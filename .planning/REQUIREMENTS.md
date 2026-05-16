# NEXUS-DASH — Requirements v1

## v1 Requirements

### Authentication & Access Control

- [ ] **AUTH-01**: User can log in with email + password and stay logged in across sessions
- [ ] **AUTH-02**: User can log out from any page and session is invalidated
- [x] **AUTH-03**: Super Admin can create, edit, and deactivate tenants from the platform
- [x] **AUTH-04**: Super Admin can switch between tenants without logging out
- [x] **AUTH-05**: Three roles exist — `super_admin` (platform-level), `tenant_admin`, `viewer` — with appropriate access gates per role
- [ ] **AUTH-06**: Row Level Security enforces tenant isolation — cross-tenant data reads at the database level must fail

### Data Sync (N8N Integration)

- [x] **SYNC-01**: N8N automatically syncs Google Ads campaign metrics on schedule (every 3-4 hours)
- [ ] **SYNC-02**: N8N automatically syncs Meta Ads campaign metrics on schedule (every 6 hours)
- [ ] **SYNC-03**: Last sync timestamp is visible in the UI per tenant and per channel
- [x] **SYNC-04**: Sync status and errors are logged to a `sync_jobs` table and surfaced to Super Admin
- [x] **SYNC-05**: Attribution window is stored per metric row from day one (`attribution_window` column)
- [x] **SYNC-06**: API version for Google Ads and Meta Ads is abstracted via a single constant per workflow (not hardcoded)

### Dashboard — Overview

- [ ] **DASH-01**: Dashboard displays KPI cards for ROAS, CPA, CTR, Spend, Impressions, Clicks, and Conversions with period-over-period delta (absolute + %, color-coded by metric polarity)
- [ ] **DASH-02**: Dashboard displays trend charts (line, time-series) per KPI for the selected period
- [ ] **DASH-03**: Dashboard displays channel breakdown showing Google Ads vs. Meta Ads in absolute values and percentage contribution
- [ ] **DASH-04**: Global date range picker with presets — Last 7, 14, 30 days; This Month; Last Month; Custom — defaults to Last 30 days and persists across page navigation

### Campaigns

- [ ] **CAMP-01**: Campaigns list table showing Campaign Name, Channel, Status, Spend, ROAS, CPA, CTR, Clicks, Conversions
- [ ] **CAMP-02**: Campaigns list can be filtered by channel (Google Ads / Meta / All)
- [ ] **CAMP-03**: Campaigns list respects the global date range picker
- [ ] **CAMP-04**: Clicking a campaign opens a drill-down view with detailed metrics over time (trend lines for the selected period)

### AI Insights

- [ ] **AI-01**: Super Admin can trigger on-demand campaign analysis via a button on the dashboard; Claude generates insights and returns results with type, priority, recommended action, and impact estimate
- [ ] **AI-02**: N8N runs scheduled daily analysis at 05:00 UTC after both sync workflows complete; results stored to database
- [ ] **AI-03**: AI Insights history page lists all generated insights with type, priority, recommended action, impact, and generation timestamp
- [ ] **AI-04**: Anomaly detection alerts appear in-app when ROAS drops more than 20% within a 24-hour window

### Settings

- [ ] **SET-01**: Tenant Admin can connect a Google Ads account to their tenant via OAuth2 flow
- [ ] **SET-02**: Tenant Admin can connect a Meta Ads account to their tenant via System User token input

---

## v2 Requirements (Deferred)

These are table stakes or expected features not included in v1 due to complexity vs. value tradeoff at 1-3 tenants.

- Magic link login — deferred; email + password sufficient for internal v1
- Google OAuth login — deferred; no user demand at current scale
- 2FA/MFA — deferred; add when opening to external clients
- Invite users to tenant by email — deferred; Super Admin creates users manually in v1
- Manual on-demand sync button — deferred; scheduled sync is sufficient in v1
- Configurable retroactive history window in Settings UI — deferred; default 90-day backfill is set in N8N config
- Sync status page in Settings — deferred; sync_jobs table queryable directly for v1
- Anomaly notification delivery (email/push) — deferred; in-app alert is sufficient in v1
- Scheduled email reports / PDF export — high complexity, zero v1 value
- White-label client portal — deferred; internal tool in v1
- Campaign write-back (pause/edit campaigns via API) — explicitly excluded, high risk
- TikTok Ads / LinkedIn Ads integrations — deferred post v1 validation
- Google Sheets data source — eliminated; add when Supabase read costs justify it
- Custom attribution modeling — out of scope indefinitely
- Self-service tenant onboarding / billing — deferred to SaaS phase

---

## Out of Scope

- **Campaign write-back** — Pausing, editing, or creating campaigns via Google/Meta APIs. High risk of accidental budget changes. Excluded.
- **PDF report generation** — Multi-week effort, zero value for internal v1 tool.
- **White-label portal** — No client-facing access in v1.
- **Google Sheets integration** — Eliminated from v1. Revisit only if Supabase read costs become a constraint.
- **Self-service SaaS onboarding / billing** — v1 is internal use; SaaS evolution is a separate milestone.
- **Custom attribution modeling** — Beyond scope of analytics display tool.

---

## Traceability

*Populated by roadmap agent — 2026-05-10. 26/26 requirements mapped.*

| REQ-ID | Phase | Status | Plan |
|--------|-------|--------|------|
| AUTH-01 | 1 — Foundation | Pending | TBD |
| AUTH-02 | 1 — Foundation | Pending | TBD |
| AUTH-03 | 1 — Foundation | Complete | TBD |
| AUTH-04 | 1 — Foundation | Complete | TBD |
| AUTH-05 | 1 — Foundation | Complete | TBD |
| AUTH-06 | 1 — Foundation | Pending | TBD |
| SYNC-01 | 2 — Data Pipeline | Complete | TBD |
| SYNC-02 | 2 — Data Pipeline | Pending | TBD |
| SYNC-03 | 2 — Data Pipeline | Pending | TBD |
| SYNC-04 | 2 — Data Pipeline | Complete | TBD |
| SYNC-05 | 2 — Data Pipeline | Complete | TBD |
| SYNC-06 | 2 — Data Pipeline | Complete | TBD |
| DASH-01 | 3 — Dashboard UI | Pending | TBD |
| DASH-02 | 3 — Dashboard UI | Pending | TBD |
| DASH-03 | 3 — Dashboard UI | Pending | TBD |
| DASH-04 | 3 — Dashboard UI | Pending | TBD |
| CAMP-01 | 3 — Dashboard UI | Pending | TBD |
| CAMP-02 | 3 — Dashboard UI | Pending | TBD |
| CAMP-03 | 3 — Dashboard UI | Pending | TBD |
| CAMP-04 | 3 — Dashboard UI | Pending | TBD |
| SET-01 | 3 — Dashboard UI | Pending | TBD |
| SET-02 | 3 — Dashboard UI | Pending | TBD |
| AI-01 | 4 — AI Insights | Pending | TBD |
| AI-02 | 4 — AI Insights | Pending | TBD |
| AI-03 | 4 — AI Insights | Pending | TBD |
| AI-04 | 4 — AI Insights | Pending | TBD |
