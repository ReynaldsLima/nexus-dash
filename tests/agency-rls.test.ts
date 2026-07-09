import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

/**
 * AGENCY-06 — RLS enforces agency access at the database level via agency_tenants grants.
 * AGENCY-03/04 — Agency-scoped tenant list resolution (loadTenantsForSwitcher) returns
 * exactly the granted set, nothing more.
 *
 * Per 05-CONTEXT.md D-01, an agency user must see ONLY tenants explicitly granted via
 * agency_tenants — never all tenants, never zero if a grant exists.
 * Per 05-RESEARCH.md, filtering direction is tenant_id IN (SELECT ... WHERE agency_id = caller)
 * — the fast direction per Supabase RLS performance guidance.
 *
 * These integration tests require a live Supabase project (staging schema) with migrations
 * 0017-0019 applied. They self-skip if SUPABASE_TEST_URL is unset so the scaffold phase passes.
 *
 * Fixture pattern mirrors tests/integration/sync-jobs-rls.test.ts: service_role client sets up
 * fixtures (tenants, agency, agency_tenants grants, an auth user with `app_metadata: { role:
 * 'agency', agency_id }` set DIRECTLY at `admin.createUser()` time — same technique
 * sync-jobs-rls.test.ts uses for `role`/`tenant_id`), then a signed-in client scoped by that JWT
 * is used to confirm `_agency_select` RLS policy row visibility.
 *
 * IMPORTANT deviation note (see 05-02-SUMMARY.md "Deviations"): this project's LIVE Auth Hook
 * (Supabase Dashboard → Authentication → Hooks) is currently wired to an HTTP Edge Function
 * (`supabase/functions/custom-access-token`) instead of the `public.custom_access_token_hook`
 * Postgres function that migrations 0005/0019 maintain — confirmed via the Management API
 * (`hook_custom_access_token_uri` points at the Edge Function, not `pg-functions://...`). That
 * Edge Function does not look up `agency_users`/`tenant_users` at all; it only echoes whatever
 * `app_metadata` a user already has. Presetting `app_metadata` at `createUser()` time (as done
 * below) verifies the `_agency_select` RLS POLICIES correctly — which is this file's actual
 * target (AGENCY-06) — independent of that pre-existing, out-of-scope hook-wiring bug. The
 * hook-wiring bug itself is flagged for the user in 05-02-SUMMARY.md and NOT fixed here (Rule 4
 * — changing production Auth Hook config affects every authenticated session in the live app).
 *
 * Filled in by Plan 02 (agency data layer) verification step.
 */
const hasTestEnv = !!process.env.SUPABASE_TEST_URL && !!process.env.SUPABASE_TEST_SERVICE_KEY
const describeIfEnv = hasTestEnv ? describe : describe.skip

describeIfEnv('Agency-scoped RLS (AGENCY-06)', () => {
  const serviceClient = createClient(
    process.env.SUPABASE_TEST_URL!,
    process.env.SUPABASE_TEST_SERVICE_KEY!
  )

  let agencyId: string
  let emptyAgencyId: string
  let tenantGrantedId: string
  let tenantUngrantedId: string
  let tenantRevokedId: string
  let tenantInactiveId: string
  let agencyUserId: string
  let emptyAgencyUserId: string
  let superAdminUserId: string
  const agencyEmail = `agency-rls-${Date.now()}@test.nexus`
  const emptyAgencyEmail = `agency-rls-empty-${Date.now()}@test.nexus`
  const superAdminEmail = `agency-rls-sa-${Date.now()}@test.nexus`
  const password = 'TestPassword123!'

  let agencyAccessToken: string | undefined
  let superAdminAccessToken: string | undefined

  beforeAll(async () => {
    // Agency with grants
    const { data: agency } = await serviceClient
      .from('agencies')
      .insert({ name: 'rls-test-agency' })
      .select()
      .single()
    agencyId = agency!.id

    // Agency with zero grants
    const { data: emptyAgency } = await serviceClient
      .from('agencies')
      .insert({ name: 'rls-test-agency-empty' })
      .select()
      .single()
    emptyAgencyId = emptyAgency!.id

    // Tenants
    const { data: tenantGranted } = await serviceClient
      .from('tenants')
      .insert({ name: 'rls-agency-tenant-granted', slug: `rls-agency-tg-${Date.now()}` })
      .select()
      .single()
    tenantGrantedId = tenantGranted!.id

    const { data: tenantUngranted } = await serviceClient
      .from('tenants')
      .insert({ name: 'rls-agency-tenant-ungranted', slug: `rls-agency-tu-${Date.now()}` })
      .select()
      .single()
    tenantUngrantedId = tenantUngranted!.id

    const { data: tenantRevoked } = await serviceClient
      .from('tenants')
      .insert({ name: 'rls-agency-tenant-revoked', slug: `rls-agency-tr-${Date.now()}` })
      .select()
      .single()
    tenantRevokedId = tenantRevoked!.id

    const { data: tenantInactive } = await serviceClient
      .from('tenants')
      .insert({
        name: 'rls-agency-tenant-inactive',
        slug: `rls-agency-ti-${Date.now()}`,
        active: false,
      })
      .select()
      .single()
    tenantInactiveId = tenantInactive!.id

    // Grants: granted + revoked (inserted then deleted below) + inactive (still granted)
    await serviceClient.from('agency_tenants').insert([
      { agency_id: agencyId, tenant_id: tenantGrantedId },
      { agency_id: agencyId, tenant_id: tenantRevokedId },
      { agency_id: agencyId, tenant_id: tenantInactiveId },
    ])

    // Revoke the "revoked" grant immediately — simulates a grant that existed then was removed
    await serviceClient
      .from('agency_tenants')
      .delete()
      .eq('agency_id', agencyId)
      .eq('tenant_id', tenantRevokedId)

    // campaign_metrics fixtures for the agency_select policy check on a tenant-scoped table
    await serviceClient.from('campaign_metrics').insert([
      {
        tenant_id: tenantGrantedId,
        campaign_id: 'rls-agency-campaign-granted',
        campaign_name: 'Granted Campaign',
        channel: 'google_ads',
        date: '2026-01-01',
      },
      {
        tenant_id: tenantUngrantedId,
        campaign_id: 'rls-agency-campaign-ungranted',
        campaign_name: 'Ungranted Campaign',
        channel: 'google_ads',
        date: '2026-01-01',
      },
    ])

    // Agency user — app_metadata preset directly at createUser time (same technique
    // sync-jobs-rls.test.ts uses for tenant_admin/tenant_id) so the JWT carries
    // role='agency'/agency_id regardless of the live Auth Hook's wiring (see file-level
    // comment above). The agency_users row is still inserted for DB-level consistency with
    // the documented design (Plan 05's Server Actions will rely on this table existing).
    const { data: agencyUser } = await serviceClient.auth.admin.createUser({
      email: agencyEmail,
      password,
      email_confirm: true,
      app_metadata: { role: 'agency', agency_id: agencyId },
    })
    agencyUserId = agencyUser.user!.id
    await serviceClient.from('agency_users').insert({ agency_id: agencyId, user_id: agencyUserId })

    // Empty-agency user — belongs to an agency with zero agency_tenants grants
    const { data: emptyAgencyUser } = await serviceClient.auth.admin.createUser({
      email: emptyAgencyEmail,
      password,
      email_confirm: true,
      app_metadata: { role: 'agency', agency_id: emptyAgencyId },
    })
    emptyAgencyUserId = emptyAgencyUser.user!.id
    await serviceClient
      .from('agency_users')
      .insert({ agency_id: emptyAgencyId, user_id: emptyAgencyUserId })

    // Super admin user — role flagged directly in auth.users.app_metadata (0005/0019 branch 1)
    const { data: superAdminUser } = await serviceClient.auth.admin.createUser({
      email: superAdminEmail,
      password,
      email_confirm: true,
      app_metadata: { role: 'super_admin' },
    })
    superAdminUserId = superAdminUser.user!.id

    // Sign in to obtain hook-processed JWTs.
    // IMPORTANT: always sign in on a disposable client, NEVER on serviceClient
    // itself — signing in on serviceClient overwrites its session and silently
    // downgrades every later serviceClient.from(...) call (including afterAll's
    // cleanup deletes) from service_role to whichever user last signed in. See
    // .planning/debug/resolved/test-tenants-leaking-into-production.md.
    const { data: agencySignIn } = await createClient(
      process.env.SUPABASE_TEST_URL!,
      process.env.SUPABASE_TEST_SERVICE_KEY!
    ).auth.signInWithPassword({
      email: agencyEmail,
      password,
    })
    agencyAccessToken = agencySignIn?.session?.access_token

    const { data: superAdminSignIn } = await createClient(
      process.env.SUPABASE_TEST_URL!,
      process.env.SUPABASE_TEST_SERVICE_KEY!
    ).auth.signInWithPassword({
      email: superAdminEmail,
      password,
    })
    superAdminAccessToken = superAdminSignIn?.session?.access_token
  })

  afterAll(async () => {
    // Cascades remove agency_tenants, agency_users, campaign_metrics, tenant_users.
    // serviceClient must still be authenticated as service_role at this point —
    // see the beforeAll comment above for why sign-ins must never touch it.
    const logIfError = (label: string, error: { message: string } | null) => {
      if (error) console.error(`[agency-rls afterAll] Failed to delete ${label}:`, error)
    }
    logIfError('agency', (await serviceClient.from('agencies').delete().eq('id', agencyId)).error)
    logIfError(
      'emptyAgency',
      (await serviceClient.from('agencies').delete().eq('id', emptyAgencyId)).error
    )
    logIfError(
      'tenantGranted',
      (await serviceClient.from('tenants').delete().eq('id', tenantGrantedId)).error
    )
    logIfError(
      'tenantUngranted',
      (await serviceClient.from('tenants').delete().eq('id', tenantUngrantedId)).error
    )
    logIfError(
      'tenantRevoked',
      (await serviceClient.from('tenants').delete().eq('id', tenantRevokedId)).error
    )
    logIfError(
      'tenantInactive',
      (await serviceClient.from('tenants').delete().eq('id', tenantInactiveId)).error
    )
    if (agencyUserId) {
      logIfError('agencyUser', (await serviceClient.auth.admin.deleteUser(agencyUserId)).error)
    }
    if (emptyAgencyUserId) {
      logIfError(
        'emptyAgencyUser',
        (await serviceClient.auth.admin.deleteUser(emptyAgencyUserId)).error
      )
    }
    if (superAdminUserId) {
      logIfError(
        'superAdminUser',
        (await serviceClient.auth.admin.deleteUser(superAdminUserId)).error
      )
    }
  })

  function agencyScopedClient() {
    return createClient(process.env.SUPABASE_TEST_URL!, process.env.SUPABASE_TEST_SERVICE_KEY!, {
      global: { headers: { Authorization: `Bearer ${agencyAccessToken}` } },
    })
  }

  it('agency user sees only tenants present in agency_tenants for their agency_id', async () => {
    expect(agencyAccessToken).toBeDefined()
    const { data } = await agencyScopedClient().from('tenants').select('id')
    const ids = (data ?? []).map((t) => t.id)
    expect(ids).toContain(tenantGrantedId)
    expect(ids).not.toContain(tenantUngrantedId)
  })

  it('agency user sees 0 tenant rows when agency_tenants has no grants for them', async () => {
    // Sign in on a disposable client — never serviceClient itself (see afterAll comment).
    const { data: emptySignIn } = await createClient(
      process.env.SUPABASE_TEST_URL!,
      process.env.SUPABASE_TEST_SERVICE_KEY!
    ).auth.signInWithPassword({
      email: emptyAgencyEmail,
      password,
    })
    const emptyAgencyClient = createClient(
      process.env.SUPABASE_TEST_URL!,
      process.env.SUPABASE_TEST_SERVICE_KEY!,
      {
        global: {
          headers: { Authorization: `Bearer ${emptySignIn?.session?.access_token}` },
        },
      }
    )
    const { data } = await emptyAgencyClient.from('tenants').select('id')
    expect(data).toHaveLength(0)
  })

  it('agency user sees 0 rows for a tenant that was granted then revoked', async () => {
    const { data } = await agencyScopedClient()
      .from('tenants')
      .select('id')
      .eq('id', tenantRevokedId)
    expect(data).toHaveLength(0)
  })

  it('agency user sees 0 rows for a granted tenant that is active=false (soft-deleted)', async () => {
    const { data } = await agencyScopedClient()
      .from('tenants')
      .select('id')
      .eq('id', tenantInactiveId)
    expect(data).toHaveLength(0)
  })

  it('agency_select policy does not expose rows from campaign_metrics for an ungranted tenant_id', async () => {
    const client = agencyScopedClient()
    const { data: ungranted } = await client
      .from('campaign_metrics')
      .select('id')
      .eq('tenant_id', tenantUngrantedId)
    expect(ungranted).toHaveLength(0)

    const { data: granted } = await client
      .from('campaign_metrics')
      .select('id')
      .eq('tenant_id', tenantGrantedId)
    expect(granted!.length).toBeGreaterThanOrEqual(1)
  })

  it('super_admin still sees all tenants regardless of agency_tenants contents (existing policy unaffected)', async () => {
    expect(superAdminAccessToken).toBeDefined()
    const superAdminClient = createClient(
      process.env.SUPABASE_TEST_URL!,
      process.env.SUPABASE_TEST_SERVICE_KEY!,
      { global: { headers: { Authorization: `Bearer ${superAdminAccessToken}` } } }
    )
    const { data } = await superAdminClient
      .from('tenants')
      .select('id')
      .in('id', [tenantGrantedId, tenantUngrantedId, tenantRevokedId, tenantInactiveId])
    const ids = (data ?? []).map((t) => t.id)
    // super_admin_all policy has no agency_tenants dependency — sees granted AND ungranted alike
    expect(ids).toContain(tenantGrantedId)
    expect(ids).toContain(tenantUngrantedId)
    expect(ids).toContain(tenantRevokedId)
    expect(ids).toContain(tenantInactiveId)
  })
})

describeIfEnv('Agency-scoped tenant list resolution (AGENCY-03/04)', () => {
  const serviceClient = createClient(
    process.env.SUPABASE_TEST_URL!,
    process.env.SUPABASE_TEST_SERVICE_KEY!
  )

  let agencyId: string
  let grantedTenantId: string
  let otherTenantId: string
  let agencyUserId: string
  const email = `agency-switcher-${Date.now()}@test.nexus`
  const password = 'TestPassword123!'
  let accessToken: string | undefined

  beforeAll(async () => {
    const { data: agency } = await serviceClient
      .from('agencies')
      .insert({ name: 'rls-test-agency-switcher' })
      .select()
      .single()
    agencyId = agency!.id

    const { data: granted } = await serviceClient
      .from('tenants')
      .insert({ name: 'switcher-granted', slug: `switcher-g-${Date.now()}` })
      .select()
      .single()
    grantedTenantId = granted!.id

    const { data: other } = await serviceClient
      .from('tenants')
      .insert({ name: 'switcher-other', slug: `switcher-o-${Date.now()}` })
      .select()
      .single()
    otherTenantId = other!.id

    await serviceClient
      .from('agency_tenants')
      .insert({ agency_id: agencyId, tenant_id: grantedTenantId })

    const { data: user } = await serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role: 'agency', agency_id: agencyId },
    })
    agencyUserId = user.user!.id
    await serviceClient.from('agency_users').insert({ agency_id: agencyId, user_id: agencyUserId })

    // Sign in on a disposable client — never serviceClient itself. Doing so would
    // overwrite serviceClient's session and silently downgrade afterAll's cleanup
    // deletes from service_role to this signed-in user's role (see
    // .planning/debug/resolved/test-tenants-leaking-into-production.md).
    const { data: signIn } = await createClient(
      process.env.SUPABASE_TEST_URL!,
      process.env.SUPABASE_TEST_SERVICE_KEY!
    ).auth.signInWithPassword({ email, password })
    accessToken = signIn?.session?.access_token
  })

  afterAll(async () => {
    const logIfError = (label: string, error: { message: string } | null) => {
      if (error) console.error(`[agency-rls switcher afterAll] Failed to delete ${label}:`, error)
    }
    logIfError('agency', (await serviceClient.from('agencies').delete().eq('id', agencyId)).error)
    logIfError(
      'grantedTenant',
      (await serviceClient.from('tenants').delete().eq('id', grantedTenantId)).error
    )
    logIfError(
      'otherTenant',
      (await serviceClient.from('tenants').delete().eq('id', otherTenantId)).error
    )
    if (agencyUserId) {
      logIfError('agencyUser', (await serviceClient.auth.admin.deleteUser(agencyUserId)).error)
    }
  })

  it('loadTenantsForSwitcher-equivalent query returns granted tenants when called with an agency JWT', async () => {
    expect(accessToken).toBeDefined()
    const client = createClient(process.env.SUPABASE_TEST_URL!, process.env.SUPABASE_TEST_SERVICE_KEY!, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    })
    // Same shape as the tenant switcher query: id + name, ordered by name — no service_role.
    const { data } = await client.from('tenants').select('id, name').order('name')
    const ids = (data ?? []).map((t) => t.id)
    expect(ids).toContain(grantedTenantId)
    expect(ids).not.toContain(otherTenantId)
  })
})

describe('agency-rls scaffold sanity', () => {
  it('test environment detection works', () => {
    expect(typeof hasTestEnv).toBe('boolean')
  })
})
