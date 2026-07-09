---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: unknown
stopped_at: Completed 05-02-PLAN.md
last_updated: "2026-07-09T22:58:39.516Z"
progress:
  total_phases: 7
  completed_phases: 5
  total_plans: 29
  completed_plans: 22
  percent: 76
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-10)
**Core value:** Super Admin sees and optimizes campaigns for all clients in one place, with actionable AI recommendations — without logging into multiple ad platforms.
**Current focus:** Phase 05 — agencia-multi-cliente

---

## Status

- Current phase: 05 — Agência Multi-Cliente (2/9 plans complete)
- Overall progress: 76% (22/29 plans complete)
- Phases complete: 5/7

```
[████████░░] 76%
Phase 0: Infrastructure (done, 3 deferred items)
Phase 1: Foundation (all 5 plans complete — auth, DB, plumbing, UI, tenant management)
Phase 2: Data Pipeline (4/5 plans complete — Plans 01-04 done; Plan 05 pending)
Phase 03.1: Leads Management via Google Sheets Integration (3/3 plans complete — data layer + write-back route + editable status dropdown, verified in production)
Phase 05: Agência Multi-Cliente (2/9 plans complete — Plan 01 Wave 0 test scaffolds + Plan 02 agency data layer done)
```

---

## Phase Status

| # | Phase | Status | Completed |
|---|-------|--------|-----------|
| 0 | Infrastructure | Done (3 deferred items) | 2026-05-10 |
| 1 | Foundation | ✅ Concluída — UAT aprovado | 2026-05-16 |
| 2 | Data Pipeline | Bloqueada (ver pré-requisitos) | — |
| 03.1 | Leads Management via Google Sheets Integration | ✅ Concluída — 3/3 plans, verificado em produção | 2026-07-05 |
| 3 | Dashboard UI | Not started | — |
| 4 | AI Insights | Not started | — |
| 5 | Agência Multi-Cliente | Em andamento — 2/9 plans (Plan 01 Wave 0 test scaffolds + Plan 02 agency data layer concluídos) | — |

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
| Phase 03.1 P03 | 87min | 2 tasks | 5 files |
| Phase 05-agencia-multi-cliente P01 | 12min | 2 tasks | 4 files |
| Phase 05-agencia-multi-cliente P02 | 33min | 2 tasks | 5 files |

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
- Phase 03.1 Plan 03: Editable status dropdown reuses `cat()`/`CATEGORY_LABELS`/`CATEGORY_BG` from `lib/leads.ts`, native `<select>`, no new UI dependency (no sonner) — optimistic write with revert-on-failure, no retry (D-06/D-07)
- Phase 03.1 Plan 03: `GET /api/leads` now tagged per-tenant (`leads-${tenantSlug}`) and invalidated via `revalidateTag(tag, 'max')` right after a successful status write — without this, the pre-existing 60s fetch cache made successful writes look like silent failures on reload; `revalidateTag()` requires a second (`profile`) argument in Next.js 16
- Phase 03.1 Plan 03: `lib/leads.ts` and `app/api/leads/route.ts` (pre-existing, written outside GSD flow) committed to git for the first time (`572b5ed`) — their absence from git broke the Vercel Turbopack production build as soon as this plan's `page.tsx` change was pushed
- Phase 03.1 code review (CR-01, CRITICAL, fixed): `tenants_member_select` RLS policy grants row SELECT to any authenticated tenant member regardless of role — `sheets_service_account` inherited that, letting a `viewer` read the write-capable Service Account private key directly via PostgREST. Fixed via migration `0016` (`REVOKE SELECT` on `tenants` from `authenticated`, re-`GRANT` only on non-sensitive columns) plus switching `app/api/leads/[id]/status/route.ts` to `createServiceClient()` for that read — same pattern as `app/api/meta-ads/connect/route.ts`. Verified live via `information_schema.column_privileges`.
- Phase 03.1 code review (WR-01/WR-02, fixed): `status` restricted to a Zod `enum` of the 4 `CATEGORY_LABELS` values (was free text — Sheets formula injection risk via `USER_ENTERED`); `sheets_service_account` shape now validated with `ServiceAccountSchema.safeParse` before use (was an unchecked `as unknown as` cast)
- **Column-level Postgres grants matter, not just RLS:** any new sensitive column added to a table with a permissive row-level SELECT policy (like `tenants_member_select`) is exposed to every role that policy covers unless explicitly column-revoked — RLS alone does not scope by column
- Phase 05 Plan 01: Wave 0 test scaffolds (`tests/agency-rls.test.ts`, `tests/integration/tenant-role-migration.test.ts`, `tests/agencies.test.ts`, extended `tests/unit/leads-status-route.test.ts`) reuse the exact skip-if-no-env (`tests/rls.test.ts`) and mock-based (`tests/tenants.test.ts`) patterns from Phase 1/03.1 — no new env vars or mock infra introduced; each file is the designated verification target for a later Phase 5 plan (02, 03, 05, 08)
- Phase 05 Plan 02: Migrations 0017-0019 (agencies/agency_users/agency_tenants tables + RLS + get_agency_id(), 5-table _agency_select policy pass, custom_access_token_hook agency branch) applied verbatim to the live Supabase project — matched Phase 1's conventions exactly, no adaptation needed
- **CRITICAL discovery (Phase 05 Plan 02):** the live project's Custom Access Token Hook (Supabase Dashboard → Authentication → Hooks) is wired to an HTTP Edge Function (`custom-access-token`), NOT the `public.custom_access_token_hook` Postgres function that migrations 0005/0019 maintain — confirmed via Management API (`hook_custom_access_token_uri` points at the Edge Function). That Edge Function never queries `agency_users`/`tenant_users`; it only echoes pre-existing `app_metadata` and writes the tenant slug under the wrong key (`slug` instead of `tenant_slug`, which `app/[tenant-slug]/layout.tsx` reads). This means the entire Postgres-hook architecture (D-13/D-14) is currently dead code in production. Not fixed (Rule 4 — changes auth for every live session); flagged as a blocker for Plan 04/07. See `.planning/phases/05-agencia-multi-cliente/deferred-items.md` and `05-02-SUMMARY.md`.
- Phase 05 Plan 02: `tests/agency-rls.test.ts`'s RLS fixtures preset `app_metadata: { role: 'agency', agency_id }` directly at `admin.createUser()` time (mirrors `tests/integration/sync-jobs-rls.test.ts`'s existing tenant_admin pattern) rather than relying on the Custom Access Token Hook — necessary given the hook-wiring bug above, and sufficient to verify the `_agency_select` RLS policies themselves (AGENCY-06)

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
- Live Supabase Auth Hook wired to an unrelated Edge Function (custom-access-token), not public.custom_access_token_hook — agency role/agency_id will not populate on real sign-in until Dashboard hook selection is corrected (see 05-02-SUMMARY.md Deviations)

### Roadmap Evolution

- Phase 03.1 inserted after Phase 3: Leads Management via Google Sheets integration (URGENT) — código já escrito fora do fluxo GSD (`app/api/leads/`, `lib/leads.ts`, `supabase/migrations/0012_add_google_sheets_to_tenants.sql`), formalizado em 2026-07-04. Não planejado ainda — rodar `/gsd-plan-phase 03.1`.
- Phase 5 added (2026-07-05): Access Modules — Multi-Client Agency. Origem: exploração via `/gsd-explore` após fechamento da fase 03.1 — usuário pediu divisão em 3 módulos (Super Admin / Agência / Cliente). Não planejado ainda — rodar `/gsd-discuss-phase 5` antes de `/gsd-plan-phase 5` dado o tamanho da mudança estrutural (nova entidade Agência, grant N:N, extensão de RLS).

### Deferred Items from Phase 00 Plan 01

- [ ] **Task 1 (N8N health):** SSH into Hostinger VPS — verify version >= 1.88.0, process manager, auth endpoint, DB type. CVE-2025-68613 status unknown.
- [ ] **Task 2 (N8N encryption key):** SSH into VPS — verify N8N_ENCRYPTION_KEY persisted to disk, set execution pruning env vars. Depends on Task 1.
- [ ] **Task 7 (Google Ads token):** Submit Basic/Standard Access application at https://ads.google.com/aw/apicenter — CRITICAL PATH BLOCKER for Phase 2.
- [ ] **Meta Business Manager:** Confirm System User with Ads Manager access per tenant.
- [ ] **ANTHROPIC_API_KEY:** Adicionar em `.env.local` (local) e no Vercel Dashboard (Production + Preview + Development) — necessário para Fase 4 (AI Insights) e para qualquer Route Handler que chame a Claude API.

---

## Session Continuity

**Last updated:** 2026-07-09
**Last action:** Fase 05 (Agência Multi-Cliente) Plano 02 executado — agency data layer. Migrations `0017`/`0018`/`0019` criadas e aplicadas na live database (rvkkvjitfddtbdpkupok): tabelas `agencies`/`agency_users`/`agency_tenants` com RLS + `get_agency_id()`; 5 policies `_agency_select` (tenants, campaign_metrics, ad_accounts, sync_jobs, daily_rollups); `custom_access_token_hook` estendido com branch de agência. `types/database.types.ts` regenerado. `tests/agency-rls.test.ts` teve seus 7 `it.todo()` preenchidos com asserções reais — todos os 8 testes passam contra a live database. **Descoberta CRÍTICA:** o Auth Hook realmente ativo no Dashboard aponta para uma Edge Function (`custom-access-token`) não relacionada, não para `public.custom_access_token_hook` — confirmado via Management API. Essa Edge Function nunca consulta `agency_users`/`tenant_users`; logins reais de agência NÃO recebem `role='agency'`/`agency_id` até essa configuração ser corrigida. Não corrigido nesta plan (Rule 4 — afeta toda sessão autenticada em produção); logado em `deferred-items.md` e `05-02-SUMMARY.md`, e registrado como blocker em STATE.md. Testes contornaram o problema pré-configurando `app_metadata` diretamente em `admin.createUser()` (mesmo padrão de `sync-jobs-rls.test.ts`). Suíte completa: 128 passed / 1 skipped / 25 todo, `npm test` e `npm run build` verdes. Os mesmos 4 erros pré-existentes de `tsc --noEmit` (Plan 01) permanecem, não tocados.
**Stopped at:** Completed 05-02-PLAN.md
**Next action:** Executar Plano 03 da Fase 05 (Cliente role collapse — `tenant_users.role` para valor único). **Recomendado antes de Plano 04/07:** resolver o blocker do Auth Hook (trocar seleção no Supabase Dashboard → Authentication → Hooks → Custom Access Token para `public.custom_access_token_hook`, ou atualizar a Edge Function para replicar a lógica de lookup) — sem isso, login real de agência não popula `role`/`agency_id` no JWT. Pendências não bloqueantes seguem: retomar Fase 2 (Data Pipeline, Plan 05) bloqueada até Google Ads Developer Token ser aprovado; autorar LEADS-01..LEADS-05 em REQUIREMENTS.md; commitar `app/[tenant-slug]/leads/agente/`/`app/api/leads/chat/`; corrigir os 4 erros de `tsc` pré-existentes listados em deferred-items.md antes do Plano 03 (role collapse) para evitar mascarar uma regressão de tipo real.
**Roadmap:** .planning/ROADMAP.md
**Requirements:** .planning/REQUIREMENTS.md
