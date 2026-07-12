# Phase 05 — Agência Multi-Cliente — Security Audit

**Audited:** 2026-07-10
**ASVS Level:** 1
**Block on:** elevation-of-privilege, information-disclosure
**Result:** 17/17 threats closed, 0 open

This audit verifies mitigations declared in `05-01-PLAN.md` through `05-09-PLAN.md`'s
`<threat_model>` blocks against the CURRENT implementation, incorporating the fix applied by
`.planning/debug/resolved/agency-app-metadata-getuser-mismatch.md` (commit `eec002f`), which
landed after those plans were written. Per that debug session, 6 files were changed to replace
`supabase.auth.getUser().app_metadata` reads with `supabase.auth.getClaims()` for
role/tenant/agency identity: `app/agencia/layout.tsx`, `app/[tenant-slug]/layout.tsx`,
`app/api/leads/[id]/status/route.ts`, `app/agencies/layout.tsx`, `app/tenants/layout.tsx`,
`app/api/meta-ads/connect/route.ts`.

## Threat Verification

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-05-00 | Repudiation | accept | CLOSED | `it.todo()` scaffolds distinguishable from passing tests in Vitest output; all downstream plans (02/03/05/08) replaced their todos with real assertions — confirmed zero `it.todo()` remain in `tests/agency-rls.test.ts`, `tests/agencies.test.ts`, `tests/unit/leads-status-route.test.ts`'s AGENCY-08 block (verified live, 35/35 passing) |
| T-05-01 | Elevation of Privilege | mitigate | CLOSED | `supabase/migrations/0018_agency_scoped_rls_policies.sql` — `tenants_agency_select`, `campaign_metrics_agency_select`, `ad_accounts_agency_select`, `sync_jobs_agency_select`, `daily_rollups_agency_select`, all filtering `tenant_id IN (SELECT agt.tenant_id FROM agency_tenants agt WHERE agt.agency_id = (SELECT get_agency_id()))` |
| T-05-02 | Elevation of Privilege | accept | CLOSED | `supabase/migrations/0019_custom_access_token_hook_agency.sql:38-51` — agency branch checked and returns before the tenant_users branch is even queried; `agency_users` migration comment documents the un-enforced invariant explicitly |
| T-05-03 | Denial of Service | mitigate | CLOSED | `supabase/migrations/0017_create_agencies_schema.sql:40-51` — `get_agency_id()` reads only `current_setting('request.jwt.claims', ...)`, zero table access |
| T-05-04 | Information Disclosure | mitigate | CLOSED | `supabase/migrations/0017_create_agencies_schema.sql:78-80` — `REVOKE ALL ON public.agencies/agency_users/agency_tenants FROM anon` |
| T-05-05 | Tampering | accept | CLOSED | `supabase/migrations/0020_collapse_tenant_role.sql` header comment + `05-CONTEXT.md` D-03 documents the intentional widening |
| T-05-06 | Repudiation | mitigate | CLOSED | `05-03-SUMMARY.md` confirms the pre-migration `SELECT role, count(*) FROM tenant_users GROUP BY role` was run before applying 0020 (`{tenant_admin: 1}`, zero unexpected values) |
| T-05-07 | Elevation of Privilege | mitigate | CLOSED | `app/[tenant-slug]/layout.tsx:39-53` — role read via `getClaims()` (post-fix); non-super_admin path always re-queries `tenants` through the RLS-scoped client regardless of claim value — independently re-verified fail-closed even in the pre-fix window (see Note A) |
| T-05-08 | Spoofing | accept | CLOSED | `proxy.ts:59-93` — decisions are redirect hints only; `/tenants` and `/agencies` prefix checks are backed by the server-verified layout guards (T-05-07/T-05-15), not treated as authorization by themselves |
| T-05-09 | Elevation of Privilege | accept | CLOSED | `lib/actions/agencies.ts` — no in-function role check in any of the 6 exported actions, confirmed identical to `lib/actions/tenants.ts`'s pattern (also no in-function check) |
| T-05-10 | Tampering | mitigate | CLOSED | `lib/actions/agencies.ts:112-119` (`createAgencyUser`) inserts only into `agency_users`; repo-wide grep of this file confirms no `.from('tenant_users')` reference |
| T-05-11 | Information Disclosure | mitigate | CLOSED | `app/agencia/page.tsx` + `components/agencies/*` — grep confirms no `service_role`/`createServiceClient` usage anywhere under `app/agencia` or `components/agencies`; `loadGrantedTenants()` uses `createClient()` (RLS-scoped) |
| T-05-12 | Spoofing | mitigate | CLOSED | `app/agencia/layout.tsx:18-20` — role read via `getClaims()` (post-fix, supersedes the plan's originally-cited `getUser().app_metadata` mechanism); independently re-verified fail-closed even pre-fix (see Note A) |
| T-05-13 | Tampering / Elevation of Privilege | mitigate | CLOSED | `app/api/leads/[id]/status/route.ts:71-95` — scope derived from `getClaims()`'s `app_metadata.tenant_slug`/`agency_id` (post-fix); body's `tenant` used only to SELECT, never to grant; independently re-verified fail-closed even pre-fix (see Note A) |
| T-05-14 | Elevation of Privilege | mitigate | CLOSED | Same file, lines 71-108 — the scope check (step 5, RLS-scoped `agency_tenants` lookup) executes and can 403 BEFORE `createServiceClient()` is instantiated (step 6) |
| T-05-15 | Elevation of Privilege | mitigate | CLOSED | `app/agencies/layout.tsx:12-16` — role read via `getClaims()` (post-fix, supersedes the plan's originally-cited `getUser().app_metadata` mechanism); independently re-verified fail-closed even pre-fix (see Note A) |
| T-05-16 | Tampering | accept | CLOSED | `lib/actions/agencies.ts:127-143` (`grantTenant`) — `upsert(..., { onConflict: 'agency_id,tenant_id', ignoreDuplicates: true })` against the `UNIQUE(agency_id, tenant_id)` constraint in migration 0017 |
| T-05-17 | Repudiation | accept | CLOSED | `.planning/phases/05-agencia-multi-cliente/05-09-PLAN.md` Task 2 + `.planning/debug/resolved/agency-app-metadata-getuser-mismatch.md` — human tester (coordinator) re-ran all 5 previously-failing UAT scripts live via Playwright against the real Supabase project and confirmed PASS |

## Note A — Independent re-assessment of pre-fix fail-open vs. fail-closed (context note points 1-2)

Per the coordinator's context note, this audit independently re-verified — rather than trusted —
the debug session's claim that the `getUser().app_metadata` bug degraded to fail-closed, not
fail-open, for T-05-07, T-05-12, T-05-13, T-05-15:

1. **Fix presence (current code):** Confirmed via direct read of all 4 files — `app/agencia/layout.tsx`,
   `app/[tenant-slug]/layout.tsx`, `app/api/leads/[id]/status/route.ts`, `app/agencies/layout.tsx`
   — all now call `supabase.auth.getClaims()` and read `claimsData.claims.app_metadata`, not
   `getUser().app_metadata`. `app/tenants/layout.tsx` and `app/api/meta-ads/connect/route.ts`
   (the other 2 files from the same fix) are also confirmed on `getClaims()`.

2. **Pre-fix disposition re-assessment (would it have been fail-open?):** No — confirmed fail-closed
   in every case, independently traced:
   - **T-05-07 / `[tenant-slug]/layout.tsx`:** the only place `role` gates an actual authorization
     decision is `if (role !== 'super_admin') { <RLS-scoped tenant lookup> }`. Pre-fix, `role`
     resolved to `null` for every non-super_admin (their `raw_app_meta_data` was never populated),
     and to the correct `'super_admin'` for the one bootstrapped account (`raw_app_meta_data` was
     manually seeded there). `null !== 'super_admin'` is `true`, so the RLS-scoped check always ran
     for real tenant_admin/agency/viewer users — same as intended — meaning the underlying data
     boundary (RLS) was never bypassed. The only externally-visible defect was UI-level: the
     sidebar's `role === 'agency'` filter (`components/layout/sidebar-nav.tsx`) failed to hide
     "AI Insights"/"Conta" for agency users. Read both linked pages: `app/[tenant-slug]/insights/page.tsx`
     renders only static `MOCK_INSIGHTS` (no real data fetch), and `app/[tenant-slug]/settings/page.tsx`
     fetches `ad_accounts` through the RLS-scoped browser client — which an agency user is already
     entitled to see via `ad_accounts_agency_select` (migration 0018) for their granted tenant — and
     its connect action (`/api/meta-ads/connect`) independently 403s any role other than
     `super_admin`/`tenant_admin`. **No information disclosure or elevation resulted from the
     pre-fix sidebar bug.**
   - **T-05-12 / `agencia/layout.tsx`:** pre-fix, `role !== 'agency'` was `true` for every real user
     (agency users got `null`, tenant_admin/viewer got `null`, super_admin got `'super_admin'`) —
     always redirects to `/`, i.e. always fail-closed. There is no user for whom this comparison
     resolved to a false negative in the attacker's favor.
   - **T-05-13 / leads-status route:** pre-fix, `callerAppMetadata?.tenant_slug` and `?.agency_id`
     were always `undefined` for real tenant_admin/agency users → the equality/existence checks
     (`callerSlug !== tenantSlug`, `!agencyId`) always evaluated to the rejecting branch → always
     403, regardless of whether the caller's real scope matched the requested tenant. Fail-closed.
   - **T-05-15 / `agencies/layout.tsx`:** identical shape to T-05-12; the one real super_admin
     account happens to have `raw_app_meta_data.role` seeded, so it passed correctly; every other
     role got `null` → correctly rejected. The debug session's flagged "latent risk" (a **future**
     super_admin onboarded without manually-seeded `raw_app_meta_data`) would also have failed
     *closed* (wrongly locked out of `/agencies`), not open.

   **Conclusion: the pre-fix condition never constituted an actual fail-open elevation-of-privilege
   or spoofing vulnerability for any of these 4 threats — it was a functional availability bug
   (legitimate users incorrectly denied), consistent with the debug session's own conclusion. This
   audit reached that conclusion independently by tracing each call site's authorization-relevant
   branch, not by trusting the debug session's assertion.** No disposition change is warranted; all
   4 remain `mitigate` and are `CLOSED` given the current `getClaims()` fix.

3. **Blast-radius completeness (context note point 3):** Repo-wide grep for `app_metadata` across
   all non-test `.ts`/`.tsx` files found exactly the 6 files the debug session fixed, all now on
   `getClaims()`, plus one additional read in `app/api/meta-ads/connect/route.ts:73` (a comment
   only). No other production call site reads `user.app_metadata` from `getUser()` for
   authorization purposes. The only remaining `app_metadata` references outside the 6 fixed files
   are in test fixtures (`tests/agency-rls.test.ts`, `tests/middleware.test.ts`,
   `tests/unit/leads-status-route.test.ts`, `tests/integration/*.test.ts`), which intentionally
   preset `app_metadata` at `admin.createUser()` time as a test-only technique (documented in
   `tests/agency-rls.test.ts`'s own comments) and in `proxy.ts`, which correctly decodes the raw JWT
   directly (not `getUser()`/`getClaims()`) — a distinct, already-correct code path. **Fix coverage
   confirmed complete — no further files need the same correction.**

## Unregistered Flags

None. Confirmed via grep that no `05-*-SUMMARY.md` file in this phase contains a `## Threat Flags`
section.

## Accepted Risks Log

The following threats carry an `accept` disposition per their originating plan and are logged here
as this phase's permanent accepted-risk record:

- **T-05-00** — Vitest `it.todo()` scaffolds could be misread as passing in a shallow CI glance.
  Accepted because Vitest's own summary output distinguishes todos from passes, and every todo in
  this phase was confirmed replaced with a real assertion by the time of this audit.
- **T-05-02** — An admin data-entry error could place one user in both `agency_users` and
  `tenant_users`. Accepted at this project's 1-3 tenant / manual-admin scale; hook precedence
  (agency-first) is the deterministic tie-breaker if it ever happens. Re-evaluate if the platform
  opens to external/self-service agencies.
- **T-05-05** — `viewer` → `tenant_admin` is an intentional, documented access widening (D-03), not
  an accidental escalation.
- **T-05-08** — `proxy.ts`'s role/tenant reads are redirect hints only; the real authorization
  boundary is RLS + the server-verified layout guards audited under T-05-07/T-05-15.
- **T-05-09** — `lib/actions/agencies.ts` has no in-function role check, matching the pre-existing,
  accepted pattern in `lib/actions/tenants.ts`. The guard lives in the calling page's layout.
- **T-05-16** — Two Super Admin tabs racing to grant/revoke the same tenant. Accepted: the
  `UNIQUE(agency_id, tenant_id)` constraint plus `ignoreDuplicates: true` makes the worst case a
  harmless no-op, not data corruption.
- **T-05-17** — Manual UAT confirmation (not independently re-verifiable after the fact) is this
  project's established closure pattern for a 1-3 tenant internal tool (Phase 1, Phase 03.1
  precedent).

## Notes on Plan-vs-Code Drift

`05-06-PLAN.md` (T-05-15), `05-07-PLAN.md` (T-05-12), and `05-08-PLAN.md` (T-05-13) each cite
`getUser().app_metadata` as the verification mechanism in their mitigation-plan text. The CURRENT
code no longer matches that literal text — it now uses `getClaims()`, following the
`agency-app-metadata-getuser-mismatch` debug session that landed after these plans were written.
This is a strictly stronger mitigation (the original mechanism was broken for every non-super_admin
role, as established above), so these threats are still assessed `CLOSED`, but the plan documents
themselves are stale and should be updated to reference `getClaims()` if this phase's plans are
revisited.
