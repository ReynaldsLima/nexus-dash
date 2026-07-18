# Architecture Research — v1.1 Integration

**Domain:** Integration of 4 features into an existing Next.js 16 (App Router) + Supabase (Postgres/Auth/RLS) + N8N self-hosted multi-tenant dashboard
**Researched:** 2026-07-11
**Confidence:** HIGH — every finding below is grounded in direct reads of the current repo (migrations, Server Actions, routes, N8N workflow JSON, RLS policies), not training-data assumptions about "how Supabase apps usually work."

**Note:** this file supersedes the previous `ARCHITECTURE.md` in this directory (dated 2026-05-10), which was written before v1.0 was implemented and describes a generic target architecture rather than the actual shipped system. This version documents the verified as-built architecture and the specific integration points for the v1.1 milestone (Gestão de Usuários, Limpeza, Janela de Histórico, Redesign Visual).

## Standard Architecture (current state, verified in repo)

```
┌──────────────────────────────────────────────────────────────────────┐
│ Browser                                                              │
│  app/[tenant-slug]/{dashboard,campanhas,insights,settings}/page.tsx  │
│  — ALL 'use client', fetch via TanStack Query + lib/supabase/client  │
│  (createBrowserClient) — RLS enforced at Postgres regardless of      │
│  client vs server origin of the request.                             │
├──────────────────────────────────────────────────────────────────────┤
│ app/[tenant-slug]/layout.tsx  (Server Component)                     │
│  — createClient() (server) → getUser() → getClaims() → role          │
│  — resolves tenantId, tenant switcher list, sidebar/header props     │
│  — THIS is the one RLS-scoped Server Component fetch on the tenant   │
│    branch of the tree (pages below it are all client-fetched)        │
├──────────────────────────────────────────────────────────────────────┤
│ proxy.ts (root, Next middleware, matcher excludes _next/static etc.) │
│  — decodes JWT app_metadata client-side (no network call)            │
│  — redirects by role: super_admin→/tenants, tenant_admin/viewer→     │
│    /{slug}/dashboard, agency→/agencia                                │
├──────────────────────────────────────────────────────────────────────┤
│ Server Actions (lib/actions/tenants.ts, agencies.ts)                 │
│  — 'use server', Zod-validated, createServiceClient() (service_role, │
│    bypasses RLS by design), revalidatePath() after writes            │
│  — TODAY: create + activate/deactivate only. No edit/delete of users.│
├──────────────────────────────────────────────────────────────────────┤
│ Route Handlers (app/api/google-ads/connect, /callback,                │
│  app/api/meta-ads/connect)                                            │
│  — role check via supabase.rpc('get_user_role'), tenant scope via     │
│    getClaims() (never getUser().app_metadata — stale/empty)           │
│  — write refresh_token/System User token to Vault, upsert ad_accounts │
├──────────────────────────────────────────────────────────────────────┤
│ Postgres (Supabase)                                                  │
│  — get_tenant_id()/get_user_role()/get_tenant_slug()/get_agency_id() │
│    STABLE SQL functions reading current_setting('request.jwt.claims')│
│    — NEVER re-query tenant_users at request time (D-14 perf rule)    │
│  — Custom Access Token Hook (0005 + 0019) mints role/tenant_id/       │
│    tenant_slug/agency_id into JWT app_metadata at LOGIN/REFRESH only  │
│  — tenant_users.role CHECK already collapsed to a single value       │
│    'tenant_admin' since migration 0020 (Phase 5, shipped 2026-07-09) │
├──────────────────────────────────────────────────────────────────────┤
│ N8N self-hosted (VPS, Queue Mode)                                     │
│  — google-ads-sync.json / meta-ads-sync.json: HTTP Request nodes only │
│    (PostgREST), never the native Supabase node (n8n#17020 bug)       │
│  — "Set Constants" node hardcodes BACKFILL_DAYS=90, INCREMENTAL_DAYS=2│
│    globally for ALL tenants — this is Feature 3's integration point   │
└──────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities (relevant to this milestone)

| Component | Responsibility | File(s) |
|-----------|-----------------|---------|
| Custom Access Token Hook | Mints role/tenant_id/agency_id into JWT at login/refresh, NOT on every request | `supabase/migrations/0005_custom_access_token_hook.sql`, `0019_custom_access_token_hook_agency.sql` |
| RLS helper functions | Read JWT claims only, never hit tables at request time | `supabase/migrations/0003_create_helper_functions.sql` |
| tenant_users / agency_users | Membership rows; `ON DELETE CASCADE` from `auth.users(id)` | `supabase/migrations/0002_create_tenants.sql`, `0017_create_agencies_schema.sql` |
| Admin Server Actions | Only entry point today for creating users (service_role, bypasses RLS by design) | `lib/actions/tenants.ts` (`createTenantUser`), `lib/actions/agencies.ts` (`createAgencyUser`) |
| Admin UI shells | Tenant/agency detail pages, currently say "listagem gerenciada via Supabase Dashboard" | `app/tenants/[slug]/page.tsx`, `app/agencies/[id]/page.tsx` |
| N8N sync constants | Single global backfill/incremental window applied to every tenant/channel | `n8n-workflows/google-ads-sync.json`, `n8n-workflows/meta-ads-sync.json` |
| OAuth connect/callback | Google: signed-state HMAC round trip (`lib/google-ads/oauth-state.ts`). Meta: single POST, no round trip. Both upsert `ad_accounts` via service role. | `app/api/google-ads/connect/route.ts`, `app/api/google-ads/callback/route.ts`, `app/api/meta-ads/connect/route.ts` |

---

## Feature 1 — Gestão completa de usuários (list/edit/remove)

### What already exists (do not rebuild)

- `createTenantUser(email, tenantId, password?)` and `createAgencyUser(email, agencyId, password?)` in `lib/actions/tenants.ts` / `lib/actions/agencies.ts` — the create half is done. Both already call `supabase.auth.admin.deleteUser(authUser.user.id)` as **rollback** if the membership insert fails — i.e. `admin.deleteUser` is an established pattern in this codebase, not a new concept.
- `AddUserModal` (`components/tenants/add-user-modal.tsx`) and `AddAgencyUserModal` (`components/agencies/add-agency-user-modal.tsx`) are the UI pattern to mirror for edit/delete modals (Dialog + `useTransition` + Server Action + `router.refresh()`).
- `app/tenants/[slug]/page.tsx` and `app/agencies/[id]/page.tsx` both have a placeholder `<CardContent>` literally stating "A listagem de usuários é gerenciada via Supabase Dashboard em v1." — this exact block is where the new user table renders.

### Delete: verified behavior, no manual cleanup needed

`tenant_users.user_id` and `agency_users.user_id` both have `REFERENCES auth.users(id) ON DELETE CASCADE` (migrations `0002`, `0017`). Calling `supabase.auth.admin.deleteUser(userId)` (service role) is **sufficient by itself** — Postgres cascades the membership row deletion automatically. No separate `.from('tenant_users').delete()` step is required, and none should be added (avoids a race where the membership row is deleted but the auth user isn't, or vice versa, if a manual two-step fails partway).

Deleting a user immediately revokes their Supabase sessions (documented Auth Admin behavior) — this is the one operation that has no "stale JWT" problem.

### Edit: what "edit" can mean given the current schema, and the stale-JWT pitfall

Because `tenant_users.role` is now CHECK-constrained to the single value `'tenant_admin'` (migration `0020`), there is no in-tenant role to change. "Edit" concretely means one of:

| Edit action | Mechanism | New or existing |
|---|---|---|
| Change email | `supabase.auth.admin.updateUserById(userId, { email })` | New Server Action |
| Reset password | `supabase.auth.admin.updateUserById(userId, { password })` (mirror `generateTempPassword()` already in `lib/actions/tenants.ts`) | New Server Action |
| Move user to a different tenant | Delete/update the `tenant_users` row (service role bypasses the `tenant_users_member_select`-only RLS for non-admins) | New Server Action |
| Move user to/from an agency | Same, on `agency_users` (respect the existing `UNIQUE(user_id)` and the documented D-04 invariant: a user is never in both `tenant_users` and `agency_users`) | New Server Action |

**Critical finding — RLS/JWT staleness on membership edits (not deletes):** `get_tenant_id()`/`get_user_role()` read `request.jwt.claims`, which is only re-minted by the Custom Access Token Hook at **login or token refresh** — never on-demand. If an admin removes a user from `tenant_users` (without deleting the auth user) or moves them to a different tenant, that user's **currently valid access token still carries the old `tenant_id`/`role` claims** until it naturally expires (Supabase default access-token TTL) or the client refreshes. RLS will keep authorizing requests against the *old* tenant scope for up to that window — this is a real, exploitable-looking gap for a "remove this user's access now" admin action, even though it self-heals within the hour.

**Mitigation to build into the edit/remove Server Actions:** after any membership mutation that isn't a full `admin.deleteUser`, call `supabase.auth.admin.signOut(userId, 'global')` (service role) to revoke the user's refresh tokens immediately, forcing their next request to fail auth and re-login — at which point the hook re-fires with correct claims. Document this in the Server Action itself; it is not automatic and nothing in the current codebase does it today (verified: no existing call to `admin.signOut` anywhere in the repo).

### Where user listing reads from

`tenant_users_member_select` RLS policy already allows a member to `SELECT` rows scoped to `tenant_id = get_tenant_id()`, but the admin UI (`/tenants/[slug]`, `/agencies/[id]`) is Super-Admin-only (gated by `proxy.ts`), so the new list query should go through `createServiceClient()` like every other action in `lib/actions/tenants.ts`/`agencies.ts` — no RLS policy changes needed. To resolve `user_id → email` for display, `auth.users` isn't queryable via PostgREST from the client; use `supabase.auth.admin.listUsers()` (service role). Given the low current volume (Active requirement caps tenants at 1-3), the simplest approach is: fetch the tenant's/agency's membership rows first (service client), then call `admin.listUsers()` and join client-side by `user_id` to resolve emails — no new SQL function needed for v1.1 scale. Flag as scaling debt if tenant/user count grows enough that `listUsers()` pagination becomes a concern (it has no tenant filter).

### New vs Modified — Feature 1

| File | New/Modified | Change |
|---|---|---|
| `lib/actions/tenants.ts` | Modified | Add `listTenantUsers`, `updateTenantUserEmail`, `resetTenantUserPassword`, `removeTenantUser`, `moveTenantUser` (or similar) |
| `lib/actions/agencies.ts` | Modified | Mirror equivalents for agency users |
| `components/tenants/tenant-users-table.tsx` | New | Replaces the placeholder text in `app/tenants/[slug]/page.tsx` |
| `components/agencies/agency-users-table.tsx` | New | Replaces the placeholder text in `app/agencies/[id]/page.tsx` |
| `components/tenants/edit-user-modal.tsx`, `remove-user-button.tsx` | New | Mirror `add-user-modal.tsx` pattern |
| `app/tenants/[slug]/page.tsx`, `app/agencies/[id]/page.tsx` | Modified | Swap placeholder `CardContent` for the new table components |

---

## Feature 2 — Retire the dead "viewer" role

### Verified current state (this changes the risk calculus)

The database **already cannot produce `'viewer'`**: migration `0020_collapse_tenant_role.sql` (Phase 5, deployed 2026-07-09, part of the already-shipped v1.0 milestone) dropped and re-added `tenant_users_role_check` to `CHECK (role = 'tenant_admin')`. `custom_access_token_hook` (0019) can therefore never mint `role: 'viewer'` into a JWT going forward — the only place `'viewer'` can still appear is:

1. **TypeScript unions** that are wider than what the backend can emit: `proxy.ts` (`AppMetadata.role` type + the `role === 'tenant_admin' || role === 'viewer'` branch), `lib/stores/tenant-store.tsx` (`export type Role = ... | 'viewer' | ...`), `components/tenants/tenant-switcher.tsx` (prop type union).
2. **Comments/docs** in migrations `0003`, `0006`, `0016`, `0020` (harmless, historical).
3. **Test fixtures** asserting `role === 'viewer' → 403/blocked` in `tests/middleware.test.ts`, `tests/unit/google-ads-connect-route.test.ts`, `tests/unit/leads-chat-route.test.ts`, `tests/unit/leads-get-route.test.ts`, `tests/unit/leads-status-route.test.ts`, `tests/unit/insights-generate-route.test.ts`, `tests/integration/tenant-role-migration.test.ts`.

**Because 0020 shipped days ago as part of the completed v1.0 milestone, there is no "in-flight session" risk left to protect against** — any JWT minted before 0020 has long since expired (access tokens are short-lived; Phase 5's own migration note confirms zero `'viewer'` rows existed in the DB at migration time). The in-flight-session concern the question anticipates was real *during* Phase 5's rollout window, not now, in v1.1. This significantly simplifies the safe order of operations.

### Safe order of operations

1. **TypeScript types first** (`lib/stores/tenant-store.tsx`: narrow `Role` to `'super_admin' | 'tenant_admin' | 'agency' | 'none' | null`; `components/tenants/tenant-switcher.tsx`: narrow the `role` prop union; `proxy.ts`: narrow `AppMetadata.role` and simplify `role === 'tenant_admin' || role === 'viewer'` → `role === 'tenant_admin'`). Safe immediately — the DB was already incapable of emitting `'viewer'` before this change; removing the TS branch just deletes unreachable code.
2. **Test fixtures second** — update/remove the `'viewer'` test cases listed above so they assert the *current* behavior (either delete the case entirely if it's now a compile error against the narrowed type, or repurpose it to assert `'none'`/unauthenticated behavior, whichever the original test intent was — several of these tests exist to prove "restricted callers get 403," which `'none'` or omitted-role now covers equally well).
3. **SQL comments last (optional, cosmetic)** — update the stale `COMMENT ON FUNCTION get_user_role` (0003) and `COMMENT ON POLICY ad_accounts_tenant_select` (0006) text that still says "viewer" if a follow-up migration touches those objects anyway; not worth a migration solely for comment text. Do **not** touch the `CHECK` constraint itself — it is already correct (`0020` is the terminal state, nothing left to migrate at the DB layer).

No new migration is required for Feature 2 — this is purely an application-layer (TypeScript + tests) cleanup. This is the cheapest, lowest-risk feature in the milestone and has zero DB coupling, which is why it should be sequenced first (see Build Order below).

### New vs Modified — Feature 2

| File | New/Modified | Change |
|---|---|---|
| `lib/stores/tenant-store.tsx` | Modified | Narrow `Role` union |
| `proxy.ts` | Modified | Narrow `AppMetadata.role`, simplify redirect branch |
| `components/tenants/tenant-switcher.tsx` | Modified | Narrow `role` prop union |
| `tests/middleware.test.ts`, `tests/unit/*-route.test.ts`, `tests/integration/tenant-role-migration.test.ts` | Modified | Remove/repurpose `'viewer'` test cases |
| Migrations | None | DB already terminal since `0020` |

---

## Feature 3 — Configurable backfill window per tenant

### Verified current mechanism

Both `n8n-workflows/google-ads-sync.json` and `n8n-workflows/meta-ads-sync.json` use an identical shape:

1. `Set Constants` node hardcodes `BACKFILL_DAYS: 90` and `INCREMENTAL_DAYS: 2` **globally**, applied to every tenant/channel.
2. `List active {Google|Meta} Ads accounts` (HTTP Request → PostgREST) selects `id,tenant_id,account_id,vault_secret_id,tenants(slug)` from `ad_accounts`.
3. `Check first sync` (HTTP Request → PostgREST) queries `sync_jobs` for any prior `status=eq.success` row for that `tenant_id`+`channel`.
4. `Compute date range` (Code node) picks `BACKFILL_DAYS` if no prior successful sync exists, else `INCREMENTAL_DAYS`, and computes `date_from`/`date_to`.

This means the backfill window is **not** tenant-aware today at all — it's a single number for the whole N8N instance.

### Recommended home: `ad_accounts.backfill_days`, not `tenants.backfill_days`

`ad_accounts` is already uniquely keyed `(tenant_id, channel)` and is precisely the row the "List active accounts" node already fetches per sync run — adding one column there requires zero new joins in N8N and naturally supports **different windows per channel** (Google Ads and Meta Ads have different historical-data realities/limits), which a single `tenants.backfill_days` column could not express without extra plumbing. This also matches the requirement's own framing ("ao conectar conta" — the window is chosen at the point of connecting a specific channel account, not once per tenant).

```sql
ALTER TABLE public.ad_accounts
  ADD COLUMN backfill_days INTEGER NOT NULL DEFAULT 90
  CHECK (backfill_days BETWEEN 7 AND 365);
```

Default `90` preserves current behavior for every existing row with zero migration risk.

### Flow: Settings UI → connect routes → ad_accounts → N8N

**Google Ads** (round-trip via signed state, because the OAuth redirect leaves and re-enters the app):
- `components/settings/google-ads-form.tsx`: add a `backfillDays` field (number input, default 90) to `GoogleAdsSchema`, include it in the query string built in `onSubmit` (`window.location.href = /api/google-ads/connect?...&backfillDays=...`).
- `app/api/google-ads/connect/route.ts`: parse/validate `backfillDays` (Zod, `int().min(7).max(365)`, default 90 if absent) alongside the existing `customerId` parsing (step 4), pass it into `signState(tenantId, tenantSlug, customerId, backfillDays)`.
- `lib/google-ads/oauth-state.ts`: extend `StatePayload` with `backfillDays: number` — this is the natural place since the state is already the authoritative, HMAC-verified carrier of tenant-scoped data across the Google redirect boundary (mirrors how `customerId` already travels this path — Pitfall 4 precedent).
- `app/api/google-ads/callback/route.ts`: read `payload.backfillDays` (step 1) and include it in the `ad_accounts` upsert (step 7): `{ ..., backfill_days: payload.backfillDays }`.

**Meta Ads** (single POST, no redirect round trip — simpler):
- `components/settings/meta-ads-form.tsx`: add `backfillDays` to `MetaAdsSchema` and the POST body.
- `app/api/meta-ads/connect/route.ts`: add `backfillDays: z.number().int().min(7).max(365).default(90)` to `BodySchema` (step 0), include it in the `ad_accounts` upsert (step 7): `{ ..., backfill_days: parsed.data.backfillDays }`.

**N8N (both workflows, same edit twice):**
- `List active {Google|Meta} Ads accounts` node: add `backfill_days` to the PostgREST `select=` query string.
- `Compute date range` Code node: replace `$('Set Constants').first().json.BACKFILL_DAYS` with `$('Loop tenants').item.json.backfill_days ?? $('Set Constants').first().json.BACKFILL_DAYS` (keep the constant as a fallback default for any row that predates the migration, and as the single source of truth for `INCREMENTAL_DAYS`, which stays global — only the *first-sync* window is meant to be tenant/channel-configurable per the requirement).

### Consideration: editing the window after the account is already connected

The requirement says "ao conectar conta" (at connect time), but a tenant admin may reasonably want to change the window later without re-running the full OAuth/token flow (which would also require re-consent from Google, an unnecessary user cost just to change a number). Recommend a lightweight `updateBackfillWindow(tenantId, channel, days)` Server Action (service role, direct `UPDATE ad_accounts SET backfill_days = ...`) exposed as a small inline control next to the existing `ChannelStatusBadge` in `app/[tenant-slug]/settings/page.tsx`, independent of the connect forms — this avoids conflating "reconnect credentials" with "change sync window" as one action, and only matters for **future** first-syncs (an already-completed first sync's window is not retroactive — `is_first_sync` in the Code node is derived from `sync_jobs` history, not from the field being edited).

### New vs Modified — Feature 3

| File | New/Modified | Change |
|---|---|---|
| New migration `00XX_add_backfill_days_to_ad_accounts.sql` | New | `ALTER TABLE ad_accounts ADD COLUMN backfill_days ...` |
| `lib/google-ads/oauth-state.ts` | Modified | Extend `StatePayload` with `backfillDays` |
| `app/api/google-ads/connect/route.ts` | Modified | Parse + sign `backfillDays` |
| `app/api/google-ads/callback/route.ts` | Modified | Read + upsert `backfillDays` |
| `app/api/meta-ads/connect/route.ts` | Modified | Validate + upsert `backfillDays` |
| `components/settings/google-ads-form.tsx`, `meta-ads-form.tsx` | Modified | Add backfill window input |
| `n8n-workflows/google-ads-sync.json`, `meta-ads-sync.json` | Modified | Select `backfill_days`; use it in `Compute date range` |
| `lib/actions/ad-accounts.ts` (new file) or added to an existing actions file | New | `updateBackfillWindow` Server Action for post-connect edits |

---

## Feature 4 — Visual redesign (dashboard, campanhas, insights, settings)

### Verified integration point: this is a pure presentation-layer change

All four target pages are `'use client'` components that fetch data via **TanStack Query hooks calling the browser Supabase client** (`lib/supabase/client.ts`), not Server Components doing RLS-scoped fetches at the page level:

- `app/[tenant-slug]/dashboard/page.tsx` → `lib/hooks/use-dashboard-data.ts`
- `app/[tenant-slug]/campanhas/page.tsx` → `lib/hooks/use-campaigns-data.ts`
- `app/[tenant-slug]/insights/page.tsx` → `lib/hooks/use-ai-insights.ts`
- `app/[tenant-slug]/settings/page.tsx` → inline `fetchTenantSettings()` using `createClient()` (browser)

RLS is enforced by Postgres on every one of these calls regardless of client vs server origin — **redesigning these pages' JSX/markup/Tailwind classes carries zero RLS risk as long as the hook calls and the shape of data they return are left untouched.** The safe integration boundary is: restyle everything *below* the point where `data`/`isLoading`/`isError` are destructured from each hook; do not touch the hooks themselves, `lib/dashboard-kpis.ts`, `lib/campaign-aggregation.ts`, or `lib/formatters.ts`.

The **one** Server Component in this branch of the tree is `app/[tenant-slug]/layout.tsx`, which does real RLS-scoped queries (`tenants` lookup, `loadTenantsForSwitcher()`) and passes `role`/`tenants`/`tenantId` as props into `HeaderActions` and `SidebarNav` (`components/layout/header-actions.tsx`, `components/layout/sidebar-nav.tsx`). If the redesign changes header/sidebar chrome (very likely, since `prototipos/*.html` all show a shared header+sidebar shell), the props contract (`role`, `tenants: TenantOption[]`, `activeSlug`, `manageHref`, `manageLabel`) must be preserved or updated in `layout.tsx` in lockstep — this is the only place in Feature 4 that touches server-side/auth-aware code.

### Prototype reference material

`prototipos/{dashboard,campanhas,insights}.html` + shared `prototipos/style.css` + `prototipos/nexus-dash.html` are static, pre-GSD HTML/CSS mockups (using Chart.js via CDN, not Recharts) — they encode the *target visual design* (KPI card layout, header/sidebar structure, color tokens like `--chart-1`/`--chart-2` already partially adopted in the live dashboard) but are not meant to be run as-is; they are a design reference to re-implement inside the existing shadcn/ui + Tailwind + Recharts component set already in `components/ui/*` and `components/dashboard/*`. Do not introduce Chart.js — the live app already uses Recharts via `components/ui/chart.tsx` per the project's stack decision (Recharts chosen over Nivo/Tremor/Victory).

### New vs Modified — Feature 4

| File | New/Modified | Change |
|---|---|---|
| `app/[tenant-slug]/dashboard/page.tsx`, `campanhas/page.tsx`, `insights/page.tsx`, `settings/page.tsx` | Modified | Restyle JSX only; preserve hook calls and data shape |
| `components/dashboard/*`, `components/campanhas/*`, `components/insights/*`, `components/settings/*` | Modified (some may become New if the redesign introduces new sub-components, e.g. new KPI card variants) | Visual layer |
| `app/[tenant-slug]/layout.tsx` | Modified (only if header/sidebar chrome changes) | Preserve `role`/`tenants`/`tenantId` prop contract into `HeaderActions`/`SidebarNav` |
| `components/layout/header-actions.tsx`, `sidebar-nav.tsx` | Modified | Visual layer, same prop contract |
| `prototipos/*.html`, `style.css` | Reference only | Not shipped; source of design tokens/layout to port into Tailwind/shadcn |

---

## Build Order Across the 4 Features

**Recommended order: Feature 2 → Feature 1 → Feature 3 → Feature 4.**

1. **Feature 2 (viewer cleanup) first.** Zero DB coupling (already terminal since migration `0020`), zero in-flight-session risk (that window closed when Phase 5 shipped), and it shrinks the `Role` type that Feature 1's new UI (role badges, user list columns) would otherwise have to needlessly account for. Doing this after Feature 1 would mean writing user-list UI against a wider, partially-dead type and then narrowing it under the new UI — strictly more work.

2. **Feature 1 (user management) second.** Depends on Feature 2 only for type cleanliness, not correctness — could technically run in parallel, but sequencing after avoids rework. Independent of Features 3/4. Establishes the `updateUserById`/`admin.signOut` patterns that don't exist anywhere else in the codebase today, so budget the most unit/integration test time here (mirroring the existing `tests/integration/tenant-role-migration.test.ts` and `tests/agency-rls.test.ts` style already in the repo).

3. **Feature 3 (backfill window) third.** Fully independent of Features 1/2 (different tables, different routes) — could run in parallel with either, but should land **before** Feature 4 because it adds a new input to the Settings forms (`google-ads-form.tsx`, `meta-ads-form.tsx`) that the visual redesign of the Settings page needs to account for. Doing Feature 4 first would mean redesigning Settings, then immediately having to re-touch that same redesigned layout to slot in the new backfill field — two design passes instead of one.

4. **Feature 4 (visual redesign) last.** Lowest technical risk (no RLS/auth surface touched beyond the one `layout.tsx` prop contract), but highest "surface area" (4 pages + shared chrome) — sequencing it last means it restyles the *final* shape of the user-management UI (Feature 1) and the *final* Settings form (with the backfill field from Feature 3) in one pass, rather than needing follow-up restyling after either lands.

## Anti-Patterns to Avoid in This Milestone

### Anti-Pattern 1: Manual `tenant_users`/`agency_users` row deletion alongside `admin.deleteUser`

**What people might do:** delete the membership row first, then call `admin.deleteUser`, "to be safe."
**Why it's wrong:** `ON DELETE CASCADE` already guarantees this atomically inside Postgres when the `auth.users` row is deleted. A manual two-step introduces a window where the auth user exists without a membership row (or vice versa if the first step fails), which is strictly worse than trusting the FK.
**Instead:** call `supabase.auth.admin.deleteUser(userId)` alone, exactly as the existing rollback code in `lib/actions/tenants.ts`/`agencies.ts` already does.

### Anti-Pattern 2: Assuming a membership edit takes effect immediately because "RLS re-checks every request"

**What people might do:** remove a user from `tenant_users` and assume their next API call is instantly blocked, because RLS is per-request.
**Why it's wrong:** `get_tenant_id()`/`get_user_role()` read the JWT, not the table, at request time (D-14 performance rule — intentional, correct for perf, but has this side effect). The JWT is only re-minted at login/refresh by the Custom Access Token Hook.
**Instead:** pair any non-delete membership mutation with `supabase.auth.admin.signOut(userId, 'global')` if immediate revocation matters for that action.

### Anti-Pattern 3: Making `BACKFILL_DAYS` tenant-configurable via a new N8N workflow parameter/credential instead of a DB column

**What people might do:** try to make N8N itself tenant-aware (e.g. per-tenant workflow copies, or an N8N "workflow static data" override).
**Why it's wrong:** the sync workflows already loop over **all** tenants' `ad_accounts` rows in a single shared workflow (`Loop tenants` / `splitInBatches`) — introducing per-tenant workflow variants would fragment the single-workflow-per-channel model the project deliberately built (and would multiply N8N maintenance for 1-3 tenants for no benefit).
**Instead:** the data the loop is already iterating over (`ad_accounts`) is the correct and only place a per-account setting belongs.

## Sources

- Direct repository reads (all HIGH confidence, primary source): `supabase/migrations/0002` through `0022`, `lib/actions/tenants.ts`, `lib/actions/agencies.ts`, `proxy.ts`, `lib/stores/tenant-store.tsx`, `components/tenants/tenant-switcher.tsx`, `app/[tenant-slug]/layout.tsx`, `app/[tenant-slug]/dashboard/page.tsx`, `app/api/google-ads/connect/route.ts`, `app/api/google-ads/callback/route.ts`, `app/api/meta-ads/connect/route.ts`, `lib/google-ads/oauth-state.ts`, `n8n-workflows/google-ads-sync.json`, `n8n-workflows/meta-ads-sync.json`, `.planning/PROJECT.md`.
- Supabase Auth Admin API behavior (deleteUser cascades sessions, updateUserById, signOut scopes) — from training knowledge of the documented `supabase-js` Admin API surface (`@supabase/supabase-js` `^2.105.4` per `package.json`); **not independently re-verified against live Supabase docs in this research pass** — flag as MEDIUM confidence specifically for the exact `admin.signOut(userId, 'global')` revocation behavior and default access-token TTL; recommend a quick doc check at implementation time before relying on it as the sole mitigation for Anti-Pattern 2.

---
*Architecture research for: NEXUS-DASH v1.1 (Gestão de Usuários, Limpeza, Janela de Histórico, Redesign Visual)*
*Researched: 2026-07-11*
