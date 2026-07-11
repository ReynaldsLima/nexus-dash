import { describe, it, expect } from 'vitest'
import { extractStructuredBlock, stripStructuredBlock } from '@/lib/ai/parse-insight-block'

/**
 * AI-01 — extractStructuredBlock(fullText) parses the trailing <insight_data>...</insight_data>
 * JSON block Claude emits after the streamed prose, validates it with Zod, and returns null on
 * malformed/missing input so the route can fall back to a defaulted row (04-RESEARCH.md Pitfall 3,
 * decided as fallback-persist in Plan 03 — never silently drop an insight).
 *
 * Filled in by Plan 03 (lib/ai/parse-insight-block.ts).
 */
describe('extractStructuredBlock (AI-01)', () => {
  it('parses a well-formed <insight_data> block into { type, title, impact, metrics, recommendations }', () => {
    const text =
      'Análise da campanha...\n' +
      '<insight_data>' +
      JSON.stringify({
        type: 'optimization',
        title: 'Otimizar orçamento',
        impact: 'high',
        metrics: [{ label: 'ROAS', value: '4.9x', delta: '+10%' }],
        recommendations: ['Aumentar orçamento em 20%'],
      }) +
      '</insight_data>'
    const result = extractStructuredBlock(text)
    expect(result).toEqual({
      type: 'optimization',
      title: 'Otimizar orçamento',
      impact: 'high',
      metrics: [{ label: 'ROAS', value: '4.9x', delta: '+10%' }],
      recommendations: ['Aumentar orçamento em 20%'],
    })
  })

  it('returns null when the <insight_data> block is absent entirely', () => {
    expect(extractStructuredBlock('apenas texto sem bloco estruturado')).toBeNull()
  })

  it('returns null when the block contains invalid JSON', () => {
    const text = '<insight_data>{ not valid json </insight_data>'
    expect(extractStructuredBlock(text)).toBeNull()
  })

  it('returns null when the JSON is valid but fails the Zod schema (e.g. type not in the enum)', () => {
    const text =
      '<insight_data>' +
      JSON.stringify({
        type: 'foo',
        title: 'Título',
        impact: 'high',
        metrics: [],
        recommendations: ['x'],
      }) +
      '</insight_data>'
    expect(extractStructuredBlock(text)).toBeNull()
  })

  it('accepts the three valid types: optimization, alert, opportunity', () => {
    for (const type of ['optimization', 'alert', 'opportunity'] as const) {
      const text =
        '<insight_data>' +
        JSON.stringify({
          type,
          title: 'Título',
          impact: 'medium',
          metrics: [],
          recommendations: ['x'],
        }) +
        '</insight_data>'
      expect(extractStructuredBlock(text)?.type).toBe(type)
    }
  })

  it('accepts the three valid impacts: high, medium, low', () => {
    for (const impact of ['high', 'medium', 'low'] as const) {
      const text =
        '<insight_data>' +
        JSON.stringify({
          type: 'alert',
          title: 'Título',
          impact,
          metrics: [],
          recommendations: ['x'],
        }) +
        '</insight_data>'
      expect(extractStructuredBlock(text)?.impact).toBe(impact)
    }
  })
})

describe('stripStructuredBlock', () => {
  it('strips the trailing <insight_data> block and trims the remaining prose', () => {
    const text = '  Texto narrativo aqui.  \n<insight_data>{"a":1}</insight_data>'
    expect(stripStructuredBlock(text)).toBe('Texto narrativo aqui.')
  })

  it('returns the full trimmed text unchanged when no block is present', () => {
    expect(stripStructuredBlock('  só prosa  ')).toBe('só prosa')
  })
})

describe('parse-insight-block scaffold sanity', () => {
  it('vitest is wired', () => {
    expect(true).toBe(true)
  })
})
