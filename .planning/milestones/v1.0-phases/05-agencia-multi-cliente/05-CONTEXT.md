# Phase 5: Access Modules — Multi-Client Agency - Context

**Gathered:** 2026-07-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Introduce a new access module, "Agência" (Agency), sitting alongside the existing Super Admin / tenant-scoped access model. An Agência has no tenant of its own; the Super Admin grants it access to N "Cliente" tenants (companies), and the Agência can switch between those granted clients to view Dashboard, Campanhas, and Gestão de Leads (including editing lead status — same capability every role already has). "Cliente" becomes the new name for full access to a single tenant (today's `tenant_admin`, collapsed with `viewer` into one role per D-03 below).

This phase does NOT touch the read/write-back leads feature itself (Phase 03.1) — it only changes who can reach a given tenant's data and how they navigate between tenants they're allowed to see.
</domain>

<decisions>
## Implementation Decisions

### Agência visibility model
- **D-01:** Agência navigation is a **client selector**, not a consolidated cross-client dashboard. Logging in as an Agência user presents a switcher (extending the existing `components/tenants/tenant-switcher.tsx`) scoped to only the Cliente tenants granted to that agency; picking one shows that tenant's normal dashboard/campanhas/leads pages, unchanged. No new aggregation/rollup work across multiple clients in this phase — that would be a future phase if requested.

### Grant management (Super Admin → Agência → Clientes)
- **D-02:** The Super Admin manages which Cliente tenants an Agência can see through a **simple in-app screen** (not manual Supabase Studio edits like tenant creation today). This is a deliberate deviation from the project's existing "no onboarding UI, manual via Studio" pattern — the user explicitly chose in-app management here because assigning/removing clients per agency is expected to be a recurring, changing operation, unlike one-time tenant creation.

### Cliente role model
- **D-03:** Within a Cliente tenant, access becomes a **single flat role** — no more internal `tenant_admin` vs `viewer` split. Whoever has access to that tenant can see and edit everything a Cliente can (including lead status, per the earlier confirmed rule that all three modules — Super Admin, Agência, Cliente — can edit lead status). Simplifies the model and matches the "todos podem alterar o status do lead" decision from the exploration that led to this phase.
- **Migration note (flag for planner/researcher):** Existing tenants (`lukseg`, `beta-test`) currently have real `tenant_admin`/`viewer` users in `tenant_users`. Collapsing to one role is a live-data migration concern — the planner should account for how existing rows in `tenant_users.role` get reconciled (e.g., does `viewer` get promoted to full Cliente access, or does the CHECK constraint just widen to accept a new single value going forward). Not resolved in this discussion — flagged as a research/planning question, not a user decision made here.

### Agência identity
- **D-04:** An Agência user has **their own account, with no tenant membership at all** — they are never a row in `tenant_users`. Their only association is to an agency entity (and, through the grant, to the Cliente tenants that agency can see). This keeps the "which hat is this user wearing" question unambiguous — a user is either a tenant member (Cliente) or an agency member (Agência), never both in this phase's model.

### Claude's Discretion
- Exact schema/table design (`agencies`, `agency_users`, `agency_tenants` join table names/columns) — technical implementation, researcher/planner territory, not discussed with the user.
- How `get_user_agency_id()` (or equivalent) is exposed via JWT custom claims, consistent with the existing `get_tenant_id()`/`get_user_role()` pattern (Custom Access Token Hook, migration 0005) — flagged as a research question already logged in `.planning/research/questions.md`.
- Whether `super_admin` needs anything new to manage agencies (likely yes — the D-02 "simple in-app screen" — but exact UI/UX of that screen, e.g. where it lives in nav, table layout, is Claude's/researcher's call).
- Whether Cliente's single flat role reuses the `tenant_admin` string value going forward (renaming meaning without a schema change) or needs an actual new value/migration — technical call for planner given the D-03 migration note above.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Prior architecture pattern (RLS + JWT claims) — the pattern Agência access must extend
- `.planning/phases/01-foundation/01-CONTEXT.md` §D-12/D-13/D-14 — `super_admin` in `auth.users.app_metadata` (not `tenant_users`); Custom Access Token Hook injects `tenant_id`+`role` into JWT (no per-request DB query); RLS must ALWAYS wrap `get_tenant_id()`/`get_user_role()` in `(SELECT ...)` — bare calls cause 100-1000x slowdown (no inlining)
- `supabase/migrations/0002_create_tenants.sql` — current `tenants`/`tenant_users` schema (role CHECK constraint `IN ('tenant_admin', 'viewer')` — will need to change per D-03)
- `supabase/migrations/0004_create_rls_policies.sql` — existing `tenants_member_select`/`tenants_super_admin_all` policies; the pattern any new Agência-scoped policy must follow
- `supabase/migrations/0005_custom_access_token_hook.sql` — the Custom Access Token Hook itself; where a new `agency_id` claim (if that's the chosen approach) would be added
- `supabase/migrations/0016_restrict_sheets_service_account_column.sql` — recent precedent: column-level Postgres GRANT/REVOKE matters in addition to RLS row policies (learned the hard way in Phase 03.1's code review) — relevant if any agency-related column ends up sensitive

### This exploration's source material
- `.planning/notes/agencia-multi-cliente-arquitetura.md` — full definitions and rationale captured during `/gsd-explore`
- `.planning/research/questions.md` — open research question on Supabase RLS patterns for N:N grant-based multi-tenant access (must be answered before/during planning)
- `.planning/PROJECT.md` §Key Decisions — "Google Sheets fora do v1" row shows the project's precedent for reversing an "Out of Scope" decision when reality diverges; §Requirements — "Três roles: Super Admin, Tenant Admin, Viewer" (Phase 1, Validated) is the model this phase revises

### Reusable code
- `components/tenants/tenant-switcher.tsx` — existing `<select>`-based switcher, currently hardcoded to `role === 'super_admin'`; D-01 reuses/extends this for Agência with a scoped tenant list instead of "all tenants"
- `app/[tenant-slug]/layout.tsx` — where role-based routing/redirects currently live; likely needs an Agência branch

[No other external specs — requirements for this phase are captured in the decisions above and will be formalized as LEADS-style REQ IDs during planning/requirements authoring.]

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `components/tenants/tenant-switcher.tsx`: simple, presentational — takes `role`, `tenants[]`, `activeSlug` props. Extending it for Agência is mostly a matter of (a) relaxing the `role !== 'super_admin'` guard to also allow an agency role, and (b) passing it the agency's granted tenant list instead of the global tenant list.
- `app/[tenant-slug]/layout.tsx`: already fetches `tenants` and passes role-aware data down — the natural place to also resolve "which tenants does this Agência see" for the switcher.

### Established Patterns
- Role and tenant scoping are resolved from JWT custom claims (`app_metadata`/Custom Access Token Hook), never re-queried from the DB per request. Any new Agência scoping should follow the same "claims-first" pattern rather than adding a query-per-request.
- RLS policies in this project consistently separate a `_super_admin_all` catch-all policy from a narrower `_member_select` (or similar) policy per table — a third `_agency_select` (or similar) policy following the same naming/structure convention is the expected shape.

### Integration Points
- `components/tenants/tenant-switcher.tsx` (UI)
- `app/[tenant-slug]/layout.tsx` (role/tenant resolution)
- Custom Access Token Hook (`supabase/migrations/0005_custom_access_token_hook.sql`) (JWT claims)
- RLS policies across `tenants`, `campaign_metrics`, `ad_accounts`, `sync_jobs`, `daily_rollups` (all currently tenant-scoped only)

</code_context>

<specifics>
## Specific Ideas

No specific visual/UX references given beyond reusing the existing tenant-switcher pattern for consistency with how Super Admin already switches tenants.

</specifics>

<deferred>
## Deferred Ideas

- **Consolidated cross-client dashboard for Agência** (sum/aggregate metrics across all clients an agency manages) — explicitly deferred by D-01 in favor of a simple selector. Could become its own future phase if the agency workflow demands portfolio-level reporting later.

</deferred>

---

*Phase: 05-agencia-multi-cliente*
*Context gathered: 2026-07-05*
