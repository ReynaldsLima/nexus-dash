---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: unknown
stopped_at: Completed 03.1-02-PLAN.md
last_updated: "2026-07-05T04:00:32.459Z"
progress:
  total_phases: 6
  completed_phases: 4
  total_plans: 20
  completed_plans: 19
  percent: 95
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-10)
**Core value:** Super Admin sees and optimizes campaigns for all clients in one place, with actionable AI recommendations — without logging into multiple ad platforms.
**Current focus:** Phase 03.1 — leads-management-via-google-sheets-integration

---

## Status

- Current phase: 03.1 — Leads Management via Google Sheets Integration (Plan 02/03 complete)
- Overall progress: 95% (19/20 plans complete)
- Phases complete: 4/6

```
[██████████] 95%
Phase 0: Infrastructure (done, 3 deferred items)
Phase 1: Foundation (all 5 plans complete — auth, DB, plumbing, UI, tenant management)
Phase 2: Data Pipeline (4/5 plans complete — Plans 01-04 done; Plan 05 pending)
Phase 03.1: Leads Management via Google Sheets Integration (Plan 02/03 complete — write-back route: lib/sheets.ts + PATCH /api/leads/[id]/status)
```

---

## Phase Status

| # | Phase | Status | Completed |
|---|-------|--------|-----------|
| 0 | Infrastructure | Done (3 deferred items) | 2026-05-10 |
| 1 | Foundation | ✅ Concluída — UAT aprovado | 2026-05-16 |
| 2 | Data Pipeline | Bloqueada (ver pré-requisitos) | — |
| 3 | Dashboard UI | Not started | — |
| 4 | AI Insights | Not started | — |

---

## Performance Metrics

| Metric | Value |
|--------|-------|
| Requirements total | 26 |
| Requirements complete | 3 (AUTH-03, AUTH-04, AUTH-05) |
| Plans written | 5 |
| Plans complete | 5 |
| Phases complete | 1/5 |

---
| Phase 01 P03 | 30 | 3 tasks | 26 files |
| Phase 01 P05 | 10 | 2 tasks | 10 files |
| Phase 02-data-pipeline P03 | 30 | 2 tasks | 1 files |
| Phase 02-data-pipeline P04 | 45 | 2 tasks | 1 files |
| Phase 02-data-pipeline P05 | 11207 | 4 tasks | 5 files |
| Phase 03.1-leads-management-via-google-sheets-integration P01 | 6min | 2 tasks | 4 files |
| Phase 03.1-leads-management-via-google-sheets-integration P02 | 25min | 3 tasks | 5 files |

## Accumulated Context

### Key Decisions Locked

- Stack: Next.js 15 (App Router) + Supabase + N8N self-hosted + Vercel + Claude Sonnet 4.6
- RLS pattern: always `(SELECT get_tenant_id())` wrapper — never bare function call in USING clause
- N8N writes: HTTP Request node + PostgREST REST API only — never native Supabase node (GitHub bug #17020)
- Claude API calls: Next.js Route Handlers only — streaming enabled, XML-tagged data injection, N8N triggers via webhook
- `daily_rollups` table must be created in Phase 2 and populated before Phase 3 dashboard queries run
- `attribution_window` column in `campaign_metrics` from Phase 2 day one — no migration later
- API versions (Google Ads, Meta Ads): single constant per workflow, never hardcoded inline
- Meta Ads attribution_window: '7d_click' fixed — '7d_view' removed by Meta in Jan/2026 (Pitfall 3)
- Meta Ads N8N import deferred: JSON validated automatically; import when System User token provisioned per tenant in Supabase Vault
- `super_admin` role stored in `auth.users.app_metadata` (not in `tenant_users`)
- Deployment: main → Vercel prod automatic; no PR review gates in v1
- Staging schema in same Supabase project as prod (not separate project) — shared auth.users, test users use `test-` email prefix
- Supabase Vercel Integration used — env var name is `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (NOT deprecated `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- Phase 03.1 Plan 01: Installed `google-auth-library` (not full `googleapis`, ~600KB vs ~207MB) for Service Account OAuth2 write auth to Google Sheets
- Phase 03.1 Plan 01: `tenants.sheets_service_account` (JSONB) stored as a separate column from `sheets_api_key` — existing read path stays untouched, write credential isolated per-tenant
- Phase 03.1 Plan 02: PATCH `/api/leads/[id]/status` role gate restricted to `super_admin`/`tenant_admin` — `viewer` explicitly rejected with 403, mirrors `app/api/meta-ads/connect/route.ts` pattern (resolves RESEARCH OQ #1)
- Phase 03.1 Plan 02: `lead.id` (0-based array index from GET route) maps to sheet row via `id + 2` (`Leads!F{row}`) — deterministic while row order is stable; no pre-write row revalidation, no retry on Sheets API errors (D-07/D-08)
- Phase 03.1 Plan 02: `google-auth-library`'s `JWT.fetch()` must be called with a single `GaxiosOptions` object (`{ url, method, data }`), not the two-arg `fetch(url, init)` form — `data` is not part of `RequestInit`

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

### Roadmap Evolution

- Phase 03.1 inserted after Phase 3: Leads Management via Google Sheets integration (URGENT) — código já escrito fora do fluxo GSD (`app/api/leads/`, `lib/leads.ts`, `supabase/migrations/0012_add_google_sheets_to_tenants.sql`), formalizado em 2026-07-04. Não planejado ainda — rodar `/gsd-plan-phase 03.1`.

### Deferred Items from Phase 00 Plan 01

- [ ] **Task 1 (N8N health):** SSH into Hostinger VPS — verify version >= 1.88.0, process manager, auth endpoint, DB type. CVE-2025-68613 status unknown.
- [ ] **Task 2 (N8N encryption key):** SSH into VPS — verify N8N_ENCRYPTION_KEY persisted to disk, set execution pruning env vars. Depends on Task 1.
- [ ] **Task 7 (Google Ads token):** Submit Basic/Standard Access application at https://ads.google.com/aw/apicenter — CRITICAL PATH BLOCKER for Phase 2.
- [ ] **Meta Business Manager:** Confirm System User with Ads Manager access per tenant.
- [ ] **ANTHROPIC_API_KEY:** Adicionar em `.env.local` (local) e no Vercel Dashboard (Production + Preview + Development) — necessário para Fase 4 (AI Insights) e para qualquer Route Handler que chame a Claude API.

---

## Session Continuity

**Last updated:** 2026-07-05
**Last action:** Fase 03.1 Plano 02 concluído — `lib/sheets.ts` (rowForId/statusRange/mapSheetsError/updateLeadStatus) e rota `PATCH /api/leads/[id]/status` implementados com role gate, validação de id, e mapeamento de erro; suíte completa e `tsc --noEmit` verdes
**Stopped at:** Completed 03.1-02-PLAN.md
**Next action:** Executar 03.1-03-PLAN.md (UI do dropdown de status de leads) — requer que o usuário crie a Service Account no Google Cloud, compartilhe a planilha como Editor e insira o JSON em `tenants.sheets_service_account` para testar a escrita fim-a-fim em produção
**Roadmap:** .planning/ROADMAP.md
**Requirements:** .planning/REQUIREMENTS.md
