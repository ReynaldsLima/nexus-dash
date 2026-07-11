---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: unknown
stopped_at: Completed 04-05-PLAN.md
last_updated: "2026-07-11T13:42:33.755Z"
progress:
  total_phases: 9
  completed_phases: 6
  total_plans: 35
  completed_plans: 33
  percent: 94
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-10)
**Core value:** Super Admin sees and optimizes campaigns for all clients in one place, with actionable AI recommendations — without logging into multiple ad platforms.
**Current focus:** Phase 04 — ai-insights

---

## Status

- Current phase: 04 — AI Insights (4/6 plans complete — gap closure per v1.0-MILESTONE-AUDIT.md)
- Overall progress: 33/35 planned plans complete (94%) — 6/9 phases fully done, 3 gap-closure phases (4, 6, 7) in progress/pending
- Phases complete: 6/9

```
[█████████░] 94%
Phase 0: Infrastructure (done, 3 deferred items)
Phase 1: Foundation (all 5 plans complete — auth, DB, plumbing, UI, tenant management)
Phase 2: Data Pipeline (4/5 plans complete — Plans 01-04 done; Plan 05 pending)
Phase 03.1: Leads Management via Google Sheets Integration (3/3 plans complete — data layer + write-back route + editable status dropdown, verified in production)
Phase 04: AI Insights (4/6 plans complete — lib/ai/ core + on-demand streaming route (AI-01 backend) + ai_insights/anomaly_alerts (RLS+Realtime) + in-app anomaly toast/sidebar badge (AI-04 frontend half) live; Plan 04 (insights UI) and Plan 06 (daily job) pending)
Phase 05: Agência Multi-Cliente (9/9 plans complete — Plan 09 UAT found a phase-blocking bug mid-verification (getUser().app_metadata vs JWT claims), fixed via /gsd-debug, all 7 UAT scripts re-verified live and passed)
```

---

## Phase Status

| # | Phase | Status | Completed |
|---|-------|--------|-----------|
| 0 | Infrastructure | Done (3 deferred items) | 2026-05-10 |
| 1 | Foundation | ✅ Concluída — UAT aprovado | 2026-05-16 |
| 2 | Data Pipeline | Bloqueada (ver pré-requisitos) | — |
| 03.1 | Leads Management via Google Sheets Integration | ✅ Concluída — 3/3 plans, verificado em produção | 2026-07-05 |
| 3 | Dashboard UI | ✅ Concluída — 6/6 plans, 15/15 must-haves verificados (`03-VERIFICATION.md`) | 2026-06-05 |
| 4 | AI Insights | Em execução — Plano 05/6 concluído (lib/ai/ core + POST /api/insights/generate streaming route + ai_insights/anomaly_alerts RLS+Realtime + toast/badge de anomalia in-app, AI-04 frontend) | — |
| 5 | Agência Multi-Cliente | ✅ Concluída — 9/9 plans, UAT completo (achou e corrigiu bug bloqueante via /gsd-debug) | 2026-07-10 |
| 6 | Security & Consistency — Leads Endpoints (gap closure) | Não planejada — criada via `/gsd-plan-milestone-gaps` | — |
| 7 | Google Ads OAuth2 Connect (gap closure) | Não planejada — criada via `/gsd-plan-milestone-gaps` | — |

---

## Performance Metrics

| Metric | Value |
|--------|-------|
| Requirements total | 26 core (v1) + 5 LEADS + 8 AGENCY = 39, + SET-01/AGENCY-08 gap-closure re-scoping (see v1.0-MILESTONE-AUDIT.md) |
| Requirements complete | 33/39 satisfied, 1 partial (AGENCY-08), 5 unsatisfied (AI-01..04, SET-01) — per `.planning/v1.0-MILESTONE-AUDIT.md` (2026-07-10) |
| Plans written | 29 |
| Plans complete | 29 |
| Phases complete | 6/9 (0, 1, 03.1, 5 done; 2 code-complete/externally blocked; 3 done; 4/6/7 pending — gap closure in progress) |
| Phase 04-ai-insights P01 | 8min | 2 tasks | 5 files |
| Phase 04-ai-insights P02 | 14min | 2 tasks | 7 files |
| Phase 04-ai-insights P03 | 12min | 3 tasks | 7 files |
| Phase 04-ai-insights P05 | 15min | 2 tasks | 8 files |

### Per-Plan Execution Log

| Phase/Plan | Duration | Tasks | Files Modified |
|------------|----------|-------|-----------------|
| Phase 01 P03 | 30min | 3 tasks | 26 files |
| Phase 01 P05 | 10min | 2 tasks | 10 files |
| Phase 02-data-pipeline P03 | 30min | 2 tasks | 1 files |
| Phase 02-data-pipeline P04 | 45min | 2 tasks | 1 files |
| Phase 02-data-pipeline P05 | 11207 (sec, likely a logging unit inconsistency — not re-derived retroactively) | 4 tasks | 5 files |
| Phase 03.1-leads-management-via-google-sheets-integration P01 | 6min | 2 tasks | 4 files |
| Phase 03.1-leads-management-via-google-sheets-integration P02 | 25min | 3 tasks | 5 files |
| Phase 03.1 P03 | 87min | 2 tasks | 5 files |
| Phase 05-agencia-multi-cliente P01 | 12min | 2 tasks | 4 files |
| Phase 05-agencia-multi-cliente P02 | 33min | 2 tasks | 5 files |
| Phase 05-agencia-multi-cliente P03 | 19min | 3 tasks | 5 files |
| Phase 05-agencia-multi-cliente P04 | 10min | 3 tasks | 7 files |
| Phase 05-agencia-multi-cliente P05 | 15min | 2 tasks | 2 files |
| Phase 05-agencia-multi-cliente P06 | 25min | 2 tasks | 11 files |
| Phase 05-agencia-multi-cliente P07 | 10min | 2 tasks | 3 files |
| Phase 05-agencia-multi-cliente P08 | 12min | 2 tasks | 2 files |
| Phase 05-agencia-multi-cliente P09 | 4min (Task 1) + ~50min (Task 2 first pass) + ~25min (Task 2 re-verification) | 2 tasks | 0 app files (fix applied by the /gsd-debug session it spawned, 7 files) |

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
- **`supabase.auth.getUser()`'s `user.app_metadata` does NOT reflect Custom Access Token Hook claims — use `supabase.auth.getClaims()` instead.** Found via Phase 05 Plan 09's manual UAT (`/gsd-debug` session `agency-app-metadata-getuser-mismatch`): `getUser()`'s `app_metadata` is the raw, persisted `auth.users.raw_app_meta_data` column, which is only ever set directly for `super_admin`; for `tenant_admin`/`agency`/`viewer`, `role`/`tenant_id`/`tenant_slug`/`agency_id` only exist as claims the hook injects into the JWT at sign-in/refresh, readable via `getClaims()` (or JWT-decode as `proxy.ts` already did). This was a real, live regression affecting 6 call sites — `app/agencia/layout.tsx`, `app/[tenant-slug]/layout.tsx`, `app/agencies/layout.tsx`, `app/tenants/layout.tsx`, `app/api/leads/[id]/status/route.ts`, `app/api/meta-ads/connect/route.ts` — fixed in commit `eec002f`. Any FUTURE code that needs role/tenant/agency identity from `auth.users` must use `getClaims()`, never `getUser().app_metadata`, for non-super_admin roles.
- Phase 05 Plan 01: Wave 0 test scaffolds (`tests/agency-rls.test.ts`, `tests/integration/tenant-role-migration.test.ts`, `tests/agencies.test.ts`, extended `tests/unit/leads-status-route.test.ts`) reuse the exact skip-if-no-env (`tests/rls.test.ts`) and mock-based (`tests/tenants.test.ts`) patterns from Phase 1/03.1 — no new env vars or mock infra introduced; each file is the designated verification target for a later Phase 5 plan (02, 03, 05, 08)
- Phase 05 Plan 02: Migrations 0017-0019 (agencies/agency_users/agency_tenants tables + RLS + get_agency_id(), 5-table _agency_select policy pass, custom_access_token_hook agency branch) applied verbatim to the live Supabase project — matched Phase 1's conventions exactly, no adaptation needed
- **CRITICAL discovery (Phase 05 Plan 02), RESOLVED 2026-07-09:** the live project's Custom Access Token Hook (Supabase Dashboard → Authentication → Hooks) was wired to an HTTP Edge Function (`custom-access-token`), NOT the `public.custom_access_token_hook` Postgres function that migrations 0005/0019 maintain — confirmed via Management API (`hook_custom_access_token_uri` pointed at the Edge Function). That Edge Function never queried `agency_users`/`tenant_users`; it only echoed pre-existing `app_metadata` and wrote the tenant slug under the wrong key (`slug` instead of `tenant_slug`, which `app/[tenant-slug]/layout.tsx` reads). Fixed via `/gsd-debug` session: user switched the Dashboard hook selection to the Postgres function. Verified via Management API + live sign-in test (fresh test user + real `beta-test` tenant_users row → JWT `app_metadata` now correctly populates `role`/`tenant_id`/`tenant_slug`). See `.planning/debug/resolved/auth-hook-wired-to-wrong-function.md` and `.planning/phases/05-agencia-multi-cliente/deferred-items.md`.
- Phase 05 Plan 02: `tests/agency-rls.test.ts`'s RLS fixtures preset `app_metadata: { role: 'agency', agency_id }` directly at `admin.createUser()` time (mirrors `tests/integration/sync-jobs-rls.test.ts`'s existing tenant_admin pattern) rather than relying on the Custom Access Token Hook — necessary given the hook-wiring bug above, and sufficient to verify the `_agency_select` RLS policies themselves (AGENCY-06)
- Phase 05 Plan 03 (AGENCY-07): `tenant_users.role` collapsed to a single surviving value `tenant_admin` via live migration `0020` — pre-migration check (`SELECT role, count(*) FROM tenant_users GROUP BY role`) found only `{tenant_admin: 1}` live, zero `viewer` rows, so the promotive `UPDATE viewer->tenant_admin` was a documented no-op on current data but the `CHECK (role = 'tenant_admin')` constraint tightening still applied and is now live. `createTenantUser` and `components/tenants/add-user-modal.tsx` no longer accept/offer a role choice (D-03 "Cliente" = full access, including lead status edits). Removing the now-impossible "rejects role super_admin" test in `tests/tenants.test.ts` also resolved 2 of the 4 pre-existing `tsc --noEmit` errors flagged in `deferred-items.md` (Plan 05-01) as a natural side effect.
- Phase 05 Plan 04 (AGENCY-03/AGENCY-04): `proxy.ts` redirects `role === 'agency'` to `/agencia` post-login and blocks non-`super_admin` from `/agencies`; `app/[tenant-slug]/layout.tsx`'s tenant guard replaced with a live RLS-scoped `tenants` existence query (`.eq('active', true).maybeSingle()`) instead of JWT string-equality — closes a latent bug where a deactivated tenant was never re-verified after login, and works identically for Cliente/Agencia/Super Admin. Switcher/sidebar/header/store all recognize `role === 'agency'`: switcher gains `manageHref`/`manageLabel` props, sidebar hides `AI Insights` and the entire `Conta` section for agency. `'viewer'` deliberately kept in `proxy.ts`'s `AppMetadata.role` and `tenant-store.tsx`'s `Role` type as a rollout-safety net even after Plan 03's live role collapse, in case a stale/cached JWT with `role=viewer` is still in circulation at deploy time.
- Phase 05 Plan 05 (AGENCY-01/AGENCY-02): `lib/actions/agencies.ts` implements the 6 Super-Admin agency Server Actions (createAgency, deactivateAgency, reactivateAgency, createAgencyUser, grantTenant, revokeTenant), mirroring `lib/actions/tenants.ts`'s pattern exactly (Zod validation, `createServiceClient()`, `generateTempPassword()`, `revalidatePath`). `createAgencyUser` inserts exclusively into `agency_users`, never `tenant_users` (D-04) — verified by grep. `grantTenant`/`revokeTenant` are idempotent (`upsert(..., ignoreDuplicates: true)` / plain delete, both no-op on repeat calls) rather than erroring on duplicate/missing `agency_tenants` rows. `tests/agencies.test.ts` converted from Plan 01's `it.todo()` scaffold to 12 real, passing mock-based tests. Zero deviations — plan's provided code executed verbatim.
- Phase 05 Plan 07 (AGENCY-03/AGENCY-04): `/agencia` landing page built — `components/agencies/agency-clients-table.tsx` (plain `<span>` for Nome, no `/tenants/{slug}` link, no Slug column), `app/agencia/layout.tsx` (minimal shell, agency-only guard via `user.app_metadata.role` directly — not the manual `decodeRole()` helper `app/tenants/layout.tsx` still uses), `app/agencia/page.tsx` (RLS-scoped `createClient()` query, zero application-level filtering — `tenants_agency_select` policy from Plan 02 is the sole scoping mechanism). Closes the 404 left by Plan 04's `proxy.ts` redirect target. Executed out-of-wave-order relative to Plan 06 (agency management UI) since 05-07 only depends on 05-02, not 05-06. Zero code deviations; one noted false-positive in the plan's own automated verify grep pattern (matched the legitimate `@/components/tenants/tenant-status-badge` import path, not an actual Super-Admin link) — documented in the plan's SUMMARY, no code change needed.
- Phase 05 Plan 08 (AGENCY-05/AGENCY-08): Closed a pre-existing IDOR/BOLA gap (T-05-13, OWASP API1:2023) in `PATCH /api/leads/[id]/status` — the route checked caller ROLE but never verified the caller was authorized for the SPECIFIC tenant named in the request body, so any `tenant_admin` could PATCH lead status for a tenant they don't belong to. Fixed by inserting a scope check (before the `service_role` credential fetch) that derives allowed tenant from `user.app_metadata.tenant_slug` for `tenant_admin`, or an RLS-scoped `agency_tenants` grant lookup for the new `agency` role (fail-closed if `agency_id` is missing from the JWT); `super_admin` unchanged. Same authorization-before-privileged-read pattern as `app/api/meta-ads/connect/route.ts`. `tests/unit/leads-status-route.test.ts`'s 5 `it.todo()` AGENCY-08 cases converted to real, passing tests (15/15 total, zero regressions). Zero code deviations — plan's provided code executed verbatim.
- Phase 05 Plan 06 (AGENCY-01/AGENCY-02): Built `/agencies` (list) and `/agencies/[id]` (detail — Informações/Usuários/Clientes vinculados) as one-to-one structural mirrors of `app/tenants/*`, consuming Plan 05's `lib/actions/agencies.ts` verbatim. `app/tenants/layout.tsx`'s manual `decodeRole()` JWT-decode helper removed and standardized on `user.app_metadata.role` (now consistent with `app/agencies/layout.tsx`, `app/[tenant-slug]/layout.tsx`, `proxy.ts`), also dropping the now-unused `supabase.auth.getSession()` call. Both admin layouts gained a two-link header nav (`Tenants` | `Agências`). Installed `components/ui/checkbox.tsx` (shadcn official registry, `@base-ui/react/checkbox`) for `components/agencies/agency-tenant-grants.tsx` — the new optimistic grant/revoke checkbox list (Set-based state, revert-on-failure, no confirmation dialog per UI-SPEC's Interaction Contract). `.planning/PROJECT.md`'s Out of Scope line for "Roles adicionais..." marked superseded by Phase 5's Agência module. Zero deviations — plan's provided code executed verbatim; `npx tsc --noEmit`/`npm run build`/`npx vitest run` (148 passed) all clean.
- Phase 04-ai-insights Plan 01 (AI-01/AI-02/AI-03/AI-04, Wave 0): Created the 5 `it.todo()` test scaffolds enumerated in `04-VALIDATION.md`'s Wave 0 Requirements — `tests/unit/parse-insight-block.test.ts`, `tests/unit/insights-generate-route.test.ts`, `tests/unit/insights-daily-route.test.ts` (mock-based, mirror `tests/unit/leads-status-route.test.ts`'s pattern), `tests/integration/ai-insights-rls.test.ts`, `tests/unit/anomaly-alerts-schema.test.ts` (skip-if-no-env, mirror `tests/integration/sync-jobs-rls.test.ts`/`tests/unit/daily-rollups-schema.test.ts`). Zero production code — same Wave 0 rollout convention as Phase 5 Plan 01. Each file is the designated verification target for a later Phase 4 plan (02 fills the RLS/schema todos after migrations 0021/0022; 03 fills parser + on-demand route todos; 06 fills daily route todos). `npm test` after: 23 test files, 153 passed, 1 skipped, 33 todo, zero regressions.
- Phase 04-ai-insights Plan 02 (AI-03/AI-04): Installed `ai@^7.0.22` + `@ai-sdk/anthropic@^4.0.12` (NOT `@anthropic-ai/sdk` — documented deviation from CLAUDE.md's Summary Table, per 04-CONTEXT.md D-01's locked "Vercel AI SDK `streamText`" decision; both still call `claude-sonnet-4-6` via the Anthropic Messages API). Applied migrations `0021_create_ai_insights.sql`/`0022_create_anomaly_alerts.sql` live to `rvkkvjitfddtbdpkupok` via `supabase db push` — both tables super_admin-only RLS (no tenant_select/agency_select policy, by design per AI-03's literal wording), `REVOKE ALL FROM anon`; `anomaly_alerts` additionally added to the `supabase_realtime` publication. Regenerated `types/database.types.ts` (diff-clean, no stray CLI tag). Filled both Plan 01 scaffolds with real, live-passing assertions (7/7 each). **Finding: PostgREST does not expose `pg_catalog` to `supabase-js` clients** (`PGRST106: Invalid schema: pg_catalog`) — the anomaly_alerts Realtime-membership check cannot be done via `.from('pg_publication_tables')` as literally written in the plan; verified instead via `supabase db query` (CLI) for static confirmation AND a behavioral subscribe+insert+receive `postgres_changes` test in the suite (stronger verification of "Realtime delivery works" than a catalog query would be). Any future test needing to inspect Postgres catalog/system views must use the Supabase CLI (`supabase db query`) or a dedicated RPC — not a direct PostgREST `.from()` call. `npm test` after: 23 test files, 165 passed, 1 skipped, 21 todo, zero regressions. `npm run build`/`npx tsc --noEmit` clean (same 2 pre-existing unrelated `vault-rpc.test.ts` errors as before).
- Phase 04-ai-insights Plan 03 (AI-01, backend half): Built `lib/ai/` shared core — `anthropic.ts` (`MODEL_ID`/`insightModel` singleton), `parse-insight-block.ts` (`extractStructuredBlock`/`stripStructuredBlock`/`InsightBlockSchema`, Zod-validated, never throws), `insight-prompt.ts` (`buildOnDemandPrompt`/`buildDailyPrompt`/`resolveTenantId`, sharing a private `aggregateTenantData` that reads both `daily_rollups` and `campaign_metrics` for the last 30 days and derives ROAS/CPA/CTR per channel and per campaign into one `<campaign_data>`-wrapped JSON payload per tenant — one query pair per tenant, never per-campaign calls per D-09/Pitfall 4). Built `POST /api/insights/generate`: super_admin-only (`getUser()`→401, `get_user_role()` RPC→403, mirrors `app/api/meta-ads/connect/route.ts` exactly), streams Claude's pt-BR narrative token-by-token via `streamText` (D-01/D-12), and auto-persists exactly one `ai_insights` row on `onFinish` with `source='on_demand'` — no explicit Save action (D-03). Parse-failure fallback policy applied literally: on a null `extractStructuredBlock` result, inserts a defaulted row (`type='optimization'`, `impact='medium'`, `summary`=streamed prose) rather than dropping the insight (T-04-06). `vercel.json` gained a `functions` block (`maxDuration: 60`) for both this route and Plan 06's not-yet-created `app/api/insights/daily/route.ts` — intentional per the plan's literal instruction, `next build` doesn't validate `vercel.json` against actual files. Both Wave 0 scaffolds (`parse-insight-block.test.ts` 9/9, `insights-generate-route.test.ts` 8/8) converted from `it.todo()` to real, passing assertions using a TDD RED→GREEN flow for Task 1. Zero deviations — plan executed as written; `insight-prompt.ts` was written from prose spec (no literal code block given) but matches every acceptance-criteria grep target. **AI-01 intentionally NOT marked complete in REQUIREMENTS.md** — its literal wording requires the dashboard button Plan 04 (`requirements: [AI-01, AI-03]`) delivers; this plan is the backend half only, same judgment-call precedent as Plan 02's AI-03/AI-04 handling. `npm run build`/`npx tsc --noEmit` clean (same 2 pre-existing unrelated `vault-rpc.test.ts` errors). Full suite has the same pre-existing `anomaly_alerts` realtime flake documented in Plan 02 (websocket cold-start on first combined-run subscription) — confirmed unrelated by isolated re-run (7/7 pass).
- Phase 04-ai-insights Plan 05 (AI-04, frontend half — executed out-of-numeric-order since it only depends on Plan 02, not Plan 04): Installed shadcn's official Sonner (`sonner@^2.0.7` + `next-themes@^0.4.6`, generating `components/ui/sonner.tsx`). Built `lib/stores/anomaly-alerts.ts` (Zustand singleton, `unread`/`increment`/`clearUnread`) as the single shared source of truth backing both the toast trigger and the sidebar badge — avoids two independent Realtime subscriptions for the same table. `lib/hooks/use-anomaly-alerts.tsx` subscribes exactly once (client-side `tenant_id` filter is convenience only; the real access boundary is Plan 02's super_admin-only RLS policy) to `postgres_changes` INSERT on `anomaly_alerts`, and on each event fires `toast.custom(..., { unstyled: true })` — the custom-JSX toast API, not the string-based `toast()` API, because only `toast.custom()` supports a per-toast `--chart-5` 3px left border plus a whole-body click handler (UI-SPEC Element 2's literal interaction contract). `components/insights/anomaly-listener.tsx` is the single mount point (renders `null`). `components/layout/sidebar-nav.tsx`'s `NavLink` gained an optional `badgeCount` slot (`var(--chart-5)` bg/white text, `9+` overflow, hidden at 0) and a `useEffect` that clears the store on visiting `/${slug}/insights`. `app/[tenant-slug]/layout.tsx` mounts `<Toaster theme="dark" position="top-right" richColors={false} closeButton>` once and conditionally mounts `<AnomalyListener>` only for `role === 'super_admin'` with a resolved `tenantId` (reused the existing non-super_admin `tenants` lookup; added a small second query only for the super_admin branch, which previously resolved no tenant row). Zero deviations — plan executed as written. `npx tsc --noEmit`/`npm run build` clean (same 2 pre-existing unrelated `vault-rpc.test.ts` errors). Full suite: 179 passed/1 skipped/9 todo; the one failure on combined run (`anomaly_alerts` realtime delivery test) is the same pre-existing websocket cold-start flake documented since Plan 02 — isolated re-run 7/7 passed, confirmed not a regression. Manual live verification (toast+badge appear on a real INSERT without refresh; non-super_admin receives nothing over the websocket) remains outstanding per 04-VALIDATION.md's Manual-Only row.

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
- ~~Live Supabase Auth Hook wired to an unrelated Edge Function (custom-access-token), not public.custom_access_token_hook~~ — **RESOLVED 2026-07-09** via `/gsd-debug` session `auth-hook-wired-to-wrong-function`. User switched the Dashboard's Custom Access Token Hook selection to `pg-functions://postgres/public/custom_access_token_hook`. Verified via Management API (`hook_custom_access_token_uri` now correct) and a live fresh-user sign-in test (JWT `app_metadata.role`/`tenant_id`/`tenant_slug` now populate correctly from `tenant_users`). See `.planning/debug/resolved/auth-hook-wired-to-wrong-function.md`.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260710-lhx | Add the official Playwright MCP server to .mcp.json for driving a browser to run Phase 5 manual UAT | 2026-07-10 | 8046c41 | [260710-lhx-add-the-official-playwright-mcp-server-t](./quick/260710-lhx-add-the-official-playwright-mcp-server-t/) |

### Roadmap Evolution

- Phase 03.1 inserted after Phase 3: Leads Management via Google Sheets integration (URGENT) — código já escrito fora do fluxo GSD (`app/api/leads/`, `lib/leads.ts`, `supabase/migrations/0012_add_google_sheets_to_tenants.sql`), formalizado em 2026-07-04. Não planejado ainda — rodar `/gsd-plan-phase 03.1`.
- Phase 5 added (2026-07-05): Access Modules — Multi-Client Agency. Origem: exploração via `/gsd-explore` após fechamento da fase 03.1 — usuário pediu divisão em 3 módulos (Super Admin / Agência / Cliente). Não planejado ainda — rodar `/gsd-discuss-phase 5` antes de `/gsd-plan-phase 5` dado o tamanho da mudança estrutural (nova entidade Agência, grant N:N, extensão de RLS).
- Phases 6 e 7 adicionadas (2026-07-10) via `/gsd-audit-milestone` → `/gsd-plan-milestone-gaps`, após o audit do milestone v1.0 retornar `gaps_found`: **Phase 6 — Security & Consistency: Leads Endpoints** (fecha AGENCY-08 parcial + achado F3 do audit: `app/api/leads/chat/route.ts`/página "Agente IA" não commitados e sem escopo de tenant/papel/rate-limit) e **Phase 7 — Google Ads OAuth2 Connect** (fecha SET-01, nunca implementado, só placeholder). O gap de AI-01..04 não gerou fase nova — é fechado simplesmente planejando/executando a Fase 4 (AI Insights) já existente no roadmap, que tinha CONTEXT.md mas nenhum plano ainda. Relatório completo: `.planning/v1.0-MILESTONE-AUDIT.md`.

### Deferred Items from Phase 00 Plan 01

- [ ] **Task 1 (N8N health):** SSH into Hostinger VPS — verify version >= 1.88.0, process manager, auth endpoint, DB type. CVE-2025-68613 status unknown.
- [ ] **Task 2 (N8N encryption key):** SSH into VPS — verify N8N_ENCRYPTION_KEY persisted to disk, set execution pruning env vars. Depends on Task 1.
- [ ] **Task 7 (Google Ads token):** Submit Basic/Standard Access application at https://ads.google.com/aw/apicenter — CRITICAL PATH BLOCKER for Phase 2.
- [ ] **Meta Business Manager:** Confirm System User with Ads Manager access per tenant.
- [ ] **ANTHROPIC_API_KEY:** Adicionar em `.env.local` (local) e no Vercel Dashboard (Production + Preview + Development) — necessário para Fase 4 (AI Insights) e para qualquer Route Handler que chame a Claude API.

---

## Session Continuity

**Last updated:** 2026-07-11 - Fase 04 (AI Insights) Plano 05/6 concluído: toast de anomalia in-app + badge de não-lidos na sidebar (metade frontend de AI-04) live e testados
**Last action:** Executado `04-05-PLAN.md` (Wave 3, depends_on 04-02; rodou fora da ordem numérica pois não depende do Plano 04) em duas tasks: (1) instalado Sonner oficial do shadcn (`sonner`+`next-themes`), criado `lib/stores/anomaly-alerts.ts` (Zustand singleton `unread`/`increment`/`clearUnread`), `lib/hooks/use-anomaly-alerts.tsx` (assinatura única de `postgres_changes` INSERT em `anomaly_alerts`, dispara `toast.custom(..., { unstyled: true })` com ícone `AlertTriangle`/borda `--chart-5` e clique no corpo inteiro navegando para `/insights`) e `components/insights/anomaly-listener.tsx` (ponto único de montagem); (2) `components/layout/sidebar-nav.tsx` ganhou slot de badge (`badgeCount`, `var(--chart-5)`, overflow `9+`, oculto em 0) + `useEffect` de limpeza ao visitar `/insights`; `app/[tenant-slug]/layout.tsx` resolve `tenantId` (reaproveitando a query já existente para não-super_admin, adicionando uma nova apenas para o ramo super_admin) e monta `<Toaster theme="dark">` + `<AnomalyListener>` condicionalmente só para `super_admin`. Zero desvios — plano executado como escrito. `npm run build`/`npx tsc --noEmit` limpos (mesmos 2 erros pré-existentes não relacionados em `vault-rpc.test.ts`); flake pré-existente do teste `anomaly_alerts` realtime (documentado desde o Plano 02) reapareceu na suíte completa (179 passed/1 skipped/9 todo) mas passou isoladamente 7/7 — confirmado não-regressão. Verificação manual ao vivo (toast+badge aparecendo sem refresh; non-super_admin não recebe nada via websocket) segue pendente por 04-VALIDATION.md.
**Stopped at:** Completed 04-05-PLAN.md
**Next action:** Executar `04-04-PLAN.md` (UI de insights sob demanda, requirements AI-01/AI-03) e depois `04-06-PLAN.md` (job diário N8N de detecção de anomalia) via `/gsd-execute-phase 4`. Pendências não bloqueantes (inalteradas desde a última sessão): `ANTHROPIC_API_KEY` ainda precisa ser adicionada ao Vercel Dashboard (Production+Preview+Development) antes do deploy das rotas de streaming (Planos 03/06) — não bloqueia execução local; `app/api/leads/chat/route.ts`/`app/[tenant-slug]/leads/agente/` seguem não commitados (endereçados pela Fase 6); limpar fixtures de teste remanescentes da Fase 5 (`rls-test-agency-*`/`debug-agency`); investigar a reversão inexplicada do lead "James Soares"; formalizar VERIFICATION.md para as Fases 1 e 5; os 2 erros de `tsc` pré-existentes em `tests/integration/vault-rpc.test.ts` (linhas 124, 135) permanecem, não relacionados a nenhum plano executado até agora; verificação manual ao vivo de AI-04 (toast+badge, isolamento non-super_admin) segue pendente.
**Roadmap:** .planning/ROADMAP.md
**Requirements:** .planning/REQUIREMENTS.md
