import { describe, it, expect } from 'vitest'
import {
  aggregateRollups,
  calcDelta,
  computePriorRange,
  type RollupRow,
} from '@/lib/dashboard-kpis'

function makeRow(overrides: Partial<RollupRow> = {}): RollupRow {
  return {
    total_spend: 0,
    total_impressions: 0,
    total_clicks: 0,
    total_conversions: 0,
    total_conv_value: 0,
    ...overrides,
  }
}

describe('aggregateRollups', () => {
  it('array vazio retorna todos os campos = 0 (sem NaN)', () => {
    const result = aggregateRollups([])
    expect(result.spend).toBe(0)
    expect(result.roas).toBe(0)
    expect(result.cpa).toBe(0)
    expect(result.ctr).toBe(0)
    expect(result.conversions).toBe(0)
    expect(result.clicks).toBe(0)
    expect(result.impressions).toBe(0)
    // garantir que nenhum campo é NaN
    for (const v of Object.values(result)) {
      expect(isNaN(v as number)).toBe(false)
    }
  })

  it('soma total_spend de múltiplas linhas', () => {
    const rows = [makeRow({ total_spend: 100 }), makeRow({ total_spend: 200 })]
    expect(aggregateRollups(rows).spend).toBe(300)
  })

  it('soma total_clicks, total_impressions, total_conversions, total_conv_value', () => {
    const rows = [
      makeRow({ total_clicks: 50, total_impressions: 1000, total_conversions: 5, total_conv_value: 500 }),
      makeRow({ total_clicks: 50, total_impressions: 500, total_conversions: 5, total_conv_value: 250 }),
    ]
    const result = aggregateRollups(rows)
    expect(result.clicks).toBe(100)
    expect(result.impressions).toBe(1500)
    expect(result.conversions).toBe(10)
  })

  it('roas = total_conv_value / total_spend quando spend > 0', () => {
    const rows = [makeRow({ total_spend: 100, total_conv_value: 400 })]
    expect(aggregateRollups(rows).roas).toBeCloseTo(4.0)
  })

  it('roas = 0 quando total_spend = 0 (guard divisão por zero)', () => {
    const rows = [makeRow({ total_spend: 0, total_conv_value: 400 })]
    expect(aggregateRollups(rows).roas).toBe(0)
  })

  it('cpa = total_spend / total_conversions quando conversions > 0', () => {
    const rows = [makeRow({ total_spend: 100, total_conversions: 5 })]
    expect(aggregateRollups(rows).cpa).toBeCloseTo(20.0)
  })

  it('cpa = 0 quando total_conversions = 0 (guard divisão por zero)', () => {
    const rows = [makeRow({ total_spend: 100, total_conversions: 0 })]
    expect(aggregateRollups(rows).cpa).toBe(0)
  })

  it('ctr = (total_clicks / total_impressions) * 100 quando impressions > 0', () => {
    const rows = [makeRow({ total_clicks: 10, total_impressions: 1000 })]
    expect(aggregateRollups(rows).ctr).toBeCloseTo(1.0)
  })

  it('ctr = 0 quando total_impressions = 0 (guard divisão por zero)', () => {
    const rows = [makeRow({ total_clicks: 10, total_impressions: 0 })]
    expect(aggregateRollups(rows).ctr).toBe(0)
  })

  it('aceita valores numéricos passados como strings (coerção com Number())', () => {
    // simula como supabase-js pode retornar numeric como string
    const rows = [makeRow({ total_spend: '500' as unknown as number, total_conv_value: '2000' as unknown as number })]
    const result = aggregateRollups(rows)
    expect(result.spend).toBe(500)
    expect(result.roas).toBeCloseTo(4.0)
  })
})

describe('calcDelta', () => {
  it('retorna absolute e pct corretos quando prior > 0', () => {
    const result = calcDelta(110, 100)
    expect(result.absolute).toBe(10)
    expect(result.pct).toBeCloseTo(10)
  })

  it('pct negativo quando current < prior', () => {
    const result = calcDelta(80, 100)
    expect(result.absolute).toBe(-20)
    expect(result.pct).toBeCloseTo(-20)
  })

  it('pct = null quando prior = 0 (guard divisão por zero)', () => {
    const result = calcDelta(50, 0)
    expect(result.absolute).toBe(50)
    expect(result.pct).toBeNull()
  })

  it('pct = null quando prior = 0 e current = 0', () => {
    const result = calcDelta(0, 0)
    expect(result.absolute).toBe(0)
    expect(result.pct).toBeNull()
  })
})

describe('computePriorRange', () => {
  it('preserva o mesmo número de dias do período atual', () => {
    const from = new Date(2026, 0, 1) // 1 Jan 2026
    const to = new Date(2026, 0, 30) // 30 Jan 2026 (29 dias de diff)
    const { priorFrom, priorTo } = computePriorRange(from, to)

    const currentDiff = to.getTime() - from.getTime()
    const priorDiff = priorTo.getTime() - priorFrom.getTime()
    expect(priorDiff).toBe(currentDiff)
  })

  it('priorTo é o dia anterior a from', () => {
    const from = new Date(2026, 0, 10)
    const to = new Date(2026, 0, 20)
    const { priorTo } = computePriorRange(from, to)

    const expectedPriorTo = new Date(2026, 0, 9) // 1 dia antes de from
    expect(priorTo.getTime()).toBe(expectedPriorTo.getTime())
  })

  it('priorFrom = priorTo - duração do período atual', () => {
    const from = new Date(2026, 0, 10)
    const to = new Date(2026, 0, 20)
    const { priorFrom, priorTo } = computePriorRange(from, to)

    const duration = to.getTime() - from.getTime()
    expect(priorTo.getTime() - priorFrom.getTime()).toBe(duration)
  })
})
