-- Phase 1 — Foundation
-- Decisions implemented: D-08 (soft delete enforces zero access), D-14 (SELECT wrapper)
-- CRITICAL: every helper call MUST be wrapped in (SELECT ...) — see RESEARCH.md Pitfall 5

-- ------------------------------------------------------------
-- tenants table
-- ------------------------------------------------------------

-- Super Admin can do anything to tenants
CREATE POLICY tenants_super_admin_all ON public.tenants
  FOR ALL TO authenticated
  USING ((SELECT public.get_user_role()) = 'super_admin')
  WITH CHECK ((SELECT public.get_user_role()) = 'super_admin');

-- Tenant members can SELECT their own tenant — and only if active per D-08
CREATE POLICY tenants_member_select ON public.tenants
  FOR SELECT TO authenticated
  USING (
    id = (SELECT public.get_tenant_id())
    AND active = TRUE
  );

-- ------------------------------------------------------------
-- tenant_users table
-- ------------------------------------------------------------

-- Super Admin sees and writes all tenant_users
CREATE POLICY tenant_users_super_admin_all ON public.tenant_users
  FOR ALL TO authenticated
  USING ((SELECT public.get_user_role()) = 'super_admin')
  WITH CHECK ((SELECT public.get_user_role()) = 'super_admin');

-- Tenant members can SELECT rows in their own tenant only — no INSERT/UPDATE/DELETE
CREATE POLICY tenant_users_member_select ON public.tenant_users
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

-- Defense-in-depth: explicitly forbid anon role from any access
REVOKE ALL ON public.tenants FROM anon;
REVOKE ALL ON public.tenant_users FROM anon;

COMMENT ON POLICY tenants_super_admin_all ON public.tenants IS 'D-14: SELECT wrapper avoids per-row helper evaluation.';
COMMENT ON POLICY tenants_member_select ON public.tenants IS 'D-08: active=TRUE clause means soft-deleted tenants return 0 rows even to their own members.';
