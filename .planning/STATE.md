---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: in_progress
stopped_at: Phase 01 discuss complete — CONTEXT.md written, ready for plan-phase
last_updated: "2026-05-10T23:59:00.000Z"
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 1
  completed_plans: 1
  percent: 10
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-10)
**Core value:** Super Admin sees and optimizes campaigns for all clients in one place, with actionable AI recommendations — without logging into multiple ad platforms.
**Current focus:** Phase 01 — Foundation (discuss complete, ready to plan)

---

## Status

- Current phase: 1 (discuss complete — CONTEXT.md written)
- Overall progress: 10%
- Phases complete: 0/5

```
[=>--------] 10%
Phase 0: Infrastructure (done, 3 deferred items)
Phase 1: Foundation (discuss ✓ — run /gsd-plan-phase 1)
```

---

## Phase Status

| # | Phase | Status | Completed |
|---|-------|--------|-----------|
| 0 | Infrastructure | In Progress (3 deferred items) | — |
| 1 | Foundation | Discuss ✓ — Ready to plan | — |
| 2 | Data Pipeline | Not started | — |
| 3 | Dashboard UI | Not started | — |
| 4 | AI Insights | Not started | — |

---

## Performance Metrics

| Metric | Value |
|--------|-------|
| Requirements total | 26 |
| Requirements complete | 0 |
| Plans written | 1 |
| Plans complete | 1 |
| Phases complete | 0/5 |

---

## Accumulated Context

### Key Decisions Locked

- Stack: Next.js 15 (App Router) + Supabase + N8N self-hosted + Vercel + Claude Sonnet 4.6
- RLS pattern: always `(SELECT get_tenant_id())` wrapper — never bare function call in USING clause
- N8N writes: HTTP Request node + PostgREST REST API only — never native Supabase node (GitHub bug #17020)
- Claude API calls: Next.js Route Handlers only — streaming enabled, XML-tagged data injection, N8N triggers via webhook
- `daily_rollups` table must be created in Phase 2 and populated before Phase 3 dashboard queries run
- `attribution_window` column in `campaign_metrics` from Phase 2 day one — no migration later
- API versions (Google Ads, Meta Ads): single constant per workflow, never hardcoded inline
- `super_admin` role stored in `auth.users.app_metadata` (not in `tenant_users`)
- Deployment: main → Vercel prod automatic; no PR review gates in v1
- Staging schema in same Supabase project as prod (not separate project) — shared auth.users, test users use `test-` email prefix
- Supabase Vercel Integration used — env var name is `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (NOT deprecated `NEXT_PUBLIC_SUPABASE_ANON_KEY`)

### Infrastructure Provisioned (Phase 00)

- **Supabase project:** rvkkvjitfddtbdpkupok (sa-east-1, São Paulo) — https://rvkkvjitfddtbdpkupok.supabase.co
- **Vercel project:** nexus-dash (gru1 region) — https://nexus-dash-h39vlzi71-riguettilimatech-8948s-projects.vercel.app
- **N8N:** https://evo.wrdigitalgroup.com.br — Queue Mode confirmed (PIDs: main 3168309, worker 3164219, webhook 3164459), process manager and version UNVERIFIED

### Open Questions (Unresolved)

1. Revenue data for ROAS — how to handle tenants without conversion value tracking configured?
2. Default retroactive history window — 90 days fixed or configurable (30/60/90)?

### Resolved Questions

- Google OAuth App: already in Production — no expiry issue ✓
- Meta Business Manager + System User: configured for initial tenants ✓
- Supabase region: sa-east-1 São Paulo — `vercel.json` uses `"regions": ["gru1"]` ✓
- Google Ads Developer Token: does NOT exist — DEFERRED, must be submitted ASAP

### Blockers

- **CRITICAL:** Google Ads Developer Token missing — Phase 2 CANNOT proceed until Basic Access approved. Submit at https://ads.google.com/aw/apicenter IMMEDIATELY. Review timeline 2-10+ business days.
- **HIGH:** N8N Tasks 1+2 deferred — CVE-2025-68613 (CVSS 10.0) status unverified, encryption key persistence unverified, process manager unknown. Must resolve before Phase 2 N8N workflows.
- **MEDIUM:** Meta Business Manager — per-tenant System User access not confirmed. Needed for Phase 2.

### Deferred Items from Phase 00 Plan 01

- [ ] **Task 1 (N8N health):** SSH into Hostinger VPS — verify version >= 1.88.0, process manager, auth endpoint, DB type. CVE-2025-68613 status unknown.
- [ ] **Task 2 (N8N encryption key):** SSH into VPS — verify N8N_ENCRYPTION_KEY persisted to disk, set execution pruning env vars. Depends on Task 1.
- [ ] **Task 7 (Google Ads token):** Submit Basic/Standard Access application at https://ads.google.com/aw/apicenter — CRITICAL PATH BLOCKER for Phase 2.
- [ ] **Meta Business Manager:** Confirm System User with Ads Manager access per tenant.
- [ ] **ANTHROPIC_API_KEY:** Adicionar em `.env.local` (local) e no Vercel Dashboard (Production + Preview + Development) — necessário para Fase 4 (AI Insights) e para qualquer Route Handler que chame a Claude API.

---

## Session Continuity

**Last updated:** 2026-05-10
**Last action:** Phase 01 discuss complete — 01-CONTEXT.md + 01-DISCUSSION-LOG.md committed (9fba1e8)
**Stopped at:** Phase 01 discuss complete — ready for planning
**Next action:** Run `/gsd-plan-phase 1` to create Phase 1 execution plan
**Roadmap:** .planning/ROADMAP.md
**Requirements:** .planning/REQUIREMENTS.md
