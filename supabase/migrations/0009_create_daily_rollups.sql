-- Phase 2 — Data Pipeline
-- Decisions implemented: D-09, D-10, D-11.
-- Pré-requisito para Fase 3 (KPI cards e trend lines fazem queries diretas em daily_rollups).
-- Populated by public.refresh_daily_rollups(...) (migration 0010), chamado pelo N8N via RPC após cada sync.
-- 'all' channel = cross-channel rollup para queries que somam Google + Meta.

CREATE TABLE IF NOT EXISTS public.daily_rollups (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  channel             TEXT NOT NULL CHECK (channel IN ('google_ads', 'meta_ads', 'all')),
  date                DATE NOT NULL,
  total_spend         NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_impressions   BIGINT NOT NULL DEFAULT 0,
  total_clicks        BIGINT NOT NULL DEFAULT 0,
  total_conversions   NUMERIC(12,4) NOT NULL DEFAULT 0,
  total_conv_value    NUMERIC(12,2) NOT NULL DEFAULT 0,
  campaign_count      INTEGER NOT NULL DEFAULT 0,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, channel, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_rollups_tenant_date
  ON public.daily_rollups(tenant_id, date DESC);

ALTER TABLE public.daily_rollups ENABLE ROW LEVEL SECURITY;

CREATE POLICY daily_rollups_super_admin_all ON public.daily_rollups
  FOR ALL TO authenticated
  USING ((SELECT public.get_user_role()) = 'super_admin')
  WITH CHECK ((SELECT public.get_user_role()) = 'super_admin');

CREATE POLICY daily_rollups_tenant_select ON public.daily_rollups
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

REVOKE ALL ON public.daily_rollups FROM anon;

COMMENT ON TABLE public.daily_rollups IS 'Phase 2 D-09/D-11: agregado day-level por tenant+channel. channel="all" = cross-channel. Populated by refresh_daily_rollups RPC (Plan 03/04).';
