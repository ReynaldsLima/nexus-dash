# Phase 1: Foundation — Research

**Researched:** 2026-05-10
**Domain:** Supabase Auth + RLS + Next.js 15 App Router + Multi-tenant RBAC
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Tenant switcher = dropdown persistente no header — visível em todas as páginas autenticadas. Super Admin vê todos os tenants na lista; tenant_admin/viewer não veem o switcher.

**D-02:** Tenant ativo aparece na URL — rotas no formato `/[tenant-slug]/[page]` (ex: `/acme/dashboard`, `/acme/campanhas`). Permite múltiplos tenants abertos em abas e URLs compartilháveis.

**D-03:** Estrutura de rotas do app:
- `/login` — página de login (pública)
- `/tenants` — visão geral de todos os tenants (Super Admin only)
- `/tenants/[slug]` — detalhes do tenant + criação de usuários (Super Admin only)
- `/[tenant-slug]/dashboard` — dashboard de campanhas (tenant_admin, viewer, super_admin)
- Rotas de Fase 3+: `/[tenant-slug]/campanhas`, `/[tenant-slug]/insights` (scaffolded, não implementadas em Fase 1)

**D-04:** Super Admin após login → `/tenants`
**D-05:** tenant_admin e viewer após login → `/[seu-tenant-slug]/dashboard`

**D-06:** `middleware.ts` responsável por: redirecionar requisições não autenticadas para `/login`, redirecionar `/` para rota correta por role, bloquear tenant_admin/viewer de rotas `/tenants/*`, bloquear viewer de rotas de admin dentro do tenant.

**D-07:** Tabela `tenants` mínima v1 (id, name, slug, active, created_at). Sem logo/timezone/moeda.

**D-08:** Desativar tenant = soft delete (`active = false`). RLS inclui `AND tenants.active = true`.

**D-09:** Tabela `tenant_users` (id, tenant_id, user_id, role CHECK IN ('tenant_admin','viewer'), created_at, UNIQUE(tenant_id, user_id)). `super_admin` não aparece em `tenant_users`.

**D-10:** Interface mínima de criação de usuários: botão no `/tenants/[slug]`, modal com email + role + senha inicial. Chama Supabase Admin API via Server Action (service_role key — nunca exposta ao client).

**D-11:** Sem página de gestão/listagem de usuários em v1. Listar usuários existentes via Supabase Dashboard.

**D-12:** `super_admin` armazenado em `auth.users.app_metadata.role` — não em `tenant_users`.

**D-13:** Custom Access Token Hook injeta `tenant_id` e `role` no JWT em cada requisição. Nenhuma consulta ao banco por request.

**D-14:** RLS: SEMPRE usar `(SELECT get_tenant_id())` como wrapper — nunca chamar a função diretamente no USING clause (causa 100-1000x slowdown).

**D-15:** Supabase client: `@supabase/ssr` APENAS. `@supabase/auth-helpers-nextjs` está deprecated.

**D-16:** `createServerClient` para Server Components, Server Actions e Route Handlers. `createBrowserClient` para Client Components.

### Claude's Discretion

- Nomes exatos das funções Postgres (`get_tenant_id`, `get_user_role`, etc.)
- Estrutura interna das RLS policies (order of conditions, index hints)
- Estrutura de loading states e error boundaries nas páginas de auth
- Implementação exata do middleware (cookie names, session refresh logic)

### Deferred Ideas (OUT OF SCOPE)

- Logo do tenant no switcher
- Timezone por tenant
- Página de gestão/listagem de usuários por tenant
- Trocar senha no primeiro acesso (força troca)
- 2FA/MFA
- Magic link / Google OAuth
- Invite por email
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | User can log in with email + password and stay logged in across sessions | `@supabase/ssr` middleware session refresh, HTTP-only cookie strategy |
| AUTH-02 | User can log out from any page and session is invalidated | `supabase.auth.signOut()` from any Server Action, cookie cleared |
| AUTH-03 | Super Admin can create, edit, and deactivate tenants from the platform | `tenants` table + Supabase Admin API via Server Action (service_role) |
| AUTH-04 | Super Admin can switch between tenants without logging out | Tenant switcher in header reads JWT claims; navigation updates URL slug |
| AUTH-05 | Three roles exist with appropriate access gates per role | `app_metadata.role` in JWT + middleware route guards + RLS policies |
| AUTH-06 | RLS enforces tenant isolation — cross-tenant reads fail at the database level | Custom Access Token Hook + `(SELECT get_tenant_id())` helper + btree index on tenant_id |
</phase_requirements>

---

## Summary

Phase 1 delivers the entire authentication and tenant isolation foundation. Every subsequent phase depends on this being correct. The work splits into three distinct layers: (1) Supabase database schema — tables, helper functions, RLS policies, and the Custom Access Token Hook; (2) Next.js middleware and Supabase client utilities — session refresh, route guards, and role-based redirects; (3) UI scaffolding — login page, `/tenants` overview, tenant detail page with user creation modal, and shell routes for Phase 3+ pages.

The most critical correctness requirement is RLS. All locked decisions (D-12 through D-16) exist specifically to avoid RLS security gaps and performance regressions. The `(SELECT get_tenant_id())` wrapper pattern (D-14) must be enforced everywhere — it prevents the Postgres query planner from evaluating the JWT extraction function once per row, which would make table scans 100-1000x slower as campaign_metrics grows.

The Custom Access Token Hook is the lynchpin of the architecture. It fires before every JWT is issued and injects `tenant_id` and `role` directly into `app_metadata` claims. This eliminates per-request database lookups in middleware and RLS policies. The hook must be registered in the Supabase Dashboard (Authentication → Hooks) after the function is created, and it requires a `GRANT EXECUTE` to `supabase_auth_admin` to run.

**Primary recommendation:** Build the database layer (migrations + hook + RLS policies) first, verify with psql/Supabase Dashboard that JWT claims flow correctly before writing any Next.js code, then build the Next.js layer on top of a verified foundation.

---

## Standard Stack

### Core (Phase 1 — not yet installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/ssr | 0.10.3 | Cookie-based Supabase auth for SSR | Official Supabase SSR package; replaces deprecated auth-helpers-nextjs |
| @supabase/supabase-js | 2.105.4 | Supabase data client | Core client for all Supabase operations |
| zustand | 5.0.13 | Active tenant context + global UI state | Official Zustand v5; store-per-request pattern for App Router |
| react-hook-form | 7.75.0 | Login form + user creation modal | Uncontrolled inputs, zero re-renders, integrates with Zod |
| zod | 4.4.3 | Schema validation (login, user creation) | Zod v4 stable; same schema on client and server |
| @hookform/resolvers | 5.2.2 | Bridge RHF ↔ Zod | Required companion to use Zod as RHF resolver |
| shadcn/ui | CLI 4.7.0 | UI components (Button, Card, Table, Modal, Dropdown) | Code-generation approach; components owned locally |

[VERIFIED: npm registry — versions confirmed 2026-05-10]

### What is Already Installed

| Library | Version | Status |
|---------|---------|--------|
| next | 16.2.6 | Installed — Phase 0 scaffold |
| react | 19.2.4 | Installed — Phase 0 scaffold |
| tailwindcss | ^4 | Installed — Phase 0 scaffold |
| typescript | ^5 | Installed — Phase 0 scaffold |

**Installation command for Phase 1 dependencies:**
```bash
npm install @supabase/ssr @supabase/supabase-js zustand react-hook-form zod @hookform/resolvers
npx shadcn@latest init
npx shadcn@latest add button card table dialog dropdown-menu form input label separator badge skeleton
```

**Version verification:** All package versions confirmed against npm registry 2026-05-10. Next.js is at 16.2.6 (higher than the documented 15.x — same App Router patterns apply). [VERIFIED: npm registry]

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| zustand | React Context | Context re-renders entire subtree on tenant switch; unacceptable for dashboard |
| react-hook-form + zod | Server Action validation only | RHF provides client-side validation before network round-trip |
| shadcn/ui | Raw Tailwind + Radix UI | shadcn/ui IS Radix + Tailwind; same thing with pre-wired components |

---

## Architecture Patterns

### Recommended File Structure for Phase 1

```
app/
├── login/
│   └── page.tsx                    # Public login page — email + password form
├── tenants/
│   ├── page.tsx                    # Super Admin only: list all tenants (Server Component)
│   └── [slug]/
│       └── page.tsx                # Super Admin only: tenant detail + user creation
├── [tenant-slug]/
│   ├── layout.tsx                  # Auth-gated layout for all tenant pages
│   └── dashboard/
│       └── page.tsx                # Scaffolded shell — no data in Phase 1
├── layout.tsx                      # Root layout — add providers here
└── globals.css                     # Tailwind base styles (already exists)

components/
├── auth/
│   ├── login-form.tsx              # RHF + Zod login form (Client Component)
│   └── logout-button.tsx           # Server Action trigger (Client Component)
└── tenants/
    ├── tenant-switcher.tsx         # Dropdown in header (Client Component, reads Zustand)
    ├── tenants-table.tsx           # List of tenants (Client Component)
    └── add-user-modal.tsx          # Modal to create new tenant user

lib/
├── supabase/
│   ├── server.ts                   # createServerClient — Server Components, Actions, Route Handlers
│   ├── client.ts                   # createBrowserClient — Client Components
│   └── service.ts                  # createClient(service_role) — Admin API calls ONLY
├── actions/
│   ├── auth.ts                     # Server Actions: signIn, signOut
│   └── tenants.ts                  # Server Actions: createTenant, editTenant, deactivateTenant, createUser
└── stores/
    └── tenant-store.ts             # Zustand store: activeTenant, setActiveTenant

middleware.ts                       # Root: session refresh + role guards + redirects
types/
└── database.types.ts               # Generated from `supabase gen types`

supabase/
└── migrations/
    ├── 0001_create_staging_schema.sql    # Existing — Phase 0
    ├── 0002_create_tenants.sql           # Phase 1: tenants + tenant_users tables
    ├── 0003_create_helper_functions.sql  # Phase 1: get_tenant_id(), get_user_role()
    ├── 0004_create_rls_policies.sql      # Phase 1: RLS on all tables
    └── 0005_custom_access_token_hook.sql # Phase 1: auth hook function + grants
```

### Pattern 1: Async Supabase Server Client (Next.js 15/16)

Next.js 15+ made `cookies()` from `next/headers` return a `Promise`. The `createClient()` helper must be `async` and `await cookies()` before passing to `createServerClient`.

```typescript
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database.types'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from Server Component — cookies are read-only here
            // Middleware handles the actual cookie write
          }
        },
      },
    }
  )
}
```
[VERIFIED: Supabase SSR official docs + community confirmed async cookies() for Next.js 15+]

### Pattern 2: Supabase Service Client (Admin API — never client-side)

```typescript
// lib/supabase/service.ts
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

export function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!  // NEVER prefix with NEXT_PUBLIC_
  )
}
```

Used exclusively in Server Actions and Route Handlers for admin operations (create user, deactivate tenant). The service_role key bypasses ALL RLS — intentional here only.

### Pattern 3: Middleware (session refresh + role guards)

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
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value, options)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // CRITICAL: getUser() refreshes the session token if expired
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Not authenticated — redirect to login (except login page itself)
  if (!user && pathname !== '/login') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Extract role from JWT claims (no DB round-trip)
  const { data: { session } } = await supabase.auth.getSession()
  const role = (session?.access_token
    ? JSON.parse(atob(session.access_token.split('.')[1]))?.app_metadata?.role
    : null) as string | null

  // Authenticated user hitting /login → redirect to role home
  if (user && pathname === '/login') {
    if (role === 'super_admin') {
      return NextResponse.redirect(new URL('/tenants', request.url))
    }
    // tenant_admin and viewer — tenant_id is in JWT; redirect to their dashboard
    const tenantSlug = JSON.parse(atob(session!.access_token.split('.')[1]))
      ?.app_metadata?.tenant_slug
    return NextResponse.redirect(new URL(`/${tenantSlug}/dashboard`, request.url))
  }

  // Block non-super_admin from /tenants routes
  if (pathname.startsWith('/tenants') && role !== 'super_admin') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

**Important:** D-02 requires `/[tenant-slug]/dashboard` — but middleware needs `tenant_slug` for the post-login redirect of tenant_admin/viewer. The JWT must carry `tenant_slug` in addition to `tenant_id` (or middleware must do a DB lookup on first login). See Open Question 1.

### Pattern 4: Custom Access Token Hook (Supabase Auth)

The hook is a PostgreSQL function that fires before every JWT is issued. It reads `app_metadata` to check for `super_admin`, and reads `tenant_users` for all other users.

```sql
-- supabase/migrations/0005_custom_access_token_hook.sql

-- Helper: returns tenant_id from JWT (caches per statement via SELECT wrapper)
CREATE OR REPLACE FUNCTION get_tenant_id()
RETURNS UUID
LANGUAGE SQL STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    current_setting('request.jwt.claims', true)::jsonb
    -> 'app_metadata'
    ->> 'tenant_id'
  )::UUID
$$;

-- Helper: returns role from JWT (caches per statement via SELECT wrapper)
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT
LANGUAGE SQL STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT current_setting('request.jwt.claims', true)::jsonb
    -> 'app_metadata'
    ->> 'role'
$$;

-- Custom Access Token Hook: injected before every JWT issuance
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_id    UUID;
  user_role  TEXT;
  tenant_id  UUID;
  tenant_slug TEXT;
  claims     JSONB;
BEGIN
  user_id := (event ->> 'user_id')::UUID;
  claims  := event -> 'claims';

  -- Ensure app_metadata key exists
  IF jsonb_typeof(claims -> 'app_metadata') IS NULL THEN
    claims := jsonb_set(claims, '{app_metadata}', '{}');
  END IF;

  -- Check if user has super_admin role set in auth.users.app_metadata
  -- (set manually via Supabase Admin API on first super_admin creation)
  IF (event -> 'claims' -> 'app_metadata' ->> 'role') = 'super_admin' THEN
    claims := jsonb_set(claims, '{app_metadata,role}', '"super_admin"');
    claims := jsonb_set(claims, '{app_metadata,tenant_id}', 'null');
    claims := jsonb_set(claims, '{app_metadata,tenant_slug}', 'null');
  ELSE
    -- Look up tenant membership
    SELECT
      tu.role,
      tu.tenant_id,
      t.slug
    INTO user_role, tenant_id, tenant_slug
    FROM tenant_users tu
    JOIN tenants t ON t.id = tu.tenant_id AND t.active = TRUE
    WHERE tu.user_id = user_id
    LIMIT 1;

    claims := jsonb_set(claims, '{app_metadata,role}',
      COALESCE(to_jsonb(user_role), '"none"'));
    claims := jsonb_set(claims, '{app_metadata,tenant_id}',
      COALESCE(to_jsonb(tenant_id::TEXT), 'null'));
    claims := jsonb_set(claims, '{app_metadata,tenant_slug}',
      COALESCE(to_jsonb(tenant_slug), 'null'));
  END IF;

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

-- Required grants for the hook to read tenant data
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;

GRANT SELECT ON TABLE public.tenant_users TO supabase_auth_admin;
GRANT SELECT ON TABLE public.tenants TO supabase_auth_admin;
REVOKE SELECT ON TABLE public.tenant_users FROM anon, public;
REVOKE SELECT ON TABLE public.tenants FROM anon, public;
```

**Activation:** After running the migration, go to Supabase Dashboard → Authentication → Hooks → "Custom Access Token" → select the function `public.custom_access_token_hook`.

[CITED: supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook]

### Pattern 5: RLS Policies — ALWAYS use SELECT wrapper

```sql
-- CORRECT: (SELECT get_tenant_id()) — evaluated ONCE per query
CREATE POLICY tenant_isolation ON campaign_metrics
  FOR ALL TO authenticated
  USING (
    tenant_id = (SELECT get_tenant_id())
    OR (SELECT get_user_role()) = 'super_admin'
  );

-- WRONG: get_tenant_id() without wrapper — evaluated per row
-- CREATE POLICY bad ON campaign_metrics FOR ALL TO authenticated
--   USING (tenant_id = get_tenant_id());  -- DO NOT USE
```

[CITED: supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices]

### Pattern 6: Zustand Tenant Store (App Router safe)

In Next.js App Router, Zustand stores must NOT be module-level singletons. Use `createStore` inside a React Context Provider in `layout.tsx` to prevent cross-request state leaks.

```typescript
// lib/stores/tenant-store.ts
import { createStore } from 'zustand'

export type Tenant = { id: string; name: string; slug: string }

export interface TenantState {
  activeTenant: Tenant | null
  tenants: Tenant[]
  setActiveTenant: (tenant: Tenant) => void
}

export const createTenantStore = (initState?: Partial<TenantState>) =>
  createStore<TenantState>()((set) => ({
    activeTenant: null,
    tenants: [],
    setActiveTenant: (tenant) => set({ activeTenant: tenant }),
    ...initState,
  }))
```

[CITED: zustand.docs.pmnd.rs/learn/guides/nextjs]

### Pattern 7: Server Action — Create User (Admin API)

```typescript
// lib/actions/tenants.ts
'use server'
import { createServiceClient } from '@/lib/supabase/service'
import { z } from 'zod'

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12),
  role: z.enum(['tenant_admin', 'viewer']),
  tenantId: z.string().uuid(),
})

export async function createTenantUser(input: unknown) {
  const parsed = createUserSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.flatten() }

  const supabase = createServiceClient()

  // Create auth user via Admin API
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,  // skip confirmation email in v1
  })
  if (authError) return { error: authError.message }

  // Insert into tenant_users
  const { error: tuError } = await supabase
    .from('tenant_users')
    .insert({
      tenant_id: parsed.data.tenantId,
      user_id: authUser.user.id,
      role: parsed.data.role,
    })
  if (tuError) return { error: tuError.message }

  return { success: true, userId: authUser.user.id }
}
```

### Anti-Patterns to Avoid

- **Bare function call in RLS USING clause:** `USING (tenant_id = get_tenant_id())` — causes per-row evaluation. Always wrap: `USING (tenant_id = (SELECT get_tenant_id()))`.
- **service_role key on client side:** Never prefix with `NEXT_PUBLIC_`. Any component importing it gets it bundled into client JS.
- **Module-level Zustand store:** `export const tenantStore = create(...)` at module level in App Router causes cross-request state leaks. Use `createStore` inside a Context Provider.
- **Using `@supabase/auth-helpers-nextjs`:** Deprecated — package is abandoned, no security fixes. Use `@supabase/ssr` exclusively.
- **Not awaiting `cookies()`:** In Next.js 15+, `cookies()` returns a Promise. Calling `cookieStore.getAll()` on the unawaited return causes TypeScript type errors and runtime failures.
- **Registering the Custom Access Token Hook in SQL but not in the Dashboard:** The function must also be activated in Supabase Dashboard → Authentication → Hooks or it will never fire.
- **super_admin not set in app_metadata before hook fires:** The hook checks `(event -> 'claims' -> 'app_metadata' ->> 'role') = 'super_admin'`. If a user's `app_metadata.role` is not set to `'super_admin'` by the Supabase Admin API before their first login, they will be treated as a regular user. The super_admin user must be created or updated with `app_metadata: { role: 'super_admin' }` via Admin API.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session persistence + refresh | Custom cookie management | `@supabase/ssr` middleware | Handles token rotation, httpOnly flags, SameSite correctly |
| Password hashing | Custom bcrypt | Supabase Auth (built-in) | Supabase Auth handles hashing, salting, rate limiting |
| CSRF protection on Server Actions | Custom CSRF token | Next.js Server Actions (built-in) | Next.js 14+ Server Actions include CSRF protection out of the box |
| User creation Admin API | Raw fetch to Supabase REST | `supabase.auth.admin.createUser()` | Handles email confirmation, password validation, audit logging |
| JWT decode in middleware | `import jwt from 'jsonwebtoken'` | `atob(token.split('.')[1])` or `jose` | No need for full JWT library for reading claims (verification done by Supabase) |
| Form validation | Custom state + regex | Zod v4 + `@hookform/resolvers` | Zod parses AND validates with one call; same schema client + server |

**Key insight:** Supabase Auth handles the entire session lifecycle. The application layer only needs to (a) call `supabase.auth.signInWithPassword()`, (b) call `supabase.auth.signOut()`, and (c) call `supabase.auth.getUser()` in middleware. Everything else — token storage, rotation, expiry — is managed by `@supabase/ssr`.

---

## Common Pitfalls

### Pitfall 1: JWT Claims Stale After Role Change (Pitfall 3.5)
**What goes wrong:** When a Super Admin changes a user's role or tenant assignment, the existing JWT token carries the OLD claims until it expires (1-hour default). RLS policies based on JWT claims enforce the old role.
**Why it happens:** JWT claims are baked in at issuance. Database changes don't invalidate existing tokens.
**How to avoid:** After any role change in `tenant_users`, call `supabase.auth.admin.deleteUser()` and recreate, OR document in the UI that "Role changes take effect after the user's next login." For v1 with 1-3 tenants, the documentation approach is sufficient.
**Warning signs:** User reports seeing data they shouldn't have access to immediately after a role change.

### Pitfall 2: Missing RLS on New Tables (Pitfall 3.1 — CRITICAL)
**What goes wrong:** Tables created via migration have RLS disabled by default. Any new table created in Phase 1 or later without `ALTER TABLE x ENABLE ROW LEVEL SECURITY` is publicly readable via the anon key.
**Why it happens:** RLS must be explicitly enabled per table — it's opt-in, not opt-out.
**How to avoid:** Every migration that creates a table MUST include `ALTER TABLE name ENABLE ROW LEVEL SECURITY` and at minimum one policy. The migration template is the enforcement mechanism.
**Warning signs:** Supabase Dashboard shows the yellow "No RLS" warning badge on a table.

### Pitfall 3: Hook Runs but Claims Are Missing (CRITICAL for Phase 1)
**What goes wrong:** The Custom Access Token Hook is created as a SQL function but not activated in the Supabase Dashboard. JWT tokens are issued without `tenant_id` or `role` claims. RLS helper functions return NULL, which means ALL RLS policies fail closed (users see nothing) or fail open (depending on policy logic).
**Why it happens:** The SQL migration creates the function, but function registration is a two-step process — the Dashboard activation is a separate manual step.
**How to avoid:** After running migration `0005_custom_access_token_hook.sql`, manually activate at: Supabase Dashboard → Authentication → Hooks → Custom Access Token → select `public.custom_access_token_hook`.
**Warning signs:** Decoded JWT has no `app_metadata.role` or `app_metadata.tenant_id` fields. Test with `console.log(JSON.parse(atob(session.access_token.split('.')[1])))`.

### Pitfall 4: Super Admin Has No `tenant_slug` for Post-Login Redirect
**What goes wrong:** D-05 says tenant_admin/viewer redirect to `/[leur-tenant-slug]/dashboard` after login. But the middleware needs the slug. If only `tenant_id` (UUID) is in the JWT, middleware must either (a) do a DB lookup (defeats the "no DB per request" goal) or (b) carry `tenant_slug` in the JWT.
**How to avoid:** The Custom Access Token Hook (Pattern 4 above) injects `tenant_slug` into the JWT claims alongside `tenant_id`. This is included in the recommended hook implementation.
**Warning signs:** Post-login redirect loops or redirects to a UUID-based URL instead of `/acme/dashboard`.

### Pitfall 5: RLS Bare Function Call Performance (Pitfall 3.3 — CRITICAL)
**What goes wrong:** Writing `USING (tenant_id = get_tenant_id())` causes the Postgres query planner to evaluate `get_tenant_id()` for every row in the table during a query. On `campaign_metrics` with millions of rows, this degrades from 200ms to 20+ seconds.
**Why it happens:** Without the `SELECT` wrapper, PostgreSQL treats the function as `VOLATILE` in the optimizer even when marked `STABLE`.
**How to avoid:** Always write `USING (tenant_id = (SELECT get_tenant_id()))`. The `SELECT` wrapper forces the planner to evaluate once per query.
**Warning signs:** `EXPLAIN ANALYZE` shows `InitPlan` calls on RLS policy evaluation, or `Seq Scan` on `tenant_id` filtered queries.

### Pitfall 6: Edge Runtime Incompatibility with Supabase Client
**What goes wrong:** Setting `export const runtime = 'edge'` on any route or layout that uses `createServerClient` causes failures. Edge Runtime doesn't support all Node.js APIs used by `@supabase/ssr`.
**How to avoid:** Never set `runtime = 'edge'` on routes that use the Supabase client. Middleware uses its own cookie API and is compatible with Edge Runtime.
**Warning signs:** Vercel build or runtime errors mentioning `fs`, `crypto`, or Node.js-specific modules when Edge Runtime is set.

---

## Code Examples

### Database Schema Migration (Phase 1)

```sql
-- supabase/migrations/0002_create_tenants.sql

CREATE TABLE public.tenants (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]+$'),
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.tenant_users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('tenant_admin', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, user_id)
);

-- Index for JWT lookup performance in the Custom Access Token Hook
CREATE INDEX idx_tenant_users_user_id ON public.tenant_users(user_id);
CREATE INDEX idx_tenant_users_tenant_id ON public.tenant_users(tenant_id);
```

### RLS Policies Migration

```sql
-- supabase/migrations/0004_create_rls_policies.sql

-- tenants table: super_admin sees all; tenant members see own tenant
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenants_super_admin ON public.tenants
  FOR ALL TO authenticated
  USING ((SELECT get_user_role()) = 'super_admin');

CREATE POLICY tenants_member_select ON public.tenants
  FOR SELECT TO authenticated
  USING (
    id = (SELECT get_tenant_id())
    AND active = TRUE
  );

-- Only super_admin can INSERT/UPDATE/DELETE tenants
CREATE POLICY tenants_super_admin_write ON public.tenants
  FOR ALL TO authenticated
  USING ((SELECT get_user_role()) = 'super_admin')
  WITH CHECK ((SELECT get_user_role()) = 'super_admin');

-- tenant_users: users see own tenant memberships; super_admin sees all
ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_users_isolation ON public.tenant_users
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT get_tenant_id())
    OR (SELECT get_user_role()) = 'super_admin'
  );

CREATE POLICY tenant_users_super_admin_write ON public.tenant_users
  FOR ALL TO authenticated
  USING ((SELECT get_user_role()) = 'super_admin')
  WITH CHECK ((SELECT get_user_role()) = 'super_admin');
```

### Login Server Action

```typescript
// lib/actions/auth.ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function signIn(formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) return { error: 'Email ou senha inválidos' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) return { error: 'Credenciais inválidas' }

  // Middleware handles the role-based redirect after login
  redirect('/')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
```

### Tenant Generation TypeScript Types

```bash
# After running migrations, regenerate types:
npx supabase gen types --lang=typescript --project-id rvkkvjitfddtbdpkupok > types/database.types.ts
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | 2023 | Auth helpers deprecated; SSR package is the only supported path |
| Synchronous `cookies()` | `await cookies()` | Next.js 15 (Oct 2024) | `createClient()` in server.ts must be `async` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 2025 Supabase migration | Both work during transition; use new name for greenfield |
| Bare function call in RLS USING | `(SELECT fn())` wrapper | Supabase RLS best practices | 100-1000x query speedup on large tables |
| Zustand `create()` at module level | `createStore()` inside Context Provider | Zustand v5 / Next.js App Router | Prevents cross-request state leaks in SSR |

**Deprecated/outdated:**
- `@supabase/auth-helpers-nextjs` — completely deprecated, no security patches, do not install
- `cookies()` without `await` in server utilities — causes TypeScript errors in Next.js 15+
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` env var name — functional but superseded by `PUBLISHABLE_KEY`

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `tenant_slug` can be stored in JWT claims alongside `tenant_id` via the Custom Access Token Hook, resolving the post-login redirect requirement (D-05) | Architecture Patterns, Pattern 4 | If Supabase's JWT claim size limit rejects the extra field, middleware must do a DB lookup for the redirect — adds one DB call on login only |
| A2 | Supabase Dashboard activation of the hook (Authentication → Hooks) works correctly after migrating with GRANT EXECUTE to supabase_auth_admin | Architecture Patterns, Pattern 4 | If the grant is insufficient or the hook doesn't fire, JWT claims will lack tenant context and all RLS policies will fail |
| A3 | `supabase.auth.admin.createUser({ email_confirm: true })` skips email verification in v1 | Code Examples (Server Action) | If email_confirm is not honored or Supabase requires SMTP config, user creation will succeed but users won't be able to log in without confirming email |

**If this table is empty:** All other claims in this research were verified via official documentation or confirmed npm registry checks.

---

## Open Questions

1. **Slug availability for post-login redirect**
   - What we know: D-05 requires redirect to `/[tenant-slug]/dashboard` but JWT only naturally carries `tenant_id` (UUID)
   - What's unclear: Whether `tenant_slug` can reliably be embedded in JWT claims without Supabase rejecting claims due to size or structure limits
   - Recommendation: Implement the hook with `tenant_slug` in claims (Pattern 4 above). If it causes issues, fall back to a single DB lookup in middleware on `/` redirect only (acceptable one-time cost on login)

2. **Creating the first super_admin user**
   - What we know: D-12 says super_admin is stored in `auth.users.app_metadata.role`. The hook checks this claim.
   - What's unclear: The planner needs a task for bootstrapping the first super_admin. The correct mechanism is: create user normally → use Supabase Dashboard or Admin API to set `app_metadata: { role: 'super_admin' }` → user logs out and back in to get refreshed JWT.
   - Recommendation: Include an explicit "bootstrap super_admin" task in the plan that uses `supabase.auth.admin.updateUserById(userId, { app_metadata: { role: 'super_admin' } })`.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | npm install, Next.js | Implied by existing project | — | — |
| Supabase project (sa-east-1) | All DB migrations | Confirmed (rvkkvjitfddtbdpkupok) | — | — |
| Supabase CLI (`supabase`) | `gen types`, migrations | [ASSUMED] | — | Use Supabase Dashboard SQL Editor for migrations |
| Vercel project | Deployment | Confirmed (gru1 region) | — | — |
| npm | Package install | Implied by existing package.json | — | — |

**Missing dependencies with no fallback:** None identified for Phase 1.

**Missing dependencies with fallback:**
- Supabase CLI: if not installed locally, all migrations can be applied via Supabase Dashboard → SQL Editor. `gen types` requires CLI — add `npm install -D supabase` if not present.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None configured in Phase 0 scaffold |
| Config file | None — Wave 0 must create |
| Quick run command | `npm run test` (after Wave 0 setup) |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Login persists across sessions | e2e / smoke | Manual — browser test | No |
| AUTH-02 | Logout invalidates session on all pages | e2e / smoke | Manual — browser test | No |
| AUTH-03 | Super Admin can create/edit/deactivate tenant | Integration (Server Action) | `npm test -- --testPathPattern=tenants` | No — Wave 0 |
| AUTH-04 | Super Admin tenant switcher navigates without logout | e2e | Manual — browser test | No |
| AUTH-05 | Role gates enforced — viewer blocked from admin routes | Unit (middleware) | `npm test -- --testPathPattern=middleware` | No — Wave 0 |
| AUTH-06 | Cross-tenant RLS fails at DB layer | Integration (Supabase RLS) | `npm test -- --testPathPattern=rls` | No — Wave 0 |

**Note:** Browser-based e2e tests (AUTH-01, AUTH-02, AUTH-04) are difficult to automate without Playwright/Cypress. For Phase 1 nyquist validation, the primary verifiable tests are:
- Middleware unit test (AUTH-05): test the route guard logic with mock JWT claims
- RLS integration test (AUTH-06): run SQL queries from different tenant JWTs via Supabase test utilities

### Sampling Rate

- **Per task commit:** Lint only (`npm run lint`)
- **Per wave merge:** Run available unit tests + manual smoke test (login + logout flow)
- **Phase gate:** Full available test suite green + manual verification of all 5 success criteria before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `vitest.config.ts` — configure Vitest for unit tests (or Jest if preferred)
- [ ] `tests/middleware.test.ts` — unit test middleware route guards with mocked JWT payloads
- [ ] `tests/rls.test.ts` — RLS isolation test using two test tenant users
- [ ] `tests/setup.ts` — test environment setup (Supabase test project connection)
- [ ] Framework install: `npm install -D vitest @vitest/ui` (or `jest @types/jest ts-jest`)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | Supabase Auth (email + password, bcrypt, rate limiting built-in) |
| V3 Session Management | Yes | `@supabase/ssr` — httpOnly cookies, SameSite=Lax, token rotation |
| V4 Access Control | Yes | RLS policies + middleware route guards + JWT claims (RBAC) |
| V5 Input Validation | Yes | Zod v4 — all form inputs and Server Action parameters |
| V6 Cryptography | Partial | Supabase Auth handles password hashing; tokens stored as httpOnly cookies |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-tenant data read | Information Disclosure | RLS with `(SELECT get_tenant_id())` wrapper — verified at DB layer |
| Service role key exposure | Elevation of Privilege | Never in `NEXT_PUBLIC_` prefix; only in Server Actions/Route Handlers |
| JWT claim manipulation | Tampering | Supabase validates JWT signature; claims cannot be tampered client-side |
| Session fixation | Elevation of Privilege | `@supabase/ssr` rotates tokens on each middleware refresh |
| Missing RLS on new table | Information Disclosure | Migration template enforces `ENABLE ROW LEVEL SECURITY` on every table |
| Prompt injection via user data | Tampering | N/A for Phase 1 (no AI integration) — defer to Phase 4 |

---

## Sources

### Primary (HIGH confidence)
- [Supabase SSR Package Docs](https://supabase.com/docs/guides/auth/server-side/nextjs) — createServerClient async cookies pattern, env variable names
- [Supabase Custom Access Token Hook](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook) — hook SQL structure, required GRANT statements
- [Supabase RBAC Docs](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac) — app_metadata role injection pattern
- [Supabase RLS Performance Docs](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) — SELECT wrapper requirement
- [npm registry: @supabase/ssr@0.10.3](https://www.npmjs.com/package/@supabase/ssr) — verified 2026-05-10
- [npm registry: @supabase/supabase-js@2.105.4](https://www.npmjs.com/package/@supabase/supabase-js) — verified 2026-05-10
- [npm registry: zustand@5.0.13](https://www.npmjs.com/package/zustand) — verified 2026-05-10
- [npm registry: react-hook-form@7.75.0](https://www.npmjs.com/package/react-hook-form) — verified 2026-05-10
- [npm registry: zod@4.4.3](https://www.npmjs.com/package/zod) — verified 2026-05-10
- [Zustand Next.js App Router Guide](https://zustand.docs.pmnd.rs/learn/guides/nextjs) — createStore + Context pattern

### Secondary (MEDIUM confidence)
- [GitHub Discussion #81445](https://github.com/vercel/next.js/discussions/81445) — async cookies() requirement confirmed for Next.js 15
- [GitHub supabase/supabase — auth-hooks MDX source](https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/auth/auth-hooks/custom-access-token-hook.mdx) — hook SQL + GRANT patterns
- `.planning/research/STACK.md` — stack decisions (all HIGH confidence from prior research)
- `.planning/research/PITFALLS.md` — pitfalls 3.1–3.5 directly applicable to Phase 1
- `.planning/research/ARCHITECTURE.md` — schema, RLS patterns, helper functions

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all library versions verified against npm registry 2026-05-10
- Architecture (auth patterns): HIGH — verified against official Supabase SSR + auth-hooks docs
- RLS patterns: HIGH — cited from Supabase RLS performance official docs
- Custom Access Token Hook activation: MEDIUM — SQL pattern HIGH, Dashboard activation steps not fully documented in available docs
- Pitfalls: HIGH — sourced from PITFALLS.md which cited official docs

**Research date:** 2026-05-10
**Valid until:** 2026-06-10 (30 days — stable library ecosystem; Supabase auth API changes slowly)
