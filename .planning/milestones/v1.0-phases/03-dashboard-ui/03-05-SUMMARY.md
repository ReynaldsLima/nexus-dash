---
phase: 03-dashboard-ui
plan: 05
subsystem: settings/meta-ads-connection
tags: [settings, meta-ads, vault, rpc, rhf, zod, tanstack-query, sidebar]
dependency_graph:
  requires:
    - supabase/migrations/0006_create_ad_accounts.sql (vault_secret_id column)
    - supabase/migrations/0010_create_pipeline_functions.sql (read_vault_secret pattern)
    - supabase/migrations/0011_fix_vault_function_grants.sql (authenticator GRANT pattern)
    - lib/supabase/service.ts (createServiceClient)
    - lib/supabase/server.ts (createClient for auth)
    - lib/supabase/client.ts (createBrowserClient for Settings page queries)
    - app/providers.tsx (QueryClientProvider — Plan 02)
    - components/ui/badge.tsx, card.tsx, button.tsx, input.tsx, skeleton.tsx (pre-existing)
  provides:
    - supabase/migrations/0013_create_vault_write_function.sql (create_or_update_vault_secret RPC)
    - app/api/meta-ads/connect/route.ts (POST handler: auth + role + Meta validation + Vault + upsert)
    - components/settings/meta-ads-form.tsx (RHF + Zod form with inline feedback)
    - app/[tenant-slug]/settings/page.tsx (Settings page with channel status badges)
    - components/layout/sidebar-nav.tsx (Settings nav link added)
  affects:
    - types/database.types.ts (create_or_update_vault_secret added to Functions block)
tech_stack:
  added: []
  patterns:
    - SECURITY DEFINER RPC with REVOKE/GRANT pattern (mirrors migration 0010/0011)
    - Route Handler: createClient (auth) + createServiceClient (service role writes)
    - Zod v4 body validation with transform (accountId normalisation to act_ prefix)
    - RHF + zodResolver for client-side form with inline feedback and token clearing
    - TanStack Query useQuery for settings data (tenant id + ad_accounts status)
    - Double Meta Graph API validation (token identity + Ads account permission)
key_files:
  created:
    - supabase/migrations/0013_create_vault_write_function.sql
    - app/api/meta-ads/connect/route.ts
    - components/settings/meta-ads-form.tsx
    - app/[tenant-slug]/settings/page.tsx
  modified:
    - types/database.types.ts (added create_or_update_vault_secret to Functions)
    - components/layout/sidebar-nav.tsx (added Settings icon + Conta group)
decisions:
  - Types updated manually — supabase db push requires SUPABASE_DB_PASSWORD not available in dev env; migration file created and will be applied on next db push with password
  - accountId normalised to act_ prefix via Zod transform on both client and server
  - Token field reset after success but accountId kept for user confirmation
  - TanStack Query useQuery (not useEffect+useState) for settings data — consistent with Plans 03-04 pattern
  - Settings added in new Conta sidebar group (not appended to Marketing items) — semantically separate concern
metrics:
  duration_minutes: 40
  completed_date: "2026-06-05"
  tasks_total: 4
  tasks_completed: 4
  files_created: 5
  files_modified: 2
requirements: [SET-01, SET-02]
---

# Phase 3 Plan 05: Settings Page — Meta Ads Connection Summary

**One-liner:** `create_or_update_vault_secret` SECURITY DEFINER RPC, POST /api/meta-ads/connect with double Meta Graph API validation (token identity + Ads permission), RHF+Zod form with inline feedback, Settings page with TanStack Query for channel status badges, Google Ads deferred section, and Settings link in sidebar — SET-01 and SET-02 complete, UAT approved.

## What Was Built

### supabase/migrations/0013_create_vault_write_function.sql

New `public.create_or_update_vault_secret(p_name TEXT, p_secret TEXT) RETURNS UUID` function:
- `LANGUAGE plpgsql`, `SECURITY DEFINER`, `SET search_path = public, vault`
- Logic: SELECT id from `vault.secrets` WHERE name = p_name; if exists → `vault.update_secret(id, secret)` + return existing id; else → `vault.create_secret(secret, name)` → return new UUID
- `REVOKE EXECUTE FROM PUBLIC, anon, authenticated` + `GRANT TO service_role, authenticator` (same pattern as migrations 0010/0011)
- Comment documenting Threat T-03-06 mitigation

**Note on migration application:** `supabase db push` requires `SUPABASE_DB_PASSWORD` which is not configured in the local development environment. The migration file is committed and will be applied on the next `supabase db push --password <pwd>`. Types were updated manually in `types/database.types.ts` to unblock TypeScript compilation.

### app/api/meta-ads/connect/route.ts

`POST` Route Handler with `export const runtime = 'nodejs'`:
1. `createClient()` → `auth.getUser()` → 401 if no session
2. `supabase.rpc('get_user_role')` → 403 if not `super_admin` or `tenant_admin`
3. Zod body parse: `accountId` (normalised to `act_\d+`), `token` (min 20), `tenantId` (UUID)
4. Fetch `https://graph.facebook.com/v22.0/me?fields=id,name&access_token=...` → 400 with Meta error message if invalid
5. Fetch `https://graph.facebook.com/v22.0/{accountId}?fields=id&access_token=...` → 400 if no Ads permission
6. `createServiceClient().rpc('create_or_update_vault_secret', { p_name, p_secret })` → 500 on vault error
7. `service.from('ad_accounts').upsert({ ... }, { onConflict: 'tenant_id,channel' })` → 500 on upsert error
8. Returns `{ success: true, accountId }` — token and vault_secret_id never returned (T-03-01, T-03-05)

### components/settings/meta-ads-form.tsx

`'use client'` component with RHF + Zod:
- `accountId` field (Input) — accepts raw digits or act_ prefix
- `token` field (textarea with font-mono) — minimum 20 chars, cleared after success
- On submit: POST to `/api/meta-ads/connect`, updates local `connectionStatus` state
- Success: badge changes to "Conectado", token field cleared via `reset()`
- Error: server error message shown in destructive alert box, badge changes to "Token inválido"
- Loading: button shows "Validando..." and is disabled

### app/[tenant-slug]/settings/page.tsx

`'use client'` page with TanStack Query:
- `useQuery(['settings', tenantSlug])` fetches tenant id + ad_accounts status
- Meta Ads section: `<MetaAdsForm>` with channel status badge (connected/not_configured/invalid)
- Google Ads section (SET-01 deferred): card with badge "Não configurado" + deferral note about Developer Token
- Channel status badges: green "Conectado", grey "Não configurado", red "Token inválido"
- Loading: `<SettingsSkeleton>` with Skeleton components
- Error: inline destructive message

### components/layout/sidebar-nav.tsx (modified)

Added:
- `Settings` icon import from `lucide-react`
- New "Conta" group at bottom of sidebar with `NavLink` to `/${slug}/settings`
- Active detection: `pathname.startsWith(/${slug}/settings)`

## Commits

| Task | Hash | Message |
|------|------|---------|
| Task 1 | ef1ab4c | feat(03-05): add create_or_update_vault_secret migration and update types |
| Task 2 | 7494adf | feat(03-05): create POST /api/meta-ads/connect route handler |
| Task 3 | 57886ab | feat(03-05): create Settings page, MetaAdsForm and sidebar link |
| Task 4 | — | UAT manual aprovado pelo usuário (sem commit — checkpoint humano) |

## Decisions Made

1. **Types updated manually, not via `supabase gen types`** — `supabase db push` requires direct DB connection (SUPABASE_DB_PASSWORD) which is not configured. Migration file committed; types patched manually with the new RPC signature. Will be overwritten correctly on next `supabase gen types --linked`.
2. **accountId normalised to `act_` prefix via Zod transform on the server** — Client schema validates format (digits or act_ prefix); server schema transforms raw digits to `act_\d+` canonical form. Keeps the UX flexible while normalising the DB value.
3. **Token field reset after success, accountId preserved** — Clearing only the token field after a successful connection gives the user visual confirmation of which account was connected without requiring them to re-enter the Account ID on reconnect.
4. **Settings in "Conta" sidebar group** — Semantically separate from Marketing and Leads items; "Conta" group at the bottom of the sidebar follows standard SaaS navigation conventions.
5. **TanStack Query for settings data** — Consistent with the hook pattern established in Plans 03 and 04; provides automatic cache invalidation and loading/error states without boilerplate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] supabase db push requires DB password — types updated manually**
- **Found during:** Task 1
- **Issue:** `npx supabase db push` and `npx supabase migration up` both fail with "unexpected login role status 544 / Connection terminated due to connection timeout" and "No connection could be made to 127.0.0.1:54322". Local Supabase stack not running; direct DB password not configured in env.
- **Fix:** Migration SQL file committed as-is. `types/database.types.ts` manually patched to add `create_or_update_vault_secret` to the `Functions` block, matching the signature the RPC will have once applied. TypeScript compilation and build pass. User must run `supabase db push --password <pwd>` to apply the migration to the remote DB.
- **Files modified:** `types/database.types.ts`
- **Commit:** ef1ab4c

## Checkpoint Status

**Task 4 (UAT manual — SET-02):** APROVADO pelo usuário.

Todos os 7 passos de verificação executados com token Meta real:
1. Login como super_admin/tenant_admin — OK
2. Navegar para /[tenant-slug]/settings via link "Configurações" no sidebar — OK
3. Seção Google Ads com badge "Não configurado" + nota de deferimento — OK
4. Token VÁLIDO submetido → badge "Conectado", linha em ad_accounts, secret no Vault — OK
5. Token INVÁLIDO → erro inline com mensagem da Meta, nada persistido — OK
6. Reload da página → badge reflete estado de ad_accounts — OK

SET-01 e SET-02 marcados como completos.

## Known Stubs

None. All UI state flows from real data:
- Channel status badges read from `ad_accounts` via TanStack Query
- MetaAdsForm connection status derived from actual API response
- Google Ads section is intentionally deferred (not a stub — it renders a functional placeholder with a clear deferral message)

## Threat Flags

None. All threats from the plan's `<threat_model>` are mitigated:
- T-03-01 (token disclosure): Token sent via POST body only; never logged (no `console.log(token`)); never returned in responses; stored only in Vault.
- T-03-02 (SSRF): URL base hardcoded to `https://graph.facebook.com/v22.0`; only regex-validated accountId and encoded token are interpolated.
- T-03-03 (service role in client): `lib/supabase/service.ts` has `import 'server-only'`; route uses `export const runtime = 'nodejs'` — service client never bundled in browser.
- T-03-04 (unauthorized writes): Route checks `auth.getUser()` + `get_user_role()` before any write. RLS on `ad_accounts` is defense in depth.
- T-03-05 (vault_secret_id exposure): Response returns only `{ success, accountId }`.
- T-03-06 (RPC abuse): `REVOKE FROM PUBLIC, anon, authenticated`; `GRANT TO service_role, authenticator`.

## Self-Check: PASSED

Files exist:
- FOUND: supabase/migrations/0013_create_vault_write_function.sql
- FOUND: app/api/meta-ads/connect/route.ts
- FOUND: components/settings/meta-ads-form.tsx
- FOUND: app/[tenant-slug]/settings/page.tsx
- FOUND: types/database.types.ts (modified)
- FOUND: components/layout/sidebar-nav.tsx (modified)

Commits exist:
- FOUND: ef1ab4c (Task 1)
- FOUND: 7494adf (Task 2)
- FOUND: 57886ab (Task 3)
