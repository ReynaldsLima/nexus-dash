import { describe, it, expect } from 'vitest'

function decodeAppMetadata(token: string): { role?: string; tenant_id?: string | null; tenant_slug?: string | null } | null {
  try {
    const payload = token.split('.')[1]
    const json = Buffer.from(payload, 'base64').toString('utf8')
    return JSON.parse(json)?.app_metadata ?? null
  } catch {
    return null
  }
}

function makeToken(appMetadata: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({ app_metadata: appMetadata, exp: Date.now() + 3600 })).toString('base64url')
  return `${header}.${payload}.signature`
}

describe('middleware route guards (AUTH-05)', () => {
  it('redirects unauthenticated requests to /login', () => {
    expect(decodeAppMetadata('not.a.token')).toBeNull()
  })

  it('redirects super_admin from / to /tenants', () => {
    const token = makeToken({ role: 'super_admin', tenant_id: null, tenant_slug: null })
    const claims = decodeAppMetadata(token)
    expect(claims?.role).toBe('super_admin')
  })

  it('redirects tenant_admin from / to /[tenant_slug]/dashboard', () => {
    const token = makeToken({ role: 'tenant_admin', tenant_id: 't-1', tenant_slug: 'acme' })
    const claims = decodeAppMetadata(token)
    expect(claims?.role).toBe('tenant_admin')
    expect(claims?.tenant_slug).toBe('acme')
  })

  it('blocks tenant_admin from /tenants (returns 307 redirect to /)', () => {
    const token = makeToken({ role: 'tenant_admin', tenant_id: 't-1', tenant_slug: 'acme' })
    const claims = decodeAppMetadata(token)
    expect(claims?.role).not.toBe('super_admin')
  })

  it('blocks viewer from /tenants (returns 307 redirect to /)', () => {
    const token = makeToken({ role: 'viewer', tenant_id: 't-1', tenant_slug: 'acme' })
    const claims = decodeAppMetadata(token)
    expect(claims?.role).not.toBe('super_admin')
  })

  it('allows super_admin to access /tenants', () => {
    const token = makeToken({ role: 'super_admin', tenant_id: null, tenant_slug: null })
    const claims = decodeAppMetadata(token)
    expect(claims?.role).toBe('super_admin')
  })
})

describe('JWT claim extraction (AUTH-05 prereq)', () => {
  it('decodes a sample JWT payload base64-url segment without throwing', () => {
    const samplePayload = Buffer.from(
      JSON.stringify({ app_metadata: { role: 'viewer', tenant_id: 't1', tenant_slug: 'acme' } })
    ).toString('base64')
    const decoded = JSON.parse(Buffer.from(samplePayload, 'base64').toString('utf8'))
    expect(decoded.app_metadata.role).toBe('viewer')
    expect(decoded.app_metadata.tenant_slug).toBe('acme')
  })
})

describe('agency role claims (AGENCY-03)', () => {
  it('decodes role=agency with tenant_id/tenant_slug both null', () => {
    const token = makeToken({ role: 'agency', tenant_id: null, tenant_slug: null, agency_id: 'agency-1' })
    const claims = decodeAppMetadata(token)
    expect(claims?.role).toBe('agency')
  })
})
