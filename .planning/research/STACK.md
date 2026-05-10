# Stack Research — NEXUS-DASH

**Researched:** 2026-05-10
**Overall confidence:** HIGH (all recommendations backed by official docs or multiple verified sources)

---

## Decided Stack (Non-negotiable)

| Layer | Choice | Notes |
|-------|--------|-------|
| Frontend / API | Next.js 15 (App Router) | Server Components, Server Actions, Route Handlers |
| Database | Supabase (PostgreSQL + Auth + RLS + Realtime) | Managed Postgres, built-in auth, row-level security |
| Automation | N8N self-hosted on VPS | Unlimited executions, full webhook control |
| Deployment | Vercel (Hobby tier initially) | Auto-deploy on push to main |
| AI | Claude API (claude-sonnet-4-6, Anthropic SDK) | Analytics insight generation |

---

## Library Recommendations

### 1. UI Component Library

**Recommendation:** shadcn/ui (CLI-based, no version pin — components are copied into your project)

**Rationale:**
shadcn/ui is not a package dependency — it is a code-generation tool. Components are copied into `components/ui/` via `npx shadcn@latest add [component]`, meaning you own the source and can modify it freely. This is the correct choice for a dashboard SaaS for three compounding reasons:

1. It ships with a built-in `Chart` component that wraps Recharts v3 with CSS-variable theming — you get dark mode, tenant-specific color tokens, and consistent chart styling without gluing libraries together manually.
2. It is the dominant standard in the Next.js ecosystem in 2025 (CLI 3.0 released August 2025, MCP server support, namespaced registries). Community blocks, templates, and AI code generation assume shadcn/ui.
3. It sits on Radix UI primitives (accessible, headless) and Tailwind CSS — both are already the standard for Next.js projects, adding zero net dependencies.

**Confidence:** HIGH
**Current CLI:** `npx shadcn@latest` (CLI 3.0 as of August 2025)
**Key components for NEXUS-DASH:** `Card`, `Table`, `DataTable`, `Chart`, `Select`, `DatePickerWithRange`, `Sidebar`, `Sheet`, `Badge`, `Skeleton`

**Do NOT use:**
- **Chakra UI** — v3 broke the API again, heavier runtime, doesn't compose well with Tailwind, not the direction the Next.js ecosystem is moving
- **Tremor** — built on top of Recharts and Tailwind but adds a second abstraction layer; since shadcn/ui already includes a Recharts-based Chart component, Tremor provides no net benefit and adds bundle weight (~200kB)
- **MUI (Material UI)** — CSS-in-JS runtime overhead, Google Material aesthetic doesn't fit analytics SaaS, poor Tailwind interop

---

### 2. Data Visualization (Charts)

**Recommendation:** Recharts 3.x via shadcn/ui Chart component

**Rationale:**
shadcn/ui's official `Chart` component is a thin, themeable wrapper around Recharts v3 (the library updated from v2 to v3 in 2024). Using Recharts through this wrapper means:

1. All charts inherit the same CSS-variable color tokens as the rest of the UI — no separate theming system to maintain.
2. 70+ ready-made chart examples (area, bar, line, pie, radar, radial) are available at `ui.shadcn.com/charts` and can be copied directly into the project.
3. 2.4M weekly npm downloads — Recharts is the most widely used React chart library; support, examples, and LLM code generation are best here.

**Version:** `recharts@^3.8.1`
**React 19 note:** Recharts v3 with React 19 (which Next.js 15 ships) requires an `overrides` entry in package.json: `"react-is": "^19.0.0"`. This is a known, documented requirement.

**Confidence:** HIGH

**Do NOT use:**
- **Nivo** — excellent library for complex/custom visualizations, but 500kB+ bundle for full install is unacceptable for a Vercel Hobby deployment. Overkill for the chart types NEXUS-DASH needs (line, bar, area, KPI cards).
- **Victory** — smaller ecosystem, slower update cadence. Best asset (cross-platform web+mobile) is irrelevant here since there is no mobile app.
- **TanStack Charts** — as of May 2026, still in alpha/early stages. Not production-ready.
- **Standalone Tremor** — adds Recharts as a transitive dependency anyway; prefer direct Recharts via shadcn/ui.

---

### 3. Data Fetching and Caching

**Recommendation:** TanStack Query v5 (`@tanstack/react-query@^5`) + `@supabase-cache-helpers/postgrest-react-query`

**Rationale:**
For a multi-tenant analytics dashboard with real-time metric updates, campaign drilldowns, and complex cache invalidation (sync completes → dashboard refreshes), TanStack Query v5 is the correct choice over SWR or Next.js native cache:

1. **Granular cache invalidation:** When N8N writes new sync data, you need to invalidate `["campaigns", tenantId]` without blowing the entire page cache. TanStack Query's key-based invalidation handles this precisely. SWR's model is coarser.
2. **Supabase Cache Helpers integration:** `@supabase-cache-helpers/postgrest-react-query` automatically constructs cache keys from Supabase query builders (filters, joins, pagination) — no manual key management for PostgREST queries.
3. **SSR prefetch + hydration:** Pattern is `prefetchQuery()` in Server Components → `dehydrate()` → `HydrationBoundary` in the Client Component tree. This eliminates loading spinners on first paint without duplicating fetches. SWR requires more boilerplate for the same result.
4. **DevTools:** `@tanstack/react-query-devtools` is essential for debugging cache states in development. SWR has no official DevTools.
5. **TypeScript inference:** v5 auto-infers query data types from the query function return — no manual type annotations needed for each query.

**Bundle size tradeoff:** TanStack Query is ~16kB gzipped vs SWR at ~5kB. This is an acceptable cost for the functionality gained; on a Vercel Hobby deployment with Next.js 15 App Router, most dashboard data comes from Server Components anyway — TanStack Query's bundle only loads for client-side interactive queries.

**Packages:**
```
@tanstack/react-query@^5
@tanstack/react-query-devtools@^5  (devDependency)
@supabase-cache-helpers/postgrest-react-query@^1
```

**Confidence:** HIGH

**Do NOT use:**
- **SWR** — Vercel's own library, but lacks mutation management depth, no DevTools, weaker TypeScript inference in v5 era. Fine for simple blogs; not enough for this dashboard.
- **Next.js native `fetch` cache** — Good for static/ISR content but does not solve client-side cache invalidation after mutations. Use it for Server Component data fetching only (e.g., initial tenant config load), not as the primary data layer.

---

### 4. State Management

**Recommendation:** Zustand 5.x (`zustand@^5`)

**Rationale:**
The App Router architecture means most state lives in one of three places: (a) URL params, (b) Server Component props, or (c) TanStack Query cache. Zustand is needed only for truly global UI state that none of those can own. For NEXUS-DASH that means:
- Active tenant context (Super Admin switching between tenants)
- Date range picker selection (shared across dashboard sections)
- Sidebar open/closed state

Zustand 5.0 (stable, released October 2024, currently at 5.0.13 as of May 2026) is the right fit:
1. It dropped React < 18 support, removing the `use-sync-external-store` shim and using the native API — cleaner integration with Next.js 15's concurrent rendering.
2. Official Next.js App Router documentation exists in Zustand's docs with per-request store pattern to avoid cross-request state leaks in Server Components.
3. 150% usage growth in 2025 — community, examples, and LLM code generation are Zustand-first.
4. The store-per-request pattern using React context (`createStore` + `useContext`) is the correct way to use Zustand in App Router — the official Zustand docs cover this explicitly.

**CRITICAL App Router pattern:** Never define a Zustand store as a module-level singleton. Use `createStore` (not `create`) inside a React Context Provider scoped to `layout.tsx`. This prevents state leaking between server requests.

```
zustand@^5
```

**Confidence:** HIGH

**Do NOT use:**
- **Jotai** — Atom-based approach is better suited for highly granular, frequently-updating UI state (think real-time collaborative editing). NEXUS-DASH's global state is coarse (tenant selection, date range) — Jotai's model is unnecessary complexity here.
- **Redux Toolkit** — Correct for large teams with complex shared domain state. The overhead (slices, reducers, middleware, DevTools setup) is unjustified for 1-2 developers on a focused dashboard app.
- **React Context alone** — Context re-renders the entire subtree on every state change. Acceptable for low-frequency updates (auth); not acceptable for a date range that drives every chart on the page.

---

### 5. Form Handling

**Recommendation:** React Hook Form 7.x + Zod 4.x + `@hookform/resolvers`

**Packages:**
```
react-hook-form@^7.75.0
zod@^4.4.3
@hookform/resolvers@^3
```

**Rationale:**
This is the established standard for Next.js form handling in 2025. The three-library stack works as a unit:

1. **React Hook Form** uses uncontrolled components via refs — zero re-renders during typing. For a settings page with tenant token inputs (Google Ads credentials, Meta tokens), this performance characteristic matters.
2. **Zod** schemas are defined once and used for both client-side validation (via `zodResolver` in RHF) and Server Action validation. The same schema validates on keyup and on the server — no duplication.
3. **Zod 4 is now stable on npm** (published to `zod@4.0.0` in 2025, currently at 4.4.3). It is 2-3x faster at parse time and significantly smaller than v3. Use `import { z } from "zod"` — the subpath `"zod/v4"` is for migration only.

**Pattern for Server Actions:**
```typescript
// shared/schemas/tenant-settings.ts
export const tenantSettingsSchema = z.object({
  googleAdsCustomerId: z.string().min(1),
  metaAdAccountId: z.string().min(1),
  historicalWindowDays: z.number().int().min(7).max(365),
})
export type TenantSettingsInput = z.infer<typeof tenantSettingsSchema>

// app/settings/actions.ts (Server Action)
"use server"
export async function updateTenantSettings(input: unknown) {
  const parsed = tenantSettingsSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.flatten() }
  // ... persist to Supabase
}
```

**Confidence:** HIGH

**Do NOT use:**
- **Formik** — Slower than RHF due to controlled component model, smaller momentum in 2025.
- **Zod v3** — Superseded by v4. Migrate on project start; don't carry v3 debt into a greenfield project.

---

## Integration Patterns

### Supabase + Next.js App Router

**Package split:**
```
@supabase/supabase-js@^2.105.4   (data client)
@supabase/ssr@latest              (cookie-based auth for SSR)
```
**Do NOT use** `@supabase/auth-helpers-nextjs` — it is deprecated and no longer receives bug fixes. All official Supabase Next.js documentation has migrated to `@supabase/ssr`.

**Two clients, two contexts:**

| Context | Factory | Import |
|---------|---------|--------|
| Server Components, Server Actions, Route Handlers | `createServerClient` | `@supabase/ssr` + `cookies()` from `next/headers` |
| Client Components | `createBrowserClient` | `@supabase/ssr` |

**Middleware (mandatory for auth):** A `middleware.ts` at the project root must call `createServerClient` and `supabase.auth.getUser()` on every request to refresh the session token. Without this, auth tokens expire silently and SSR requests return stale sessions.

```typescript
// middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )
  await supabase.auth.getUser()
  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

**Environment variables (use new naming):**
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=   # replaces NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=              # server-only, never in NEXT_PUBLIC_
```
Note: Supabase is transitioning from `ANON_KEY` to `PUBLISHABLE_KEY`. Both work during the transition; use the new naming for greenfield.

---

### RLS Multi-Tenant Isolation Pattern

**Architecture decision:** Use Supabase `app_metadata` (not `user_metadata`) for tenant and role claims. `app_metadata` is set server-side only and cannot be modified by the user — critical for security.

**Custom Access Token Hook (required for custom claims in JWT):**
Supabase provides a "Custom Access Token" Auth Hook (Postgres function triggered before JWT issuance) to inject `tenant_id` and `role` into the JWT. This makes tenant isolation available directly in RLS without a database lookup per query.

```sql
-- Auth hook: inject tenant_id and role into JWT
CREATE OR REPLACE FUNCTION auth.custom_access_token_hook(event jsonb)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  claims jsonb;
  user_tenant_id text;
  user_role text;
BEGIN
  claims := event -> 'claims';
  SELECT tenant_id, role INTO user_tenant_id, user_role
  FROM public.user_tenants WHERE user_id = (event->>'user_id')::uuid;

  claims := jsonb_set(claims, '{app_metadata,tenant_id}', to_jsonb(user_tenant_id));
  claims := jsonb_set(claims, '{app_metadata,role}', to_jsonb(user_role));
  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;
```

**Helper functions for RLS policies:**
```sql
-- Extract tenant_id from JWT in RLS policies
CREATE OR REPLACE FUNCTION auth.tenant_id() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT nullif(
    ((current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata') ->> 'tenant_id'),
    ''
  )::text
$$;

-- Extract role from JWT
CREATE OR REPLACE FUNCTION auth.user_role() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT nullif(
    ((current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata') ->> 'role'),
    ''
  )::text
$$;
```

**RLS policy pattern for all tenant-scoped tables:**
```sql
-- Enable RLS (mandatory on every table)
ALTER TABLE campaign_metrics ENABLE ROW LEVEL SECURITY;

-- Tenants see only their own data
CREATE POLICY "tenant_isolation" ON campaign_metrics
  FOR ALL USING (tenant_id = auth.tenant_id());

-- Super Admin can see all tenants
CREATE POLICY "super_admin_access" ON campaign_metrics
  FOR ALL USING (auth.user_role() = 'super_admin');
```

**Three roles:**
| Role | JWT `app_metadata.role` | Access |
|------|------------------------|--------|
| Super Admin | `super_admin` | All tenants, AI insights generation |
| Tenant Admin | `tenant_admin` | Own tenant data, settings |
| Viewer | `viewer` | Own tenant data, read-only |

---

### N8N to Supabase Write Strategy

**Recommended approach: HTTP Request node + PostgREST REST API + service role key**

Do NOT use the native N8N Supabase node for writes. There is a documented, unresolved bug (GitHub issue #17020) where the Supabase node sends both `apikey` and `Authorization` headers simultaneously when using a service role key, causing 403 errors. The workaround is the HTTP Request node.

**Setup in N8N:**
1. Store the Supabase service role key as an N8N credential (Environment Variable or Header Auth credential).
2. Use the HTTP Request node for all Supabase PostgREST calls:

```
URL:     https://<project-ref>.supabase.co/rest/v1/campaign_metrics
Method:  POST (insert) or PATCH (upsert)
Headers:
  apikey:        <service_role_key>
  Authorization: Bearer <service_role_key>
  Content-Type:  application/json
  Prefer:        resolution=merge-duplicates  (for upsert)
Body:    [{ "tenant_id": "...", "campaign_id": "...", "impressions": 0, ... }]
```

**Why service role key is correct here:** N8N runs server-side on a VPS, not in a browser. The service role key bypasses RLS — this is intentional for sync writes from a trusted automation layer. The key must never be exposed to client code.

**Alternative for complex operations:** The N8N Postgres node connects directly to Supabase's connection pooler (Transaction mode, port 6543). Use this for batch inserts, upserts with conflict resolution logic, or queries that require multiple statements. Credentials: host = `db.<project-ref>.supabase.co`, port = `5432` (direct) or `6543` (pooler).

**N8N → Supabase write pattern for metrics sync:**
```
Trigger (Schedule) →
  [Platform API node: Google Ads / Meta Ads] →
  [Transform: normalize to schema] →
  [HTTP Request → Supabase REST upsert] →
  [N8N Supabase node OR HTTP Request → trigger AI analysis flag]
```

**Security:** N8N VPS should be firewalled. The service role key stored in N8N environment variables, not hardcoded in workflows. Rotate the key if it is ever exposed.

---

### Claude API Integration (Anthropic SDK)

**Package:** `@anthropic-ai/sdk@^0.95.1`

**Pattern:** Claude calls are always Server Actions or Route Handlers — never Client Components. The API key is `ANTHROPIC_API_KEY` (server-only, no `NEXT_PUBLIC_` prefix).

**Vercel Hobby timeout constraint:** Serverless functions default to 10s, max 60s on Hobby. Claude `claude-sonnet-4-6` takes 3-15 seconds for analytical prompts. Configure `maxDuration = 60` on the route:

```typescript
// app/api/insights/route.ts
export const maxDuration = 60  // seconds — max for Hobby tier

import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()  // uses process.env.ANTHROPIC_API_KEY automatically

export async function POST(request: Request) {
  const { tenantId, campaignData } = await request.json()

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `Analyze the following campaign performance data for tenant ${tenantId} and provide 3 actionable optimization recommendations:\n\n${JSON.stringify(campaignData, null, 2)}`
    }]
  })

  return Response.json({ insight: message.content[0].text })
}
```

**For streaming responses** (on-demand insight generation button in dashboard):
```typescript
const stream = await client.messages.stream({
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  messages: [...]
})

const headers = new Headers({ 'Content-Type': 'text/event-stream' })
return new Response(stream.toReadableStream(), { headers })
```

**Confidence:** HIGH (SDK version from npm registry, patterns from official Anthropic docs)

---

### TypeScript + Supabase Generated Types Workflow

**Command:**
```bash
npx supabase gen types --lang=typescript --project-id "$PROJECT_REF" > src/types/database.types.ts
```

**package.json script:**
```json
{
  "scripts": {
    "gen:types": "supabase gen types --lang=typescript --project-id $PROJECT_REF > src/types/database.types.ts"
  }
}
```

**Usage:**
```typescript
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import type { Database } from '@/types/database.types'

export function createClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { /* ... */ } }
  )
}
```

Passing `Database` to `createClient<Database>()` gives full type inference: query results, insert shapes, and RPC return types are all typed from the generated schema.

**Automation:** For a v1 internal tool, run `npm run gen:types` manually after schema migrations. For later phases, add a GitHub Actions workflow that runs nightly and commits updated types.

---

### Vercel Deployment Optimization

**Hobby tier constraints to design around:**
| Limit | Value | Mitigation |
|-------|-------|------------|
| Serverless function timeout | 60s max (10s default) | Set `export const maxDuration = 60` on AI routes only |
| Fluid Compute timeout | 300s | Enable Fluid Compute for AI routes if 60s isn't enough |
| Bandwidth | 100 GB/month | Acceptable for 1-3 tenants |
| Serverless function regions | Single region | Configure `vercel.json` to match Supabase region |

**vercel.json for region alignment:**
```json
{
  "regions": ["iad1"],
  "functions": {
    "app/api/insights/route.ts": { "maxDuration": 60 }
  }
}
```
Set `regions` to the same AWS region as your Supabase project (e.g., `iad1` = us-east-1). Cold start latency from database queries drops significantly when compute and database are co-located.

**Supabase Vercel integration:** The official Supabase Vercel integration (available in Vercel Marketplace) auto-syncs environment variables (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) to Vercel environment settings. Use it — avoids manual secret management.

**Next.js 15 caching with App Router:**
- Use React Server Components for initial data loads (no client roundtrip, no bundle cost)
- Use `unstable_cache` or `revalidatePath` from `next/cache` for Server Component data that changes on sync completion
- TanStack Query handles client-side interactive state (drilldowns, filter changes)
- Avoid `export const dynamic = 'force-dynamic'` on the entire layout — scope it to only pages that require real-time freshness

**Confidence:** HIGH

---

## Summary Table

| Concern | Library | Version | Confidence |
|---------|---------|---------|-----------|
| UI Components | shadcn/ui | CLI 3.0 (no version pin) | HIGH |
| Data Visualization | Recharts (via shadcn/ui Chart) | ^3.8.1 | HIGH |
| Data Fetching / Cache | TanStack Query | ^5 | HIGH |
| Supabase Cache Helpers | @supabase-cache-helpers/postgrest-react-query | ^1 | MEDIUM |
| State Management | Zustand | ^5 | HIGH |
| Form Handling | React Hook Form | ^7.75.0 | HIGH |
| Schema Validation | Zod | ^4.4.3 | HIGH |
| Form Resolver | @hookform/resolvers | ^3 | HIGH |
| Supabase Client | @supabase/supabase-js | ^2.105.4 | HIGH |
| Supabase SSR Auth | @supabase/ssr | latest | HIGH |
| Claude API | @anthropic-ai/sdk | ^0.95.1 | HIGH |

---

## What NOT to Install (Explicit Rejections)

| Library | Reason |
|---------|--------|
| `@supabase/auth-helpers-nextjs` | Deprecated — replaced by `@supabase/ssr` |
| Chakra UI | Incompatible with Tailwind-first architecture, breaking v3 API |
| Tremor | Redundant — shadcn/ui Chart component covers the same use case |
| Nivo | 500kB+ bundle, overkill for ROAS/CTR line and bar charts |
| TanStack Charts | Alpha-stage as of mid-2026, not production-ready |
| SWR | Insufficient cache invalidation granularity for this domain |
| Redux Toolkit | Over-engineered for a 1-2 developer dashboard project |
| Formik | Slower than RHF (controlled components), smaller 2025 momentum |
| Zod v3 | Superseded by v4 — start greenfield on v4 |
| Victory | Smaller ecosystem, no advantage over Recharts for this use case |

---

## Sources

- Supabase Next.js Quickstart: https://supabase.com/docs/guides/getting-started/quickstarts/nextjs
- Supabase SSR package: https://supabase.com/docs/guides/auth/server-side/nextjs
- Supabase Custom Claims RBAC: https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac
- Supabase Custom Access Token Hook: https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook
- Supabase TypeScript Types: https://supabase.com/docs/guides/api/rest/generating-types
- TanStack Query SSR: https://tanstack.com/query/v5/docs/react/guides/ssr
- Supabase Cache Helpers + React Query guide: https://supabase.com/blog/react-query-nextjs-app-router-cache-helpers
- shadcn/ui Charts: https://ui.shadcn.com/charts
- shadcn/ui CLI 3.0 changelog: https://ui.shadcn.com/docs/changelog/2025-08-cli-3-mcp
- Recharts React 19 compatibility: https://ui.shadcn.com/docs/react-19
- Zustand v5 announcement: https://pmnd.rs/blog/announcing-zustand-v5
- Zustand Next.js setup: https://zustand.docs.pmnd.rs/learn/guides/nextjs
- Zod v4 release: https://zod.dev/v4
- N8N Supabase node 403 bug: https://github.com/n8n-io/n8n/issues/17020
- N8N Supabase credentials docs: https://docs.n8n.io/integrations/builtin/credentials/supabase/
- Anthropic SDK npm: https://www.npmjs.com/package/@anthropic-ai/sdk
- Vercel Function limits: https://vercel.com/docs/functions/limitations
- Vercel + Supabase integration: https://supabase.com/partners/integrations/vercel
