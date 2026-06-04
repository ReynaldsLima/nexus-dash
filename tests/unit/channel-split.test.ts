import { describe, it, expect } from 'vitest'
import { computeChannelSplit } from '@/lib/dashboard-kpis'

describe('computeChannelSplit', () => {
  it('google 60 + meta 40 → pcts 60 e 40 (somam 100)', () => {
    const result = computeChannelSplit(60, 40)
    expect(result.google.value).toBe(60)
    expect(result.meta.value).toBe(40)
    expect(result.google.pct).toBeCloseTo(60)
    expect(result.meta.pct).toBeCloseTo(40)
    expect(result.google.pct + result.meta.pct).toBeCloseTo(100)
  })

  it('google 0 + meta 0 → ambos pct = 0 (sem NaN ou divisão por zero)', () => {
    const result = computeChannelSplit(0, 0)
    expect(result.google.pct).toBe(0)
    expect(result.meta.pct).toBe(0)
    expect(isNaN(result.google.pct)).toBe(false)
    expect(isNaN(result.meta.pct)).toBe(false)
  })

  it('apenas google → pct 100 para google e 0 para meta', () => {
    const result = computeChannelSplit(100, 0)
    expect(result.google.pct).toBeCloseTo(100)
    expect(result.meta.pct).toBeCloseTo(0)
  })

  it('apenas meta → pct 0 para google e 100 para meta', () => {
    const result = computeChannelSplit(0, 100)
    expect(result.google.pct).toBeCloseTo(0)
    expect(result.meta.pct).toBeCloseTo(100)
  })

  it('valores decimais — pcts somam 100', () => {
    const result = computeChannelSplit(333.33, 666.67)
    expect(result.google.pct + result.meta.pct).toBeCloseTo(100)
  })
})
