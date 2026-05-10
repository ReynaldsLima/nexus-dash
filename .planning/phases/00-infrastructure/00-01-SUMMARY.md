---
phase: 00-infrastructure
plan: 01
subsystem: infra
tags: [supabase, vercel, n8n, nextjs, postgresql, vercel-integration]

# Dependency graph
requires: []
provides:
  - Supabase project provisioned in sa-east-1 (São Paulo) — ref rvkkvjitfddtbdpkupok
  - Staging schema created with correct GRANTs (anon, authenticated, service_role)
  - Vercel project linked to GitHub repo, region locked to gru1, 5 env vars set
  - Next.js 15 scaffold deployed and auto-deploy from main confirmed working
  - vercel.json with regions gru1 committed to git
  - .env.local template committed (gitignored)
  - supabase/migrations/0001_create_staging_schema.sql committed to git
affects:
  - 01-foundation
  - 02-data-pipeline
  - 03-dashboard-ui
  - 04-ai-insights

# Tech tracking
tech-stack:
  added:
    - Next.js 15 (App Router, TypeScript, Tailwind CSS)
    - Supabase (PostgreSQL, Auth, RLS) — project rvkkvjitfddtbdpkupok
    - Vercel (Hobby tier, gru1 region)
    - N8N self-hosted on VPS (Queue Mode, process status unverified)
  patterns:
    - vercel.json region lock to gru1 — matches Supabase sa-east-1 for co-location
    - staging schema in same Supabase project (not separate project) — shared auth.users, test- email prefix convention
    - SUPABASE_SERVICE_ROLE_KEY without NEXT_PUBLIC_ prefix (server-only)
    - Supabase Vercel Integration used for auto env var sync

key-files:
  created:
    - vercel.json
    - .env.local (gitignored template)
    - supabase/migrations/0001_create_staging_schema.sql
    - app/layout.tsx
    - app/page.tsx
    - package.json
    - tsconfig.json
    - next.config.ts
    - tailwind.config.ts
    - postcss.config.mjs
  modified:
    - .gitignore

key-decisions:
  - "Staging schema in same Supabase project as prod (not separate project) to stay within Free tier 2-project limit — shared auth.users, test users must use test- email prefix"
  - "Supabase Vercel Integration used for env var sync — sets NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (new name, not deprecated ANON_KEY)"
  - "N8N Tasks 1+2 deferred — N8N confirmed running in Queue Mode via ps aux but process manager unverified. Must revisit before Phase 2"
  - "Google Ads Developer Token deferred — critical blocker for Phase 2, must be submitted ASAP"

patterns-established:
  - "vercel.json: always lock region to gru1 for Supabase sa-east-1 co-location"
  - "Env vars: service role key and Anthropic API key never use NEXT_PUBLIC_ prefix"
  - "Staging test users: always use test- prefix on email (e.g., test-admin@wrdigitalgroup.com.br)"

requirements-completed: []

# Metrics
duration: multi-session (deferred tasks extend timeline)
completed: 2026-05-10
---

# Phase 0 Plan 01: Infrastructure Setup Summary

**Next.js 15 scaffold deployed to Vercel (gru1), Supabase project provisioned in sa-east-1, N8N running in Queue Mode — 3 tasks deferred (N8N verification, encryption key persistence, Google Ads token)**

## Performance

- **Duration:** Multi-session (human checkpoint tasks required manual VPS/browser steps)
- **Started:** 2026-05-10
- **Completed:** 2026-05-10
- **Tasks:** 3 complete, 3 deferred (Tasks 1, 2, 7), 1 partially complete (Task 7 deferred by user decision)
- **Files modified:** 11 (vercel.json, .gitignore, .env.local, supabase/migrations/0001_create_staging_schema.sql, app/layout.tsx, app/page.tsx, package.json, tsconfig.json, next.config.ts, tailwind.config.ts, postcss.config.mjs)

## Accomplishments

- Supabase project `rvkkvjitfddtbdpkupok` created in sa-east-1 (São Paulo), staging schema provisioned with correct GRANTs
- Vercel project `nexus-dash` linked to GitHub repo with gru1 region lock, 5 environment variables confirmed, Supabase Vercel Integration active
- Next.js 15 scaffold (TypeScript, Tailwind, App Router) initialized, built successfully, and deployed — auto-deploy from main confirmed working at https://nexus-dash-h39vlzi71-riguettilimatech-8948s-projects.vercel.app

## Task Commits

Tasks with human-action checkpoints were completed by the user; automated tasks committed atomically:

1. **Task 3: Supabase creation** — completed by user (no code commit — dashboard + SQL Editor operations)
2. **Task 4: vercel.json, .env.local, .gitignore** — `2889bb9` (chore)
3. **Task 5: Vercel project + env vars** — completed by user (Vercel Dashboard + Supabase Integration)
4. **Task 6: Next.js scaffold + Vercel deploy** — `ab3b66d` (chore) + `5dfd889` (fix)

**Deferred tasks:** Tasks 1, 2 (N8N VPS SSH — process manager unverified), Task 7 (Google Ads Developer Token — not submitted)

## Files Created/Modified

- `vercel.json` — Region lock to gru1 (São Paulo), prevents default iad1 cold-start penalty
- `.env.local` — Local dev env var template (gitignored, 5 variables: SUPABASE_URL, PUBLISHABLE_KEY, SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, N8N_WEBHOOK_BASE_URL)
- `.gitignore` — Confirmed .env.local, .supabase/, .next/, node_modules excluded from git
- `supabase/migrations/0001_create_staging_schema.sql` — Staging schema with GRANTs, canonical migration file
- `app/layout.tsx`, `app/page.tsx` — Next.js 15 App Router scaffold (default)
- `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs` — Framework scaffold

## Infrastructure Details

### Supabase

- **Project ref:** rvkkvjitfddtbdpkupok
- **URL:** https://rvkkvjitfddtbdpkupok.supabase.co
- **Region:** sa-east-1 (São Paulo)
- **Schemas:** public (prod) + staging (test) — same project, shared auth.users
- **Supabase Vercel Integration:** Used — auto-synced NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (new name), SUPABASE_SERVICE_ROLE_KEY to Vercel
- **Known limitation:** auth.users table is shared between prod and staging schemas. Test users must use `test-` prefix on email addresses (e.g., `test-admin@wrdigitalgroup.com.br`) to distinguish from production users at the application level.

### Vercel

- **Project:** nexus-dash
- **Deploy URL:** https://nexus-dash-h39vlzi71-riguettilimatech-8948s-projects.vercel.app
- **Region:** gru1 (São Paulo) — co-located with Supabase sa-east-1
- **Environment variables set (5):**
  | Variable | Environments | Sensitive |
  |----------|-------------|-----------|
  | NEXT_PUBLIC_SUPABASE_URL | Production, Preview | No |
  | NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Production, Preview | No |
  | SUPABASE_SERVICE_ROLE_KEY | Production, Preview, Development | Yes |
  | ANTHROPIC_API_KEY | All environments | Yes |
  | N8N_WEBHOOK_BASE_URL | All environments | No |
- **Auto-deploy from main:** Confirmed working
- **SUPABASE_SERVICE_ROLE_KEY:** Confirmed without NEXT_PUBLIC_ prefix (server-only)
- **ANTHROPIC_API_KEY:** Confirmed without NEXT_PUBLIC_ prefix (server-only)

### N8N

- **Host:** https://evo.wrdigitalgroup.com.br
- **Mode:** Queue Mode confirmed (main process PID 3168309 `n8n start`, worker PID 3164219, webhook PID 3164459 found via `ps aux`)
- **Version:** Unverified — CVE-2025-68613 (CVSS 10.0, unauthenticated RCE) status unknown
- **Process manager:** NOT systemd, NOT pm2 — unknown. Persistence on VPS restart unverified.
- **Encryption key persistence:** Unverified — depends on Task 1 findings
- **Execution pruning:** Not confirmed set (EXECUTIONS_DATA_SAVE_ON_SUCCESS=none, etc.)
- **Status:** DEFERRED — Tasks 1 and 2 not completed

## Deferred Tasks (Open Items — MUST resolve before Phase 2)

### Task 1: N8N Health Verification (DEFERRED)

- **Status:** Partial — N8N confirmed running in Queue Mode via `ps aux` (PID 3168309), but SSH VPS access not completed
- **Blockers for Phase 2:**
  - N8N version not verified (CVE-2025-68613 CVSS 10.0 status unknown — do NOT proceed to Phase 2 with potentially vulnerable N8N)
  - Process manager unknown (not systemd, not pm2) — cannot confirm auto-restart on VPS reboot
  - `curl -I https://evo.wrdigitalgroup.com.br/` auth check not performed (T-00-01 threat unverified)
- **Action required:** SSH into Hostinger VPS, run all checks from Task 1 in the plan

### Task 2: N8N Encryption Key Persistence (DEFERRED)

- **Status:** Not started — depends on Task 1 SSH access
- **Blockers for Phase 2:**
  - N8N_ENCRYPTION_KEY persistence to disk not verified (T-00-03 threat unverified)
  - Execution pruning not configured — 2 GB VPS disk bloat risk on extended use
- **Action required:** After Task 1, complete Task 2 SSH checks from the plan

### Task 7: Google Ads Developer Token (DEFERRED — CRITICAL BLOCKER)

- **Status:** NOT submitted — deferred by user decision
- **Impact:** PHASE 2 CANNOT PROCEED until Basic Access (or Standard Access) token is approved
- **Review timeline:** 2-10 business days under normal conditions; Google acknowledged backlog as of February 2026
- **Action required:** Submit application at https://ads.google.com/aw/apicenter ASAP
  - Application must include: Manager Account linked to all 3 client accounts, advertiser verification completed, Google OAuth app verified status confirmed
  - Use the "Reporting/Analytics" use case description from Task 7 in the plan
- **Explorer Access:** The automatic default (2,880 ops/day) is NOT sufficient for the 90-day backfill of 3 accounts

### Meta Business Manager (DEFERRED)

- **Status:** Not confirmed per tenant
- **Action required:** Verify each initial tenant has a Meta Business Manager configured with a System User that has Ads Manager access. Document which tenants are confirmed.

## Decisions Made

1. **Staging in same Supabase project:** Free tier limits to 2 active projects; staging schema in same project avoids using the second slot. Tradeoff: shared auth.users requires test- email prefix convention.
2. **Supabase Vercel Integration:** Used for auto env var sync. Sets `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (new name) not the deprecated `NEXT_PUBLIC_SUPABASE_ANON_KEY` — application code must use the new name from Phase 1 onward.
3. **N8N Tasks 1+2 deferred:** User chose to proceed to later phases without completing VPS SSH verification. These tasks represent open security and reliability risks that must be resolved before Phase 2 goes to production.
4. **Google Ads Token deferred:** User decision to proceed without submitting the token application. This creates a hard Phase 2 blocker. The token review can run in parallel with Phase 1 development.

## Deviations from Plan

### Deferred Items (User Decision)

**1. Tasks 1 + 2 — N8N VPS SSH health checks deferred**
- **Reason:** User decision to proceed without completing SSH-dependent tasks
- **Risk:** CVE-2025-68613 status unknown, encryption key persistence unverified, process manager unknown
- **Mitigation:** Must be completed before Phase 2 N8N workflows are created

**2. Task 7 — Google Ads Developer Token not submitted**
- **Reason:** User decision to defer
- **Risk:** CRITICAL — Phase 2 cannot proceed without Basic Access approval. 2-10+ day review timeline means delay compounds.

### Auto-fixed Issues

None — automated tasks (4 and 6) executed without deviations.

## Issues Encountered

- **turbopack workspace lockfile warning (Task 6):** Next.js 15 scaffold emitted a warning about workspace lockfile. Fixed by setting `turbopack.root` in `next.config.ts` (commit 5dfd889). Build now passes cleanly.

## Threat Surface Scan

| Threat | File | Status |
|--------|------|--------|
| T-00-01: N8N editor auth | N/A (VPS) | UNVERIFIED — Task 1 deferred |
| T-00-02: CVE-2025-68613 N8N RCE | N/A (VPS) | UNVERIFIED — Task 1 deferred |
| T-00-03: N8N encryption key | N/A (VPS) | UNVERIFIED — Task 2 deferred |
| T-00-04: SUPABASE_SERVICE_ROLE_KEY prefix | Vercel env vars | MITIGATED — confirmed no NEXT_PUBLIC_ prefix |
| T-00-05: .env.local in git | .gitignore | MITIGATED — gitignored, `git check-ignore -v .env.local` confirmed |
| T-00-06: N8N execution data bloat | N/A (VPS) | UNVERIFIED — Task 2 deferred |
| T-00-07: ANTHROPIC_API_KEY prefix | Vercel env vars | MITIGATED — confirmed no NEXT_PUBLIC_ prefix |

## Next Phase Readiness

### Ready for Phase 1 (Foundation):

- Supabase project active in sa-east-1 with staging schema
- Vercel auto-deploy from main working (gru1 region)
- All 5 environment variables confirmed in Vercel
- Next.js 15 scaffold with TypeScript, Tailwind, App Router ready for Phase 1 code

### NOT Ready — Blockers Before Phase 2:

1. **N8N Tasks 1+2** — VPS SSH verification required (security, reliability)
2. **Google Ads Developer Token** — Submit ASAP; review takes 2-10+ days
3. **Meta Business Manager** — Confirm System User access per tenant

### Recommendation:

Proceed to Phase 1 (Foundation) in parallel with:
- Submitting Google Ads Developer Token application immediately
- Completing N8N Tasks 1+2 at the earliest opportunity

---
*Phase: 00-infrastructure*
*Completed: 2026-05-10*
