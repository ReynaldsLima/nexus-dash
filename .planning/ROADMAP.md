# NEXUS-DASH — Roadmap

## Phases

| # | Phase | Goal | Requirements | Status |
|---|-------|------|--------------|--------|
| 0 | Infrastructure | VPS, N8N, Supabase projects, and Vercel wired together before any code runs | — (ops prerequisites) | Not started |
| 1 | Foundation | 5/5 | Complete   | 2026-05-16 |
| 2 | Data Pipeline | 5/5 | Complete    | 2026-05-16 |
| 3 | Dashboard UI | Super Admin can view, filter, and drill into campaign performance across all tenants and channels | DASH-01 – DASH-04, CAMP-01 – CAMP-04, SET-01 – SET-02 | Not started |
| 4 | AI Insights | Super Admin can generate and review AI-powered campaign recommendations on-demand and on schedule | AI-01 – AI-04 | Not started |

---

## Phase Details

### Phase 0: Infrastructure
**Goal:** VPS, N8N, Supabase projects (prod + staging), and Vercel are configured and connected before any application code is written.
**Depends on:** Nothing
**Requirements:** None (operational prerequisites — no v1 code requirements map here)
**UI hint:** no
**Success criteria:**
1. N8N is running on VPS with `N8N_ENCRYPTION_KEY` set and persisted — rebooting the VPS does not destroy credentials.
2. N8N editor is not publicly accessible without authentication (HTTP basic auth or Cloudflare Access in place).
3. Two Supabase projects exist (prod, staging) with separate environment variables; a push to `main` triggers a successful Vercel deployment.
4. Google Ads Standard Access developer token request is submitted; Meta Business Manager and System User configuration is confirmed for each initial tenant.
5. Vercel project region matches Supabase AWS region in `vercel.json`.
**Plans:** 1 plan

Plans:
- [x] 00-01-PLAN.md — N8N health check, Supabase project + staging schema, Vercel project + env vars, Next.js scaffold, Google Ads token application

---

### Phase 1: Foundation
**Goal:** Users can securely log in with role-based access, and the database enforces complete tenant isolation at the row level.
**Depends on:** Phase 0
**Requirements:** AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06
**UI hint:** no
**Success criteria:**
1. A user can log in with email and password and remain logged in across browser sessions; logging out from any page invalidates the session immediately.
2. Three roles (`super_admin`, `tenant_admin`, `viewer`) are enforced — a `viewer` cannot access admin-only pages, and a `tenant_admin` cannot see another tenant's data.
3. Super Admin can create, edit, and deactivate a tenant from the platform and can switch between tenants without logging out.
4. A direct database query from Tenant A's authenticated session against Tenant B's rows returns zero results — cross-tenant reads fail at the RLS layer, not only at the application layer.
5. JWT access tokens contain `tenant_id` and `role` claims (injected by the Custom Access Token Hook) and no database lookup is required per request to determine tenant context.
**Plans:** 5/5 plans complete

Plans:
- [x] 01-01-PLAN.md — Wave 0 test infra (Vitest + middleware/rls/tenants scaffolds)
- [x] 01-02-PLAN.md — DB layer (tenants schema, helpers, RLS, Access Token Hook) + BLOCKING schema push + super_admin bootstrap
- [x] 01-03-PLAN.md — Next.js plumbing (deps, shadcn init, Supabase clients, middleware, auth Server Actions)
- [x] 01-04-PLAN.md — Login UI + scaffolded tenant routes + tenant Server Actions
- [x] 01-05-PLAN.md — Super Admin tenant management UI + tenant switcher + BLOCKING manual UAT

---

### Phase 2: Data Pipeline
**Goal:** Campaign metrics from Google Ads and Meta Ads flow into the database automatically on schedule, with sync status visible and data correct to within ±2% of native platform UIs.
**Depends on:** Phase 1
**Requirements:** SYNC-01, SYNC-02, SYNC-03, SYNC-04, SYNC-05, SYNC-06
**UI hint:** no
**Success criteria:**
1. Google Ads campaign metrics sync automatically every 3–4 hours; Meta Ads metrics sync every 6 hours — without manual intervention.
2. Each synced metric row stores an `attribution_window` column value from day one; no migration is needed later to add it.
3. Sync jobs (success and failure) are recorded in the `sync_jobs` table; a Super Admin can inspect errors without querying raw logs.
4. Last sync timestamp per tenant per channel is visible in the UI so users can judge data freshness at a glance.
5. Google Ads API version and Meta Ads API version are each defined in a single constant per workflow — changing one constant updates all calls in that workflow.
**Plans:** 5/5 plans complete

Plans:
- [x] 02-01-PLAN.md — Wave 0 test scaffolds (campaign_metrics, daily_rollups, sync_jobs RLS, vault RPC)
- [x] 02-02-PLAN.md — DB layer (4 tabelas + 2 funções Postgres) + [BLOCKING] supabase db push + types regeneration + Wave 0 tests filled
- [x] 02-03-PLAN.md — N8N workflow JSON: Google Ads Sync (SYNC-01, SYNC-06 — BLOCKER: Developer Token aprovação pendente)
- [x] 02-04-PLAN.md — N8N workflow JSON: Meta Ads Sync (SYNC-02, SYNC-06)
- [x] 02-05-PLAN.md — UI SYNC-03: SyncStatusSection na página /tenants

---

### Phase 3: Dashboard UI
**Goal:** Super Admin can view consolidated campaign performance across all tenants and channels, drill into campaigns, and manage tenant account connections — all within a responsive, filterable dashboard.
**Depends on:** Phase 2
**Requirements:** DASH-01, DASH-02, DASH-03, DASH-04, CAMP-01, CAMP-02, CAMP-03, CAMP-04, SET-01, SET-02
**UI hint:** yes
**Success criteria:**
1. The Overview page displays KPI cards (ROAS, CPA, CTR, Spend, Impressions, Clicks, Conversions) with period-over-period deltas (absolute + %, color-coded by metric polarity) and trend line charts for the selected period.
2. A global date range picker with presets (Last 7, 14, 30 days; This Month; Last Month; Custom) defaults to Last 30 days and its selection persists across page navigation.
3. A channel breakdown section shows Google Ads vs. Meta Ads in absolute values and percentage contribution; clicking a channel or campaign opens a drill-down view with detailed time-series metrics.
4. The Campaigns page lists all campaigns with Name, Channel, Status, Spend, ROAS, CPA, CTR, Clicks, Conversions and can be filtered by channel and respects the global date range.
5. A Tenant Admin can connect a Google Ads account via OAuth2 and a Meta Ads account via System User token from the Settings page, and the connection status is reflected immediately.
**Plans:** 6 plans

Plans:
- [x] 03-01-PLAN.md — Wave 0: lógica pura (formatters, date-range store, KPI/delta/split, campaign aggregation) + 4 test scaffolds
- [x] 03-02-PLAN.md — Wave 1: TanStack Query + shadcn popover/calendar/sheet + Providers + DateRangePicker global (DASH-04)
- [x] 03-03-PLAN.md — Wave 2: dashboard real data — 7 KPI cards + deltas + trend chart + channel split (DASH-01/02/03)
- [x] 03-04-PLAN.md — Wave 2: campanhas real data + filtro + date range + drill-down Sheet (CAMP-01/02/03/04)
- [x] 03-05-PLAN.md — Wave 2: Settings — Vault write RPC + Route Handler + Meta Ads form + Google deferido + sidebar link (SET-01/02)
- [x] 03-06-PLAN.md — Wave 3 (gap closure GAP-03-01): ChannelSheet + PieChart onClick — channel drill-down (DASH-03-ext)

---

### Phase 03.1: Leads Management via Google Sheets integration (INSERTED)

**Goal:** Super Admin/Tenant Admin can edit a lead status inline in the leads table, writing the change back to the source Google Sheet via a Service Account, with clear error handling on failure (revert + message, no auto-retry). Formalizes the already-shipped read path (dashboard, KPIs, funnel, AI chat).
**Requirements:** LEADS-01, LEADS-02, LEADS-03, LEADS-04, LEADS-05
**Depends on:** Phase 3
**Plans:** 3/3 plans complete

Plans:
- [x] 03.1-01-PLAN.md — Data layer: sheets_service_account JSONB column + types + google-auth-library + [BLOCKING] supabase db push (LEADS-02)
- [x] 03.1-02-PLAN.md — lib/sheets.ts (row mapping + Service Account auth + error mapping) + PATCH /api/leads/[id]/status route + unit/integration tests (LEADS-01/02/04/05)
- [x] 03.1-03-PLAN.md — UI: inline status dropdown with optimistic write + revert on failure + manual verify checkpoint (LEADS-03/04)

### Phase 4: AI Insights
**Goal:** Super Admin can trigger on-demand AI analysis of campaign performance and view a history of all generated recommendations, with automatic daily analysis and in-app anomaly alerts running without manual action.
**Depends on:** Phase 3
**Requirements:** AI-01, AI-02, AI-03, AI-04
**UI hint:** yes
**Success criteria:**
1. A Super Admin can click a button on the dashboard to trigger on-demand analysis; Claude returns structured insights (type, priority, recommended action, impact estimate) within the Vercel timeout using streaming.
2. N8N runs a scheduled daily analysis at 05:00 UTC after both sync workflows complete; results are stored to the database and visible without any manual trigger.
3. The AI Insights history page lists all generated insights with type, priority, recommended action, impact, and generation timestamp — accessible only to Super Admin.
4. When ROAS for any campaign drops more than 20% within a 24-hour window, an in-app anomaly alert appears for the Super Admin without requiring a page refresh or manual analysis trigger.
**Plans:** 6 plans

Plans:
- [x] 04-01-PLAN.md — Wave 0 test scaffolds (parse-insight-block, generate/daily routes, ai_insights RLS, anomaly_alerts schema)
- [x] 04-02-PLAN.md — Foundation: install ai + @ai-sdk/anthropic + ai_insights/anomaly_alerts migrations + [BLOCKING] db push + realtime publication (AI-03/AI-04)
- [x] 04-03-PLAN.md — lib/ai core (parser + prompt builders) + on-demand streaming route + vercel.json maxDuration (AI-01)
- [x] 04-04-PLAN.md — Insights page real data + streaming card + dashboard shortcut (AI-01/AI-03)
- [x] 04-05-PLAN.md — Anomaly alerts UI: Sonner toast + Zustand store + Realtime subscription + sidebar badge (AI-04)
- [x] 04-06-PLAN.md — N8N daily workflow (05:00 UTC) + daily route + ROAS anomaly detection (AI-02/AI-04)

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 0. Infrastructure | 0/1 | Not started | — |
| 1. Foundation | 0/5 | Planned | — |
| 2. Data Pipeline | 0/5 | Planned | — |
| 3. Dashboard UI | 5/6 | Gap closure in progress | — |
| 4. AI Insights | 0/6 | Planned | — |

### Phase 5: Access Modules — Multi-Client Agency

**Goal:** Nova entidade Agência (sem tenant próprio), liberada pelo Super Admin para acessar N tenants Cliente via grant N:N (`agency_tenants`). Agência vê Dashboard, Campanhas e Gestão de Leads consolidados dos clientes que gerencia, e pode editar status de lead — assim como Cliente (equivalente ao `tenant_admin` atual, só vê os próprios dados) e Super Admin. Requer RLS estendida reconhecendo acesso via associação a uma agência com grant no tenant, além do acesso direto por `tenant_id` já existente.
**Requirements**: AGENCY-01, AGENCY-02, AGENCY-03, AGENCY-04, AGENCY-05, AGENCY-06, AGENCY-07, AGENCY-08
**Depends on:** Phase 4
**Plans:** 9 plans

Plans:
- [x] 05-01-PLAN.md — Wave 1 test scaffolds (agency-rls, tenant-role-migration, agencies, leads-status-route extension)
- [x] 05-02-PLAN.md — Wave 2: Agency data layer — agencies/agency_users/agency_tenants + agency-scoped RLS + Custom Access Token Hook + [BLOCKING] supabase db push (AGENCY-06)
- [x] 05-03-PLAN.md — Wave 3: Cliente role collapse (D-03) — migration 0020 + [BLOCKING] db push + createTenantUser/add-user-modal simplification (AGENCY-07)
- [x] 05-04-PLAN.md — Wave 3: proxy.ts + [tenant-slug]/layout.tsx + tenant-switcher/sidebar-nav/header-actions wiring for the agency role (AGENCY-03/04)
- [x] 05-05-PLAN.md — Wave 3: lib/actions/agencies.ts Server Actions (AGENCY-01/02)
- [x] 05-06-PLAN.md — Wave 4: Super Admin agency management UI — /agencies list + detail + tenant grants (AGENCY-01/02)
- [x] 05-07-PLAN.md — Wave 3: Agência client-selector landing — /agencia (AGENCY-03/04)
- [x] 05-08-PLAN.md — Wave 3: Leads status route IDOR fix + agency support (AGENCY-05/08)
- [x] 05-09-PLAN.md — Wave 5: full-suite verification + BLOCKING manual UAT — found and fixed a phase-blocking bug (getUser().app_metadata vs JWT claims) via /gsd-debug; all 7 UAT scripts passed post-fix

---

### Phase 6: Security & Consistency — Leads Endpoints (GAP CLOSURE)

**Goal:** Close two findings from the v1.0 milestone audit (2026-07-10): an uncommitted, unauthorized-scope AI chat endpoint riding on the leads feature, and a leads read-endpoint that doesn't follow the explicit authorization pattern AGENCY-08 established.
**Requirements:** AGENCY-08 (completes the partial closure)
**Depends on:** Phase 5
**Origin:** `.planning/v1.0-MILESTONE-AUDIT.md` — Integration Finding F3 (uncommitted `app/api/leads/chat/route.ts` + `app/[tenant-slug]/leads/agente/page.tsx`, no role/tenant/rate-limit checks, open proxy to the shared Anthropic API key) and the AGENCY-08 partial gap (`GET /api/leads` relies on implicit RLS only, unlike the explicit `getClaims()` + grant check `PATCH /api/leads/[id]/status` uses).
**Success criteria:**
1. `app/api/leads/chat/route.ts` either enforces the same explicit tenant/role scoping as `PATCH /api/leads/[id]/status` (plus reasonable rate limiting) and is committed, or is removed entirely if not wanted for v1.
2. `GET /api/leads` derives its tenant/agency scope explicitly via `getClaims()`, matching the pattern `PATCH /api/leads/[id]/status` already uses, instead of relying solely on implicit RLS.
3. No untracked files remain under `app/api/leads/` or `app/[tenant-slug]/leads/` that aren't part of a decided, committed feature.
**Plans:** 4 plans

Plans:
- [x] 06-01-PLAN.md — Wave 0 test scaffolds (rate-limit, leads-get-route, leads-chat-route) (AGENCY-08)
- [x] 06-02-PLAN.md — GET /api/leads role gate + getClaims() scope (AGENCY-08, D-07)
- [x] 06-03-PLAN.md — Chat hardening: rate limiter + role/scope gate + SDK migration + client + commit untracked (D-01..06, D-08)
- [x] 06-04-PLAN.md — Manual verification checkpoint (streamed chat UI + 429 UX + phase gate)

---

### Phase 7: Google Ads OAuth2 Connect (GAP CLOSURE)

**Goal:** Tenant Admin can connect a Google Ads account to their tenant via OAuth2, mirroring the existing Meta Ads System User token connection flow.
**Requirements:** SET-01
**Depends on:** Phase 3
**Origin:** `.planning/v1.0-MILESTONE-AUDIT.md` — SET-01 was never implemented; `app/[tenant-slug]/settings/page.tsx` only renders a static "not configured" placeholder. Building this now is reasonable even though live sync is still gated on the Google Ads Developer Token approval — the connection flow and credential storage can exist and be tested independently of the token approval, so the moment the token is approved this phase doesn't block the sync from having real per-tenant accounts.
**Success criteria:**
1. Tenant Admin can initiate a Google Ads OAuth2 flow from the Settings page and, after granting consent, see the connection reflected as active immediately (mirrors SET-02's Meta Ads UX).
2. The resulting refresh token is stored in Supabase Vault (same pattern as Meta Ads's `create_or_update_vault_secret` RPC), never in `ad_accounts` directly or logged.
3. `ad_accounts` gets a `google_ads` row per connected tenant, consistent with the existing `meta_ads` row shape.
**Plans:** 4 plans

Plans:
- [ ] 07-01-PLAN.md — Wave 0 test scaffolds (oauth-state, connect route, callback route) — RED specs (SET-01)
- [ ] 07-02-PLAN.md — Wave 1: lib/google-ads/oauth-state.ts (HMAC state) + GET /api/google-ads/connect (auth/role/claims gate + redirect to Google) + GOOGLE_OAUTH_STATE_SECRET env (SET-01)
- [ ] 07-03-PLAN.md — Wave 2: GET /api/google-ads/callback (verify state, token exchange, Vault write, ad_accounts upsert) (SET-01)
- [ ] 07-04-PLAN.md — Wave 2: GoogleAdsForm + Settings page card (Customer ID input, inline error, pre-fill, Connect button) (SET-01)

---

## Coverage Validation

| REQ-ID | Phase | Notes |
|--------|-------|-------|
| AUTH-01 | 1 | Login + session persistence |
| AUTH-02 | 1 | Logout + session invalidation |
| AUTH-03 | 1 | Super Admin tenant management |
| AUTH-04 | 1 | Super Admin tenant switching |
| AUTH-05 | 1 | Three-role access gates |
| AUTH-06 | 1 | RLS cross-tenant isolation |
| SYNC-01 | 2 | Google Ads scheduled sync |
| SYNC-02 | 2 | Meta Ads scheduled sync |
| SYNC-03 | 2 | Last sync timestamp in UI |
| SYNC-04 | 2 | sync_jobs table + error surfacing |
| SYNC-05 | 2 | attribution_window column from day one |
| SYNC-06 | 2 | API version abstracted via constants |
| DASH-01 | 3 | KPI cards with period-over-period deltas |
| DASH-02 | 3 | Trend charts per KPI |
| DASH-03 | 3 | Channel breakdown |
| DASH-03-ext | 3 | Channel PieChart click drill-down (GAP-03-01, Plan 06) |
| DASH-04 | 3 | Global date range picker |
| CAMP-01 | 3 | Campaigns list table |
| CAMP-02 | 3 | Filter by channel |
| CAMP-03 | 3 | Respects global date range |
| CAMP-04 | 3 | Campaign drill-down view |
| AI-01 | 4 | On-demand AI analysis |
| AI-02 | 4 | Scheduled daily AI analysis via N8N |
| AI-03 | 4 | AI Insights history page |
| AI-04 | 4 | Anomaly detection in-app alert |
| SET-01 | 7 | Google Ads OAuth2 connection (gap closure — never implemented in Phase 3, only a placeholder) |
| SET-02 | 3 | Meta Ads System User token connection |
| LEADS-01 | 03.1 | Lead status write-back via Service Account |
| LEADS-02 | 03.1 | sheets_service_account credential storage |
| LEADS-03 | 03.1 | Inline editable status dropdown |
| LEADS-04 | 03.1 | Optimistic write + revert on failure |
| LEADS-05 | 03.1 | Error mapping (rate limit / permission) |
| AGENCY-01 | 5 | Super Admin creates agency + agency users (in-app screen, D-02) |
| AGENCY-02 | 5 | Super Admin grants/revokes agency access to N Cliente tenants |
| AGENCY-03 | 5 | Agency user post-login routed to client-selector (/agencia) |
| AGENCY-04 | 5 | Agency user views Dashboard/Campanhas/Leads for granted tenants |
| AGENCY-05 | 5 | Agency user can edit lead status for granted tenants |
| AGENCY-06 | 5 | RLS enforces agency access at the database level |
| AGENCY-07 | 5 | tenant_users.role collapses to single flat Cliente value |
| AGENCY-08 | 5, 6 | Tenant/agency-scoped write endpoints verify authorization server-side (PATCH done in Phase 5; GET /api/leads consistency gap closed in Phase 6) |

**Mapped: 26/26 core + 1 gap extension + 5 LEADS + 8 AGENCY — 100% coverage. No orphaned requirements.**

**Gap closure phases (added 2026-07-10 per `/gsd-audit-milestone` → `.planning/v1.0-MILESTONE-AUDIT.md`):** Phase 6 (Security & Consistency — Leads Endpoints, closes AGENCY-08's remaining gap + integration finding F3) and Phase 7 (Google Ads OAuth2 Connect, closes SET-01). AI-01 through AI-04 require no new phase — they are closed by finally planning/executing the pre-existing Phase 4 (AI Insights), which had context gathered but no plans yet.
