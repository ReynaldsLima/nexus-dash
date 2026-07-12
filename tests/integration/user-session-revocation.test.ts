import { describe, it, expect, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

/**
 * USER-05 — proves public.revoke_user_sessions(uuid) (migration 0023) actually revokes a
 * user's refresh capability server-side, not merely "the RPC was called without throwing."
 *
 * Why this matters (10-RESEARCH.md Critical Finding / Pitfall 1): there is no supabase-js
 * Admin API method that revokes an arbitrary OTHER user's sessions by user ID —
 * `supabase.auth.admin.signOut(jwt, scope)` requires the TARGET user's own JWT, which a
 * Super Admin removing someone else's access never has. Migration 0023 adds a SECURITY
 * DEFINER Postgres function instead, deleting rows from auth.sessions (confirmed live to
 * cascade to auth.refresh_tokens via refresh_tokens_session_id_fkey ON DELETE CASCADE — see
 * 0023's migration comment). This test signs in a real disposable test user to obtain a real
 * refresh_token, calls the RPC via a service-role client, then attempts to use the
 * PRE-revocation refresh_token to mint a new access token — the only way to prove the
 * revocation's SERVER-SIDE effect (10-RESEARCH.md Pitfall 2: this does NOT invalidate an
 * already-issued, unexpired access token — stateless JWT, checked only for signature+expiry).
 *
 * Requires a live Supabase project with migration 0023 applied. Self-skips (describe.skip)
 * when SUPABASE_TEST_URL / SUPABASE_TEST_SERVICE_KEY are unset, mirroring
 * tests/agency-rls.test.ts / tests/integration/sync-jobs-rls.test.ts.
 */
const hasTestEnv = !!process.env.SUPABASE_TEST_URL && !!process.env.SUPABASE_TEST_SERVICE_KEY
const describeIfEnv = hasTestEnv ? describe : describe.skip

describeIfEnv('USER-05 — revoke_user_sessions revokes refresh capability', () => {
  const serviceClient = createClient(
    process.env.SUPABASE_TEST_URL!,
    process.env.SUPABASE_TEST_SERVICE_KEY!
  )

  let userId: string | undefined
  const email = `test-revoke-${Date.now()}@example.com`
  const password = 'TestPassword123!ABCDEF'

  afterAll(async () => {
    // serviceClient must still be authenticated as service_role at this point — never sign in
    // on serviceClient itself (see tests/agency-rls.test.ts's afterAll comment for the incident
    // this guards against: .planning/debug/resolved/test-tenants-leaking-into-production.md).
    if (userId) {
      const { error } = await serviceClient.auth.admin.deleteUser(userId)
      if (error) console.error('[user-session-revocation afterAll] Failed to delete user:', error)
    }
  })

  it('a pre-revocation refresh token can no longer mint a new access token after revoke_user_sessions runs', async () => {
    // 1. Create a real test user via the service-role client.
    const { data: createdUser, error: createError } = await serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    expect(createError).toBeNull()
    userId = createdUser?.user?.id
    expect(userId).toBeDefined()

    // 2. Sign in on a DISPOSABLE client (never serviceClient) to obtain a real refresh_token.
    const signInClient = createClient(
      process.env.SUPABASE_TEST_URL!,
      process.env.SUPABASE_TEST_SERVICE_KEY!
    )
    const { data: signInData, error: signInError } = await signInClient.auth.signInWithPassword({
      email,
      password,
    })
    expect(signInError).toBeNull()
    const refreshToken = signInData?.session?.refresh_token
    expect(refreshToken).toBeDefined()

    // 3. Call revoke_user_sessions via the service-role client — proves the RPC itself succeeds.
    const { error: rpcError } = await serviceClient.rpc('revoke_user_sessions', {
      target_user_id: userId,
    })
    expect(rpcError).toBeNull()

    // 4. Attempt to use the PRE-revocation refresh token to mint a new access token — this is
    // the actual proof of server-side effect (not just "the RPC was called").
    const freshClient = createClient(
      process.env.SUPABASE_TEST_URL!,
      process.env.SUPABASE_TEST_SERVICE_KEY!
    )
    const { data: refreshData, error: refreshError } = await freshClient.auth.refreshSession({
      refresh_token: refreshToken!,
    })

    expect(refreshError).not.toBeNull()
    expect(refreshData?.session).toBeNull()
  })
})

describe('user-session-revocation scaffold sanity', () => {
  it('test environment detection works', () => {
    expect(typeof hasTestEnv).toBe('boolean')
  })
})
