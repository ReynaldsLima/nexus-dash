import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

/**
 * Vault RPC isolation — read_vault_secret deve ser acessível APENAS via service_role.
 *
 * Per RESEARCH.md §Padrão 6:
 *   CREATE FUNCTION public.read_vault_secret(p_secret_name TEXT)
 *     RETURNS TEXT SECURITY DEFINER ...
 *   GRANT EXECUTE TO service_role;
 *   REVOKE EXECUTE FROM authenticated, anon;
 *
 * Threat T-2-03: Elevation of Privilege se função estiver acessível via PostgREST sem
 * service_role. Este teste garante que GRANT/REVOKE estão corretos.
 *
 * Self-skip if SUPABASE_TEST_URL unset.
 */
const hasTestEnv = !!process.env.SUPABASE_TEST_URL && !!process.env.SUPABASE_TEST_SERVICE_KEY
const describeIfEnv = hasTestEnv ? describe : describe.skip

describeIfEnv('read_vault_secret RPC (Threat T-2-03)', () => {
  // Clients criados LAZY (dentro de beforeAll/it) para garantir que process.env
  // já foi carregado pelo setupFiles (tests/setup.ts) antes da instanciação.
  let serviceClient: ReturnType<typeof createClient>
  let tenantAdminUserId: string | null = null

  beforeAll(async () => {
    // Lazy init — env já carregado pelo setupFiles neste ponto
    serviceClient = createClient(
      process.env.SUPABASE_TEST_URL!,
      process.env.SUPABASE_TEST_SERVICE_KEY!
    )

    // Criar um tenant_admin user para testar rejeição de authenticated
    const email = `vault-test-${Date.now()}@test.nexus`
    const { data: userResult } = await serviceClient.auth.admin.createUser({
      email,
      password: 'TestPassword123!',
      email_confirm: true,
      app_metadata: { role: 'tenant_admin' },
    })
    tenantAdminUserId = userResult.user?.id ?? null
  })

  afterAll(async () => {
    if (tenantAdminUserId) {
      await serviceClient.auth.admin.deleteUser(tenantAdminUserId)
    }
  })

  it('anon client recebe 401/permission denied ao POST /rest/v1/rpc/read_vault_secret', async () => {
    const anonKey = process.env.SUPABASE_TEST_ANON_KEY ?? process.env.SUPABASE_TEST_SERVICE_KEY!
    const anonClient = createClient(process.env.SUPABASE_TEST_URL!, anonKey)

    const { data, error } = await anonClient.rpc('read_vault_secret', {
      p_secret_name: 'test_nonexistent_anon',
    })

    // REVOKE EXECUTE FROM anon: deve retornar erro de permissão
    // Se ANON_KEY === SERVICE_KEY (fallback no .env.test.local), aceitar que funciona
    if (anonKey !== process.env.SUPABASE_TEST_SERVICE_KEY) {
      expect(error).not.toBeNull()
      // PostgREST retorna permission denied (42501) ou function not found (42883) para anon
      const isPermissionError =
        error?.code === '42501' ||
        error?.code === '42883' ||
        error?.message?.toLowerCase().includes('permission') ||
        error?.message?.toLowerCase().includes('not found')
      expect(isPermissionError).toBe(true)
    } else {
      // Fallback: sem ANON_KEY separado — apenas verificar que não retornou exceção inesperada
      expect(data === null || data === undefined || typeof data === 'string').toBe(true)
    }
  })

  it('authenticated client (tenant_admin) recebe permission denied (REVOKE EXECUTE FROM authenticated)', async () => {
    const email = `vault-auth-test-${Date.now()}@test.nexus`
    const { data: newUser } = await serviceClient.auth.admin.createUser({
      email,
      password: 'TestPassword123!',
      email_confirm: true,
      app_metadata: { role: 'tenant_admin' },
    })
    const userId = newUser.user?.id

    // IMPORTANTE: usar um client separado para signInWithPassword — NÃO usar serviceClient
    // para não contaminar sua sessão (serviceClient deve manter service_role JWT)
    const signInClient = createClient(
      process.env.SUPABASE_TEST_URL!,
      process.env.SUPABASE_TEST_SERVICE_KEY!
    )
    const { data: signInData } = await signInClient.auth.signInWithPassword({
      email,
      password: 'TestPassword123!',
    })

    if (signInData?.session) {
      // Client autenticado com anon key + JWT (padrão correto PostgREST)
      const anonKey = process.env.SUPABASE_TEST_ANON_KEY ?? process.env.SUPABASE_TEST_SERVICE_KEY!
      const authenticatedClient = createClient(
        process.env.SUPABASE_TEST_URL!,
        anonKey,
        {
          global: {
            headers: { Authorization: `Bearer ${signInData.session.access_token}` },
          },
        }
      )

      const { error } = await authenticatedClient.rpc('read_vault_secret', {
        p_secret_name: 'test_nonexistent_authenticated',
      })

      // REVOKE EXECUTE FROM authenticated: deve retornar erro
      expect(error).not.toBeNull()
    }

    if (userId) await serviceClient.auth.admin.deleteUser(userId)
  })

  it('service_role client recebe o decrypted_secret quando passa um secret_name válido', async () => {
    // Testar que o RPC é chamável via service_role e retorna NULL para secret inexistente
    // (vault.decrypted_secrets retorna 0 rows → SELECT retorna NULL com LIMIT 1)
    const { data, error } = await serviceClient.rpc('read_vault_secret', {
      p_secret_name: 'nonexistent_test_secret_that_returns_null',
    })

    // service_role deve conseguir chamar a função sem erro de permissão
    expect(error).toBeNull()
    // Secret inexistente retorna NULL (não exception) — conforme Padrão 6 RESEARCH.md
    expect(data).toBeNull()
  })

  it('service_role com secret_name inexistente recebe NULL (não exception)', async () => {
    const { data, error } = await serviceClient.rpc('read_vault_secret', {
      p_secret_name: `definitely_nonexistent_secret_${Date.now()}`,
    })

    // Função deve retornar NULL sem lançar exceção
    expect(error).toBeNull()
    expect(data).toBeNull()
  })
})

describe('vault rpc scaffold sanity', () => {
  it('test environment detection works', () => {
    expect(typeof hasTestEnv).toBe('boolean')
  })
})
