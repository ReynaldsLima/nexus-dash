import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'

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
 * Preenchidas pela Plan 02 (migrations).
 */
const hasTestEnv = !!process.env.SUPABASE_TEST_URL && !!process.env.SUPABASE_TEST_SERVICE_KEY
const describeIfEnv = hasTestEnv ? describe : describe.skip

describeIfEnv('campaign_metrics schema (SYNC-05, SYNC-04)', () => {
  const supa = createClient(
    process.env.SUPABASE_TEST_URL!,
    process.env.SUPABASE_TEST_SERVICE_KEY!
  )

  it("attribution_window NOT NULL com DEFAULT '7d_click' — INSERT sem coluna grava '7d_click'", async () => {
    const { data: tenant, error: tenantErr } = await supa
      .from('tenants')
      .insert({ name: 'test-attr-window', slug: `test-attr-${Date.now()}` })
      .select()
      .single()
    expect(tenantErr).toBeNull()

    const { data, error } = await supa
      .from('campaign_metrics')
      .insert({
        tenant_id: tenant!.id,
        campaign_id: 'c1',
        campaign_name: 'C1',
        channel: 'google_ads',
        date: '2026-01-01',
      })
      .select('attribution_window')
      .single()
    expect(error).toBeNull()
    expect(data?.attribution_window).toBe('7d_click')

    // cleanup via CASCADE
    await supa.from('tenants').delete().eq('id', tenant!.id)
  })

  it("channel CHECK constraint rejeita valores fora de ('google_ads','meta_ads') com SQLSTATE 23514", async () => {
    const { data: tenant } = await supa
      .from('tenants')
      .insert({ name: 'test-check', slug: `test-check-${Date.now()}` })
      .select()
      .single()

    const { error } = await supa.from('campaign_metrics').insert({
      tenant_id: tenant!.id,
      campaign_id: 'c2',
      campaign_name: 'C2',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      channel: 'tiktok_ads' as any,
      date: '2026-01-01',
    })
    expect(error).not.toBeNull()
    expect(error?.code).toBe('23514')

    await supa.from('tenants').delete().eq('id', tenant!.id)
  })

  it('UNIQUE(tenant_id, campaign_id, channel, date) — inserir duplicata retorna SQLSTATE 23505', async () => {
    const { data: tenant } = await supa
      .from('tenants')
      .insert({ name: 'test-uniq', slug: `test-uniq-${Date.now()}` })
      .select()
      .single()

    const row = {
      tenant_id: tenant!.id,
      campaign_id: 'c3',
      campaign_name: 'C3',
      channel: 'google_ads',
      date: '2026-01-01',
    }
    await supa.from('campaign_metrics').insert(row)
    const { error } = await supa.from('campaign_metrics').insert(row)
    expect(error?.code).toBe('23505')

    await supa.from('tenants').delete().eq('id', tenant!.id)
  })

  it('spend, conversions, conversion_value default to 0 quando omitidos', async () => {
    const { data: tenant } = await supa
      .from('tenants')
      .insert({ name: 'test-defaults', slug: `test-def-${Date.now()}` })
      .select()
      .single()

    const { data, error } = await supa
      .from('campaign_metrics')
      .insert({
        tenant_id: tenant!.id,
        campaign_id: 'c4',
        campaign_name: 'C4',
        channel: 'meta_ads',
        date: '2026-01-02',
      })
      .select('impressions, clicks, spend, conversions, conversion_value')
      .single()

    expect(error).toBeNull()
    expect(data?.impressions).toBe(0)
    expect(data?.clicks).toBe(0)
    expect(Number(data?.spend)).toBe(0)
    expect(Number(data?.conversions)).toBe(0)
    expect(Number(data?.conversion_value)).toBe(0)

    await supa.from('tenants').delete().eq('id', tenant!.id)
  })

  it('tenant_id FK ON DELETE CASCADE remove métricas órfãs', async () => {
    const { data: tenant } = await supa
      .from('tenants')
      .insert({ name: 'test-cascade', slug: `test-casc-${Date.now()}` })
      .select()
      .single()

    await supa.from('campaign_metrics').insert({
      tenant_id: tenant!.id,
      campaign_id: 'c5',
      campaign_name: 'C5',
      channel: 'google_ads',
      date: '2026-01-03',
    })

    // DELETE tenant — CASCADE should remove campaign_metrics
    await supa.from('tenants').delete().eq('id', tenant!.id)

    const { data: remaining } = await supa
      .from('campaign_metrics')
      .select('id')
      .eq('tenant_id', tenant!.id)
    expect(remaining).toHaveLength(0)
  })
})

describe('campaign_metrics scaffold sanity', () => {
  it('test environment detection works', () => {
    expect(typeof hasTestEnv).toBe('boolean')
  })
})
