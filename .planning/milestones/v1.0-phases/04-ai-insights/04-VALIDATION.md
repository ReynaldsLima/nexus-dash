---
phase: 4
slug: ai-insights
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-10
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^2.1.9 (already configured project-wide) |
| **Config file** | `vitest.config.mts` — `environment: 'node'`, `include: ['tests/**/*.test.ts']` |
| **Quick run command** | `npx vitest run tests/unit/<file>.test.ts` (or `tests/integration/<file>.test.ts`) |
| **Full suite command** | `npm test` (= `vitest run`) |
| **Estimated runtime** | ~30 seconds (full suite, based on existing project scale) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <changed-file>.test.ts`
- **After every plan wave:** Run `npm run test` (full suite)
- **Before `/gsd-verify-work`:** Full suite green + `tsc --noEmit` + `npm run build` (matches every prior phase's closing verification pattern)
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD (filled after `/gsd-plan-phase 4` produces PLAN.md files) | — | — | AI-01 | — | `extractStructuredBlock` correctly parses a well-formed `<insight_data>` block and returns null on malformed input | unit | `npx vitest run tests/unit/parse-insight-block.test.ts` | ❌ Wave 0 | ⬜ pending |
| TBD | — | — | AI-01 | — | `/api/insights/generate` rejects non-super_admin callers (403) | unit | `npx vitest run tests/unit/insights-generate-route.test.ts` | ❌ Wave 0 | ⬜ pending |
| TBD | — | — | AI-02 | — | `/api/insights/daily` rejects requests without the correct `x-n8n-secret` header | unit | `npx vitest run tests/unit/insights-daily-route.test.ts` | ❌ Wave 0 | ⬜ pending |
| TBD | — | — | AI-03 | — | `ai_insights` RLS: super_admin can SELECT, tenant_admin cannot (skip-if-no-env, mirrors `tests/integration/sync-jobs-rls.test.ts`) | integration | `npx vitest run tests/integration/ai-insights-rls.test.ts` | ❌ Wave 0 | ⬜ pending |
| TBD | — | — | AI-04 | — | `anomaly_alerts` RLS + `supabase_realtime` publication membership (schema-level check) | integration | `npx vitest run tests/unit/anomaly-alerts-schema.test.ts` | ❌ Wave 0 | ⬜ pending |
| TBD | — | — | AI-04 | — | ROAS drop >20%/24h detection logic (location TBD by planner — N8N Function node vs. SQL function) | unit | `npx vitest run tests/unit/roas-anomaly-detection.test.ts` | ❌ Wave 0 | ⬜ pending |

*Task ID / Plan / Wave columns will be filled in once `/gsd-plan-phase 4`'s planner produces the finalized PLAN.md files. Per 04-RESEARCH.md's Validation Architecture section.*

---

## Wave 0 Requirements

- [ ] `tests/unit/parse-insight-block.test.ts` — covers AI-01 structured-block parsing/fallback behavior
- [ ] `tests/unit/insights-generate-route.test.ts` — covers AI-01 auth/role gate (mock Supabase client, same shape as `tests/unit/leads-status-route.test.ts`)
- [ ] `tests/unit/insights-daily-route.test.ts` — covers AI-02 shared-secret auth gate
- [ ] `tests/integration/ai-insights-rls.test.ts` — covers AI-03 RLS (skip-if-no-env, same pattern as `tests/integration/sync-jobs-rls.test.ts`)
- [ ] `tests/unit/anomaly-alerts-schema.test.ts` — covers AI-04 schema constraints + publication membership
- No framework install needed — Vitest already configured and used across 18 existing test files.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|--------------------|
| On-demand streaming UI — text appears token-by-token, merges into history on completion | AI-01 | Streaming/visual behavior isn't covered by this project's `environment: 'node'` Vitest setup (no `@testing-library/react`) | Log in as super_admin, click "Analisar agora", confirm text streams progressively and the finished insight appears in the history list without a page refresh |
| Supabase Realtime anomaly alert delivery (toast + sidebar badge, no refresh) | AI-04 | WebSocket subscription behavior requires a live Supabase project and browser runtime, not verifiable via mocked unit tests | Manually insert a row into `anomaly_alerts` (or trigger the N8N job against seeded data showing a >20% ROAS drop) while logged in; confirm toast appears and sidebar badge shows without a page refresh |
| Realtime RLS enforcement over `postgres_changes` (Assumption A3 from 04-RESEARCH.md — NOT just table-level RLS, the Realtime delivery path specifically) | AI-04 | Cannot be verified via mocked tests; must be confirmed against the live Supabase project before AI-04 is considered secure, not just functional | As a non-super_admin session, subscribe to the same Realtime channel and confirm no rows are delivered — repeat as super_admin and confirm rows ARE delivered |
| N8N daily job at 05:00 UTC actually fires and completes end-to-end against real tenant data | AI-02 | Requires the live N8N instance and real ad_accounts to observe a genuine scheduled run, not just workflow JSON structure | After activation, confirm via `sync_jobs`-equivalent logging (or N8N execution history) that the job ran at 05:00 UTC and produced insights/alerts for all tenants with configured ad_accounts |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (pending gsd-plan-checker pass across all Phase 4 PLAN.md files)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (5 test files scaffolded, per above)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter (pending plan-checker approval)

**Approval:** pending — awaiting `/gsd-plan-phase 4`'s planner + plan-checker pass
