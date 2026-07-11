import { describe, it, expect } from 'vitest'

/**
 * AI-02 — POST /api/insights/daily is the N8N-triggered daily analysis route. It has NO Supabase
 * user session; auth is a shared-secret header compared against process.env.N8N_INSIGHTS_SECRET
 * (04-RESEARCH.md Architecture Pattern 2). It also validates that the body's tenantId actually
 * has >= 1 ad_accounts row before processing (D-07 eligibility, anti-pattern: never trust an
 * arbitrary tenantId).
 *
 * Filled in by Plan 06 (app/api/insights/daily/route.ts).
 */
describe('POST /api/insights/daily — shared-secret gate (AI-02)', () => {
  it.todo('missing x-n8n-secret header → 401')
  it.todo('wrong x-n8n-secret value → 401')
  it.todo('correct x-n8n-secret but tenant has zero ad_accounts rows → 200 skipped (no insight generated)')
  it.todo('correct x-n8n-secret and eligible tenant → generates + inserts one ai_insights row with source=daily')
})

describe('insights-daily-route scaffold sanity', () => {
  it('vitest is wired', () => {
    expect(true).toBe(true)
  })
})
