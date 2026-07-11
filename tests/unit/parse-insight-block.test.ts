import { describe, it, expect } from 'vitest'

/**
 * AI-01 — extractStructuredBlock(fullText) parses the trailing <insight_data>...</insight_data>
 * JSON block Claude emits after the streamed prose, validates it with Zod, and returns null on
 * malformed/missing input so the route can fall back to a defaulted row (04-RESEARCH.md Pitfall 3,
 * decided as fallback-persist in Plan 03 — never silently drop an insight).
 *
 * Filled in by Plan 03 (lib/ai/parse-insight-block.ts).
 */
describe('extractStructuredBlock (AI-01)', () => {
  it.todo('parses a well-formed <insight_data> block into { type, title, impact, metrics, recommendations }')
  it.todo('returns null when the <insight_data> block is absent entirely')
  it.todo('returns null when the block contains invalid JSON')
  it.todo('returns null when the JSON is valid but fails the Zod schema (e.g. type not in the enum)')
  it.todo('accepts the three valid types: optimization, alert, opportunity')
  it.todo('accepts the three valid impacts: high, medium, low')
})

describe('parse-insight-block scaffold sanity', () => {
  it('vitest is wired', () => {
    expect(true).toBe(true)
  })
})
