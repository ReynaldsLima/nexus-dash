# Ops Follow-ups

This doc tracks manual/ops follow-ups for the v1.0 milestone that are intentionally NOT code tasks — they require logging into a live dashboard, SSH-ing into infrastructure, or waiting on a third-party approval, and have no CLI/code path in this repo.

## Required

- [ ] **N8N daily-insights workflow activation** — Import + activate `n8n-workflows/daily-insights-and-anomaly-detection.json` on the live N8N instance (https://evo.wrdigitalgroup.com.br), wire credentials, replace the `VERCEL_APP_URL` placeholder, and set `active: true`. Requires `ANTHROPIC_API_KEY` and `N8N_INSIGHTS_SECRET` present in Vercel Production (and the N8N Header Auth credential). Blocks AI-02/AI-04 live (daily insight + anomaly producer). Why manual: requires logging into the live N8N editor and the Vercel dashboard — no CLI path wired.

- [ ] **Phase 0 VPS security check** — SSH into the Hostinger VPS hosting N8N: verify N8N version >= 1.88.0 (CVE-2025-68613, CVSS 10.0), confirm the N8N editor is not publicly accessible without auth, and confirm `N8N_ENCRYPTION_KEY` is persisted to disk (survives reboot). Closes `00-VERIFICATION.md`'s outstanding human_needed items. Why manual: VPS-side SSH-only checks, no application code involved.

## Other Known External Blockers (lower priority, tracked elsewhere too)

- [ ] `ANTHROPIC_API_KEY` missing from Vercel (Production/Preview/Development) — blocks real Claude calls from `/api/insights/generate` and `/api/insights/daily` in production. Tracked since Phase 4 (`04-HUMAN-UAT.md` item 4).
- [ ] Google Ads Developer Token approval (Basic Access) — submit at https://ads.google.com/aw/apicenter, review timeline 2-10+ business days. Blocks Phase 2 Google Ads sync from going live.
- [ ] Google Cloud OAuth Client creation (Web application type) + `GOOGLE_ADS_CLIENT_ID` / `GOOGLE_ADS_CLIENT_SECRET` / `GOOGLE_OAUTH_STATE_SECRET` set in Vercel — blocks the live end-to-end verification of Phase 7's Google Ads OAuth2 Connect flow (SET-01).
- [ ] Per-tenant Meta System User tokens provisioned in Supabase Vault — blocks Meta Ads N8N sync activation for any tenant not yet configured.

---
*Created 2026-07-11 during Phase 08 (Tech Debt Cleanup) Plan 02, consolidating scattered follow-up items from STATE.md so they survive v1.0 milestone archival.*
