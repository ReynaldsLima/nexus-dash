-- Phase 5 — Agência (multi-client agency) access module
-- Decisions implemented: D-01 (agency has no tenant), D-04 (own identity, never in tenant_users)
-- Creates agencies / agency_users / agency_tenants tables + their own RLS + get_agency_id() helper.
-- Agency-scoped SELECT policies on EXISTING tenant-scoped tables are added separately in 0018
-- (one concern per migration, matching the 0002-vs-0004 split already established in this project).

CREATE TABLE IF NOT EXISTS public.agencies (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.agency_users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id  UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS public.agency_tenants (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id  UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  tenant_id  UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(agency_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_agency_users_agency_id ON public.agency_users(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_tenants_agency_id ON public.agency_tenants(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_tenants_tenant_id ON public.agency_tenants(tenant_id);

ALTER TABLE public.agencies       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_users   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_tenants ENABLE ROW LEVEL SECURITY;

-- get_agency_id(): parallel to get_tenant_id() (migration 0003). Reads JWT only — no table
-- access — so it is safe inside agencies/agency_tenants RLS policies without recursion risk.
CREATE OR REPLACE FUNCTION public.get_agency_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NULLIF(
    current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'agency_id',
    ''
  )::UUID
$$;

GRANT EXECUTE ON FUNCTION public.get_agency_id() TO authenticated, anon;

COMMENT ON FUNCTION public.get_agency_id IS 'Phase 5: reads agency_id from JWT app_metadata. ALWAYS call as (SELECT get_agency_id()) in RLS policies — same D-14 rule as get_tenant_id().';

CREATE POLICY agencies_super_admin_all ON public.agencies FOR ALL TO authenticated
  USING ((SELECT public.get_user_role()) = 'super_admin')
  WITH CHECK ((SELECT public.get_user_role()) = 'super_admin');

CREATE POLICY agency_users_super_admin_all ON public.agency_users FOR ALL TO authenticated
  USING ((SELECT public.get_user_role()) = 'super_admin')
  WITH CHECK ((SELECT public.get_user_role()) = 'super_admin');

CREATE POLICY agency_tenants_super_admin_all ON public.agency_tenants FOR ALL TO authenticated
  USING ((SELECT public.get_user_role()) = 'super_admin')
  WITH CHECK ((SELECT public.get_user_role()) = 'super_admin');

-- Agency members can see their own agency row + their own grants — needed by the RLS-scoped
-- loadTenantsForSwitcher query (Plan 04) and the /agencia landing page (Plan 07), neither of
-- which uses service_role.
CREATE POLICY agencies_member_select ON public.agencies FOR SELECT TO authenticated
  USING (id = (SELECT public.get_agency_id()));

CREATE POLICY agency_tenants_member_select ON public.agency_tenants FOR SELECT TO authenticated
  USING (agency_id = (SELECT public.get_agency_id()));

REVOKE ALL ON public.agencies FROM anon;
REVOKE ALL ON public.agency_users FROM anon;
REVOKE ALL ON public.agency_tenants FROM anon;

COMMENT ON TABLE public.agencies IS 'Phase 5 D-01/D-02: agency entity, no tenant of its own. Grants N Cliente tenants via agency_tenants.';
COMMENT ON TABLE public.agency_users IS 'Phase 5 D-04: associates auth.users to an agency. UNIQUE(user_id) — a user belongs to at most one agency, and is documented (not DB-enforced) as never ALSO a tenant_users row — see 05-RESEARCH.md Pitfall 4.';
COMMENT ON TABLE public.agency_tenants IS 'Phase 5 D-01/AGENCY-02: N:N grant — which Cliente tenants an agency can access.';
