-- Code review fix (Phase 03.1) — column-level exposure of sheets_service_account.
-- tenants_member_select (0004) grants row-level SELECT on tenants to ANY authenticated
-- tenant member regardless of role. sheets_service_account (0015, a write-capable Google
-- Service Account credential including its RS256 private_key) inherited that same
-- unrestricted column access, so a 'viewer' could read it directly via PostgREST,
-- bypassing the super_admin/tenant_admin application-level gate in
-- app/api/leads/[id]/status/route.ts. RLS controls row visibility, not column visibility —
-- this fix uses standard Postgres column privileges to close that gap.
--
-- sheets_service_account becomes selectable only by service_role (server-side only),
-- matching the column's existing COMMENT ("server-side only, NUNCA exposto ao client").

REVOKE SELECT ON public.tenants FROM authenticated;

GRANT SELECT (
  id,
  name,
  slug,
  active,
  created_at,
  sheet_id,
  sheets_api_key
) ON public.tenants TO authenticated;
