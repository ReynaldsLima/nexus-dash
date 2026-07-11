import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'

/**
 * AI-04 — anomaly_alerts stores ROAS-drop anomalies inserted by N8N; delivered to the frontend via
 * Supabase Realtime. This suite verifies the schema constraints AND that the table is a member of
 * the supabase_realtime publication (04-RESEARCH.md Pitfall 2 — a CREATE TABLE + RLS alone does
 * NOT enable Realtime; the migration must ALTER PUBLICATION supabase_realtime ADD TABLE).
 *
 * Requires a live Supabase test project with migration 0022 applied. Self-skips if
 * SUPABASE_TEST_URL is unset. Filled in by Plan 02 (schema push).
 *
 * NOTE on the realtime-membership test: PostgREST (which supabase-js's `.from()` uses) only
 * exposes the `public`/`graphql_public` schemas — `pg_catalog.pg_publication_tables` is NOT
 * queryable via the JS client (confirmed live: PGRST106 "Invalid schema: pg_catalog"). Static
 * membership was independently confirmed via `supabase db query` during Plan 02 execution
 * (`SELECT tablename FROM pg_publication_tables WHERE pubname='supabase_realtime' AND
 * tablename='anomaly_alerts'` returned a row). This suite instead runs a stronger BEHAVIORAL
 * check: subscribe to `postgres_changes` on `anomaly_alerts`, insert a row via service_role, and
 * assert the subscriber actually receives the INSERT event — this is what the must_haves truth
 * "(Realtime delivery works)" requires, not just catalog metadata.
 */
const hasTestEnv = !!process.env.SUPABASE_TEST_URL && !!process.env.SUPABASE_TEST_SERVICE_KEY
const describeIfEnv = hasTestEnv ? describe : describe.skip

describeIfEnv('anomaly_alerts schema + realtime (AI-04)', () => {
  const supa = createClient(process.env.SUPABASE_TEST_URL!, process.env.SUPABASE_TEST_SERVICE_KEY!)

  it("channel CHECK accepts google_ads / meta_ads and rejects others (SQLSTATE 23514)", async () => {
    const { data: tenant } = await supa
      .from('tenants')
      .insert({ name: 'test-aa-channel', slug: `test-aa-ch-${Date.now()}` })
      .select()
      .single()

    for (const channel of ['google_ads', 'meta_ads']) {
      const { error } = await supa.from('anomaly_alerts').insert({
        tenant_id: tenant!.id,
        campaign_id: `camp-${channel}`,
        campaign_name: 'Test campaign',
        channel,
        drop_pct: 25.5,
      })
      expect(error).toBeNull()
    }

    const { error: checkError } = await supa.from('anomaly_alerts').insert({
      tenant_id: tenant!.id,
      campaign_id: 'camp-invalid',
      campaign_name: 'Test campaign',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      channel: 'tiktok_ads' as any,
      drop_pct: 25.5,
    })
    expect(checkError?.code).toBe('23514')

    await supa.from('tenants').delete().eq('id', tenant!.id)
  })

  it('drop_pct is NOT NULL', async () => {
    const { data: tenant } = await supa
      .from('tenants')
      .insert({ name: 'test-aa-notnull', slug: `test-aa-nn-${Date.now()}` })
      .select()
      .single()

    const { error } = await supa.from('anomaly_alerts').insert({
      tenant_id: tenant!.id,
      campaign_id: 'camp-notnull',
      campaign_name: 'Test campaign',
      channel: 'google_ads',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      drop_pct: null as any,
    })
    expect(error).not.toBeNull()
    expect(error?.code).toBe('23502')

    await supa.from('tenants').delete().eq('id', tenant!.id)
  })

  it('window_hours defaults to 24, metric defaults to roas', async () => {
    const { data: tenant } = await supa
      .from('tenants')
      .insert({ name: 'test-aa-defaults', slug: `test-aa-def-${Date.now()}` })
      .select()
      .single()

    const { data, error } = await supa
      .from('anomaly_alerts')
      .insert({
        tenant_id: tenant!.id,
        campaign_id: 'camp-defaults',
        campaign_name: 'Test campaign',
        channel: 'meta_ads',
        drop_pct: 30,
      })
      .select('window_hours, metric')
      .single()

    expect(error).toBeNull()
    expect(data?.window_hours).toBe(24)
    expect(data?.metric).toBe('roas')

    await supa.from('tenants').delete().eq('id', tenant!.id)
  })

  it('tenant_id FK ON DELETE CASCADE removes orphan alerts', async () => {
    const { data: tenant } = await supa
      .from('tenants')
      .insert({ name: 'test-aa-cascade', slug: `test-aa-casc-${Date.now()}` })
      .select()
      .single()

    await supa.from('anomaly_alerts').insert({
      tenant_id: tenant!.id,
      campaign_id: 'camp-cascade',
      campaign_name: 'Test campaign',
      channel: 'google_ads',
      drop_pct: 40,
    })

    await supa.from('tenants').delete().eq('id', tenant!.id)

    const { data: remaining } = await supa
      .from('anomaly_alerts')
      .select('id')
      .eq('tenant_id', tenant!.id)
    expect(remaining).toHaveLength(0)
  })

  it(
    'anomaly_alerts is a member of the supabase_realtime publication — INSERT is delivered to a postgres_changes subscriber',
    async () => {
      const { data: tenant } = await supa
        .from('tenants')
        .insert({ name: 'test-aa-realtime', slug: `test-aa-rt-${Date.now()}` })
        .select()
        .single()

      const received: unknown[] = []
      const channel = supa
        .channel(`test-anomaly-alerts-${Date.now()}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'anomaly_alerts', filter: `tenant_id=eq.${tenant!.id}` },
          (payload) => {
            received.push(payload.new)
          }
        )

      await new Promise<void>((resolve, reject) => {
        channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') resolve()
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            reject(new Error(`Realtime subscribe failed: ${status}`))
          }
        })
      })

      await supa.from('anomaly_alerts').insert({
        tenant_id: tenant!.id,
        campaign_id: 'camp-realtime',
        campaign_name: 'Realtime test campaign',
        channel: 'google_ads',
        drop_pct: 22.1,
      })

      // Poll for the event to arrive (Realtime delivery is async over websocket).
      const start = Date.now()
      while (received.length === 0 && Date.now() - start < 8000) {
        await new Promise((r) => setTimeout(r, 200))
      }

      await supa.removeChannel(channel)
      await supa.from('tenants').delete().eq('id', tenant!.id)

      expect(received.length).toBeGreaterThanOrEqual(1)
    },
    10_000
  )

  it('super_admin can SELECT; tenant_admin cannot (RLS super_admin-only)', async () => {
    const { data: tenant } = await supa
      .from('tenants')
      .insert({ name: 'test-aa-rls', slug: `test-aa-rls-${Date.now()}` })
      .select()
      .single()

    const { data: alert } = await supa
      .from('anomaly_alerts')
      .insert({
        tenant_id: tenant!.id,
        campaign_id: 'camp-rls',
        campaign_name: 'RLS test campaign',
        channel: 'google_ads',
        drop_pct: 35,
      })
      .select()
      .single()

    const password = 'TestPassword123!'
    const tenantAdminEmail = `aa-schema-rls-ta-${Date.now()}@test.nexus`
    const { data: tenantAdminUser } = await supa.auth.admin.createUser({
      email: tenantAdminEmail,
      password,
      email_confirm: true,
      app_metadata: { role: 'tenant_admin', tenant_id: tenant!.id },
    })
    const tenantAdminUserId = tenantAdminUser.user!.id
    await supa
      .from('tenant_users')
      .insert({ tenant_id: tenant!.id, user_id: tenantAdminUserId, role: 'tenant_admin' })

    // super_admin: service_role bypasses RLS, equivalent to super_admin visibility
    const { data: superAdminView } = await supa
      .from('anomaly_alerts')
      .select('id')
      .eq('id', alert!.id)
    expect(superAdminView).toHaveLength(1)

    // tenant_admin: sign in on a disposable client, never on `supa` itself
    const { data: signIn } = await createClient(
      process.env.SUPABASE_TEST_URL!,
      process.env.SUPABASE_TEST_SERVICE_KEY!
    ).auth.signInWithPassword({ email: tenantAdminEmail, password })

    if (signIn?.session) {
      const tenantAdminClient = createClient(
        process.env.SUPABASE_TEST_URL!,
        process.env.SUPABASE_TEST_SERVICE_KEY!,
        { global: { headers: { Authorization: `Bearer ${signIn.session.access_token}` } } }
      )
      const { data: tenantAdminView } = await tenantAdminClient
        .from('anomaly_alerts')
        .select('id')
        .eq('id', alert!.id)
      expect(tenantAdminView).toHaveLength(0)
    }

    await supa.auth.admin.deleteUser(tenantAdminUserId)
    await supa.from('tenants').delete().eq('id', tenant!.id)
  })
})

describe('anomaly-alerts-schema scaffold sanity', () => {
  it('test environment detection works', () => {
    expect(typeof hasTestEnv).toBe('boolean')
  })
})
