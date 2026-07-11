import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

/**
 * AI-03 — ai_insights is accessible ONLY to super_admin. Per 04-RESEARCH.md Assumption A2 and the
 * literal AI-03 wording, there is NO tenant_admin/agency SELECT policy on this table (unlike
 * campaign_metrics/daily_rollups). This differs deliberately from the tenant-scoped tables.
 *
 * Requires a live Supabase test project with migration 0021 applied. Self-skips if
 * SUPABASE_TEST_URL is unset. Filled in by Plan 02 (schema push).
 *
 * Fixture pattern mirrors tests/integration/sync-jobs-rls.test.ts and tests/agency-rls.test.ts:
 * service_role client sets up a tenant, a tenant_admin (via tenant_users row), an agency (via
 * agency_users row), and a super_admin (app_metadata.role set directly at createUser time — the
 * Custom Access Token Hook preserves a preset 'super_admin' role, see 0005/0019). The live Auth
 * Hook was confirmed wired to the real public.custom_access_token_hook Postgres function as of
 * 2026-07-09 (.planning/debug/resolved/auth-hook-wired-to-wrong-function.md), so tenant_admin/
 * agency claims are derived from tenant_users/agency_users at sign-in, not from a preset
 * app_metadata value.
 */
const hasTestEnv = !!process.env.SUPABASE_TEST_URL && !!process.env.SUPABASE_TEST_SERVICE_KEY
const describeIfEnv = hasTestEnv ? describe : describe.skip

describeIfEnv('ai_insights RLS — super_admin only (AI-03)', () => {
  const serviceClient = createClient(
    process.env.SUPABASE_TEST_URL!,
    process.env.SUPABASE_TEST_SERVICE_KEY!
  )

  let tenantId: string
  let agencyId: string
  let insightId: string
  let superAdminUserId: string
  let tenantAdminUserId: string
  let agencyUserId: string
  const superAdminEmail = `ai-insights-rls-sa-${Date.now()}@test.nexus`
  const tenantAdminEmail = `ai-insights-rls-ta-${Date.now()}@test.nexus`
  const agencyEmail = `ai-insights-rls-ag-${Date.now()}@test.nexus`
  const password = 'TestPassword123!'

  let superAdminAccessToken: string | undefined
  let tenantAdminAccessToken: string | undefined
  let agencyAccessToken: string | undefined

  beforeAll(async () => {
    const { data: tenant } = await serviceClient
      .from('tenants')
      .insert({ name: 'ai-insights-rls-tenant', slug: `ai-insights-rls-${Date.now()}` })
      .select()
      .single()
    tenantId = tenant!.id

    const { data: agency } = await serviceClient
      .from('agencies')
      .insert({ name: 'ai-insights-rls-agency' })
      .select()
      .single()
    agencyId = agency!.id

    // ai_insights row created via service_role (bypasses RLS) — the fixture under test.
    const { data: insight } = await serviceClient
      .from('ai_insights')
      .insert({
        tenant_id: tenantId,
        source: 'on_demand',
        type: 'optimization',
        title: 'Test insight',
        summary: 'Test summary',
        impact: 'medium',
      })
      .select()
      .single()
    insightId = insight!.id

    // super_admin — role set directly on auth.users.app_metadata (hook preserves it, branch 1)
    const { data: superAdminUser } = await serviceClient.auth.admin.createUser({
      email: superAdminEmail,
      password,
      email_confirm: true,
      app_metadata: { role: 'super_admin' },
    })
    superAdminUserId = superAdminUser.user!.id

    // tenant_admin — role/tenant_id injected by the hook from tenant_users at sign-in
    const { data: tenantAdminUser } = await serviceClient.auth.admin.createUser({
      email: tenantAdminEmail,
      password,
      email_confirm: true,
      app_metadata: { role: 'tenant_admin', tenant_id: tenantId },
    })
    tenantAdminUserId = tenantAdminUser.user!.id
    await serviceClient
      .from('tenant_users')
      .insert({ tenant_id: tenantId, user_id: tenantAdminUserId, role: 'tenant_admin' })

    // agency — role/agency_id injected by the hook from agency_users at sign-in
    const { data: agencyUser } = await serviceClient.auth.admin.createUser({
      email: agencyEmail,
      password,
      email_confirm: true,
      app_metadata: { role: 'agency', agency_id: agencyId },
    })
    agencyUserId = agencyUser.user!.id
    await serviceClient.from('agency_users').insert({ agency_id: agencyId, user_id: agencyUserId })

    // Sign in on disposable clients — NEVER on serviceClient itself (would silently downgrade
    // afterAll's cleanup deletes from service_role). See
    // .planning/debug/resolved/test-tenants-leaking-into-production.md.
    const { data: superAdminSignIn } = await createClient(
      process.env.SUPABASE_TEST_URL!,
      process.env.SUPABASE_TEST_SERVICE_KEY!
    ).auth.signInWithPassword({ email: superAdminEmail, password })
    superAdminAccessToken = superAdminSignIn?.session?.access_token

    const { data: tenantAdminSignIn } = await createClient(
      process.env.SUPABASE_TEST_URL!,
      process.env.SUPABASE_TEST_SERVICE_KEY!
    ).auth.signInWithPassword({ email: tenantAdminEmail, password })
    tenantAdminAccessToken = tenantAdminSignIn?.session?.access_token

    const { data: agencySignIn } = await createClient(
      process.env.SUPABASE_TEST_URL!,
      process.env.SUPABASE_TEST_SERVICE_KEY!
    ).auth.signInWithPassword({ email: agencyEmail, password })
    agencyAccessToken = agencySignIn?.session?.access_token
  })

  afterAll(async () => {
    // Cascades remove ai_insights (tenant FK), tenant_users, agency_users.
    const logIfError = (label: string, error: { message: string } | null) => {
      if (error) console.error(`[ai-insights-rls afterAll] Failed to delete ${label}:`, error)
    }
    logIfError('tenant', (await serviceClient.from('tenants').delete().eq('id', tenantId)).error)
    logIfError('agency', (await serviceClient.from('agencies').delete().eq('id', agencyId)).error)
    if (superAdminUserId) {
      logIfError(
        'superAdminUser',
        (await serviceClient.auth.admin.deleteUser(superAdminUserId)).error
      )
    }
    if (tenantAdminUserId) {
      logIfError(
        'tenantAdminUser',
        (await serviceClient.auth.admin.deleteUser(tenantAdminUserId)).error
      )
    }
    if (agencyUserId) {
      logIfError('agencyUser', (await serviceClient.auth.admin.deleteUser(agencyUserId)).error)
    }
  })

  it('super_admin session can SELECT ai_insights rows across tenants', async () => {
    expect(superAdminAccessToken).toBeDefined()
    const client = createClient(process.env.SUPABASE_TEST_URL!, process.env.SUPABASE_TEST_SERVICE_KEY!, {
      global: { headers: { Authorization: `Bearer ${superAdminAccessToken}` } },
    })
    const { data, error } = await client.from('ai_insights').select('id').eq('id', insightId)
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
  })

  it('tenant_admin session sees zero ai_insights rows (no tenant_select policy exists)', async () => {
    expect(tenantAdminAccessToken).toBeDefined()
    const client = createClient(process.env.SUPABASE_TEST_URL!, process.env.SUPABASE_TEST_SERVICE_KEY!, {
      global: { headers: { Authorization: `Bearer ${tenantAdminAccessToken}` } },
    })
    const { data } = await client.from('ai_insights').select('id').eq('id', insightId)
    expect(data).toHaveLength(0)
  })

  it('agency session sees zero ai_insights rows', async () => {
    expect(agencyAccessToken).toBeDefined()
    const client = createClient(process.env.SUPABASE_TEST_URL!, process.env.SUPABASE_TEST_SERVICE_KEY!, {
      global: { headers: { Authorization: `Bearer ${agencyAccessToken}` } },
    })
    const { data } = await client.from('ai_insights').select('id').eq('id', insightId)
    expect(data).toHaveLength(0)
  })

  it('anon has no access (REVOKE ALL FROM anon)', async () => {
    const anonClient = createClient(
      process.env.SUPABASE_TEST_URL!,
      process.env.SUPABASE_TEST_ANON_KEY ?? process.env.SUPABASE_TEST_SERVICE_KEY!
    )
    const { data, error } = await anonClient.from('ai_insights').select('id').eq('id', insightId)
    const noAccess = error !== null || (data !== null && data.length === 0)
    expect(noAccess).toBe(true)
  })

  it('source CHECK rejects a value other than on_demand / daily (SQLSTATE 23514)', async () => {
    const { error } = await serviceClient.from('ai_insights').insert({
      tenant_id: tenantId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      source: 'weekly' as any,
      type: 'optimization',
      title: 'Invalid source',
      summary: 'Invalid source',
      impact: 'low',
    })
    expect(error).not.toBeNull()
    expect(error?.code).toBe('23514')
  })

  it('type CHECK rejects a value other than optimization / alert / opportunity', async () => {
    const { error } = await serviceClient.from('ai_insights').insert({
      tenant_id: tenantId,
      source: 'on_demand',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type: 'warning' as any,
      title: 'Invalid type',
      summary: 'Invalid type',
      impact: 'low',
    })
    expect(error).not.toBeNull()
    expect(error?.code).toBe('23514')
  })
})

describe('ai-insights-rls scaffold sanity', () => {
  it('test environment detection works', () => {
    expect(typeof hasTestEnv).toBe('boolean')
  })
})
