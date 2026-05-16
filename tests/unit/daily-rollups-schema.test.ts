import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'

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
  const supa = createClient(
    process.env.SUPABASE_TEST_URL!,
    process.env.SUPABASE_TEST_SERVICE_KEY!
  )

  it('UNIQUE(tenant_id, channel, date) — inserir duplicata retorna SQLSTATE 23505', async () => {
    const { data: tenant } = await supa
      .from('tenants')
      .insert({ name: 'test-dr-uniq', slug: `test-dr-uniq-${Date.now()}` })
      .select()
      .single()

    const row = {
      tenant_id: tenant!.id,
      channel: 'google_ads',
      date: '2026-01-01',
    }
    await supa.from('daily_rollups').insert(row)
    const { error } = await supa.from('daily_rollups').insert(row)
    expect(error?.code).toBe('23505')

    await supa.from('tenants').delete().eq('id', tenant!.id)
  })

  it("channel aceita 'google_ads', 'meta_ads', e 'all' (cross-channel rollup)", async () => {
    const { data: tenant } = await supa
      .from('tenants')
      .insert({ name: 'test-dr-channel', slug: `test-dr-ch-${Date.now()}` })
      .select()
      .single()

    // Inserir uma row por canal — todos devem funcionar sem erro
    const channels = ['google_ads', 'meta_ads', 'all']
    for (const channel of channels) {
      const { error } = await supa.from('daily_rollups').insert({
        tenant_id: tenant!.id,
        channel,
        date: '2026-01-01',
      })
      expect(error).toBeNull()
    }

    // Canal inválido deve falhar com SQLSTATE 23514
    const { error: checkError } = await supa.from('daily_rollups').insert({
      tenant_id: tenant!.id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      channel: 'tiktok_ads' as any,
      date: '2026-01-02',
    })
    expect(checkError?.code).toBe('23514')

    await supa.from('tenants').delete().eq('id', tenant!.id)
  })

  it('Defaults: total_spend=0, total_impressions=0, total_clicks=0, total_conversions=0, total_conv_value=0, campaign_count=0', async () => {
    const { data: tenant } = await supa
      .from('tenants')
      .insert({ name: 'test-dr-defaults', slug: `test-dr-def-${Date.now()}` })
      .select()
      .single()

    const { data, error } = await supa
      .from('daily_rollups')
      .insert({ tenant_id: tenant!.id, channel: 'all', date: '2026-01-03' })
      .select('total_spend, total_impressions, total_clicks, total_conversions, total_conv_value, campaign_count')
      .single()

    expect(error).toBeNull()
    expect(Number(data?.total_spend)).toBe(0)
    expect(Number(data?.total_impressions)).toBe(0)
    expect(Number(data?.total_clicks)).toBe(0)
    expect(Number(data?.total_conversions)).toBe(0)
    expect(Number(data?.total_conv_value)).toBe(0)
    expect(data?.campaign_count).toBe(0)

    await supa.from('tenants').delete().eq('id', tenant!.id)
  })

  it('tenant_id FK ON DELETE CASCADE remove rollups órfãos', async () => {
    const { data: tenant } = await supa
      .from('tenants')
      .insert({ name: 'test-dr-cascade', slug: `test-dr-casc-${Date.now()}` })
      .select()
      .single()

    await supa.from('daily_rollups').insert({
      tenant_id: tenant!.id,
      channel: 'meta_ads',
      date: '2026-01-04',
    })

    // DELETE tenant — CASCADE should remove daily_rollups
    await supa.from('tenants').delete().eq('id', tenant!.id)

    const { data: remaining } = await supa
      .from('daily_rollups')
      .select('id')
      .eq('tenant_id', tenant!.id)
    expect(remaining).toHaveLength(0)
  })
})

describe('daily_rollups scaffold sanity', () => {
  it('test environment detection works', () => {
    expect(typeof hasTestEnv).toBe('boolean')
  })
})
