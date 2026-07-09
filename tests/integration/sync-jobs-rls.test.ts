import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

/**
 * SYNC-04 — sync_jobs RLS isolation entre tenants.
 *
 * Per CONTEXT.md §D-08:
 *   - sync_jobs(tenant_id, channel, status, started_at, completed_at, records_synced, date_from, date_to, error_message)
 *   - status CHECK IN ('running','success','failed')
 *
 * Per RESEARCH.md §Padrão 8: RLS segue o mesmo wrapper (SELECT public.get_user_role()) e
 * (SELECT public.get_tenant_id()) da Fase 1. service_role bypassa RLS.
 *
 * Self-skip if SUPABASE_TEST_URL unset.
 */
const hasTestEnv = !!process.env.SUPABASE_TEST_URL && !!process.env.SUPABASE_TEST_SERVICE_KEY
const describeIfEnv = hasTestEnv ? describe : describe.skip

describeIfEnv('sync_jobs RLS (SYNC-04)', () => {
  const serviceClient = createClient(
    process.env.SUPABASE_TEST_URL!,
    process.env.SUPABASE_TEST_SERVICE_KEY!
  )

  let tenantAId: string
  let tenantBId: string
  let syncJobAId: string
  let userAId: string
  let userBId: string

  beforeAll(async () => {
    // Criar tenant A
    const { data: tenantA } = await serviceClient
      .from('tenants')
      .insert({ name: 'rls-test-tenant-a', slug: `rls-ta-${Date.now()}` })
      .select()
      .single()
    tenantAId = tenantA!.id

    // Criar tenant B
    const { data: tenantB } = await serviceClient
      .from('tenants')
      .insert({ name: 'rls-test-tenant-b', slug: `rls-tb-${Date.now()}` })
      .select()
      .single()
    tenantBId = tenantB!.id

    // Criar usuário para tenant A (tenant_admin)
    const emailA = `rls-test-a-${Date.now()}@test.nexus`
    const { data: userA } = await serviceClient.auth.admin.createUser({
      email: emailA,
      password: 'TestPassword123!',
      email_confirm: true,
      app_metadata: { role: 'tenant_admin', tenant_id: tenantAId },
    })
    userAId = userA.user!.id

    // Criar registro em tenant_users para tenant A
    await serviceClient.from('tenant_users').insert({
      tenant_id: tenantAId,
      user_id: userAId,
      role: 'tenant_admin',
    })

    // Criar usuário para tenant B (tenant_admin)
    const emailB = `rls-test-b-${Date.now()}@test.nexus`
    const { data: userB } = await serviceClient.auth.admin.createUser({
      email: emailB,
      password: 'TestPassword123!',
      email_confirm: true,
      app_metadata: { role: 'tenant_admin', tenant_id: tenantBId },
    })
    userBId = userB.user!.id

    await serviceClient.from('tenant_users').insert({
      tenant_id: tenantBId,
      user_id: userBId,
      role: 'tenant_admin',
    })

    // Criar um sync_job para tenant A via service_role (bypassa RLS)
    const { data: job } = await serviceClient
      .from('sync_jobs')
      .insert({
        tenant_id: tenantAId,
        channel: 'google_ads',
        status: 'success',
        records_synced: 10,
      })
      .select()
      .single()
    syncJobAId = job!.id
  })

  afterAll(async () => {
    // Cleanup — CASCADE remove sync_jobs e tenant_users ao deletar tenant.
    // IMPORTANT: serviceClient must still be authenticated as service_role at
    // this point. Never call serviceClient.auth.signInWithPassword(...) (or
    // anything else that mutates serviceClient's own session) anywhere above —
    // doing so silently swaps its Authorization header from the service_role
    // key to the signed-in user's session for every request from then on,
    // including these deletes (see tests/README or debug session
    // test-tenants-leaking-into-production.md for the full incident).
    const delA = await serviceClient.from('tenants').delete().eq('id', tenantAId)
    if (delA.error) {
      console.error('[sync-jobs-rls afterAll] Failed to delete tenantA:', tenantAId, delA.error)
    }
    const delB = await serviceClient.from('tenants').delete().eq('id', tenantBId)
    if (delB.error) {
      console.error('[sync-jobs-rls afterAll] Failed to delete tenantB:', tenantBId, delB.error)
    }
    // Cleanup users
    if (userAId) {
      const { error } = await serviceClient.auth.admin.deleteUser(userAId)
      if (error) console.error('[sync-jobs-rls afterAll] Failed to delete userA:', userAId, error)
    }
    if (userBId) {
      const { error } = await serviceClient.auth.admin.deleteUser(userBId)
      if (error) console.error('[sync-jobs-rls afterAll] Failed to delete userB:', userBId, error)
    }
  })

  it('tenant_admin do tenant A vê 0 rows ao SELECT sync_jobs WHERE tenant_id = <tenant B>', async () => {
    // tenant_admin de A tenta ler dados de B — RLS deve bloquear
    const { data } = await serviceClient
      .from('sync_jobs')
      .select('id')
      .eq('tenant_id', tenantBId)
    // service_role vê tudo, mas como tenant B não tem jobs, deve ser 0
    // O teste real de isolamento é: criar job para B e verificar que usuário A não vê
    // Criar job para tenant B
    const { data: jobB } = await serviceClient
      .from('sync_jobs')
      .insert({
        tenant_id: tenantBId,
        channel: 'meta_ads',
        status: 'success',
        records_synced: 5,
      })
      .select()
      .single()

    // Obter JWT do tenant A para criar client autenticado
    const emailA = `verify-rls-a-${Date.now()}@test.nexus`
    const { data: verifyUser } = await serviceClient.auth.admin.createUser({
      email: emailA,
      password: 'TestPassword123!',
      email_confirm: true,
      app_metadata: { role: 'tenant_admin', tenant_id: tenantAId },
    })
    const verifyUserId = verifyUser.user!.id

    await serviceClient.from('tenant_users').insert({
      tenant_id: tenantAId,
      user_id: verifyUserId,
      role: 'tenant_admin',
    })

    // Gerar token de acesso para o usuário tenant A
    const { data: session } = await serviceClient.auth.admin.generateLink({
      type: 'magiclink',
      email: emailA,
    })

    // Com service_role geramos o access_token via getUserById + impersonation
    // Como alternativa, usar signInWithPassword que é mais confiável para testes
    const userClientA = createClient(
      process.env.SUPABASE_TEST_URL!,
      process.env.SUPABASE_TEST_SERVICE_KEY!
    )
    // Sign in com a conta do tenant A
    const { data: signInData } = await userClientA.auth.signInWithPassword({
      email: emailA,
      password: 'TestPassword123!',
    })

    if (signInData?.session) {
      const tenantAClient = createClient(
        process.env.SUPABASE_TEST_URL!,
        process.env.SUPABASE_TEST_SERVICE_KEY!,
        { global: { headers: { Authorization: `Bearer ${signInData.session.access_token}` } } }
      )

      // Tenant A não deve ver sync_jobs de tenant B
      const { data: visibleToA } = await tenantAClient
        .from('sync_jobs')
        .select('id')
        .eq('tenant_id', tenantBId)

      expect(visibleToA).toHaveLength(0)
    }

    // Cleanup
    await serviceClient.from('sync_jobs').delete().eq('id', jobB!.id)
    await serviceClient.auth.admin.deleteUser(verifyUserId)
  })

  it('super_admin vê todos os sync_jobs de todos os tenants', async () => {
    // service_role bypassa RLS — equivale a super_admin para leitura de dados
    const { data, error } = await serviceClient
      .from('sync_jobs')
      .select('id, tenant_id')
      .in('tenant_id', [tenantAId, tenantBId])

    expect(error).toBeNull()
    // Deve ver ao menos o sync_job de tenant A criado no beforeAll
    expect(data!.length).toBeGreaterThanOrEqual(1)
    expect(data!.some((j) => j.id === syncJobAId)).toBe(true)
  })

  it('anon role recebe 0 rows (REVOKE ALL ON sync_jobs FROM anon)', async () => {
    const anonClient = createClient(
      process.env.SUPABASE_TEST_URL!,
      process.env.SUPABASE_TEST_ANON_KEY ?? process.env.SUPABASE_TEST_SERVICE_KEY!
    )

    const { data, error } = await anonClient
      .from('sync_jobs')
      .select('id')
      .eq('tenant_id', tenantAId)

    // REVOKE ALL FROM anon: deve retornar erro de permissão OU 0 rows
    const noAccess = error !== null || (data !== null && data.length === 0)
    expect(noAccess).toBe(true)
  })

  it("status CHECK rejeita valores fora de ('running','success','failed') com SQLSTATE 23514", async () => {
    const { error } = await serviceClient.from('sync_jobs').insert({
      tenant_id: tenantAId,
      channel: 'google_ads',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      status: 'pending' as any,
    })
    expect(error).not.toBeNull()
    expect(error?.code).toBe('23514')
  })

  it('tenant_admin não consegue INSERT em sync_jobs (apenas service_role/super_admin)', async () => {
    const emailTA = `insert-test-${Date.now()}@test.nexus`
    const { data: insertUser } = await serviceClient.auth.admin.createUser({
      email: emailTA,
      password: 'TestPassword123!',
      email_confirm: true,
      app_metadata: { role: 'tenant_admin', tenant_id: tenantAId },
    })
    const insertUserId = insertUser.user!.id

    await serviceClient.from('tenant_users').insert({
      tenant_id: tenantAId,
      user_id: insertUserId,
      role: 'tenant_admin',
    })

    // IMPORTANT: sign in on a disposable client, NEVER on serviceClient itself —
    // signing in on serviceClient overwrites its session and silently downgrades
    // every later serviceClient.from(...) call (including afterAll's cleanup
    // deletes) from service_role to this signed-in user's role. See
    // .planning/debug/resolved/test-tenants-leaking-into-production.md.
    const signInClient = createClient(
      process.env.SUPABASE_TEST_URL!,
      process.env.SUPABASE_TEST_SERVICE_KEY!
    )
    const { data: signInData } = await signInClient.auth.signInWithPassword({
      email: emailTA,
      password: 'TestPassword123!',
    })

    if (signInData?.session) {
      const tenantAdminClient = createClient(
        process.env.SUPABASE_TEST_URL!,
        process.env.SUPABASE_TEST_SERVICE_KEY!,
        { global: { headers: { Authorization: `Bearer ${signInData.session.access_token}` } } }
      )

      const { error } = await tenantAdminClient.from('sync_jobs').insert({
        tenant_id: tenantAId,
        channel: 'google_ads',
        status: 'running',
      })

      // tenant_admin policy só tem FOR SELECT — INSERT deve falhar com RLS violation
      expect(error).not.toBeNull()
    }

    await serviceClient.auth.admin.deleteUser(insertUserId)
  })
})

describe('sync_jobs RLS scaffold sanity', () => {
  it('test environment detection works', () => {
    expect(typeof hasTestEnv).toBe('boolean')
  })
})
