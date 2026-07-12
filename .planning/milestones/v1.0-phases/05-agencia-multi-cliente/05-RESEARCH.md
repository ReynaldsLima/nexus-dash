# Phase 5: Access Modules — Multi-Client Agency - Research

**Researched:** 2026-07-05
**Domain:** Supabase RLS multi-path authorization (direct tenant membership + N:N grant via intermediary entity), Custom Access Token Hook extension, Next.js App Router role-based routing
**Confidence:** HIGH (schema/RLS/hook patterns verified against live project code + Supabase official docs); MEDIUM (exact UI screen layout, since it's genuinely new); flagged LOW/ASSUMED items called out individually below.

## Summary

This phase adds a second, parallel authorization path to a codebase that today only knows "I am a member of exactly one tenant" (`tenant_id` in JWT) or "I am super_admin" (global). The new path is "I am a member of an agency that has a grant on this tenant" — a classic N:N-via-junction-table pattern. The good news: the project's existing conventions (JWT custom claims via Custom Access Token Hook, `(SELECT helper())`-wrapped RLS, a `_super_admin_all` + `_member_select` policy pair per table) extend cleanly to a third `_agency_select` policy per table, verified against Supabase's own documented performance guidance for junction-table RLS `[CITED: supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv]`.

The harder part is NOT the RLS extension — it's two things this research surfaced by reading the actual code (not just the CONTEXT.md description of it): (1) the Custom Access Token Hook and the two page-level layouts (`app/tenants/layout.tsx`, `app/[tenant-slug]/layout.tsx`) currently gate on a **single JWT `tenant_slug` string equality**, which structurally cannot express "member of a set of tenants" — this needs a real architecture change, not a config tweak; and (2) the Leads status write-back route (`app/api/leads/[id]/status/route.ts`, Phase 03.1) has a **pre-existing authorization gap**: it never verifies the caller's tenant matches the `tenant` slug in the request body, unlike its sibling route `app/api/meta-ads/connect/route.ts` which does this correctly. Because this phase is exactly about "who can reach which tenant's data," this gap must be closed as part of Phase 5, not left as-is — otherwise Agência inherits (and widens the blast radius of) the same hole.

**Primary recommendation:** Add `agencies` / `agency_users` / `agency_tenants` tables with `agency_id` as a new JWT claim (parallel to, never alongside, `tenant_id`); replace the JWT-string-equality tenant guard in `app/[tenant-slug]/layout.tsx` with a live RLS-scoped query (works uniformly for Cliente and Agência, and even fixes a latent staleness bug for deactivated tenants); collapse `tenant_users.role` to a single surviving value `tenant_admin` (cheapest migration — reuse the existing string, promote `viewer` rows, no literal-string churn across 12 files that already say `'tenant_admin'`); and close the Leads route's tenant-scope gap using the exact pattern already proven in `app/api/meta-ads/connect/route.ts` (derive tenant scope server-side from JWT/grant, never trust client-supplied tenant identifiers).

## User Constraints

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 (Agência visibility model):** Agência navigation is a **client selector**, not a consolidated cross-client dashboard. Logging in as an Agência user presents a switcher (extending `components/tenants/tenant-switcher.tsx`) scoped to only the Cliente tenants granted to that agency; picking one shows that tenant's normal dashboard/campanhas/leads pages, unchanged. No new aggregation/rollup work across multiple clients in this phase.
- **D-02 (Grant management):** The Super Admin manages which Cliente tenants an Agência can see through a **simple in-app screen** (not manual Supabase Studio edits like tenant creation today). Deliberate deviation from the project's "no onboarding UI" pattern because this is a recurring, changing operation.
- **D-03 (Cliente role model):** Within a Cliente tenant, access becomes a **single flat role** — no more internal `tenant_admin` vs `viewer` split. Whoever has access sees and edits everything, including lead status. Migration note: `lukseg` and `beta-test` have live `tenant_admin`/`viewer` rows — planner must decide how existing rows reconcile (not resolved by the user, flagged as research/planning question).
- **D-04 (Agência identity):** An Agência user has **their own account, with no tenant membership at all** — never a row in `tenant_users`. Their only association is to an agency entity (and, through the grant, to the Cliente tenants that agency can see). A user is either a tenant member (Cliente) or an agency member (Agência), never both, in this phase's model.

### Claude's Discretion

- Exact schema/table design (`agencies`, `agency_users`, `agency_tenants` join table names/columns).
- How `get_user_agency_id()` (or equivalent) is exposed via JWT custom claims, consistent with `get_tenant_id()`/`get_user_role()`.
- Whether `super_admin` needs a new "simple in-app screen" (likely yes per D-02) — exact UI/UX, nav placement, table layout is researcher/planner's call.
- Whether Cliente's single flat role reuses the `tenant_admin` string value going forward or needs a new value/migration.

### Deferred Ideas (OUT OF SCOPE)

- **Consolidated cross-client dashboard for Agência** (sum/aggregate metrics across all clients an agency manages) — explicitly deferred by D-01 in favor of a simple selector. Could become a future phase if the agency workflow demands portfolio-level reporting later.
</user_constraints>

## Project Constraints (from CLAUDE.md)

- Stack is locked: Next.js 15+ App Router (project is actually on Next.js **16.2.6** — see State of the Art below), Supabase (Postgres + Auth + RLS + Realtime), N8N self-hosted, Vercel, Claude API. No new libraries needed for this phase.
- RLS is the primary security layer, mandatory, total tenant isolation — this phase's core deliverable (extending isolation to a second access path) is a direct continuation of this constraint, not an exception to it.
- No PR review gates, `main` → Vercel prod auto-deploy — migrations must be safe to run directly against the shared prod/staging Supabase project (per STATE.md: staging schema lives in the *same* Supabase project as prod).
- `@supabase/ssr` only, `createServerClient`/`createBrowserClient` factory split — already followed by existing `lib/supabase/server.ts` / `lib/supabase/service.ts`; any new agency-related code must follow the same factory split.
- Zod v4 (`zod/v4` import path is the project's established pattern, confirmed in `app/api/leads/[id]/status/route.ts`) for any new request schemas (e.g., agency grant management Server Actions).
- No roles beyond what's decided: PROJECT.md's "Out of Scope" table lists "Roles adicionais ou permissões granulares além de Super Admin / Tenant Admin / Viewer" — Phase 5 explicitly supersedes this line (roadmap evolution recorded in STATE.md); the planner should update PROJECT.md's Out of Scope section to reflect the new 3-module model (Super Admin / Agência / Cliente) as part of phase closure, not during research.

<phase_requirements>
## Phase Requirements

No formal REQ IDs exist yet for this phase (REQUIREMENTS.md traceability table has no Phase 5 rows). Based on the roadmap goal and CONTEXT.md decisions D-01–D-04, this research proposes the following candidate IDs for the requirements author to formalize during planning (naming follows the project's existing `PREFIX-NN` convention, e.g. `LEADS-01`):

| Candidate ID | Description | Research Support |
|----|-------------|------------------|
| AGENCY-01 | Super Admin can create an Agência entity and add/remove Agência users via an in-app screen | D-02; reuse pattern from `app/tenants/page.tsx` + `lib/actions/tenants.ts` (see Architecture Patterns) |
| AGENCY-02 | Super Admin can grant/revoke an Agência's access to N Cliente tenants via the same in-app screen | D-02; `agency_tenants` N:N schema (see Standard Stack / Don't Hand-Roll) |
| AGENCY-03 | An Agência user, on login, is routed to a client-selector view listing only their granted Cliente tenants | D-01; `proxy.ts` routing gap identified in Common Pitfalls |
| AGENCY-04 | An Agência user can view Dashboard, Campanhas, and Gestão de Leads for any granted tenant, identical to what a Cliente sees | D-01; RLS `_agency_select` policies (see Architecture Patterns) |
| AGENCY-05 | An Agência user can edit lead status for any granted tenant, same capability as Cliente/Super Admin | D-01 cross-ref "todos podem alterar o status do lead"; requires closing the PATCH route gap (see Common Pitfalls, CRITICAL) |
| AGENCY-06 | RLS enforces Agência access at the database level (`tenants`, `campaign_metrics`, `ad_accounts`, `sync_jobs`, `daily_rollups`) via `agency_tenants` grant, not just direct `tenant_id` membership | Roadmap goal; canonical refs 01-CONTEXT.md D-12–D-14 |
| AGENCY-07 | `tenant_users.role` collapses to a single flat Cliente value; existing `viewer` rows are promoted, no tenant loses access | D-03; migration plan in Architecture Patterns |
| AGENCY-08 | Tenant/agency-scoped write endpoints (starting with `PATCH /api/leads/[id]/status`) verify the caller's authorization server-side instead of trusting a client-supplied tenant identifier | Pre-existing gap found in this research (Common Pitfalls, CRITICAL) — prerequisite for safely extending Leads write-back to Agência |

These are draft, not authoritative — the planner/requirements-author should confirm exact wording and confirm whether AGENCY-08 is filed as its own requirement or as an implementation detail under AGENCY-05.
</phase_requirements>

## Standard Stack

No new libraries are needed for this phase — it is pure Postgres schema/RLS + existing Next.js/Supabase code changes. All tooling is already installed and verified in `package.json` `[VERIFIED: package.json]`:

| Component | Version | Role in this phase |
|-----------|---------|--------------------|
| `@supabase/ssr` | ^0.10.3 | Unchanged — `createServerClient`/`createBrowserClient` factories already used correctly |
| `@supabase/supabase-js` | ^2.105.4 | Unchanged — service-role client for Server Actions (agency CRUD) |
| `next` | 16.2.6 | Routing changes live in `proxy.ts` (see State of the Art) and `app/[tenant-slug]/layout.tsx` |
| `zod` | ^4.4.3 (`zod/v4` import path) | New request schemas for agency Server Actions, mirroring `lib/actions/tenants.ts` |
| `supabase` (CLI) | ^2.98.2 | New migrations `00XX_create_agencies.sql`, `00XX_agency_rls.sql`, `00XX_collapse_tenant_role.sql` |

**No installation needed.**

## Architecture Patterns

### Recommended Schema

```sql
-- New tables, following the existing tenants/tenant_users shape (0002_create_tenants.sql)
CREATE TABLE public.agencies (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.agency_users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id  UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)  -- D-04: a user is unambiguously in at most one agency, ever
);

CREATE TABLE public.agency_tenants (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id  UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  tenant_id  UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(agency_id, tenant_id)
);

CREATE INDEX idx_agency_users_agency_id ON public.agency_users(agency_id);
CREATE INDEX idx_agency_tenants_agency_id ON public.agency_tenants(agency_id);
CREATE INDEX idx_agency_tenants_tenant_id ON public.agency_tenants(tenant_id);
```

`[ASSUMED]` — `UNIQUE(user_id)` on `agency_users` is a discretionary, not user-locked, choice: it enforces "at most one agency per user account" by DB constraint, which removes the ambiguity the existing `tenant_users` lookup has today (`custom_access_token_hook` uses `LIMIT 1` and silently picks one row if a user happens to belong to multiple tenants — see migration `0005`, line 46). Since this table is new, there's no reason to carry that same ambiguity forward. If a future need arises for one user to belong to multiple agencies, this constraint can be relaxed later without breaking anything that depends on the single-agency assumption today. **Flag for user confirmation** if the planner wants to allow multi-agency membership from day one.

### Custom Access Token Hook Extension (migration 0005 → new migration)

Add a lookup branch **before** the existing `tenant_users` branch (order matters — D-04 says a user is never in both tables, but nothing in the schema enforces that across two independent tables, so precedence order is the tie-breaker if that invariant is ever violated by a data-entry mistake):

```sql
-- Inside custom_access_token_hook(event JSONB), after the super_admin branch:
DECLARE
  v_agency_id UUID;
BEGIN
  ...
  IF v_existing = 'super_admin' THEN
    ... -- unchanged
  ELSE
    -- NEW: check agency membership first
    SELECT au.agency_id INTO v_agency_id
      FROM public.agency_users au
      JOIN public.agencies a ON a.id = au.agency_id AND a.active = TRUE
     WHERE au.user_id = v_user_id
     LIMIT 1;

    IF v_agency_id IS NOT NULL THEN
      claims := jsonb_set(claims, '{app_metadata,role}', '"agency"'::jsonb, true);
      claims := jsonb_set(claims, '{app_metadata,agency_id}', to_jsonb(v_agency_id::TEXT), true);
      claims := jsonb_set(claims, '{app_metadata,tenant_id}', 'null'::jsonb, true);
      claims := jsonb_set(claims, '{app_metadata,tenant_slug}', 'null'::jsonb, true);
    ELSE
      -- existing tenant_users lookup (Branch 2), unchanged, plus:
      claims := jsonb_set(claims, '{app_metadata,agency_id}', 'null'::jsonb, true);
    END IF;
  END IF;
```

Also required (mirrors the existing grants at the bottom of migration `0005`):
```sql
GRANT SELECT ON TABLE public.agency_users TO supabase_auth_admin;
GRANT SELECT ON TABLE public.agencies      TO supabase_auth_admin;
REVOKE SELECT ON TABLE public.agency_users FROM anon, PUBLIC;
REVOKE SELECT ON TABLE public.agencies      FROM anon, PUBLIC;
```

New helper function, exactly parallel to `get_tenant_id()` (migration 0003):
```sql
CREATE OR REPLACE FUNCTION public.get_agency_id()
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::jsonb
    -> 'app_metadata' ->> 'agency_id', '')::UUID
$$;
GRANT EXECUTE ON FUNCTION public.get_agency_id() TO authenticated, anon;
```

**Reminder that already burned this project once (Pitfall from 01-CONTEXT.md, still applies):** after this migration runs, an operator must re-verify the hook is still selected in Supabase Dashboard → Authentication → Hooks → Custom Access Token (editing the function body via migration does not require reselecting it, but this is worth a smoke-test step since the hook silently no-ops if ever deselected).

### RLS Pattern: `_agency_select` Policy (per table)

Verified against Supabase's own performance guidance: filtering `tenant_id IN (SELECT tenant_id FROM junction WHERE junction.owning_id = caller_id)` is the fast direction; the reverse (`caller_id IN (SELECT ... WHERE junction.tenant_id = table.tenant_id)`) is the slow one `[CITED: supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv]`. Apply this to every currently tenant-scoped table (`tenants`, `campaign_metrics`, `ad_accounts`, `sync_jobs`, `daily_rollups`):

```sql
-- Example: campaign_metrics (same shape applies to tenants, ad_accounts, sync_jobs, daily_rollups)
CREATE POLICY campaign_metrics_agency_select ON public.campaign_metrics
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (
      SELECT agt.tenant_id FROM public.agency_tenants agt
      WHERE agt.agency_id = (SELECT public.get_agency_id())
    )
  );
```

This is a `SELECT`-only policy (Agência never writes campaign data directly, same as today's `_tenant_select` policies) added **alongside** the existing `_super_admin_all` and `_tenant_select` policies — Postgres RLS policies are OR'd together for the same command type, so this purely adds a new access path without touching the existing two `[VERIFIED: read migrations 0004, 0006–0009 — all follow `_super_admin_all` + `_tenant_select` two-policy shape]`.

Also add RLS to the three new tables themselves:
```sql
ALTER TABLE public.agencies       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_users   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_tenants ENABLE ROW LEVEL SECURITY;

-- Super Admin manages everything (mirrors tenants_super_admin_all)
CREATE POLICY agencies_super_admin_all ON public.agencies FOR ALL TO authenticated
  USING ((SELECT public.get_user_role()) = 'super_admin')
  WITH CHECK ((SELECT public.get_user_role()) = 'super_admin');
-- (same pattern for agency_users, agency_tenants)

-- Agency members can see their own agency + their own grants (needed for the tenant-switcher query)
CREATE POLICY agencies_member_select ON public.agencies FOR SELECT TO authenticated
  USING (id = (SELECT public.get_agency_id()));
CREATE POLICY agency_tenants_member_select ON public.agency_tenants FOR SELECT TO authenticated
  USING (agency_id = (SELECT public.get_agency_id()));

REVOKE ALL ON public.agencies FROM anon;
REVOKE ALL ON public.agency_users FROM anon;
REVOKE ALL ON public.agency_tenants FROM anon;
```

No recursion risk here: `get_agency_id()` only reads the JWT (no table access), so `agency_tenants_member_select`'s `USING` clause never queries `agency_tenants` itself or any other RLS-protected table — this avoids the exact "policy queries its own junction table" trap Supabase's docs warn about `[CITED: supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv]`.

### Tenant Switcher Scoping — Already Works "For Free" Once RLS Is Extended

Read `components/tenants/tenant-switcher.tsx` and `app/[tenant-slug]/layout.tsx` in full `[VERIFIED: codebase]`. The switcher's tenant list is loaded like this today:

```typescript
// app/[tenant-slug]/layout.tsx, current code
async function loadTenantsForSwitcher(): Promise<TenantOption[]> {
  const supabase = await createClient()   // RLS-scoped client, not service-role
  const { data, error } = await supabase.from('tenants').select('id, name, slug, active')...
  return data
}
const tenants = role === 'super_admin' ? await loadTenantsForSwitcher() : []
```

Because `loadTenantsForSwitcher()` already uses the RLS-scoped client (not service-role), it will **automatically** return the correct, grant-scoped list for an Agência user once `tenants_agency_select` exists — no query changes needed there. The only code change required is the gate:

```typescript
const tenants = (role === 'super_admin' || role === 'agency') ? await loadTenantsForSwitcher() : []
```

...and in `tenant-switcher.tsx`, relax the guard:
```typescript
// current: if (role !== 'super_admin') return null
if (role !== 'super_admin' && role !== 'agency') return null
```

This is the cleanest possible extension point in the whole codebase for this phase — RLS-driven data loading means the UI component needed zero data-shape changes, only a role-string check widened from one value to two.

### `app/[tenant-slug]/layout.tsx` Guard — Needs a Real Fix, Not a Branch

Current code (`[VERIFIED: codebase]`):
```typescript
const role = (user.app_metadata?.role as string | null) ?? null
const tokenSlug = (user.app_metadata?.tenant_slug as string | null) ?? null
if (role !== 'super_admin' && tokenSlug !== urlSlug) {
  redirect('/')
}
```

This is a **single JWT string equality check** and structurally cannot express "member of a set of tenants" — an Agência user's JWT has `tenant_slug: null` always (per D-04/the hook design above), so `tokenSlug !== urlSlug` is always `true` for them, and they'd be redirected away from every `/[tenant-slug]/...` route regardless of grants. Don't special-case `role === 'agency'` here — replace the JWT-string check with a live, RLS-scoped row check that works identically for Cliente, Agência, and Super Admin:

```typescript
if (role !== 'super_admin') {
  const { data: tenantRow } = await supabase
    .from('tenants')
    .select('id')
    .eq('slug', urlSlug)
    .eq('active', true)
    .maybeSingle()
  if (!tenantRow) redirect('/')
}
```

This single indexed lookup (`idx_tenants_slug`, already exists per migration `0002`) is negligible at this project's 1–3 tenant scale, and as a side effect it also fixes a latent gap in the *current* code: today, a Cliente whose tenant gets deactivated (`active = false`) between login and page load is **not** redirected by the JWT-string check (it only compares slugs, never re-checks `active`), even though their actual data queries would come back empty via RLS's `active = TRUE` clause. The proposed query-based guard closes both gaps in one change.

### `proxy.ts` (the project's middleware — Next.js 16 renamed `middleware.ts` → `proxy.ts`)

`[CITED: nextjs.org/docs/messages/middleware-to-proxy]` — Next.js 16 renamed the middleware file convention from `middleware.ts` to `proxy.ts` (function renamed `middleware` → `proxy`); the old file is still supported but deprecated. This project has already migrated (`proxy.ts` exists at repo root, no `middleware.ts` file exists) `[VERIFIED: Glob + Read of proxy.ts]`. Two branches in `proxy.ts` need Agência handling — currently:

```typescript
if (pathname === '/login' || pathname === '/') {
  if (role === 'super_admin') url.pathname = '/tenants'
  else if ((role === 'tenant_admin' || role === 'viewer') && tenantSlug) url.pathname = `/${tenantSlug}/dashboard`
  else { url.pathname = '/login'; url.searchParams.set('error', 'no_membership') }
}
```

An Agência user (`role: 'agency'`, `tenantSlug: null`) falls through to the `else` branch today and gets bounced to `/login?error=no_membership` — this must add an `else if (role === 'agency')` branch pointing to a new landing route (see UI screen below, e.g. `/agencia`). The `/tenants` guard block (Super Admin only) is unaffected; a parallel guard block should be added for the new `/agencies` (grant management) route, also Super Admin only.

### Super Admin Grant Management Screen (D-02)

Reuse the exact `/tenants` + `/tenants/[slug]` pattern rather than inventing new conventions:

- `app/agencies/layout.tsx` — copy `app/tenants/layout.tsx` shape (role gate, header). Note: `app/tenants/layout.tsx` currently does its own **manual JWT decode** from `session.access_token` (`decodeRole()` helper) instead of using `user.app_metadata` from the already-verified `getUser()` call, which is what `app/[tenant-slug]/layout.tsx` and `proxy.ts` do. This is an existing inconsistency (three different role-reading approaches across three files) — the planner should standardize any *new* agency-related layout on the `getUser().app_metadata` approach (server-verified, no manual decode needed), not copy the `app/tenants/layout.tsx` pattern verbatim.
- `app/agencies/page.tsx` — mirrors `app/tenants/page.tsx`: list of agencies (name, active status, "Gerenciar" link), a "+ Nova agência" dialog mirroring `CreateTenantForm`.
- `app/agencies/[id]/page.tsx` — mirrors `app/tenants/[slug]/page.tsx`: agency details, "Adicionar usuário" modal (mirrors `AddUserModal`, minus the role selector since agency membership has no internal role split), and a new "Clientes vinculados" section — a multi-select or checkbox list of all active tenants with grant/revoke toggles, backed by `agency_tenants` inserts/deletes.
- `lib/actions/agencies.ts` — mirrors `lib/actions/tenants.ts` exactly: `createAgency`, `createAgencyUser` (via `supabase.auth.admin.createUser` + insert into `agency_users`, same temp-password-once UX as `createTenantUser`), `grantTenant(agencyId, tenantId)` / `revokeTenant(agencyId, tenantId)` (insert/delete on `agency_tenants`), all using `createServiceClient()` (service-role bypasses RLS for admin writes, same as existing tenant management actions).
- Nav: add an "Agências" link in `app/tenants/layout.tsx`'s header (currently just a logo + logout button) so Super Admin can move between `/tenants` and `/agencies` — no dedicated sidebar exists for the Super Admin admin area today, a simple header link is consistent with the current minimal UI.

### Sidebar Scope for Agência (derived from D-01, not previously flagged in CONTEXT.md)

D-01 says Agência sees "Dashboard, Campanhas e Gestão de Leads" — it does **not** mention AI Insights or Settings (Configurações). `components/layout/sidebar-nav.tsx` currently has **zero role-based filtering** — every authenticated role sees the same `MARKETING_ITEMS` (Dashboard, Campanhas, AI Insights) and `LEADS_ITEMS` (Gestão de Leads, Agente IA) `[VERIFIED: codebase]`. This phase should add a `role` prop to `SidebarNav` and hide "AI Insights" and "Configurações" for `role === 'agency'`. Note: this does not conflict with AI-03's "Super Admin only" requirement for the AI Insights *page* — that page-level gate belongs to Phase 4 (not yet built) and is out of this phase's scope; this research only flags that the *sidebar link itself* needs a role check now that a third role exists, so Agência users aren't shown a link to a page they can't use.

### Tenant Role Migration (D-03)

Recommendation: **reuse `tenant_admin` as the sole surviving value** rather than introducing a new string like `cliente`. Rationale: a grep across the repo found **12 files** referencing the literal strings `'tenant_admin'` / `'viewer'` `[VERIFIED: Grep]` — `app/api/leads/[id]/status/route.ts`, `app/api/meta-ads/connect/route.ts`, `components/tenants/tenant-switcher.tsx`, `components/tenants/add-user-modal.tsx`, `lib/actions/tenants.ts`, `lib/stores/tenant-store.tsx`, `proxy.ts`, plus 5 test files. Reusing `tenant_admin` means only the *meaning* changes (now "full Cliente access," not "admin vs. viewer split") — no literal-string churn, and the role check in `app/api/leads/[id]/status/route.ts` (`role !== 'super_admin' && role !== 'tenant_admin'`) simply needs `viewer` removed as a distinct case (it's promoted, not excluded, anymore) without renaming the surviving value.

Migration (single atomic statement, safe for the 2 live tenants `lukseg`/`beta-test`):
```sql
-- Promote all viewer rows to full access; tenant_admin rows are unaffected.
UPDATE public.tenant_users SET role = 'tenant_admin' WHERE role = 'viewer';

ALTER TABLE public.tenant_users DROP CONSTRAINT tenant_users_role_check;
ALTER TABLE public.tenant_users ADD CONSTRAINT tenant_users_role_check CHECK (role = 'tenant_admin');
```

Application code changes required as a consequence:
- `components/tenants/add-user-modal.tsx` — remove the role `<Select>` entirely (no more choice to present); `createTenantUser` action always inserts `role: 'tenant_admin'`.
- `lib/actions/tenants.ts` — `createUserSchema`'s `role: z.enum(['tenant_admin', 'viewer'])` becomes a no-op/removed field.
- `app/api/leads/[id]/status/route.ts` and `app/api/meta-ads/connect/route.ts` — role checks already say `role !== 'super_admin' && role !== 'tenant_admin'`; these do **not** need to change in spirit (viewer no longer exists as a role value), but must be extended to also accept `role === 'agency'` for the Leads route per AGENCY-05 (see Common Pitfalls — this must be paired with the tenant/grant-scope fix, not done in isolation).
- `lib/stores/tenant-store.tsx` and `proxy.ts` — `Role` type / `AppMetadata.role` union should drop `'viewer'` and add `'agency'`.

**Alternative considered and rejected:** introducing a new value (e.g., `cliente`) for clarity. Tradeoff: clearer terminology matching the new 3-module naming (Super Admin / Agência / Cliente in product language) vs. touching all 12 files' literal strings plus the CHECK constraint plus every test fixture that hardcodes `'tenant_admin'`. Given the project is internal-tool-scale (1–3 tenants) and the CLAUDE.md constraint favors minimal churn, reuse is the prescriptive recommendation; flip to `cliente` only if the user explicitly wants the DB-level vocabulary to match the UI vocabulary.

### Closing the Leads Route Authorization Gap (prerequisite for AGENCY-05)

`[VERIFIED: codebase read, cross-referenced against sibling route]` — `app/api/leads/[id]/status/route.ts` (Phase 03.1) never checks that the caller's own tenant matches the `tenant` slug supplied in the PATCH body. It checks role (`super_admin`/`tenant_admin`) and validates the tenant *exists*, but not that the caller is *authorized for that specific tenant*. Compare with `app/api/meta-ads/connect/route.ts`, which does this correctly:

```typescript
// app/api/meta-ads/connect/route.ts — the CORRECT existing pattern
if (role === 'super_admin') {
  tenantId = parsed.data.tenantId
} else {
  const callerTenantId = user.app_metadata?.tenant_id as string | undefined
  if (!callerTenantId) return NextResponse.json({ error: '...' }, { status: 403 })
  tenantId = callerTenantId   // NEVER trust the body's tenantId for non-super_admin
}
```

The Leads route has no equivalent — any authenticated `tenant_admin`, regardless of which tenant they belong to, can PATCH lead status for **any** tenant slug by simply putting a different tenant in the request body (`{ tenant: 'other-tenant-slug', status: '...' }`), because the route fetches credentials via `createServiceClient()` (bypasses RLS by design, since `sheets_service_account` is deliberately not selectable by `authenticated` — migration `0016`) filtered only by that unverified slug. **This is an IDOR/BOLA-class gap (OWASP API1:2023, STRIDE: Tampering)** that predates this phase but must be fixed as part of it, since Phase 5 is exactly about "who can reach which tenant." The `tests/unit/leads-status-route.test.ts` test suite confirms there is currently no test case exercising cross-tenant access, corroborating the gap.

**Fix, extending the meta-ads pattern to also cover Agência:**
```typescript
// After role check, before fetching sheets_service_account:
if (role === 'super_admin') {
  // any tenant, as today
} else if (role === 'tenant_admin') {
  const callerSlug = user.app_metadata?.tenant_slug as string | undefined
  if (callerSlug !== tenantSlug) {
    return NextResponse.json({ error: 'Sem acesso a este tenant' }, { status: 403 })
  }
} else if (role === 'agency') {
  const agencyId = user.app_metadata?.agency_id as string | undefined
  const { data: grant } = await supabase
    .from('agency_tenants')
    .select('tenant_id, tenants!inner(slug)')
    .eq('agency_id', agencyId)
    .eq('tenants.slug', tenantSlug)
    .maybeSingle()
  if (!grant) return NextResponse.json({ error: 'Sem acesso a este tenant' }, { status: 403 })
} else {
  return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
}
```
(Uses the RLS-scoped `supabase` client, not `service`, for the `agency_tenants` check — the new `agency_tenants_member_select` policy makes this safe and self-scoping.)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| "Does this user have access to tenant X" logic duplicated across RLS policies AND non-RLS route handlers (Leads Sheets write path) | A hand-written combination of `role === ...` checks re-derived in every new route | For **RLS-protected Postgres tables**: three simple, separate, per-table policies (`_super_admin_all`, `_tenant_select`, `_agency_select`) as shown above — keep them flat and indexable, do not wrap them in one shared function (see performance note below). For **non-RLS codepaths** (the Leads route, which deliberately uses `service_role`): one shared authorization check per role branch, following the exact pattern already proven correct in `app/api/meta-ads/connect/route.ts`, not a new abstraction. |
| Custom JWT decoding | Three different manual/semi-manual JWT-decode implementations already exist in this codebase (`app/tenants/layout.tsx`'s `decodeRole()`, `proxy.ts`'s `decodeJwtClaims()`, `tests/middleware.test.ts`'s test-only decoder) | For **Server Components/Actions/Route Handlers**, always use `(await supabase.auth.getUser()).data.user.app_metadata` — it re-validates the token server-side (no PostgREST auth surface), unlike decoding the raw JWT cookie by hand. `proxy.ts`'s manual decode is unavoidable there (Edge/Node network boundary, no round-trip to Supabase Auth is desirable in a proxy) — but it should not be copy-pasted into a fourth location for the new `/agencies` screen. | Manual decode is one more place that can silently diverge from what `getUser()` actually verifies (e.g., expired-but-not-yet-refreshed tokens) |
| Cross-tenant tenant-picker query logic per role | A `if (role === 'agency') { ... } else if (role === 'super_admin') { ... }` branch inside `loadTenantsForSwitcher()` | Nothing — RLS already does this for free once `tenants_agency_select` exists (see Architecture Patterns). Don't add role branching where RLS already provides the correct scoping. | Avoids the two sources of truth (RLS policy + app-level role branch) drifting apart over time |

**Key insight:** This project already has the "right way to do it" pattern living in the same codebase (`app/api/meta-ads/connect/route.ts`'s tenant-derivation logic) right next to the "wrong way" (`app/api/leads/[id]/status/route.ts`). The fix for Phase 5 is largely "apply the pattern that already exists one file over," not invent something new.

## Common Pitfalls

### Pitfall 1 (CRITICAL): Leads status route trusts client-supplied tenant scope
**What goes wrong:** Any `tenant_admin` (and, if unfixed, any future `agency` user) can write lead status for a tenant they don't belong to by changing the `tenant` field in the PATCH body.
**Why it happens:** The route uses a service-role client to read `sheets_service_account` (correctly, since that column is intentionally not exposed via RLS — migration `0016`), but forgot to re-derive/verify the tenant scope the way its sibling route (`meta-ads/connect`) does.
**How to avoid:** Apply the fix in Architecture Patterns above before or as part of wiring Agência into the Leads flow.
**Warning signs:** Any new endpoint that reads `req.json()` for a `tenant`/`tenantId` field and uses it directly in a `service_role`-backed query without cross-checking `user.app_metadata`.

### Pitfall 2: JWT string-equality can't express set membership
**What goes wrong:** `tokenSlug !== urlSlug` (current `app/[tenant-slug]/layout.tsx` guard) always evaluates `true` for Agência (whose JWT `tenant_slug` is always `null`), permanently locking them out even with valid grants.
**Why it happens:** The guard was written when "which tenant can I see" was always exactly one value, encodable as a single JWT claim.
**How to avoid:** Replace with a live RLS-scoped existence query (see Architecture Patterns) rather than adding an `if (role === 'agency')` special case that duplicates RLS logic in TypeScript.
**Warning signs:** Any `=== ` or `!==` comparison against `tenant_slug`/`tenant_id` claims in application code outside of `proxy.ts` — these should be one-time redirect hints, not authorization decisions, once a grant-based path exists.

### Pitfall 3: `proxy.ts`'s post-login redirect has no branch for `role === 'agency'`
**What goes wrong:** An Agência user lands on `/login?error=no_membership` after successful authentication.
**Why it happens:** The `else if ((role === 'tenant_admin' || role === 'viewer') && tenantSlug)` branch requires a non-null `tenantSlug`, which Agência never has.
**How to avoid:** Add an explicit `else if (role === 'agency')` branch routing to the new client-selector landing page.
**Warning signs:** Manual login test as an agency user redirecting to an error page.

### Pitfall 4: Role precedence ambiguity if a user ends up in both `tenant_users` and `agency_users`
**What goes wrong:** Nothing in the schema prevents a data-entry mistake (e.g., Super Admin accidentally adds the same `user_id` to both a tenant and an agency) — D-04's "never both" invariant is a decision, not a constraint.
**Why it happens:** The two tables are independent; there's no cross-table `CHECK` or trigger enforcing mutual exclusivity.
**How to avoid:** Document the hook's precedence order explicitly (agency checked before tenant, so agency silently wins) as intentional; optionally add a `BEFORE INSERT` trigger on `tenant_users` that rejects the insert if `user_id` already exists in `agency_users` (and vice versa) for defense-in-depth. Given the project's 1–3 tenant / manual-admin scale, documenting the precedence is likely sufficient for v1 — flag this tradeoff for the planner to decide (not a locked user decision).
**Warning signs:** A user reports seeing the wrong dashboard after being (re-)added to the platform.

### Pitfall 5: Sidebar shows Agência a link to pages they can't use
**What goes wrong:** `SidebarNav` has no role-awareness today — an Agência user viewing a client's tenant would see "AI Insights" and "Configurações" links that D-01 never granted them.
**Why it happens:** The component was built when only Super Admin/Tenant Admin/Viewer existed and all three saw the same nav.
**How to avoid:** Add a `role` prop and filter `MARKETING_ITEMS`/the Settings link based on it (see Architecture Patterns).
**Warning signs:** Manual UAT as an agency user clicking into a page that immediately errors or redirects.

### Pitfall 6: Component-level testing isn't set up for this project — don't add rendering tests
**What goes wrong:** `vitest.config.mts` sets `environment: 'node'` (not `jsdom`), and no test in the repo renders a React component — all existing tests exercise pure logic, Server Actions, or route handlers with mocked Supabase clients.
**Why it happens:** The project's test strategy deliberately stayed at the logic/route layer.
**How to avoid:** Test the new Agência scoping logic the way the project already tests everything else — e.g., test `loadTenantsForSwitcher`'s query construction/RLS reliance indirectly via an integration test against a live Supabase project (same skip-if-no-env pattern as `tests/rls.test.ts`), not via rendering `<TenantSwitcher />` with React Testing Library (which isn't installed).
**Warning signs:** A new test file imports `@testing-library/react` — this dependency doesn't exist in `package.json`.

## Runtime State Inventory

This phase's D-03 role collapse (`tenant_admin`/`viewer` → single value) is a live-data migration, not just a schema change, so this section is required.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `tenant_users.role` CHECK-constrained column with live `tenant_admin`/`viewer` rows for the 2 active tenants (`lukseg`, `beta-test` — STATE.md confirms these are the only surviving tenants after test-tenant cleanup on 2026-07-05). Exact row counts per role were **not verified in this research session** (no live DB query tool was available) — the planner/Wave-0 task should run `SELECT role, count(*) FROM tenant_users GROUP BY role;` against the live project before writing the migration, to confirm no unexpected role values exist beyond the two CHECK-permitted ones. | Data migration (single `UPDATE` statement, see Architecture Patterns) + CHECK constraint change. |
| Live service config | None found — no external service (N8N, Vercel, etc.) stores `tenant_admin`/`viewer` role strings in its own config outside this Postgres table. | None. |
| OS-registered state | None — no OS-level task/process registration involved in this phase. | None. |
| Secrets/env vars | None — no env var or Vault secret name references role values. | None. |
| Build artifacts | `types/database.types.ts` types `tenant_users.role` as plain `string` (not a TypeScript literal union) `[VERIFIED: Grep of types/database.types.ts]` — the Supabase type generator did not encode the CHECK constraint as a union type, so **no type regeneration is strictly required** for the role collapse itself. Regeneration IS required after the new `agencies`/`agency_users`/`agency_tenants` tables are created (standard workflow already established in this project per STACK.md "TypeScript + Supabase Generated Types Workflow"). | `supabase gen types typescript` after the new-tables migration; not required (but harmless) after the role-collapse migration alone. |

**Nothing found in 3 of 5 categories** — this phase's runtime-state footprint is narrow (one column's live data + generated types), unlike prior phases involving external services.

## Code Examples

### Full three-policy shape for a tenant-scoped table (pattern to replicate across all 5 tables)
```sql
-- Source: this project's own migrations 0004, 0006-0009 (existing pattern) + this research's agency extension
CREATE POLICY <table>_super_admin_all ON public.<table>
  FOR ALL TO authenticated
  USING ((SELECT public.get_user_role()) = 'super_admin')
  WITH CHECK ((SELECT public.get_user_role()) = 'super_admin');

CREATE POLICY <table>_tenant_select ON public.<table>
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY <table>_agency_select ON public.<table>
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (
      SELECT agt.tenant_id FROM public.agency_tenants agt
      WHERE agt.agency_id = (SELECT public.get_agency_id())
    )
  );
```

### Server-derived tenant scope (the pattern to copy, from an existing route)
```typescript
// Source: app/api/meta-ads/connect/route.ts, lines 71-85 (already in this codebase)
let tenantId: string
if (role === 'super_admin') {
  tenantId = parsed.data.tenantId
} else {
  const callerTenantId = user.app_metadata?.tenant_id as string | undefined
  if (!callerTenantId) {
    return NextResponse.json({ error: 'Não foi possível verificar o tenant do usuário' }, { status: 403 })
  }
  tenantId = callerTenantId
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `middleware.ts` / `export function middleware()` | `proxy.ts` / `export function proxy()` (Node.js runtime, not Edge) | Next.js 16 (this project is on 16.2.6) | This project has already migrated `[VERIFIED: proxy.ts exists, no middleware.ts]`; any Phase 5 routing change edits `proxy.ts`, not `middleware.ts`. `[CITED: nextjs.org/docs/messages/middleware-to-proxy]` |

**Deprecated/outdated:** N/A for this phase — no library version changes needed.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `agency_users.UNIQUE(user_id)` — a user belongs to at most one agency, ever | Architecture Patterns → Recommended Schema | Low: relaxing a UNIQUE constraint later is a non-breaking migration; only risk is if the user actually wants multi-agency membership from day one, which would also change the Custom Access Token Hook's `agency_id` claim from a scalar to an array (bigger change) |
| A2 | Reusing `tenant_admin` as Cliente's sole role value (vs. introducing `cliente`) | Architecture Patterns → Tenant Role Migration | Low-medium: purely a naming/clarity tradeoff, reversible via a follow-up rename migration; does not affect functionality either way |
| A3 | Role precedence (agency checked before tenant_users in the hook) is documented but not DB-enforced against a user being in both tables | Common Pitfalls → Pitfall 4 | Medium: if the Super Admin's new in-app screen doesn't prevent double-assignment, a misconfigured user could see unexpected access; mitigated by the constrained, small (1-3 tenant) admin surface in v1 |
| A4 | `viewer` row counts in live `tenant_users` were not queried in this research session (no DB access tool available) | Runtime State Inventory | Low: the migration is additive/promotive (`UPDATE ... SET role = 'tenant_admin'`), so it's safe even if row counts differ from expectations — but the planner should still verify no unexpected 3rd role value exists before running the CHECK-constraint tightening step |

## Open Questions

1. **Should the new `/agencies` grant-management screen live under a shared "admin" layout with `/tenants`, or stay fully separate?**
   - What we know: both are Super-Admin-only, both currently have their own minimal `layout.tsx` with a logo + logout header.
   - What's unclear: whether the user wants a unified "Platform Admin" shell (nav between Tenants/Agências) or two independent screens.
   - Recommendation: add a two-link header nav (Tenants | Agências) inside the existing `app/tenants/layout.tsx` shape, applied to both routes — smallest change, no new layout concept introduced.

2. **What does the Agência's post-login landing page look like exactly?**
   - What we know: D-01 says it's a "client selector," analogous to `/tenants` for Super Admin.
   - What's unclear: exact route name (`/agencia`? `/agencia/clientes`?) and whether it's a full page or just the header switcher immediately dropping them into their first granted tenant's dashboard.
   - Recommendation: mirror `/tenants` exactly (a dedicated landing listing granted tenants with an "Entrar" button per row, reusing `TenantsTable`'s shape minus the create/deactivate actions) rather than auto-redirecting to an arbitrary "first" tenant, since auto-redirect hides the multi-client nature of the role.

3. **Live `tenant_users` role row counts** (see Runtime State Inventory / A4) — needs a live query before the migration is written, not resolvable from static code research.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^2.1.9 (config: `vitest.config.mts`) `[VERIFIED: package.json, vitest.config.mts]` |
| Config file | `vitest.config.mts` — `environment: 'node'`, `include: ['tests/**/*.test.ts']`, setup file `./tests/setup.ts` |
| Quick run command | `npx vitest run tests/unit/<file>.test.ts` (or `tests/<file>.test.ts` for top-level suites like `rls.test.ts`) |
| Full suite command | `npm run test` (= `vitest run`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AGENCY-06 | Agency grant-based RLS on `campaign_metrics`/`tenants`/etc. | integration (skip-if-no-env, same pattern as `tests/rls.test.ts`) | `npx vitest run tests/agency-rls.test.ts` | ❌ Wave 0 |
| AGENCY-07 | `tenant_users.role` collapse migration leaves no row outside `('tenant_admin')` | integration | `npx vitest run tests/integration/tenant-role-migration.test.ts` | ❌ Wave 0 |
| AGENCY-08 | PATCH `/api/leads/[id]/status` rejects cross-tenant and ungranted-agency requests | unit (mock-based, extends existing file) | `npx vitest run tests/unit/leads-status-route.test.ts` | ✅ extend existing file |
| AGENCY-01/02 | `lib/actions/agencies.ts` Server Actions (create agency, grant/revoke tenant) | unit (mock-based, mirrors `tests/tenants.test.ts`) | `npx vitest run tests/agencies.test.ts` | ❌ Wave 0 |
| AGENCY-03/04 | Agency-scoped tenant list resolution (`loadTenantsForSwitcher` equivalent) | integration (live RLS, same skip-if-no-env pattern) — component rendering is NOT the project's test style (see Pitfall 6) | `npx vitest run tests/agency-rls.test.ts` (can share file with AGENCY-06) | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** targeted `npx vitest run <changed-file>.test.ts`
- **Per wave merge:** `npm run test` (full suite)
- **Phase gate:** Full suite green + `tsc --noEmit` + `npm run build` before `/gsd-verify-work` (matches Phase 03.1's closing verification pattern per STATE.md)

### Wave 0 Gaps
- [ ] `tests/agency-rls.test.ts` — covers AGENCY-06, AGENCY-03/04 (skip-if-no-env pattern copied from `tests/rls.test.ts`)
- [ ] `tests/integration/tenant-role-migration.test.ts` — covers AGENCY-07
- [ ] `tests/agencies.test.ts` — covers AGENCY-01/02 (mock pattern copied from `tests/tenants.test.ts`)
- [ ] Extend `tests/unit/leads-status-route.test.ts` with cross-tenant/cross-agency 403 cases — covers AGENCY-08 (no new file, no framework install needed)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No change this phase | Existing Supabase Auth email+password, unchanged |
| V3 Session Management | No change this phase | Existing `@supabase/ssr` cookie-based session, unchanged |
| V4 Access Control | **Yes — this phase's core deliverable** | RLS policies (`_agency_select`) + server-derived tenant scope in route handlers (never trust client-supplied tenant identifiers) |
| V5 Input Validation | Yes, for new Server Actions | Zod v4 (`zod/v4`), mirroring `lib/actions/tenants.ts`'s existing schemas |
| V6 Cryptography | No change this phase | No new secrets/crypto introduced |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| IDOR / Broken Object Level Authorization — client-supplied tenant/agency identifier trusted without server-side verification (found live in `app/api/leads/[id]/status/route.ts`, OWASP API1:2023) | Tampering / Elevation of Privilege | Always derive tenant/agency scope from server-verified `user.app_metadata` (or an RLS-scoped grant lookup), never from request body/query params, for any non-super_admin caller — pattern already proven in `app/api/meta-ads/connect/route.ts` |
| RLS bypass via `service_role` client used for a codepath that also needs row-level authorization (the Leads Sheets write path, by necessity, since `sheets_service_account` is intentionally not `authenticated`-selectable) | Elevation of Privilege | Any time `createServiceClient()` is used, the authorization check that RLS would normally provide MUST be re-implemented explicitly in application code — this is exactly the gap this phase must close |
| Privilege confusion from ambiguous dual membership (a user in both `tenant_users` and `agency_users`) | Elevation of Privilege / Repudiation | Document hook precedence explicitly (agency checked first); consider a defense-in-depth trigger if the admin UI doesn't prevent double-assignment (see Pitfall 4) |
| Junction-table RLS recursion (a policy on `agency_tenants` querying `agency_tenants` itself) | Denial of Service (500 errors) | Use JWT-only helper functions (`get_agency_id()`) in junction-table policies, never a subquery back into the same or another RLS-protected table without a `SECURITY DEFINER` break in the cycle `[CITED: supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv]` |

## Sources

### Primary (HIGH confidence)
- Direct codebase reads: `supabase/migrations/0002` through `0016`, `components/tenants/tenant-switcher.tsx`, `app/[tenant-slug]/layout.tsx`, `app/tenants/layout.tsx`, `app/tenants/page.tsx`, `app/tenants/[slug]/page.tsx`, `lib/actions/tenants.ts`, `components/tenants/add-user-modal.tsx`, `components/tenants/create-tenant-form.tsx`, `components/layout/sidebar-nav.tsx`, `components/layout/header-actions.tsx`, `proxy.ts`, `app/api/leads/route.ts`, `app/api/leads/[id]/status/route.ts`, `app/api/leads/chat/route.ts`, `app/api/meta-ads/connect/route.ts`, `lib/leads.ts`, `lib/supabase/server.ts`, `lib/supabase/service.ts`, `lib/stores/tenant-store.tsx`, `tests/rls.test.ts`, `tests/middleware.test.ts`, `tests/tenants.test.ts`, `tests/unit/leads-status-route.test.ts`, `vitest.config.mts`, `package.json`, `types/database.types.ts`
- `.planning/phases/01-foundation/01-CONTEXT.md`, `.planning/notes/agencia-multi-cliente-arquitetura.md`, `.planning/research/questions.md`, `.planning/PROJECT.md`, `.planning/STATE.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`
- [Supabase RLS Performance and Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) — junction-table filtering direction, function-wrapping, indexing, recursion trap
- [Renaming Middleware to Proxy — Next.js Docs](https://nextjs.org/docs/messages/middleware-to-proxy) — confirms `proxy.ts` is the Next.js 16 successor to `middleware.ts`

### Secondary (MEDIUM confidence)
- [Custom Claims & Role-based Access Control (RBAC) — Supabase Docs](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac) — general pattern confirmation for `app_metadata`-based multi-tenant claims (not agency-specific, but consistent with this project's existing implementation)
- [Custom Access Token Hook — Supabase Docs](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook)

### Tertiary (LOW confidence)
- None used as load-bearing claims — all WebSearch findings above were cross-verified against either official Supabase/Next.js docs pages returned in the same search, or against this project's own working code.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries, all versions confirmed from `package.json`
- Architecture (schema/RLS/hook): HIGH — directly extends verified, working patterns already in the live codebase; junction-table performance guidance cross-checked against official Supabase docs
- Architecture (UI screen layout for `/agencies`): MEDIUM — genuinely new screen, no existing agency-management UI to verify against, recommendation is pattern-matched from `/tenants` rather than confirmed
- Pitfalls: HIGH — Pitfalls 1-3 and 5-6 verified by direct code inspection (not inferred); Pitfall 4 is a reasoned risk assessment, not an observed bug
- Security: HIGH for the identified IDOR gap (verified via code + absence of test coverage); MEDIUM for the precedence-ambiguity item (reasoned, not observed)

**Research date:** 2026-07-05
**Valid until:** 2026-08-04 (30 days — stable domain, no fast-moving external dependencies; re-verify sooner only if Next.js or Supabase ship a breaking change to RLS/JWT hook behavior in that window)
