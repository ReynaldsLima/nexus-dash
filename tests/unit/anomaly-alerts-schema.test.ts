import { describe, it, expect } from 'vitest'

/**
 * AI-04 — anomaly_alerts stores ROAS-drop anomalies inserted by N8N; delivered to the frontend via
 * Supabase Realtime. This suite verifies the schema constraints AND that the table is a member of
 * the supabase_realtime publication (04-RESEARCH.md Pitfall 2 — a CREATE TABLE + RLS alone does
 * NOT enable Realtime; the migration must ALTER PUBLICATION supabase_realtime ADD TABLE).
 *
 * Requires a live Supabase test project with migration 0022 applied. Self-skips if
 * SUPABASE_TEST_URL is unset. Filled in by Plan 02 (schema push).
 */
const hasTestEnv = !!process.env.SUPABASE_TEST_URL && !!process.env.SUPABASE_TEST_SERVICE_KEY
const describeIfEnv = hasTestEnv ? describe : describe.skip

describeIfEnv('anomaly_alerts schema + realtime (AI-04)', () => {
  it.todo('channel CHECK accepts google_ads / meta_ads and rejects others (SQLSTATE 23514)')
  it.todo('drop_pct is NOT NULL')
  it.todo('window_hours defaults to 24, metric defaults to roas')
  it.todo('tenant_id FK ON DELETE CASCADE removes orphan alerts')
  it.todo('anomaly_alerts is a member of the supabase_realtime publication (pg_publication_tables)')
  it.todo('super_admin can SELECT; tenant_admin cannot (RLS super_admin-only)')
})

describe('anomaly-alerts-schema scaffold sanity', () => {
  it('test environment detection works', () => {
    expect(typeof hasTestEnv).toBe('boolean')
  })
})
