# Project State

## Project Reference
See: .planning/PROJECT.md (updated 2026-05-10)
**Core value:** Super Admin sees and optimizes campaigns for all clients in one place, with actionable AI recommendations — without logging into multiple ad platforms.
**Current focus:** Phase 0

---

## Status
- Current phase: 0
- Overall progress: 0%
- Phases complete: 0/5

```
[----------] 0%
Phase 0: Infrastructure
```

---

## Phase Status

| # | Phase | Status | Completed |
|---|-------|--------|-----------|
| 0 | Infrastructure | Not started | — |
| 1 | Foundation | Not started | — |
| 2 | Data Pipeline | Not started | — |
| 3 | Dashboard UI | Not started | — |
| 4 | AI Insights | Not started | — |

---

## Performance Metrics

| Metric | Value |
|--------|-------|
| Requirements total | 26 |
| Requirements complete | 0 |
| Plans written | 0 |
| Plans complete | 0 |
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

### Open Questions (Unresolved)

1. Google OAuth App Publication Status — must be in "Production" before connecting real accounts; Testing mode tokens expire in 7 days. Status unknown.
2. Meta Business Manager + System User — confirmed for how many of the 3 initial tenants?
3. Google Ads Standard Access developer token — request submitted? Basic Access quota may be pressured during 90-day backfill with 3 tenants.
4. Revenue data for ROAS — how to handle tenants without conversion value tracking configured?
5. Default retroactive history window — 90 days fixed or configurable (30/60/90)?
6. Supabase project region — must match `vercel.json` regions setting to minimize latency. Which AWS region?

### Blockers

None yet.

### TODOs (Phase 0)

- [ ] Provision VPS (minimum 2 GB RAM); install N8N with Postgres backend
- [ ] Generate and persist `N8N_ENCRYPTION_KEY` (`openssl rand -hex 32`) before adding any credentials
- [ ] Secure N8N editor (HTTP basic auth or Cloudflare Access; never expose to open internet — CVE-2025-68613 CVSS 10.0)
- [ ] Create two Supabase projects: prod and staging
- [ ] Configure Vercel project with Supabase integration; confirm push-to-main deploy works
- [ ] Set `vercel.json` region to match Supabase AWS region
- [ ] Submit Google Ads Standard Access developer token request
- [ ] Confirm Meta Business Manager + System User status per tenant
- [ ] Confirm Google OAuth App Publication Status

---

## Session Continuity

**Last updated:** 2026-05-10
**Last action:** Roadmap created — all 26 requirements mapped across 5 phases (0–4)
**Next action:** `/gsd-plan-phase 0` to create execution plan for Infrastructure phase
**Roadmap:** .planning/ROADMAP.md
**Requirements:** .planning/REQUIREMENTS.md
