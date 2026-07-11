import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
// Real signState is used to produce VALID state values for the happy-path tests below.
// This module does not exist yet (created in Plan 02) — this file is intentionally RED
// via this import (module-not-found) until BOTH oauth-state.ts AND the callback route exist.
import { signState } from '@/lib/google-ads/oauth-state'

// server-only lança erro em ambientes não-RSC (como Vitest/Node).
vi.mock('server-only', () => ({}))

const mockState = {
  vaultSecretId: null as string | null,
  vaultError: null as { message: string } | null,
  vaultRpcCalls: [] as Array<{ name: string; args: unknown }>,
  upsertCalls: [] as Array<{ payload: unknown; opts: unknown }>,
  upsertError: null as { message: string } | null,
  tokenResponse: null as { ok: boolean; json: () => Promise<unknown> } | null,
  // WR-01: callback route now requires an authenticated session before doing
  // anything else. Defaults to a logged-in user so existing state/token-exchange
  // scenarios below are unaffected; the dedicated test overrides this to null.
  user: { id: 'user-1' } as { id: string } | null,
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: () => Promise.resolve({ data: { user: mockState.user } }),
    },
  }),
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    rpc: (name: string, args: unknown) => {
      mockState.vaultRpcCalls.push({ name, args })
      return Promise.resolve({ data: mockState.vaultSecretId, error: mockState.vaultError })
    },
    from: (_table: string) => ({
      upsert: (payload: unknown, opts: unknown) => {
        mockState.upsertCalls.push({ payload, opts })
        return Promise.resolve({ error: mockState.upsertError })
      },
    }),
  }),
}))

function makeRequest(query: string) {
  return new NextRequest(`http://localhost/api/google-ads/callback?${query}`, { method: 'GET' })
}

function validTokenResponse() {
  return {
    ok: true,
    json: async () => ({
      access_token: 'ya29',
      refresh_token: '1//rt',
      expires_in: 3600,
      scope: 'https://www.googleapis.com/auth/adwords',
      token_type: 'Bearer',
    }),
  }
}

beforeEach(() => {
  process.env.GOOGLE_OAUTH_STATE_SECRET = 'test-secret-32-bytes-minimum-abcdef'
  process.env.GOOGLE_ADS_CLIENT_ID = 'test-client-id.apps.googleusercontent.com'
  process.env.GOOGLE_ADS_CLIENT_SECRET = 'test-client-secret'
  mockState.vaultSecretId = 'secret-uuid'
  mockState.vaultError = null
  mockState.vaultRpcCalls = []
  mockState.upsertCalls = []
  mockState.upsertError = null
  mockState.tokenResponse = validTokenResponse()
  mockState.user = { id: 'user-1' }
  vi.stubGlobal('fetch', vi.fn(async () => mockState.tokenResponse))
  vi.resetModules()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('GET /api/google-ads/callback', () => {
  it('no authenticated session (WR-01) → redirect to / (root), NO Vault write, NO upsert', async () => {
    mockState.user = null
    const state = signState('tenant-uuid-1', 'acme', '1234567890')
    const { GET } = await import('@/app/api/google-ads/callback/route')
    const res = await GET(makeRequest(`code=auth-code-xyz&state=${encodeURIComponent(state)}`))
    expect([302, 307]).toContain(res.status)
    const loc = res.headers.get('location')!
    expect(new URL(loc).pathname).toBe('/')
    expect(mockState.upsertCalls.length).toBe(0)
    expect(mockState.vaultRpcCalls.length).toBe(0)
  })

  it('bad-signature/unverifiable state → 3xx redirect to / (root), NO Vault write, NO upsert', async () => {
    const { GET } = await import('@/app/api/google-ads/callback/route')
    const res = await GET(makeRequest('code=auth-code-xyz&state=garbage'))
    expect([302, 307]).toContain(res.status)
    const loc = res.headers.get('location')!
    expect(new URL(loc).pathname).toBe('/')
    expect(loc).not.toContain('google_error')
    expect(mockState.upsertCalls.length).toBe(0)
    expect(mockState.vaultRpcCalls.length).toBe(0)
  })

  it('expired-but-validly-signed state → redirect to /acme/settings?google_error=state_expired, NO Vault write, NO upsert', async () => {
    vi.useFakeTimers()
    const state = signState('tenant-uuid-1', 'acme', '1234567890')
    vi.setSystemTime(Date.now() + 11 * 60 * 1000)
    const { GET } = await import('@/app/api/google-ads/callback/route')
    const res = await GET(makeRequest(`code=auth-code-xyz&state=${encodeURIComponent(state)}`))
    const loc = res.headers.get('location')!
    expect(loc).toContain('/acme/settings')
    expect(loc).toContain('google_error=state_expired')
    expect(mockState.upsertCalls.length).toBe(0)
    expect(mockState.vaultRpcCalls.length).toBe(0)
  })

  it('Google returned error param (?error=access_denied) with a valid state → redirect to /acme/settings with google_error=access_denied', async () => {
    const state = signState('tenant-uuid-1', 'acme', '1234567890')
    const { GET } = await import('@/app/api/google-ads/callback/route')
    const res = await GET(makeRequest(`error=access_denied&state=${encodeURIComponent(state)}`))
    const loc = res.headers.get('location')!
    expect(loc).toContain('/acme/settings')
    expect(loc).toContain('google_error=access_denied')
    expect(mockState.upsertCalls.length).toBe(0)
  })

  it('valid state + successful token exchange with refresh_token → Vault write + ad_accounts upsert (active:true) + redirect to /acme/settings', async () => {
    const state = signState('tenant-uuid-1', 'acme', '1234567890')
    mockState.tokenResponse = validTokenResponse()
    mockState.vaultSecretId = 'secret-uuid'
    const { GET } = await import('@/app/api/google-ads/callback/route')
    const res = await GET(makeRequest(`code=auth-code-xyz&state=${encodeURIComponent(state)}`))
    const loc = res.headers.get('location')!
    expect(loc).toContain('/acme/settings')

    expect(mockState.upsertCalls.length).toBe(1)
    const { payload, opts } = mockState.upsertCalls[0]
    expect(payload).toMatchObject({
      channel: 'google_ads',
      account_id: '1234567890', // dashes stripped from the state's customerId
      vault_secret_id: 'secret-uuid',
      active: true,
      tenant_id: 'tenant-uuid-1',
    })
    expect(opts).toEqual({ onConflict: 'tenant_id,channel' })

    expect(mockState.vaultRpcCalls.length).toBe(1)
    expect(mockState.vaultRpcCalls[0].name).toBe('create_or_update_vault_secret')
    const rpcArgs = mockState.vaultRpcCalls[0].args as { p_name: string }
    expect(rpcArgs.p_name).toContain('google_ads_token_tenant-uuid-1')
  })

  it('token exchange HTTP failure (ok:false) → redirect with google_error=token_exchange_failed, no upsert', async () => {
    const state = signState('tenant-uuid-1', 'acme', '1234567890')
    mockState.tokenResponse = { ok: false, json: async () => ({}) }
    const { GET } = await import('@/app/api/google-ads/callback/route')
    const res = await GET(makeRequest(`code=auth-code-xyz&state=${encodeURIComponent(state)}`))
    const loc = res.headers.get('location')!
    expect(loc).toContain('google_error=token_exchange_failed')
    expect(mockState.upsertCalls.length).toBe(0)
  })

  it('token response missing refresh_token → redirect with google_error=no_refresh_token, no upsert', async () => {
    const state = signState('tenant-uuid-1', 'acme', '1234567890')
    mockState.tokenResponse = {
      ok: true,
      json: async () => ({
        access_token: 'ya29',
        expires_in: 3600,
        scope: 'https://www.googleapis.com/auth/adwords',
        token_type: 'Bearer',
      }),
    }
    const { GET } = await import('@/app/api/google-ads/callback/route')
    const res = await GET(makeRequest(`code=auth-code-xyz&state=${encodeURIComponent(state)}`))
    const loc = res.headers.get('location')!
    expect(loc).toContain('google_error=no_refresh_token')
    expect(mockState.upsertCalls.length).toBe(0)
  })

  it('Vault write fails → redirect with a google_error, no upsert', async () => {
    const state = signState('tenant-uuid-1', 'acme', '1234567890')
    mockState.vaultError = { message: 'vault write failed' }
    mockState.vaultSecretId = null
    const { GET } = await import('@/app/api/google-ads/callback/route')
    const res = await GET(makeRequest(`code=auth-code-xyz&state=${encodeURIComponent(state)}`))
    const loc = res.headers.get('location')!
    expect(loc).toContain('google_error=')
    expect(mockState.upsertCalls.length).toBe(0)
  })
})
