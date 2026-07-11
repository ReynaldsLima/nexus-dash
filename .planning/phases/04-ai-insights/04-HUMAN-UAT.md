---
status: partial
phase: 04-ai-insights
source: [04-VERIFICATION.md]
started: 2026-07-11T14:38:35Z
updated: 2026-07-11T14:38:35Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. On-demand streaming UI (visual)
expected: Log in as super_admin, click "Analisar agora" from both the Insights page and the dashboard shortcut card. Text streams progressively (token-by-token) into the blue-accented streaming card, then transitions to a green "completing" state and the finished insight appears at the top of the history list without a page refresh.
result: [pending]

### 2. Anomaly toast + badge live delivery
expected: While logged in as super_admin, insert a row into `anomaly_alerts` for the active tenant (or trigger the N8N job against seeded data with a genuine >20% ROAS drop). A toast with an `AlertTriangle` icon and 3px `--chart-5` left border appears immediately (no refresh); the sidebar "AI Insights" badge increments; clicking anywhere on the toast body navigates to `/insights`; visiting `/insights` clears the badge.
result: [pending]

### 3. Realtime RLS enforcement over `postgres_changes` (A3)
expected: Open two concurrent sessions — one super_admin, one non-super_admin (tenant_admin/viewer/agency) — both subscribed to `anomaly_alerts`; insert a row. Only the super_admin session receives the event; the non-super_admin session receives nothing, even though the client-side `filter` alone would not enforce this.
result: [pending]

### 4. N8N daily job live execution
expected: Import `n8n-workflows/daily-insights-and-anomaly-detection.json` into the production N8N instance, wire the `Supabase Service Role` and `N8N Insights Secret` (header `x-n8n-secret`) credentials, replace the `VERCEL_APP_URL` placeholder, add `N8N_INSIGHTS_SECRET`/`ANTHROPIC_API_KEY` to the Vercel Dashboard, and activate the workflow. At the next 05:00 UTC run, N8N's execution history shows the workflow completed, an `ai_insights` row (`source='daily'`) exists for each eligible tenant, and any tenant with a genuine >20% ROAS drop gets an `anomaly_alerts` row.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
