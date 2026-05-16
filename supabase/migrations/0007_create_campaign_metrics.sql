-- Phase 2 — Data Pipeline
-- Decisions implemented: D-01 (day-level), D-02 (tabela única com coluna channel),
-- D-03 (schema exato), SYNC-05 (attribution_window NOT NULL DEFAULT '7d_click' desde o dia 1).
-- Per RESEARCH.md Pitfall 3, '7d_click' é o default correto após mudanças Meta de jan/2026.

CREATE TABLE IF NOT EXISTS public.campaign_metrics (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  campaign_id        TEXT NOT NULL,
  campaign_name      TEXT NOT NULL,
  channel            TEXT NOT NULL CHECK (channel IN ('google_ads', 'meta_ads')),
  date               DATE NOT NULL,
  impressions        BIGINT NOT NULL DEFAULT 0,
  clicks             BIGINT NOT NULL DEFAULT 0,
  spend              NUMERIC(12,2) NOT NULL DEFAULT 0,
  conversions        NUMERIC(12,4) NOT NULL DEFAULT 0,
  conversion_value   NUMERIC(12,2) NOT NULL DEFAULT 0,
  status             TEXT,
  ad_group_id        TEXT,
  attribution_window TEXT NOT NULL DEFAULT '7d_click',
  synced_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, campaign_id, channel, date)
);

-- Indexes for Phase 3 dashboard queries
CREATE INDEX IF NOT EXISTS idx_campaign_metrics_tenant_date
  ON public.campaign_metrics(tenant_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_metrics_tenant_channel_date
  ON public.campaign_metrics(tenant_id, channel, date DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_metrics_campaign_date
  ON public.campaign_metrics(campaign_id, date DESC);

ALTER TABLE public.campaign_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY campaign_metrics_super_admin_all ON public.campaign_metrics
  FOR ALL TO authenticated
  USING ((SELECT public.get_user_role()) = 'super_admin')
  WITH CHECK ((SELECT public.get_user_role()) = 'super_admin');

CREATE POLICY campaign_metrics_tenant_select ON public.campaign_metrics
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

REVOKE ALL ON public.campaign_metrics FROM anon;

COMMENT ON TABLE public.campaign_metrics IS 'Phase 2 D-01/D-02/D-03 SYNC-05: day-level métricas unificadas. attribution_window NOT NULL DEFAULT 7d_click desde dia 1.';
COMMENT ON COLUMN public.campaign_metrics.attribution_window IS 'SYNC-05: nunca NULL. Default 7d_click (Meta post jan/2026 changes; Google Ads default).';
COMMENT ON COLUMN public.campaign_metrics.spend IS 'Em moeda real (já dividido por 1.000.000 quando vem de Google Ads cost_micros — ver Pitfall 5).';
