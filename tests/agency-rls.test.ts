import { describe, it, expect } from 'vitest'

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
 * Filled in by Plan 02 (agency data layer) verification step.
 */
const hasTestEnv = !!process.env.SUPABASE_TEST_URL && !!process.env.SUPABASE_TEST_SERVICE_KEY
const describeIfEnv = hasTestEnv ? describe : describe.skip

describeIfEnv('Agency-scoped RLS (AGENCY-06)', () => {
  it.todo('agency user sees only tenants present in agency_tenants for their agency_id')
  it.todo('agency user sees 0 tenant rows when agency_tenants has no grants for them')
  it.todo('agency user sees 0 rows for a tenant that was granted then revoked')
  it.todo('agency user sees 0 rows for a granted tenant that is active=false (soft-deleted)')
  it.todo('agency_select policy does not expose rows from campaign_metrics for an ungranted tenant_id')
  it.todo('super_admin still sees all tenants regardless of agency_tenants contents (existing policy unaffected)')
})

describeIfEnv('Agency-scoped tenant list resolution (AGENCY-03/04)', () => {
  it.todo('loadTenantsForSwitcher-equivalent query returns granted tenants when called with an agency JWT')
})

describe('agency-rls scaffold sanity', () => {
  it('test environment detection works', () => {
    expect(typeof hasTestEnv).toBe('boolean')
  })
})
