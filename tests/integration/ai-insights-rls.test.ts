import { describe, it, expect } from 'vitest'

/**
 * AI-03 — ai_insights is accessible ONLY to super_admin. Per 04-RESEARCH.md Assumption A2 and the
 * literal AI-03 wording, there is NO tenant_admin/agency SELECT policy on this table (unlike
 * campaign_metrics/daily_rollups). This differs deliberately from the tenant-scoped tables.
 *
 * Requires a live Supabase test project with migration 0021 applied. Self-skips if
 * SUPABASE_TEST_URL is unset. Filled in by Plan 02 (schema push).
 */
const hasTestEnv = !!process.env.SUPABASE_TEST_URL && !!process.env.SUPABASE_TEST_SERVICE_KEY
const describeIfEnv = hasTestEnv ? describe : describe.skip

describeIfEnv('ai_insights RLS — super_admin only (AI-03)', () => {
  it.todo('super_admin session can SELECT ai_insights rows across tenants')
  it.todo('tenant_admin session sees zero ai_insights rows (no tenant_select policy exists)')
  it.todo('agency session sees zero ai_insights rows')
  it.todo('anon has no access (REVOKE ALL FROM anon)')
  it.todo('source CHECK rejects a value other than on_demand / daily (SQLSTATE 23514)')
  it.todo('type CHECK rejects a value other than optimization / alert / opportunity')
})

describe('ai-insights-rls scaffold sanity', () => {
  it('test environment detection works', () => {
    expect(typeof hasTestEnv).toBe('boolean')
  })
})
