-- Phase 5 AGENCY-06 — adds a third RLS policy (_agency_select) to every currently tenant-scoped
-- table, alongside the existing _super_admin_all + _tenant_select pair (migrations 0004, 0006-0009).
-- Postgres OR-combines policies for the same command — this purely ADDS an access path, it does
-- not modify the existing two policies on any of these 5 tables.
-- Filtering direction (tenant_id IN subquery keyed on agency_id) is the fast direction per
-- Supabase RLS performance guidance — see 05-RESEARCH.md Architecture Patterns.

CREATE POLICY tenants_agency_select ON public.tenants
  FOR SELECT TO authenticated
  USING (
    active = TRUE
    AND id IN (
      SELECT agt.tenant_id FROM public.agency_tenants agt
      WHERE agt.agency_id = (SELECT public.get_agency_id())
    )
  );

CREATE POLICY campaign_metrics_agency_select ON public.campaign_metrics
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (
      SELECT agt.tenant_id FROM public.agency_tenants agt
      WHERE agt.agency_id = (SELECT public.get_agency_id())
    )
  );

CREATE POLICY ad_accounts_agency_select ON public.ad_accounts
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (
      SELECT agt.tenant_id FROM public.agency_tenants agt
      WHERE agt.agency_id = (SELECT public.get_agency_id())
    )
  );

CREATE POLICY sync_jobs_agency_select ON public.sync_jobs
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (
      SELECT agt.tenant_id FROM public.agency_tenants agt
      WHERE agt.agency_id = (SELECT public.get_agency_id())
    )
  );

CREATE POLICY daily_rollups_agency_select ON public.daily_rollups
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (
      SELECT agt.tenant_id FROM public.agency_tenants agt
      WHERE agt.agency_id = (SELECT public.get_agency_id())
    )
  );

COMMENT ON POLICY tenants_agency_select ON public.tenants IS 'Phase 5 D-01/AGENCY-06: agency members see only tenants granted via agency_tenants, and only if active — mirrors the D-08 soft-delete rule already applied in tenants_member_select.';
