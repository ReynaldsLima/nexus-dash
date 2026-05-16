import { describe, it, expect } from 'vitest'

/**
 * daily_rollups schema constraints (pré-requisito para queries de KPI da Fase 3).
 *
 * Per CONTEXT.md §D-11:
 *   - UNIQUE(tenant_id, channel, date)
 *   - channel aceita 'google_ads', 'meta_ads', 'all'
 *   - Todos os totals default to 0
 *
 * Self-skip if SUPABASE_TEST_URL unset.
 */
const hasTestEnv = !!process.env.SUPABASE_TEST_URL && !!process.env.SUPABASE_TEST_SERVICE_KEY
const describeIfEnv = hasTestEnv ? describe : describe.skip

describeIfEnv('daily_rollups schema', () => {
  it.todo('UNIQUE(tenant_id, channel, date) — inserir duplicata retorna SQLSTATE 23505')
  it.todo("channel aceita 'google_ads', 'meta_ads', e 'all' (cross-channel rollup)")
  it.todo('Defaults: total_spend=0, total_impressions=0, total_clicks=0, total_conversions=0, total_conv_value=0, campaign_count=0')
  it.todo('tenant_id FK ON DELETE CASCADE remove rollups órfãos')
})

describe('daily_rollups scaffold sanity', () => {
  it('test environment detection works', () => {
    expect(typeof hasTestEnv).toBe('boolean')
  })
})
