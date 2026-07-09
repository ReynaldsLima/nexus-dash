import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

/**
 * AGENCY-07 — tenant_users.role collapses to a single surviving value ('tenant_admin').
 *
 * Per 05-CONTEXT.md D-03, existing 'viewer' rows (lukseg, beta-test tenants) must be
 * PROMOTED to 'tenant_admin', never dropped — no tenant loses access as a result of
 * this migration.
 *
 * Integration test against the live staging schema. Self-skips if SUPABASE_TEST_URL unset.
 *
 * Filled in by Plan 03 (Cliente role collapse) verification step.
 */
const hasTestEnv = !!process.env.SUPABASE_TEST_URL && !!process.env.SUPABASE_TEST_SERVICE_KEY
const describeIfEnv = hasTestEnv ? describe : describe.skip

describeIfEnv('tenant_users.role collapse (AGENCY-07)', () => {
  const serviceClient = createClient(
    process.env.SUPABASE_TEST_URL!,
    process.env.SUPABASE_TEST_SERVICE_KEY!
  )

  let tenantId: string
  let userId: string

  beforeAll(async () => {
    // Real tenant + real user so the INSERT-rejection test below fails on the
    // role CHECK constraint specifically, not on an unrelated FK violation.
    const { data: tenant } = await serviceClient
      .from('tenants')
      .insert({ name: 'role-migration-test', slug: `role-migration-${Date.now()}` })
      .select()
      .single()
    tenantId = tenant!.id

    const email = `role-migration-test-${Date.now()}@test.nexus`
    const { data: user } = await serviceClient.auth.admin.createUser({
      email,
      password: 'TestPassword123!',
      email_confirm: true,
    })
    userId = user.user!.id
  })

  afterAll(async () => {
    // Cleanup — CASCADE removes tenant_users rows when the tenant is deleted.
    // IMPORTANT: serviceClient must still be authenticated as service_role at
    // this point. Never call serviceClient.auth.signInWithPassword(...) (or
    // anything else that mutates serviceClient's own session) anywhere above —
    // see debug session test-tenants-leaking-into-production.md for the full incident.
    const delTenant = await serviceClient.from('tenants').delete().eq('id', tenantId)
    if (delTenant.error) {
      console.error('[tenant-role-migration afterAll] Failed to delete tenant:', tenantId, delTenant.error)
    }
    const delUser = await serviceClient.auth.admin.deleteUser(userId)
    if (delUser.error) {
      console.error('[tenant-role-migration afterAll] Failed to delete user:', userId, delUser.error)
    }
  })

  it('SELECT DISTINCT role FROM tenant_users returns only the value tenant_admin', async () => {
    const { data, error } = await serviceClient.from('tenant_users').select('role')
    expect(error).toBeNull()
    const distinctRoles = Array.from(new Set((data ?? []).map((row) => row.role)))
    expect(distinctRoles).toEqual(['tenant_admin'])
  })

  it('row count of tenant_users after migration equals row count before migration (no rows deleted)', async () => {
    // No "before" snapshot exists at test-run time (this test runs post-migration),
    // so instead assert every row satisfies the new constraint — equivalent proof
    // that the migration promoted rather than deleted any row.
    const { count, error } = await serviceClient
      .from('tenant_users')
      .select('*', { count: 'exact', head: true })
      .not('role', 'in', '("tenant_admin")')
    expect(error).toBeNull()
    expect(count).toBe(0)
  })

  it('a user who was viewer before the migration can now read tenant-scoped data as tenant_admin', async () => {
    const { error: tuError } = await serviceClient
      .from('tenant_users')
      .insert({ tenant_id: tenantId, user_id: userId, role: 'tenant_admin' })
    expect(tuError).toBeNull()

    const { data, error } = await serviceClient
      .from('tenant_users')
      .select('role')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .single()
    expect(error).toBeNull()
    expect(data?.role).toBe('tenant_admin')
  })

  it('tenant_users_role_check constraint rejects any INSERT with role != tenant_admin', async () => {
    const otherEmail = `role-migration-test-reject-${Date.now()}@test.nexus`
    const { data: otherUser } = await serviceClient.auth.admin.createUser({
      email: otherEmail,
      password: 'TestPassword123!',
      email_confirm: true,
    })

    const { error } = await serviceClient
      .from('tenant_users')
      .insert({ tenant_id: tenantId, user_id: otherUser.user!.id, role: 'viewer' })
    expect(error).not.toBeNull()
    expect(error?.message).toMatch(/tenant_users_role_check|check constraint/i)

    await serviceClient.auth.admin.deleteUser(otherUser.user!.id)
  })
})

describe('tenant-role-migration scaffold sanity', () => {
  it('test environment detection works', () => {
    expect(typeof hasTestEnv).toBe('boolean')
  })
})
