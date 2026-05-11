# NEXUS-DASH — Roadmap

## Phases

| # | Phase | Goal | Requirements | Status |
|---|-------|------|--------------|--------|
| 0 | Infrastructure | VPS, N8N, Supabase projects, and Vercel wired together before any code runs | — (ops prerequisites) | Not started |
| 1 | Foundation | 3/5 | In Progress|  |
| 2 | Data Pipeline | Campaign metrics flow automatically from Google Ads and Meta Ads into the database on schedule | SYNC-01 – SYNC-06 | Not started |
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
**Plans:** 3/5 plans executed

Plans:
- [x] 01-01-PLAN.md — Wave 0 test infra (Vitest + middleware/rls/tenants scaffolds)
- [x] 01-02-PLAN.md — DB layer (tenants schema, helpers, RLS, Access Token Hook) + BLOCKING schema push + super_admin bootstrap
- [x] 01-03-PLAN.md — Next.js plumbing (deps, shadcn init, Supabase clients, middleware, auth Server Actions)
- [ ] 01-04-PLAN.md — Login UI + scaffolded tenant routes + tenant Server Actions
- [ ] 01-05-PLAN.md — Super Admin tenant management UI + tenant switcher + BLOCKING manual UAT

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
**Plans:** TBD

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
**Plans:** TBD

---

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
**Plans:** TBD

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 0. Infrastructure | 0/1 | Not started | — |
| 1. Foundation | 0/5 | Planned | — |
| 2. Data Pipeline | 0/? | Not started | — |
| 3. Dashboard UI | 0/? | Not started | — |
| 4. AI Insights | 0/? | Not started | — |

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
| DASH-04 | 3 | Global date range picker |
| CAMP-01 | 3 | Campaigns list table |
| CAMP-02 | 3 | Filter by channel |
| CAMP-03 | 3 | Respects global date range |
| CAMP-04 | 3 | Campaign drill-down view |
| AI-01 | 4 | On-demand AI analysis |
| AI-02 | 4 | Scheduled daily AI analysis via N8N |
| AI-03 | 4 | AI Insights history page |
| AI-04 | 4 | Anomaly detection in-app alert |
| SET-01 | 3 | Google Ads OAuth2 connection |
| SET-02 | 3 | Meta Ads System User token connection |

**Mapped: 26/26 — 100% coverage. No orphaned requirements.**
