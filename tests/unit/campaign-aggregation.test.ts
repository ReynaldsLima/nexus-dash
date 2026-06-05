import { describe, it, expect } from 'vitest'
import { groupCampaignMetrics, type CampaignMetricRow } from '@/lib/campaign-aggregation'

function makeRow(overrides: Partial<CampaignMetricRow> = {}): CampaignMetricRow {
  return {
    campaign_id: 'camp-1',
    campaign_name: 'Test Campaign',
    channel: 'google_ads',
    status: 'ENABLED',
    date: '2026-01-01',
    impressions: 0,
    clicks: 0,
    spend: 0,
    conversions: 0,
    conversion_value: 0,
    ...overrides,
  }
}

describe('groupCampaignMetrics', () => {
  it('array vazio retorna []', () => {
    expect(groupCampaignMetrics([])).toEqual([])
  })

  it('múltiplas linhas com mesmo campaign_id são somadas em uma entrada', () => {
    const rows = [
      makeRow({
        campaign_id: 'camp-1',
        date: '2026-01-01',
        impressions: 1000,
        clicks: 50,
        spend: 100,
        conversions: 5,
        conversion_value: 400,
      }),
      makeRow({
        campaign_id: 'camp-1',
        date: '2026-01-02',
        impressions: 2000,
        clicks: 100,
        spend: 200,
        conversions: 10,
        conversion_value: 800,
      }),
    ]

    const result = groupCampaignMetrics(rows)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('camp-1')
    expect(result[0].impressions).toBe(3000)
    expect(result[0].clicks).toBe(150)
    expect(result[0].spend).toBe(300)
    expect(result[0].conversions).toBe(15)
    expect(result[0].convValue).toBe(1200)
  })

  it('linhas com campaign_id diferentes geram entradas separadas', () => {
    const rows = [
      makeRow({ campaign_id: 'camp-1', campaign_name: 'Campanha 1' }),
      makeRow({ campaign_id: 'camp-2', campaign_name: 'Campanha 2', channel: 'meta_ads' }),
    ]

    const result = groupCampaignMetrics(rows)
    expect(result).toHaveLength(2)
    expect(result.map((r) => r.id)).toContain('camp-1')
    expect(result.map((r) => r.id)).toContain('camp-2')
  })

  it('roas derivado: convValue / spend', () => {
    const rows = [makeRow({ spend: 100, conversion_value: 400 })]
    const result = groupCampaignMetrics(rows)
    expect(result[0].roas).toBeCloseTo(4.0)
  })

  it('roas = 0 quando spend = 0 (guard divisão por zero)', () => {
    const rows = [makeRow({ spend: 0, conversion_value: 400 })]
    const result = groupCampaignMetrics(rows)
    expect(result[0].roas).toBe(0)
  })

  it('cpa = spend / conversions quando conversions > 0', () => {
    const rows = [makeRow({ spend: 100, conversions: 5 })]
    const result = groupCampaignMetrics(rows)
    expect(result[0].cpa).toBeCloseTo(20.0)
  })

  it('cpa = 0 quando conversions = 0 (guard divisão por zero)', () => {
    const rows = [makeRow({ spend: 100, conversions: 0 })]
    const result = groupCampaignMetrics(rows)
    expect(result[0].cpa).toBe(0)
  })

  it('ctr = (clicks / impressions) * 100', () => {
    const rows = [makeRow({ clicks: 10, impressions: 1000 })]
    const result = groupCampaignMetrics(rows)
    expect(result[0].ctr).toBeCloseTo(1.0)
  })

  it('ctr = 0 quando impressions = 0 (guard divisão por zero)', () => {
    const rows = [makeRow({ clicks: 10, impressions: 0 })]
    const result = groupCampaignMetrics(rows)
    expect(result[0].ctr).toBe(0)
  })

  it('status ENABLED → active; PAUSED → paused', () => {
    const active = groupCampaignMetrics([makeRow({ status: 'ENABLED' })])
    const paused = groupCampaignMetrics([makeRow({ status: 'PAUSED' })])
    expect(active[0].status).toBe('active')
    expect(paused[0].status).toBe('paused')
  })

  it('status ACTIVE (Meta Ads) → active', () => {
    const result = groupCampaignMetrics([makeRow({ status: 'ACTIVE', channel: 'meta_ads' })])
    expect(result[0].status).toBe('active')
  })

  it('status nulo → paused', () => {
    const result = groupCampaignMetrics([makeRow({ status: null })])
    expect(result[0].status).toBe('paused')
  })

  it('status vem da linha mais recente (maior date)', () => {
    const rows = [
      makeRow({ campaign_id: 'camp-1', date: '2026-01-01', status: 'ENABLED' }),
      makeRow({ campaign_id: 'camp-1', date: '2026-01-10', status: 'PAUSED' }),
    ]
    const result = groupCampaignMetrics(rows)
    expect(result[0].status).toBe('paused') // data mais recente é PAUSED
  })

  it('campaign_name e channel vêm da primeira linha do grupo', () => {
    const rows = [
      makeRow({ campaign_id: 'camp-1', campaign_name: 'Primeira', channel: 'google_ads' }),
      makeRow({ campaign_id: 'camp-1', campaign_name: 'Segunda', channel: 'meta_ads' }),
    ]
    const result = groupCampaignMetrics(rows)
    expect(result[0].name).toBe('Primeira')
    expect(result[0].channel).toBe('google_ads')
  })

  it('output tem campo convValue (compatível com type Campaign de lib/mock-data)', () => {
    const rows = [makeRow({ conversion_value: 999 })]
    const result = groupCampaignMetrics(rows)
    expect(result[0]).toHaveProperty('convValue', 999)
  })

  it('aceita valores numéricos passados como strings (coerção com Number())', () => {
    const rows = [
      makeRow({
        spend: '100' as unknown as number,
        conversion_value: '400' as unknown as number,
        impressions: '1000' as unknown as number,
        clicks: '50' as unknown as number,
      }),
    ]
    const result = groupCampaignMetrics(rows)
    expect(result[0].spend).toBe(100)
    expect(result[0].roas).toBeCloseTo(4.0)
    expect(result[0].ctr).toBeCloseTo(5.0)
  })
})
