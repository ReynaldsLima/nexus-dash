# Architecture Patterns: NEXUS-DASH

**Domain:** Multi-tenant Marketing Analytics SaaS
**Researched:** 2026-05-10
**Overall confidence:** HIGH (stack is well-documented, patterns are established)

---

## Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER (Client)                          │
│  React Client Components (charts, filters, interactive UI)       │
│  @supabase/ssr client (cookie-based session, real-time subs)     │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS
┌────────────────────────────▼────────────────────────────────────┐
│                     VERCEL (Next.js 15)                          │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  middleware.ts                                           │    │
│  │  - Refresh Supabase session cookies                      │    │
│  │  - Read JWT claims: role, tenant_id                      │    │
│  │  - Block /dashboard/* if no session                      │    │
│  │  - Block /admin/* if role != super_admin                 │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  ┌──────────────────────┐  ┌──────────────────────────────┐     │
│  │  Server Components   │  │  Route Handlers (API)        │     │
│  │  /app/dashboard/*    │  │  /api/sync/trigger           │     │
│  │  /app/campaigns/*    │  │  /api/insights/generate      │     │
│  │  /app/insights/*     │  │  /api/webhooks/n8n           │     │
│  │  /app/settings/*     │  │  (N8N calls these)           │     │
│  │  /app/admin/*        │  └──────────────────────────────┘     │
│  │                      │                                        │
│  │  Fetches via         │  Route handlers use service_role key   │
│  │  Supabase SSR client │  to bypass RLS for N8N writes         │
│  └──────────────────────┘                                        │
└──────┬─────────────────────────────┬───────────────────────────┘
       │ Supabase JS (cookie-auth)    │ Supabase JS (service_role)
       │                              │
┌──────▼──────────────────────────────▼──────────────────────────┐
│                        SUPABASE                                   │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Auth (Supabase Auth)                                    │    │
│  │  - Session management via JWT                            │    │
│  │  - Custom Access Token Hook → injects tenant_id + role   │    │
│  │    into JWT app_metadata claims on every token issue     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  PostgreSQL (shared schema, tenant isolation via RLS)    │    │
│  │                                                          │    │
│  │  tenants         — one row per client                    │    │
│  │  users           — mirrors auth.users                    │    │
│  │  tenant_users    — M:M with role column                  │    │
│  │  ad_accounts     — Google/Meta account connections       │    │
│  │  campaigns       — campaign metadata per account         │    │
│  │  campaign_metrics— time-series daily rows (partitioned)  │    │
│  │  daily_rollups   — precomputed aggregations per tenant   │    │
│  │  ai_insights     — stored Claude analysis results        │    │
│  │  sync_jobs       — N8N job tracking + audit log          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  Row Level Security enforces tenant isolation on every table     │
└──────────────────────────────────────────────────────────────────┘
                    ▲                        ▲
                    │ Supabase REST API       │ Supabase REST API
                    │ (anon key + JWT)        │ (service_role key)
┌───────────────────┴──┐          ┌───────────┴──────────────────┐
│  ANTHROPIC (Claude)  │          │  N8N (self-hosted VPS)       │
│                      │          │                               │
│  /v1/messages        │          │  Scheduled workflows:        │
│  claude-sonnet-4-6   │          │  - Google Ads sync (daily)   │
│  Prompt caching for  │          │  - Meta Ads sync (daily)     │
│  static system prompt│          │  - AI analysis trigger       │
│                      │          │                               │
│  Called from:        │          │  Authenticates with:         │
│  Route Handler       │          │  - Google Ads: OAuth2        │
│  /api/insights/      │          │    (stored refresh token)    │
│  generate            │          │  - Meta: System User token   │
│                      │          │    (stored, never expires)   │
│                      │          │  - Supabase: service_role    │
│                      │          │    key (writes bypass RLS)   │
│                      │          │                              │
│                      │          │  Error strategy:             │
│                      │          │  - 3 retries exponential     │
│                      │          │  - Error workflow → notify   │
│                      │          │  - sync_jobs audit log       │
└──────────────────────┘          └──────────────────────────────┘
                                               │
                              ┌────────────────┴────────────────┐
                              │  External Ad Platforms           │
                              │  Google Ads API (v18+)          │
                              │  Meta Marketing API (v21+)      │
                              └──────────────────────────────────┘
```

---

## Data Flow Description

### Flow 1: User Authentication and Tenant Context

```
1. User visits /login → Next.js serves login page (Server Component)
2. User submits credentials → Supabase Auth issues JWT
3. Custom Access Token Hook fires before JWT is issued:
   - Queries tenant_users table for this user's tenant_id + role
   - Injects { tenant_id, role } into JWT app_metadata
4. @supabase/ssr stores session in HTTP-only cookies
5. middleware.ts runs on every request:
   - Calls supabase.auth.getUser() to refresh cookies
   - Reads decoded JWT claims for tenant_id + role
   - Enforces route-level access (super_admin vs tenant admin)
6. Server Components call Supabase with session cookie
   → RLS automatically filters all queries to current tenant_id
```

### Flow 2: N8N Sync — Daily Metrics Ingestion

```
1. N8N schedule triggers (e.g., 03:00 UTC daily)
2. N8N calls Next.js Route Handler: POST /api/sync/trigger
   - Request includes X-N8N-Secret header for authentication
   - Route handler validates secret, returns 200 + job_id
   (Alternative: N8N runs fully autonomously without Next.js trigger)
3. N8N reads ad_accounts table via Supabase REST (service_role):
   - Gets all active tenant ad accounts with stored credentials
4. N8N calls Google Ads API:
   - Uses stored OAuth2 refresh token per account
   - Requests campaign metrics for date range
   - Handles rate limits with exponential backoff
5. N8N upserts rows into campaign_metrics:
   - Uses Supabase REST API (service_role key, bypasses RLS)
   - UPSERT on (campaign_id, date) to handle reruns
6. N8N updates sync_jobs table: status, last_sync_at, error_message
7. Same flow repeats for Meta Ads using System User token
8. After both complete: N8N triggers daily AI analysis workflow
```

### Flow 3: On-Demand AI Insights (Super Admin)

```
1. Super Admin clicks "Generate Insights" button
2. Next.js Route Handler: POST /api/insights/generate
   - Verifies JWT role == super_admin (server-side check)
   - Queries campaign_metrics + daily_rollups for last 30 days
   - Structures data as compact JSON summary per tenant
3. Calls Anthropic API with prompt caching:
   - Cached static system prompt (role description + output format)
   - Dynamic user message: campaign data JSON + analysis request
4. Claude returns structured JSON with recommendations
5. Route Handler stores result in ai_insights table:
   - tenant_id, generated_at, raw_response (JSONB), summary_text
6. Returns insight_id to client
7. Client navigates to /insights page — Server Component fetches
   ai_insights rows for this tenant, displays with history
```

### Flow 4: Dashboard Data Fetch

```
1. User navigates to /dashboard
2. Next.js Server Component runs at request time (force-dynamic):
   - Fetches daily_rollups for current tenant (last 30 days)
   - Returns aggregated KPIs: ROAS, CPA, CTR, Spend per channel
3. Client Component renders charts (client-side interactivity)
4. User applies date filter → client-side Supabase query
   - Queries campaign_metrics directly if outside rollup range
   - RLS ensures only current tenant's data is returned
5. N8N sync completion triggers revalidatePath via webhook:
   - POST /api/webhooks/n8n with secret header
   - Route handler calls revalidateTag('metrics-{tenant_id}')
   - Next.js background regenerates affected pages
```

---

## Database Schema

### Core Tables

```sql
-- Tenants: one row per client organization
CREATE TABLE tenants (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  slug         TEXT UNIQUE NOT NULL,       -- URL-safe identifier
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  is_active    BOOLEAN DEFAULT TRUE
);

-- Users: mirrors auth.users, application-level profile
CREATE TABLE users (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  display_name TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Tenant-User membership with role
CREATE TABLE tenant_users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('tenant_admin', 'viewer')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, user_id)
);

-- Super admins are stored separately (platform-level role)
-- Stored as app_metadata in auth.users, NOT in tenant_users
-- Avoids complexity of super_admin appearing in every tenant

-- Ad platform account connections (credentials stored encrypted)
CREATE TABLE ad_accounts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  platform           TEXT NOT NULL CHECK (platform IN ('google_ads', 'meta')),
  account_id         TEXT NOT NULL,              -- platform account ID
  account_name       TEXT,
  refresh_token      TEXT,                        -- OAuth2 refresh token (Google)
  access_token       TEXT,                        -- long-lived token (Meta System User)
  token_expires_at   TIMESTAMPTZ,                 -- for expiry tracking
  historical_window  INT DEFAULT 90,              -- days of history to fetch on first sync
  last_sync_at       TIMESTAMPTZ,
  is_active          BOOLEAN DEFAULT TRUE,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, platform, account_id)
);

-- Campaign metadata (synced from ad platforms, updated on each sync)
CREATE TABLE campaigns (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ad_account_id UUID NOT NULL REFERENCES ad_accounts(id) ON DELETE CASCADE,
  platform     TEXT NOT NULL CHECK (platform IN ('google_ads', 'meta')),
  campaign_id  TEXT NOT NULL,                     -- platform campaign ID
  campaign_name TEXT NOT NULL,
  status       TEXT,                              -- ACTIVE, PAUSED, REMOVED
  objective    TEXT,                              -- CONVERSIONS, AWARENESS, etc.
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ad_account_id, campaign_id)
);
CREATE INDEX idx_campaigns_tenant ON campaigns(tenant_id);

-- Time-series daily campaign metrics (partitioned by month)
CREATE TABLE campaign_metrics (
  id             UUID DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL,                   -- denormalized for RLS index
  campaign_id    UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  date           DATE NOT NULL,
  impressions    BIGINT DEFAULT 0,
  clicks         BIGINT DEFAULT 0,
  spend          NUMERIC(12, 4) DEFAULT 0,
  conversions    NUMERIC(10, 2) DEFAULT 0,
  conversion_value NUMERIC(12, 4) DEFAULT 0,
  ctr            NUMERIC(8, 6),                   -- computed: clicks/impressions
  cpa            NUMERIC(12, 4),                  -- computed: spend/conversions
  roas           NUMERIC(10, 4),                  -- computed: value/spend
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, date),
  UNIQUE(campaign_id, date)
) PARTITION BY RANGE (date);

-- Create monthly partitions (use pg_partman to automate going forward)
CREATE TABLE campaign_metrics_2025_01 PARTITION OF campaign_metrics
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
-- (repeat monthly; add automation via pg_cron for future months)

-- Composite index for the primary query pattern: tenant + date range
CREATE INDEX idx_metrics_tenant_date
  ON campaign_metrics(tenant_id, date DESC);

-- Index for campaign-level drill-down
CREATE INDEX idx_metrics_campaign_date
  ON campaign_metrics(campaign_id, date DESC);

-- Precomputed daily rollups per tenant (avoids full table scan on dashboard)
CREATE TABLE daily_rollups (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  date         DATE NOT NULL,
  platform     TEXT,                              -- NULL = all platforms combined
  total_spend  NUMERIC(14, 4) DEFAULT 0,
  total_clicks BIGINT DEFAULT 0,
  total_impressions BIGINT DEFAULT 0,
  total_conversions NUMERIC(12, 2) DEFAULT 0,
  total_conversion_value NUMERIC(14, 4) DEFAULT 0,
  avg_roas     NUMERIC(10, 4),
  avg_cpa      NUMERIC(12, 4),
  avg_ctr      NUMERIC(8, 6),
  computed_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, date, platform)
);
CREATE INDEX idx_rollups_tenant_date ON daily_rollups(tenant_id, date DESC);

-- AI insights history
CREATE TABLE ai_insights (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  generated_at   TIMESTAMPTZ DEFAULT NOW(),
  trigger_type   TEXT CHECK (trigger_type IN ('manual', 'scheduled')),
  date_range_start DATE,
  date_range_end   DATE,
  summary_text   TEXT,                            -- human-readable summary
  recommendations JSONB,                          -- structured array of recommendations
  raw_response   JSONB,                           -- full Claude response for debugging
  token_usage    JSONB,                           -- { input_tokens, output_tokens, cache_hits }
  created_by     UUID REFERENCES users(id)        -- NULL if triggered by N8N schedule
);
CREATE INDEX idx_insights_tenant ON ai_insights(tenant_id, generated_at DESC);

-- Sync job audit log
CREATE TABLE sync_jobs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ad_account_id  UUID REFERENCES ad_accounts(id),
  platform       TEXT,
  status         TEXT CHECK (status IN ('running', 'success', 'failed', 'partial')),
  started_at     TIMESTAMPTZ DEFAULT NOW(),
  completed_at   TIMESTAMPTZ,
  rows_upserted  INT DEFAULT 0,
  error_message  TEXT,
  date_range_start DATE,
  date_range_end   DATE
);
CREATE INDEX idx_sync_jobs_tenant ON sync_jobs(tenant_id, started_at DESC);
```

### RLS Policies

```sql
-- ============================================================
-- HELPER FUNCTION (security definer + SELECT caching trick)
-- Wrapping in SELECT causes Postgres optimizer to cache per-statement
-- ============================================================
CREATE OR REPLACE FUNCTION get_tenant_id()
RETURNS UUID
LANGUAGE SQL STABLE
SECURITY DEFINER
AS $$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID
$$;

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT
LANGUAGE SQL STABLE
SECURITY DEFINER
AS $$
  SELECT auth.jwt() -> 'app_metadata' ->> 'role'
$$;

-- ============================================================
-- TENANTS TABLE
-- ============================================================
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- Super admins see all tenants
CREATE POLICY tenants_super_admin ON tenants
  FOR SELECT TO authenticated
  USING (get_user_role() = 'super_admin');

-- Tenant members see only their tenant
CREATE POLICY tenants_member ON tenants
  FOR SELECT TO authenticated
  USING (id = get_tenant_id());

-- ============================================================
-- AD_ACCOUNTS, CAMPAIGNS, METRICS, ROLLUPS, INSIGHTS
-- (same pattern for all tenant-scoped tables)
-- ============================================================
ALTER TABLE ad_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY ad_accounts_isolation ON ad_accounts
  FOR ALL TO authenticated
  USING (
    tenant_id = (SELECT get_tenant_id())
    OR get_user_role() = 'super_admin'
  );

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY campaigns_isolation ON campaigns
  FOR ALL TO authenticated
  USING (
    tenant_id = (SELECT get_tenant_id())
    OR get_user_role() = 'super_admin'
  );

ALTER TABLE campaign_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY metrics_isolation ON campaign_metrics
  FOR ALL TO authenticated
  USING (
    tenant_id = (SELECT get_tenant_id())
    OR get_user_role() = 'super_admin'
  );

ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;
-- AI insights: only super_admin can read (per project requirements)
CREATE POLICY insights_super_admin_only ON ai_insights
  FOR ALL TO authenticated
  USING (get_user_role() = 'super_admin');

-- N8N writes via service_role key which bypasses ALL RLS policies
-- No special policy needed for N8N writes
```

### Custom Access Token Hook (PostgreSQL function)

```sql
-- Fires before every JWT is issued by Supabase Auth
-- Injects tenant_id and role into app_metadata claims
CREATE OR REPLACE FUNCTION auth.custom_access_token_hook(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_id   UUID;
  tenant_id UUID;
  user_role TEXT;
  claims    JSONB;
BEGIN
  user_id := (event ->> 'user_id')::UUID;

  -- Check if user is super_admin (stored in auth.users app_metadata)
  IF (event -> 'claims' -> 'app_metadata' ->> 'is_super_admin') = 'true' THEN
    user_role := 'super_admin';
    tenant_id := NULL;
  ELSE
    -- Get tenant membership
    SELECT tu.tenant_id, tu.role
    INTO tenant_id, user_role
    FROM tenant_users tu
    WHERE tu.user_id = user_id
    LIMIT 1;
  END IF;

  claims := event -> 'claims';
  claims := jsonb_set(claims, '{app_metadata,tenant_id}',
    COALESCE(to_jsonb(tenant_id::TEXT), 'null'));
  claims := jsonb_set(claims, '{app_metadata,role}',
    to_jsonb(COALESCE(user_role, 'none')));

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;
```

---

## Multi-Tenancy Decision: Shared Schema + RLS

**Recommendation: Shared schema with RLS. Not schema-per-tenant.**

Rationale for this project:
- v1 has 1–3 tenants. Schema-per-tenant adds migration complexity with zero benefit at this scale.
- Supabase's Auth Hook approach makes RLS tenant injection clean and automatic.
- The `SELECT get_tenant_id()` caching pattern eliminates the per-row function call overhead that makes naive RLS slow.
- All queries include explicit `tenant_id` filters alongside RLS, so indexes are hit.
- When the project evolves to true SaaS (10+ tenants), the RLS model scales fine up to hundreds of tenants before schema-per-tenant becomes worth considering.

**Confidence: HIGH** — This is the documented Supabase recommended pattern for multi-tenant SaaS.

---

## N8N Integration Architecture

### Authentication Credentials (stored in N8N credential store, not in code)

**Google Ads:**
- OAuth2 flow: Admin connects Google account in Settings UI
- Next.js calls Google OAuth endpoint, receives `refresh_token`
- `refresh_token` stored in `ad_accounts.refresh_token` (encrypted at rest by Supabase)
- N8N reads refresh token from Supabase, exchanges for `access_token` per workflow run
- Google Ads access tokens expire in 1 hour — N8N refreshes on each workflow run

**Meta Marketing API:**
- Use a Meta Business System User (not personal user tokens)
- System User tokens are permanent (never expire) — ideal for server automation
- Admin generates System User token in Meta Business Manager
- Token stored in `ad_accounts.access_token`
- N8N reads token from Supabase and uses directly (no refresh needed)
- Fallback: if token becomes invalid (permissions revoked), sync_jobs records error + notifies

### N8N → Supabase Write Pattern

```
N8N uses Supabase node (service_role key):
- Full table access, RLS bypassed
- UPSERT operations using onConflict parameter
- Batch inserts in chunks of 500 rows for campaign_metrics
- Updates sync_jobs table at start/end of each workflow

Service role key stored as N8N credential (encrypted)
Never exposed to browser or server components
```

### N8N Workflow Structure

```
Workflow 1: Daily Google Ads Sync
  Schedule Trigger (03:00 UTC)
  → Supabase: Get active ad_accounts WHERE platform = 'google_ads'
  → Loop over each account:
    → HTTP Request: Refresh OAuth2 token
    → HTTP Request: Google Ads API - get campaign metrics
    → Supabase: UPSERT campaign_metrics (500-row batches)
    → Supabase: Update ad_accounts.last_sync_at
  → Supabase: Update sync_jobs status = 'success'
  → Error Workflow: On any failure → update sync_jobs status = 'failed'
    + HTTP Request to Next.js /api/webhooks/n8n (error notification)

Workflow 2: Daily Meta Ads Sync
  Schedule Trigger (03:30 UTC)  -- offset from Google to avoid DB contention
  → Same pattern as Workflow 1 but with Meta API + System User token

Workflow 3: Daily AI Analysis
  Schedule Trigger (05:00 UTC)  -- after both syncs complete
  → HTTP Request: POST /api/insights/generate
    (Next.js Route Handler calls Claude, stores result)
  → Or: Query Supabase directly for metrics, format, call Claude API
    (depends on whether Claude API key is in Next.js env or N8N)
    Recommendation: Keep Claude calls in Next.js Route Handler
    for easier key management and response caching

Workflow 4: On-Demand Sync Trigger (optional)
  Webhook Trigger (receives from /api/sync/trigger)
  → Same as Workflow 1/2 but for single tenant/account
```

### Error Handling Strategy

```
Per workflow:
1. Wrap each API call in Try/Catch node
2. Transient errors (429, 502, 503, 504): retry 3x with exponential backoff
   - Delays: 10s, 30s, 90s (jitter ±20%)
3. Auth errors (401): refresh token → retry once → fail with alert
4. Fatal errors: update sync_jobs with error_message, trigger Error Workflow
5. Error Workflow: write to sync_jobs, POST to N8N internal notification webhook

Idempotency:
- All metric writes use UPSERT on (campaign_id, date)
- Rerunning a workflow is always safe
- sync_jobs.id passed as idempotency key for deduplication
```

---

## Claude API Integration

### Prompt Structure

```
System prompt (CACHED — static, placed first):
  - Role: expert digital marketing analyst
  - Output format: strict JSON schema with fields:
    { summary, recommendations[], risk_flags[], next_actions[] }
  - Analysis criteria: ROAS targets, CPA thresholds, CTR benchmarks
  - 2000-3000 tokens, stays in cache for 5-min TTL
    (use 1-hour cache for Batch API if daily scheduled analysis)

User message (DYNAMIC — changes per request):
  - Tenant name + date range
  - Compact JSON of campaign metrics (last 30 days)
    flattened to: [{ campaign, platform, spend, roas, cpa, ctr, trend_7d, trend_30d }]
  - Specific question or "general analysis"
  - Target: keep dynamic portion under 8,000 tokens for 1-3 tenants
```

### Token Optimization

```
1. Prompt caching: system prompt cached at 25% write cost, 10% read cost
   - Pays off from first read (saves 75% on system prompt tokens)
   - Use cache_control: { type: "ephemeral" } on system message

2. Data compression: send pre-aggregated metrics, not raw rows
   - daily_rollups table serves this purpose
   - 30 rows per tenant (daily rollups) vs 30 × N campaigns

3. Structured output: use tool_use or JSON mode to enforce schema
   - Avoids verbose explanatory prose in responses
   - Easier to parse and store in ai_insights.recommendations JSONB

4. Batch API for scheduled analysis:
   - Daily N8N trigger → POST /api/insights/generate
   - Route handler can use Batch API (50% token discount) for non-urgent analysis
   - With 1-hour cache TTL: batch processes all tenants using same cached system prompt
```

### Storage Pattern

```sql
-- ai_insights.recommendations stores structured array:
[
  {
    "type": "budget_optimization",
    "campaign_id": "...",
    "campaign_name": "...",
    "platform": "google_ads",
    "priority": "high",
    "finding": "ROAS dropped 23% over 7 days",
    "action": "Reduce daily budget by 30% until CPA stabilizes",
    "expected_impact": "Save ~$450/week while maintaining conversion volume"
  }
]

-- Query pattern: latest insight per tenant
SELECT * FROM ai_insights
WHERE tenant_id = $1
ORDER BY generated_at DESC
LIMIT 10;

-- Query pattern: insights for specific date range
SELECT * FROM ai_insights
WHERE tenant_id = $1
  AND date_range_end BETWEEN $2 AND $3;
```

---

## Next.js App Router Patterns

### Supabase Client Setup

```typescript
// lib/supabase/server.ts — for Server Components, Route Handlers, Server Actions
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: ... } }
  )
}

// lib/supabase/service.ts — for N8N webhook handlers (bypasses RLS)
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!  // never exposed to browser
  )
}
```

### Middleware

```typescript
// middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  // 1. Refresh Supabase session (required — do not skip)
  const { supabase, response } = createServerClientInMiddleware(request)
  const { data: { user } } = await supabase.auth.getUser()

  // 2. Extract role from JWT claims (no DB round-trip)
  const session = await supabase.auth.getSession()
  const role = session?.data?.session?.access_token
    ? decodeJwt(session.data.session.access_token)?.app_metadata?.role
    : null

  // 3. Route guards
  if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (role !== 'super_admin' && request.nextUrl.pathname.startsWith('/admin')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*', '/api/:path*']
}
```

### Server Component Data Fetching

```typescript
// app/dashboard/page.tsx — force-dynamic, never cached
export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = createClient()

  // RLS automatically scopes to current tenant via JWT claims
  const { data: rollups } = await supabase
    .from('daily_rollups')
    .select('*')
    .gte('date', thirtyDaysAgo)
    .order('date', { ascending: false })

  return <DashboardClient initialData={rollups} />
}
```

### Route Handler: N8N Webhook Receiver

```typescript
// app/api/webhooks/n8n/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'

export async function POST(request: NextRequest) {
  // Validate shared secret (stored in both N8N and Vercel env)
  const secret = request.headers.get('x-n8n-secret')
  if (secret !== process.env.N8N_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { tenant_id, event } = await request.json()

  if (event === 'sync_complete') {
    revalidateTag(`metrics-${tenant_id}`)  // invalidate cached dashboard data
  }

  return NextResponse.json({ ok: true })
}
```

### Caching Strategy

```
Dashboard pages:           force-dynamic (always fresh, no stale KPIs)
Campaign list:             force-dynamic
Insights history:          revalidate: 3600 (1 hour, changes rarely)
Settings page:             force-dynamic
Static UI (login, etc.):   default static caching

After N8N sync completes:
  → N8N calls POST /api/webhooks/n8n
  → Route handler calls revalidateTag('metrics-{tenant_id}')
  → Next.js regenerates affected pages in background
  → Next user load gets fresh data
```

---

## Build Order Recommendations

The dependency graph determines sequencing. Each phase must complete before the next can build on top of it.

### Phase 1: Foundation (Database + Auth)

Build first because everything else depends on it.

```
1.1 Supabase project setup
    - Create tables: tenants, users, tenant_users
    - Create Custom Access Token Hook
    - Create helper functions: get_tenant_id(), get_user_role()
    - Enable RLS on all tables with initial policies

1.2 Next.js project scaffold
    - App Router setup with @supabase/ssr
    - middleware.ts with session refresh + route guards
    - /login and /dashboard layout shells (no data yet)
    - lib/supabase/server.ts and lib/supabase/service.ts

1.3 Super Admin creates first tenant manually
    - No UI yet: direct Supabase insert
    - Verify RLS is working: tenant A cannot see tenant B's data
    - Verify JWT claims flow end-to-end

GATE: Auth flow works. Tenant isolation verified. JWT claims confirmed.
```

### Phase 2: Ad Platform Connections + N8N Sync

Build second because metrics data depends on accounts being connected.

```
2.1 Database tables: ad_accounts, campaigns, campaign_metrics, sync_jobs
    - Add RLS policies
    - Create monthly partitions for campaign_metrics
    - Add indexes

2.2 Settings page: ad account connection flow
    - Google OAuth2 flow: Next.js → Google → callback → store refresh_token
    - Meta System User token: manual input field + validation call to Meta API
    - ad_accounts management UI (connect/disconnect)

2.3 N8N workflows
    - Google Ads sync workflow
    - Meta Ads sync workflow
    - Error handling workflow
    - Test with one real tenant account
    - Backfill historical window on first connect

2.4 Sync monitoring
    - sync_jobs table visible in admin panel
    - POST /api/webhooks/n8n route handler

GATE: Metrics are flowing into campaign_metrics table daily.
```

### Phase 3: Dashboard + Campaigns UI

Build third — can now display real data.

```
3.1 daily_rollups computation
    - N8N workflow or pg_cron: after sync, compute daily_rollups
    - Or: compute in Next.js Route Handler after N8N webhook

3.2 Dashboard Overview page
    - Server Component fetches daily_rollups
    - KPI cards: ROAS, CPA, CTR, Spend
    - Channel breakdown charts (Google vs Meta)
    - Date range picker (client-side filter)

3.3 Campaigns list page
    - Filterable by platform, date range, status
    - Drill-down to campaign-level metrics

GATE: Super Admin can see all tenant data in one place.
```

### Phase 4: AI Insights

Build last — depends on having real metrics to analyze.

```
4.1 Claude API integration
    - /api/insights/generate route handler
    - Prompt construction from daily_rollups data
    - Prompt caching setup (static system prompt)
    - Store results in ai_insights table

4.2 Insights UI
    - Manual trigger button (Super Admin only)
    - Insights history page with recommendations list
    - Per-recommendation action items display

4.3 N8N daily scheduled insights
    - Workflow triggers /api/insights/generate at 05:00 UTC
    - Stores result, Super Admin sees on next login

GATE: AI insights generating actionable recommendations.
```

---

## Suggested Phase Structure Implications

| Phase | Focus | Key Risk | Mitigation |
|-------|-------|---------|------------|
| 1 | Auth + Multi-tenancy foundation | RLS misconfiguration leaks data | Test tenant isolation with two test tenants before any real data |
| 2 | Ad platform connections + N8N | OAuth token expiry, Meta token revocation | Monitor sync_jobs, alert on auth failures early |
| 3 | Dashboard + Campaigns UI | dashboard performance with large metric volumes | daily_rollups table prevents full-table scans |
| 4 | AI Insights | Claude API cost at scale, prompt engineering | Prompt caching from day one, budget alerts on Anthropic dashboard |

**Critical ordering rationale:**
- Phase 1 must be 100% correct before any data enters the system. RLS bugs at this stage are security vulnerabilities, not features.
- Phase 2 before Phase 3 because the UI is useless without data. Build the pipeline first, validate the data, then build display logic.
- Phase 4 last because AI analysis is only valuable when there is meaningful historical data (at least 7–14 days of metrics).
- daily_rollups computation (Phase 3.1) is architecturally important: it decouples dashboard query performance from the growing size of campaign_metrics. Build this before building the dashboard, not after.

---

## Pitfall Flags

| Area | Pitfall | Details |
|------|---------|---------|
| RLS | Missing SELECT wrapper on auth functions | Calling `auth.jwt()` or `auth.uid()` directly in policy USING clause re-evaluates per row. Always wrap: `(SELECT get_tenant_id())` |
| RLS | Forgetting to enable RLS on new tables | Any table created without `ALTER TABLE x ENABLE ROW LEVEL SECURITY` is publicly readable via anon key |
| campaign_metrics | Missing tenant_id denormalization | Without `tenant_id` on campaign_metrics, RLS requires a JOIN to campaigns on every query. Denormalize tenant_id directly onto the table |
| campaign_metrics | Partitioning and RLS index | Partition indexes are local to each partition. Verify indexes exist on each partition, not just the parent table |
| Meta tokens | System User token vs User token | User tokens expire in 60 days and will break sync. Always use System User tokens for server automation |
| N8N → Supabase | Using anon key for writes | N8N must use service_role key, not anon key. Anon key + RLS = N8N cannot write without a user session |
| Next.js caching | Dashboard page cached | Setting `revalidate: 60` on a dashboard means KPI data is up to 60 seconds stale after sync. Use `force-dynamic` or cache with explicit tag invalidation |
| JWT claims | Claims stale after role change | If a user's role is changed in the DB, existing JWT tokens still carry the old claims until expiry. For role changes, force token refresh or use short JWT TTL |
| Claude API | Sending raw campaign_metrics rows | Raw rows (one per day per campaign) inflate token usage dramatically. Always send pre-aggregated summaries from daily_rollups |

---

## Sources

- [Supabase Row Level Security Docs](https://supabase.com/docs/guides/database/postgres/row-level-security) — HIGH confidence
- [Supabase Custom Access Token Hook](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook) — HIGH confidence
- [Supabase Custom Claims & RBAC](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac) — HIGH confidence
- [Supabase RLS Performance and Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) — HIGH confidence
- [Multi-Tenant Applications with RLS on Supabase](https://www.antstack.com/blog/multi-tenant-applications-with-rls-on-supabase-postgress/) — MEDIUM confidence
- [Supabase RLS Best Practices (MakerKit)](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices) — MEDIUM confidence
- [9 Postgres Partitioning Strategies for Time-Series](https://medium.com/@ThinkingLoop/9-postgres-partitioning-strategies-for-time-series-at-scale-fa644428b915) — MEDIUM confidence
- [AWS RDS PostgreSQL Time-Series Design](https://aws.amazon.com/blogs/database/designing-high-performance-time-series-data-tables-on-amazon-rds-for-postgresql/) — HIGH confidence
- [Materialized Views vs Rollup Tables (Citus)](https://www.citusdata.com/blog/2018/10/31/materialized-views-vs-rollup-tables/) — MEDIUM confidence
- [N8N Google Ads Integration](https://n8n.io/integrations/google-ads/and/supabase/) — HIGH confidence
- [N8N Error Handling Docs](https://docs.n8n.io/flow-logic/error-handling/) — HIGH confidence
- [Advanced N8N Error Handling](https://www.wednesday.is/writing-articles/advanced-n8n-error-handling-and-recovery-strategies) — MEDIUM confidence
- [Meta Access Token Guide](https://developers.facebook.com/docs/facebook-login/guides/access-tokens/) — HIGH confidence
- [Meta Long-Lived Token Guide](https://developers.facebook.com/docs/facebook-login/guides/access-tokens/get-long-lived/) — HIGH confidence
- [Claude API Prompt Caching Docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) — HIGH confidence
- [Claude Batch Processing Docs](https://platform.claude.com/docs/en/build-with-claude/batch-processing) — HIGH confidence
- [Next.js Revalidation Docs](https://nextjs.org/docs/app/getting-started/revalidating) — HIGH confidence
- [Supabase Auth with Next.js App Router](https://supabase.com/docs/guides/auth/auth-helpers/nextjs) — HIGH confidence
- [N8N Supabase Credentials Docs](https://docs.n8n.io/integrations/builtin/credentials/supabase/) — HIGH confidence
