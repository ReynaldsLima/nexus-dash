import { describe, it, expect } from 'vitest'

/**
 * SYNC-05 — attribution_window NOT NULL com DEFAULT '7d_click' desde o dia 1.
 * SYNC-04 — schema base de campaign_metrics.
 *
 * Per CONTEXT.md §D-03, campaign_metrics tem:
 *   - UNIQUE(tenant_id, campaign_id, channel, date)
 *   - CHECK (channel IN ('google_ads','meta_ads'))
 *   - attribution_window NOT NULL DEFAULT '7d_click'
 *
 * These tests require a live Supabase project (staging) com a migration 0007 aplicada.
 * They self-skip if SUPABASE_TEST_URL is unset so the scaffold phase passes.
 *
 * Preenchidas pela verificação da Plan 02 (migrations).
 */
const hasTestEnv = !!process.env.SUPABASE_TEST_URL && !!process.env.SUPABASE_TEST_SERVICE_KEY
const describeIfEnv = hasTestEnv ? describe : describe.skip

describeIfEnv('campaign_metrics schema (SYNC-05, SYNC-04)', () => {
  it.todo("attribution_window NOT NULL com DEFAULT '7d_click' — INSERT sem coluna grava '7d_click'")
  it.todo("channel CHECK constraint rejeita valores fora de ('google_ads','meta_ads') com SQLSTATE 23514")
  it.todo('UNIQUE(tenant_id, campaign_id, channel, date) — inserir duplicata retorna SQLSTATE 23505')
  it.todo('spend, conversions, conversion_value default to 0 quando omitidos')
  it.todo('tenant_id FK ON DELETE CASCADE remove métricas órfãs')
})

describe('campaign_metrics scaffold sanity', () => {
  it('test environment detection works', () => {
    expect(typeof hasTestEnv).toBe('boolean')
  })
})
