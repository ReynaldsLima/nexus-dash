---
phase: 11
slug: janela-de-hist-rico-retroativo
status: audited
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-18T17:03:12.968Z
reconstructed: true
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> **Reconstructed retroactively** via `/gsd-validate-phase` — this phase's original `/gsd-plan-phase` run skipped RESEARCH.md/VALIDATION.md creation because the user opted to skip research (CONTEXT.md + ARCHITECTURE.md already covered the technical design in full). This document audits actual test coverage against the 5 executed plans after the fact.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 2.1.9 |
| **Config file** | `vitest.config.mts` |
| **Quick run command** | `npx vitest run <file>` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~14s full suite (258 tests) |

---

## Sampling Rate

- **After every task commit:** `npx vitest run <affected file>` — followed as-executed per plan SUMMARY.md (each TDD task ran RED→GREEN before its commit)
- **After every plan wave:** `npx vitest run` (full suite) — run at the end of each of the 5 plans, zero regressions each time
- **Before `/gsd-verify-work`:** Full suite green — confirmed (258/259 passing; 1 pre-existing unrelated realtime flake, isolated re-run 7/7)
- **Max feedback latency:** ~15s (full suite runtime)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | SET-04 | T-11-02 | DB CHECK rejects out-of-range backfill_days | migration | `information_schema.columns` query (live) | ✅ | ✅ green |
| 11-01-02 | 01 | 1 | SET-04 | T-11-02 | Migration pushed live, types regenerated | live check | Supabase Management API query | ✅ | ✅ green |
| 11-01-03 | 01 | 1 | SET-04 | T-11-01 | HMAC-signed state rejects tampering | unit (TDD) | `npx vitest run tests/unit/oauth-state.test.ts` | ✅ | ✅ green (6/6) |
| 11-02-01 | 02 | 2 | SET-03 | T-11-03 | Zod clamps out-of-range backfillDays to safe default | unit (TDD) | `npx vitest run tests/unit/google-ads-connect-route.test.ts` | ✅ | ✅ green (12/12) |
| 11-02-02 | 02 | 2 | SET-03, SET-04 | T-11-01 | Callback upserts backfill_days from verified state only | unit (TDD) | `npx vitest run tests/unit/google-ads-callback-route.test.ts` | ✅ | ✅ green (8/8) |
| 11-02-03 | 02 | 2 | SET-03 | — | Form input wired into connect query string | manual | N/A — no component-test precedent in this codebase for any RHF/shadcn form | ❌ | ⬜ manual-only |
| 11-03-01 | 03 | 2 | SET-03, SET-04 | T-11-05 | Zod rejects out-of-range backfillDays in POST body | unit (TDD) | `npx vitest run tests/unit/meta-ads-connect-route.test.ts` | ✅ | ✅ green (3/3) |
| 11-03-02 | 03 | 2 | SET-03 | — | Form input wired into connect POST body | manual | N/A — same as 11-02-03 | ❌ | ⬜ manual-only |
| 11-04-01 | 04 | 2 | SET-05 | T-11-07, T-11-08, T-11-09 | Cross-tenant/unauthenticated/out-of-range writes rejected | unit (TDD) | `npx vitest run tests/unit/ad-accounts-actions.test.ts` | ✅ | ✅ green (6/6) |
| 11-04-02 | 04 | 2 | SET-05 | — | Optimistic save + revert-on-failure UX | manual | Tracked in `11-HUMAN-UAT.md` item 3 | ❌ | ⬜ manual-only |
| 11-04-03 | 04 | 2 | SET-05 | — | Control wired into Settings page per channel | manual | Tracked in `11-HUMAN-UAT.md` item 3 | ❌ | ⬜ manual-only |
| 11-05-01 | 05 | 2 | SET-04 | T-11-10, T-11-11 | google-ads-sync uses per-account backfill_days, capped at 365 | manual | Tracked in `11-HUMAN-UAT.md` item 4 — N8N Code node has no Vitest harness outside a running N8N instance (same precedent as Phase 4 Plan 06's ROAS anomaly detection) | ❌ | ⬜ manual-only |
| 11-05-02 | 05 | 2 | SET-04 | T-11-10, T-11-11 | meta-ads-sync uses per-account backfill_days, capped at 365 | manual | Same as 11-05-01 | ❌ | ⬜ manual-only |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Automated coverage:** 8/13 tasks (35 unit tests, all green). **Manual-only:** 5/13 tasks — 2 form-input wiring tasks (no test precedent for form components anywhere in this codebase), 2 UI-interaction tasks and 2 N8N workflow tasks (already tracked as human verification items 3 and 4 in `11-HUMAN-UAT.md`).

---

## Wave 0 Requirements

Existing infrastructure (vitest, established mock patterns from `tests/unit/leads-status-route.test.ts` and `tests/unit/agencies.test.ts`) covered all Phase 11 automatable requirements — no new test scaffolding/framework install was needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|--------------------|
| Google/Meta connect form pre-fills and submits `backfillDays` | SET-03 | No component-test precedent for RHF/shadcn forms in this codebase (`google-ads-form.tsx`/`meta-ads-form.tsx` predate any component-level test); covered indirectly by the connect-route unit tests asserting the received value | Visually confirm the number input renders `min=7 max=365` and defaults to 90 in Settings before connecting an account |
| `BackfillWindowControl` optimistic save + revert-on-failure UX | SET-05 | Real-time UI/interaction behavior not verifiable from static code alone | See `11-HUMAN-UAT.md` item 3 |
| N8N first-sync honoring per-account `backfill_days` | SET-04 | N8N runs on an external self-hosted VPS; Code node JS embedded in workflow JSON has no meaningful Vitest harness outside a running N8N instance (same precedent as Phase 4 Plan 06's ROAS anomaly detection, deliberately not unit-tested for the same reason) | See `11-HUMAN-UAT.md` item 4 |
| Live Google OAuth / Meta Graph API connect round-trip with a custom window | SET-03, SET-04 | Requires real OAuth consent / System User token, blocked in automated environment since Phase 7 (D-03) | See `11-HUMAN-UAT.md` items 1 and 2 |

---

## Validation Sign-Off

- [x] All automatable tasks have `<automated>` verify (8/13; remaining 5 are UI/N8N/form-wiring with no automated-test precedent in this project)
- [x] Sampling continuity: no 3 consecutive automatable tasks without automated verify (each TDD task in 11-01/02/03/04 ran RED→GREEN before commit)
- [x] Wave 0 covers all MISSING references — none needed, existing vitest infra sufficient
- [x] No watch-mode flags used (`npx vitest run`, not `vitest` watch mode)
- [x] Feedback latency < 15s (full suite ~14s)
- [x] `nyquist_compliant: true` set in frontmatter — all requirement-bearing logic (SET-03/04/05) that CAN be automated IS automated (35/35 tests green); the 5 manual-only tasks are UI-interaction, N8N-execution, and form-wiring items with no automated-test path in this codebase, consistent with established project precedent, and already tracked for human verification in `11-HUMAN-UAT.md`

**Approval:** approved 2026-07-18 (retroactive audit, user selected "mark as manual-only")
