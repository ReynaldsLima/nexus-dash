# Phase 0: Infrastructure — Research

**Researched:** 2026-05-10
**Domain:** Infrastructure provisioning — Supabase, Vercel, N8N (existing), Google Ads Developer Token
**Confidence:** HIGH (all critical findings verified against official documentation)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** N8N already installed and operational at `evo.wrdigitalgroup.com.br` (Hostinger VPS 2+ GB RAM, NPM install, PostgreSQL backend)
- **D-02:** `N8N_ENCRYPTION_KEY` already configured — do not regenerate or reconfigure existing credentials
- **D-03:** N8N uses native auth (email + password) — no additional security layer for v1 internal use
- **D-04:** N8N stays at `evo.wrdigitalgroup.com.br` — the Next.js app goes to a separate address
- **D-05:** Supabase project region: **South America (sa-east-1) — São Paulo** — lowest latency for Brazilian users
- **D-06:** Environment strategy: **1 Supabase project + separate schemas** — `public` for prod, `staging` for tests. Both share free tier limits (500 MB DB, 2 GB bandwidth). NOTE: Supabase officially recommends 2 separate projects, but NEXUS-DASH uses D-06 to stay within the 2-project free tier limit (prod + staging), since the auth schema sharing limitation is acceptable for an internal tool with a single admin.
- **D-07:** `vercel.json` must set `"regions": ["gru1"]` (Vercel South America = São Paulo) to match Supabase
- **D-08:** Initial domain: Vercel-generated `.vercel.app` URL — custom domain decided later
- **D-09:** Auto-deploy: push to `main` → prod; other branches → preview URLs
- **D-10:** Google OAuth App already published (Production) — tenant tokens do not expire in 7 days ✓
- **D-11:** Meta Business Manager + System User already configured for initial tenants ✓
- **D-12:** **CRITICAL BLOCKER:** Google Ads Developer Token does NOT exist yet. Must apply during Phase 0. Without it, Phase 2 (Google Ads sync) is impossible. Apply at: https://ads.google.com/aw/apicenter — target Basic Access minimum, Standard Access preferred.

### Claude's Discretion

- Exact method for installing additional VPS tools (if needed)
- Disk/memory alert configuration on Hostinger (beyond functional minimum)
- Internal schema naming conventions for staging vs prod tables

### Deferred Ideas (OUT OF SCOPE)

- Custom domain for the app (nexusdash.com.br or dash.wrdigitalgroup.com.br) — decide when near first real client access
- IP allowlist / Cloudflare Access on N8N — add if security concern arises or when opening to more users
- Supabase Branching (beta) — consider in SaaS evolution phase

</user_constraints>

---

## Summary

Phase 0 is a pure infrastructure/ops phase — no application code is written. The goal is to have VPS/N8N (existing), Supabase (new project), and Vercel (new project) provisioned, verified, and connected to each other before Phase 1 begins.

The critical path blocker is the Google Ads Developer Token. As of February 2026, Google acknowledged a processing backlog for token applications. Applications that are well-documented and have managed accounts properly linked tend to be processed faster. This application must be submitted on Day 1 of Phase 0 to avoid blocking Phase 2 which is 3-4 phases away — but the review timeline (2-10 business days under normal conditions, longer with the current backlog) means starting immediately is essential.

The Supabase schema isolation decision (1 project, 2 schemas: `public` = prod, `staging` = staging schema) deviates from Supabase's official recommendation of 2 separate projects. This is an intentional tradeoff to stay within the free tier's 2-project limit, with the second project slot preserved for a future use. The planner must account for the auth schema sharing limitation: both environments share the same `auth.users` table, which means test users and prod users coexist in the same auth namespace.

Vercel region `gru1` (São Paulo, Brazil) is confirmed as a valid region code that maps to `sa-east-1` — the exact same AWS region as the Supabase South America option. This alignment eliminates cross-region database latency.

**Primary recommendation:** Submit the Google Ads Developer Token application immediately (Task 1, Day 1). Everything else in Phase 0 can be completed in 1-2 days; the token review is the only item with an external dependency on Google's timeline.

---

## Project Constraints (from CLAUDE.md)

The following directives from `CLAUDE.md` are binding for this phase and all downstream phases:

| Constraint | Detail |
|-----------|--------|
| Tech stack locked | Next.js 15 (App Router) + Supabase + N8N self-hosted + Vercel — no substitutions in v1 |
| AI provider locked | Claude API, claude-sonnet-4-6 — Anthropic SDK only |
| Budget: free/hobby tiers | Vercel Hobby, Supabase Free, minimum-cost VPS for N8N |
| Tenants v1: 1-3 max | No UI onboarding — Super Admin creates manually |
| CI/CD: main → Vercel prod | Automatic deploy, no PR review gates in v1 |
| RLS mandatory | Row Level Security on Supabase — total tenant isolation |
| `@supabase/auth-helpers-nextjs` FORBIDDEN | Deprecated — use `@supabase/ssr` only |
| `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` FORBIDDEN | Service role key must never be in a `NEXT_PUBLIC_` variable |
| N8N writes via HTTP Request node only | Native Supabase node has bug #17020 (403 errors with service role key) |

---

## Standard Stack

### Phase 0 Tools (Infrastructure Only)

| Tool | Version | Purpose | Source |
|------|---------|---------|--------|
| Supabase CLI | latest (`npx supabase@latest`) | Project init, migrations, type gen, link to remote | [VERIFIED: supabase.com/docs] |
| Vercel CLI | latest (`npm i -g vercel`) | Project creation, deployment, env var management | [VERIFIED: vercel.com/docs] |
| Node.js | 24.14.0 (confirmed on machine) | N8N runtime, local tooling | [VERIFIED: node --version] |
| PostgreSQL | via Supabase managed | Application database (prod + staging schemas) | [CITED: supabase.com/docs] |

### No Application Packages in Phase 0

Phase 0 installs zero npm packages for the application. The Next.js project scaffold does not exist yet. Package installation begins in Phase 1.

---

## Architecture Patterns

### Supabase: 1 Project, 2 Schemas

**Decision rationale:** Supabase Free tier allows 2 active projects. The constraint D-06 (1 project + 2 schemas) preserves the second project slot. The official Supabase recommendation is 2 separate projects, but for a v1 internal tool with one super admin, sharing the auth schema is an acceptable tradeoff.

**Schema layout:**
```
Supabase Project: nexus-dash-prod (sa-east-1)
├── schema: public          → production tables (Phase 1+)
├── schema: staging         → staging/test tables (same structure as public)
└── schema: auth            → Supabase managed (shared between environments)
```

**Critical limitation of this approach:**
- `auth.users` is shared — test users and prod users exist in the same table
- Auth Hooks (Custom Access Token Hook) run for all users regardless of schema
- Row Level Security policies reference `auth.uid()` which spans both schemas
- Mitigation: use a `test_` prefix on staging user email addresses (e.g., `test-admin@wrdigitalgroup.com.br`) to distinguish them from prod users

**Naming convention for staging schema:**
- Schema name: `staging` (not `stg_`)
- All tables mirrored from `public` with identical names — schema prefix differentiates them in queries
- Migrations apply to both schemas in parallel: `SET search_path = public; CREATE TABLE ...; SET search_path = staging; CREATE TABLE ...;`

### Vercel Project Structure

```
Vercel Project: nexus-dash
├── Production (main branch)    → connects to Supabase public schema
├── Preview (feature branches)  → connects to Supabase staging schema
└── Development (local)         → local Supabase or staging schema
```

**vercel.json (Phase 0 baseline):**
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "regions": ["gru1"]
}
```
Note: `functions` config for `maxDuration` is added in Phase 4 (AI Insights). No function configuration needed in Phase 0.
[VERIFIED: vercel.com/docs/regions — gru1 confirmed as sa-east-1 / São Paulo]

### Environment Variable Strategy

**Vercel environment variable layout:**

| Variable | Production | Preview | Development | Notes |
|----------|-----------|---------|-------------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | prod project URL | staging schema URL | local/staging URL | Browser-safe |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | prod anon key | staging anon key | local/staging key | Browser-safe; replaces deprecated `ANON_KEY` naming |
| `SUPABASE_SERVICE_ROLE_KEY` | prod service role | staging service role | local service role | Server-only; mark as Sensitive in Vercel |
| `ANTHROPIC_API_KEY` | prod key | same key | same key | Server-only; never NEXT_PUBLIC_ |

**Key rule:** Variables prefixed `NEXT_PUBLIC_` are bundled into client JavaScript and readable by anyone. The service role key (`SUPABASE_SERVICE_ROLE_KEY`) and `ANTHROPIC_API_KEY` must NEVER have this prefix. [CITED: CLAUDE.md, PITFALLS.md §3.2]

**Supabase Vercel Integration:** The official Supabase integration (Vercel Marketplace) auto-syncs environment variables to Vercel. This is the recommended setup path — it eliminates manual variable management and ensures the correct variable names are used.
[VERIFIED: supabase.com/partners/integrations/vercel]

### N8N Production Configuration Verification

The existing N8N installation at `evo.wrdigitalgroup.com.br` needs a health check against this checklist before Phase 1 begins:

| Check | How to Verify | Expected State |
|-------|--------------|----------------|
| `N8N_ENCRYPTION_KEY` persisted | `cat /path/to/.env | grep N8N_ENCRYPTION_KEY` | Non-empty, 64-char hex string |
| N8N process status | `systemctl status n8n` or `pm2 status` | Active/running |
| Database backend | Check N8N environment: `echo $DB_TYPE` | Should be `postgresdb` (not `sqlite`) |
| Health endpoint | `curl http://localhost:5678/healthz` | Returns `{"status":"ok"}` |
| Editor not open to internet | `curl -I http://evo.wrdigitalgroup.com.br/` | Returns 401 or requires auth — not a 200 open page |
| Execution pruning configured | Check `.env` for `EXECUTIONS_DATA_MAX_AGE` | Should be set (default 336 hours / 14 days) |

**Recommended N8N environment variables to confirm/set:**

```bash
# Persist in /home/n8n/.env or the systemd/pm2 service file

# CRITICAL: Must be set and never change
N8N_ENCRYPTION_KEY=<64-char-hex>          # already set per D-02

# Database (already Postgres per D-01)
DB_TYPE=postgresdb
DB_POSTGRESDB_HOST=localhost
DB_POSTGRESDB_PORT=5432
DB_POSTGRESDB_DATABASE=n8n
DB_POSTGRESDB_USER=n8n
DB_POSTGRESDB_PASSWORD=<password>

# Execution pruning — prevent disk bloat
EXECUTIONS_DATA_SAVE_ON_SUCCESS=none       # Don't save successful sync executions
EXECUTIONS_DATA_MAX_AGE=168               # Prune after 7 days (not default 14)
EXECUTIONS_DATA_PRUNE_MAX_COUNT=5000      # Hard cap at 5000 stored executions

# Memory cap — prevent OOM kill on 2 GB VPS
NODE_OPTIONS=--max-old-space-size=1024    # 1 GB heap limit; triggers clean failure not OOM kill

# Security
N8N_BASIC_AUTH_ACTIVE=true               # Or use N8N native auth — per D-03 native auth is in use
N8N_HOST=evo.wrdigitalgroup.com.br
N8N_PROTOCOL=https
```

[CITED: docs.n8n.io/hosting/configuration/environment-variables/executions/]
[CITED: docs.n8n.io/hosting/scaling/memory-errors/ — NODE_OPTIONS recommendation]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Supabase env var sync to Vercel | Manual copy-paste of keys | Supabase Vercel Integration (Marketplace) | Auto-syncs on project changes, handles Preview vs Production correctly |
| Database migration tracking | Custom SQL scripts | Supabase CLI migrations (`supabase migration new`) | Timestamped files, CLI push/pull, tracks what's applied per environment |
| N8N encryption key generation | `Math.random()` or custom | `openssl rand -hex 32` | Cryptographically secure; 32 bytes = 256-bit entropy |
| Vercel region configuration | Dashboard-only settings | `vercel.json` committed to git | Reproducible, version-controlled, visible in PR review |

---

## Common Pitfalls

### Pitfall 1: Google Ads Explorer Access (2,880 ops/day) Is Not Enough for Backfill

**What goes wrong:** Newly created developer tokens now start at "Explorer Access" (2,880 daily operations), not "Basic Access" (15,000 daily operations). A 90-day retroactive backfill for 3 tenants with many campaigns can easily exceed 2,880 operations in one day.
[VERIFIED: developers.google.com/google-ads/api/docs/api-policy/access-levels]

**Why it happens:** Explorer Access was introduced in late 2025 as an intermediate tier. A Search or SearchStream request counts as 1 operation — but a backfill that queries day-by-day for 90 days × 3 tenants = 270 requests minimum, plus campaign-level queries.

**How to avoid:** Apply for Basic Access immediately. Do not start backfill operations until Basic Access is confirmed. If stuck on Explorer Access, limit initial backfill to 30 days until access is upgraded.

**Warning signs:** `RESOURCE_TEMPORARILY_EXHAUSTED` error with HTTP 429 in N8N execution logs.

---

### Pitfall 2: N8N Encryption Key Loss on VPS Restart

**What goes wrong:** If `N8N_ENCRYPTION_KEY` is set in a shell environment (not persisted to a `.env` file or systemd unit), it is lost on restart. All stored credentials become unreadable.

**Already mitigated (D-02):** The key is reportedly already configured. The Phase 0 task is to VERIFY persistence — confirm the key is in the `.env` file or systemd service file, NOT only in a running process's environment.

**How to verify:** Run `systemctl cat n8n` or `cat /etc/systemd/system/n8n.service` and confirm `N8N_ENCRYPTION_KEY` is explicitly set in the `[Service]` section or in an `EnvironmentFile`.

**Warning signs:** After any VPS restart, N8N shows "could not decrypt" errors on credentials.

---

### Pitfall 3: Supabase Project Paused Due to Inactivity

**What goes wrong:** Free tier Supabase projects are automatically paused after 1 week without an active database connection. The staging schema project is at highest risk — it will be used less frequently.

**How to avoid:** Since both prod and staging schemas are in the SAME project (D-06), this risk is reduced — any prod activity keeps the project active. However, confirm the project is not on a legacy plan that still applies the 1-week inactivity pause.

**Warning signs:** Supabase Dashboard shows project status as "Paused" with a "Restore" button.

---

### Pitfall 4: Vercel Functions Default to iad1 (Washington, D.C.)

**What goes wrong:** All new Vercel projects default to `iad1` (Washington D.C., us-east-1). Without setting `"regions": ["gru1"]` in `vercel.json`, every database query from Vercel to Supabase crosses from São Paulo to Washington D.C. and back — adding ~200ms per request.

**How to avoid:** Commit `vercel.json` with `"regions": ["gru1"]` before the first Vercel deployment. Changing the region after deployment requires redeployment.
[VERIFIED: vercel.com/docs/functions/configuring-functions/region — last_updated: 2026-02-27]

**Note:** Hobby tier can only deploy to a single region. The `gru1` region is valid for Hobby tier.

---

### Pitfall 5: Using Deprecated ANON_KEY Variable Name

**What goes wrong:** Supabase is transitioning from `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. The Supabase Vercel Integration sets the new name. Application code that hardcodes the old variable name will fail when the integration auto-configures the environment.

**How to avoid:** Use `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in all application code from the start. Both names work during the transition period, but starting with the new name prevents a migration later.
[CITED: .planning/research/STACK.md §"Supabase + Next.js App Router"]

---

### Pitfall 6: Google Ads Token Application Backlog (February 2026)

**What goes wrong:** As of February 6, 2026, Google acknowledged that developer token review timelines are "taking longer than usual." The normal 2-business-day Basic Access timeline and 10-business-day Standard Access timeline are both extended.

**How to avoid:** Submit the application on Day 1 of Phase 0. To accelerate review:
1. Link all managed Google Ads accounts under the Manager Account before applying
2. Complete advertiser verification in Google Ads
3. Verify the OAuth app in Google Cloud (it's already published — confirm verified status)
4. Write a clear, specific use case description (internal marketing analytics dashboard for agency managing 3 clients)

[CITED: ppc.land article on Feb 2026 backlog]

---

## Code Examples

### vercel.json (Phase 0 complete configuration)

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "regions": ["gru1"]
}
```

Note: `functions.maxDuration` for AI routes is added in Phase 4, not Phase 0.
[VERIFIED: vercel.com/docs/regions — gru1 = sa-east-1 = São Paulo]

### Supabase CLI — Project Initialization

```bash
# Install Supabase CLI
npm install -g supabase

# In the NEXUS-DASH project root: initialize Supabase config
supabase init

# Login to Supabase (uses personal access token)
supabase login

# Link local project to the remote project
supabase link --project-ref <PROJECT_REF>

# Pull the remote schema state (for a new project, this will be empty)
supabase db pull

# Verify connection
supabase status
```

[CITED: supabase.com/docs/guides/local-development/cli/getting-started]

### Supabase CLI — Create Staging Schema

```sql
-- supabase/migrations/0001_create_staging_schema.sql
-- Run once after project creation to set up the staging schema

CREATE SCHEMA IF NOT EXISTS staging;

-- Grant same permissions as public schema
GRANT USAGE ON SCHEMA staging TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA staging GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA staging GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA staging GRANT ALL ON ROUTINES TO anon, authenticated, service_role;
```

### N8N Health Verification Commands (run on VPS)

```bash
# Check process status
systemctl status n8n
# or if using pm2:
pm2 status

# Check health endpoint (from VPS)
curl -s http://localhost:5678/healthz

# Verify encryption key is persisted (not just in memory)
# For systemd:
systemctl cat n8n | grep ENCRYPTION_KEY
# For pm2 ecosystem file:
cat ecosystem.config.js | grep ENCRYPTION_KEY
# For .env file:
grep N8N_ENCRYPTION_KEY /home/n8n/.env

# Check N8N is NOT open to the internet without auth
curl -I https://evo.wrdigitalgroup.com.br/
# Should return 401 or redirect to login — NOT 200 with open editor

# Check database backend (should be postgresdb, not sqlite)
# Look in the N8N config or env:
grep DB_TYPE /home/n8n/.env
```

[CITED: docs.n8n.io/hosting/, PITFALLS.md §4.1, §4.3]

### Environment Variable Template (.env.local for development)

```bash
# .env.local (gitignored — never commit this file)

# Supabase — use STAGING schema connection for local development
NEXT_PUBLIC_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<ANON_KEY>  # safe for browser
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>       # server-only

# Claude API
ANTHROPIC_API_KEY=<ANTHROPIC_KEY>                  # server-only

# N8N webhook base URL (for triggering workflows from Next.js)
N8N_WEBHOOK_BASE_URL=https://evo.wrdigitalgroup.com.br
```

---

## Google Ads Developer Token: Detailed Guidance

This is the only Phase 0 item with an external timeline dependency. Full details for the planner:

### Access Tiers (as of May 2026)

| Tier | Daily Ops (Production) | Review Time | Notes |
|------|----------------------|-------------|-------|
| Explorer Access | 2,880 | Automatic/instant | New default for fresh tokens; insufficient for 90-day backfill |
| Basic Access | 15,000 | ~2 business days (currently delayed) | Minimum viable for NEXUS-DASH v1 |
| Standard Access | Unlimited | ~10 business days (currently delayed) | Required if 15K/day is insufficient; preferred for production |

[VERIFIED: developers.google.com/google-ads/api/docs/api-policy/access-levels]

### Quota Math for NEXUS-DASH

- Each `SearchStream` request = 1 operation (regardless of result size)
- Daily scheduled sync (3 tenants, campaign-level, incremental): ~10-15 operations/day — well within any tier
- 90-day retroactive backfill (3 tenants, by-day queries): ~270-810 operations — within Basic Access (15,000/day)
- Explorer Access (2,880/day) is technically sufficient for the backfill IF done over multiple days, but is risky and blocks parallel syncs

**Recommendation:** Apply for Basic Access minimum. Include Standard Access application in the same submission. The CONTEXT.md (D-12) already recommends Standard Access — research confirms this.

### Application Checklist

Before submitting at https://ads.google.com/aw/apicenter:

- [ ] Google Ads Manager Account (MCC) exists and is linked to all client accounts
- [ ] Advertiser verification completed in Google Ads Manager Account
- [ ] OAuth app in Google Cloud is verified (it's published to Production per D-10 — confirm it's also verified, not just published)
- [ ] API contact email is monitored and responds promptly (Google may reach out)
- [ ] Company/developer website is live and accessible
- [ ] Use case description is specific: "Internal marketing analytics dashboard for agency managing 1-3 Google Ads clients. N8N automation pulls campaign metrics every 3-4 hours. No write operations — read-only API access."

### Testing While Waiting for Approval

During the review period (which could be 2-10+ business days), development can proceed using:
- Explorer Access (2,880 ops/day) — sufficient for manual testing and small-scale verification
- Test accounts in the Manager Account — these use the 15,000 test account operations regardless of production access tier

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|-----------------|--------------|--------|
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase transition (ongoing 2025-2026) | Use new name for greenfield to avoid future migration |
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | Deprecated 2024 | NEVER use the old package — no bug fixes |
| N8N native Supabase node | HTTP Request node + PostgREST API | Unresolved bug #17020 (2024-present) | Always use HTTP Request node for Supabase writes from N8N |
| `vercel.json` `regions: ["iad1"]` (default) | `regions: ["gru1"]` | Must be set explicitly | Default is Washington D.C. — gru1 co-locates with Supabase sa-east-1 |
| Google Ads Basic Access as default starting tier | Explorer Access (2,880 ops) as new default | Late 2025 | Must explicitly apply for Basic Access upgrade |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | N8N Postgres backend is properly configured (not SQLite) on the existing VPS | N8N Health Check | If SQLite, execution history disk bloat is higher; autovacuum doesn't help; must migrate to Postgres |
| A2 | `N8N_ENCRYPTION_KEY` is persisted to disk (not just in running process memory) | N8N Health Check | If not persisted, key is lost on VPS restart and all credentials must be re-entered |
| A3 | The Google OAuth app's "Production" publication status means it has also passed Google's verification process | Google OAuth context | If only published but not verified, some quotas may still be limited |
| A4 | Hostinger VPS has at least 2 GB RAM available (not just 2 GB total before OS and N8N usage) | N8N Memory | If less than 1 GB free, `NODE_OPTIONS=--max-old-space-size=1024` may cause OOM kills during sync |

---

## Open Questions

1. **Is the Google OAuth app verified or just published?**
   - What we know: D-10 says it's in Production status (not Testing mode)
   - What's unclear: "Published" and "verified" are different states in Google Cloud Console. Verified apps have gone through Google's security review; unverified apps in Production may still have user quota limits
   - Recommendation: Check Google Cloud Console → APIs & Services → OAuth consent screen → Verification status before applying for the Google Ads Developer Token (verified status may accelerate the token review)

2. **What is the current N8N version on the VPS?**
   - What we know: NPM install, Postgres backend, encryption key set
   - What's unclear: Version number — CVE-2025-68613 (CVSS 10.0) affects N8N; if the version is vulnerable, it should be updated before Phase 1 stores real credentials
   - Recommendation: Run `n8n --version` or `npm list -g n8n` on the VPS as part of Phase 0 health check task

3. **What exact Supabase free tier project slot is being used?**
   - What we know: Free tier allows 2 active projects
   - What's unclear: Does the user already have 1 Supabase project consuming one slot? Or are both slots available?
   - Recommendation: Check the Supabase Dashboard for existing projects before creating a new one

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-----------|-----------|---------|----------|
| Node.js | Supabase CLI, local tooling | ✓ | 24.14.0 | — |
| npm | Package management | ✓ | 11.9.0 | — |
| git | Version control, Vercel deploy | ✓ | 2.53.0.windows.1 | — |
| Supabase CLI | Project init, migrations | Not verified locally | Install via `npm i -g supabase` | — |
| Vercel CLI | Project creation | Not verified locally | Install via `npm i -g vercel` | Dashboard UI |
| N8N (VPS) | Automation runtime | ✓ (per D-01) | Unknown — check `n8n --version` | — |
| PostgreSQL (VPS) | N8N backend storage | ✓ (per D-01) | Unknown — part of VPS N8N setup | — |
| Google Ads Developer Token | Phase 2 Google sync | ✗ — DOES NOT EXIST | — | Explorer Access (2,880 ops/day) while waiting |

**Missing dependencies with no fallback:**
- Google Ads Developer Token — must apply during Phase 0; no fallback that enables full 90-day backfill for Phase 2

**Missing dependencies with fallback:**
- Supabase CLI — can install in seconds; Vercel CLI likewise
- Google Ads Token at Basic Access level — Explorer Access is an automatic partial fallback during review

---

## Validation Architecture

Phase 0 is pure infrastructure/ops. There is no application code to test and no automated test suite applies. Validation for this phase is entirely manual smoke tests:

| Check | Type | How to Verify | Pass Criteria |
|-------|------|--------------|---------------|
| Supabase project accessible | Smoke | Open Supabase Dashboard URL | Project shows "Active" status |
| Supabase `staging` schema exists | Smoke | Run `SELECT schema_name FROM information_schema.schemata` | `staging` row present |
| Vercel project deployed | Smoke | Visit `.vercel.app` URL | Returns a response (even placeholder) |
| Vercel region correct | Smoke | Check Vercel Dashboard → Settings → Functions → Region | Shows `gru1` |
| Environment variables set | Smoke | Check Vercel Dashboard → Settings → Environment Variables | All 4 vars present across environments |
| N8N health endpoint | Smoke | `curl https://evo.wrdigitalgroup.com.br/healthz` | Returns `{"status":"ok"}` |
| N8N encryption key persisted | Smoke | Check systemd/pm2 config file | Key present in service definition, not just shell |
| Developer token application submitted | Process | Check Google Ads API Center | Application status visible (pending/approved) |
| Vercel + Supabase integration linked | Smoke | Check Supabase Dashboard → Project → Integrations | Vercel project listed |

---

## Security Domain

### Applicable ASVS Categories for Phase 0

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Partial | N8N native auth (email+password) confirmed per D-03; Supabase auth configured in Phase 1 |
| V3 Session Management | No | No application sessions in Phase 0 |
| V4 Access Control | Partial | Supabase RLS enabled per-table — configured in Phase 1; N8N not exposed to public |
| V5 Input Validation | No | No application input in Phase 0 |
| V6 Cryptography | Yes | N8N encryption key must use `openssl rand -hex 32` (256-bit) — no hand-roll |

### Phase 0 Specific Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| N8N editor open to internet | Elevation of Privilege | Native auth enabled (D-03); confirm auth is required before any credential storage |
| Service role key in `NEXT_PUBLIC_` env var | Information Disclosure | NEVER prefix service role key with `NEXT_PUBLIC_` — server-only variable |
| N8N CVE-2025-68613 (CVSS 10.0) | All STRIDE categories | Verify N8N version; update if below patched version |
| Encryption key in git | Information Disclosure | Verify `.env` is in `.gitignore`; N8N key stored on VPS only |

---

## Sources

### Primary (HIGH confidence)
- [Vercel Regions — vercel.com/docs/regions](https://vercel.com/docs/regions) — confirmed `gru1` = sa-east-1 = São Paulo; last_updated 2026-03-05
- [Vercel Function Regions — vercel.com/docs/functions/configuring-functions/region](https://vercel.com/docs/functions/configuring-functions/region) — `vercel.json` syntax confirmed; last_updated 2026-02-27
- [Google Ads API Access Levels — developers.google.com/google-ads/api/docs/api-policy/access-levels](https://developers.google.com/google-ads/api/docs/api-policy/access-levels) — Explorer (2,880), Basic (15,000), Standard (unlimited) confirmed
- [Supabase Managing Environments — supabase.com/docs/guides/deployment/managing-environments](https://supabase.com/docs/guides/deployment/managing-environments) — 2 separate projects recommended; schema limitation documented
- [Supabase Local Development — supabase.com/docs/guides/local-development/overview](https://supabase.com/docs/guides/local-development/overview) — CLI commands verified
- [Supabase Vercel Integration — supabase.com/partners/integrations/vercel](https://supabase.com/partners/integrations/vercel) — auto env var sync confirmed

### Secondary (MEDIUM confidence)
- [Google Ads API backlog announcement — ppc.land article on Feb 2026](https://ppc.land/google-faces-developer-token-application-backlog-as-new-api-tier-debuts/) — backlog confirmed, acceleration tips documented
- [N8N Execution variables — docs.n8n.io/hosting/configuration/environment-variables/executions/](https://docs.n8n.io/hosting/configuration/environment-variables/executions/) — `EXECUTIONS_DATA_SAVE_ON_SUCCESS`, `EXECUTIONS_DATA_MAX_AGE` confirmed
- [Vercel + Supabase environment variable sync discussion — github.com/orgs/supabase/discussions/44989](https://github.com/orgs/supabase/discussions/44989) — integration behavior documented

### Internal (Project docs, treated as verified for this project)
- `.planning/research/PITFALLS.md` — PITFALL 4.1 (encryption key), 4.3 (N8N security), 4.5 (execution bloat), 6.4 (env vars)
- `.planning/research/STACK.md` — Vercel region config, Supabase env var naming, N8N write strategy
- `.planning/phases/00-infrastructure/00-CONTEXT.md` — locked decisions D-01 through D-12

---

## Metadata

**Confidence breakdown:**
- Google Ads token process: HIGH — official docs verified, backlog status from credible secondary source
- Vercel region configuration: HIGH — official docs confirmed gru1 is valid and is sa-east-1
- Supabase schema isolation pattern: MEDIUM — official recommendation is 2 projects; 1-project/2-schema approach is documented as valid but has noted limitations around shared auth schema
- N8N health check procedures: HIGH — based on known documentation + prior project research
- Environment variable strategy: HIGH — derived directly from official Supabase + Vercel docs

**Research date:** 2026-05-10
**Valid until:** 2026-06-10 (30 days — stable infrastructure; Google Ads token backlog status may resolve sooner)
