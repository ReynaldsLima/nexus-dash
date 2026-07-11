-- Phase 4 — Anomaly Alerts (AI-04)
-- N8N inserts a row here when a campaign's ROAS drops >20% within 24h (D-05). Supabase Realtime
-- (postgres_changes) delivers the INSERT to the super_admin frontend with no page refresh (D-04).
-- RLS: super_admin ONLY (matches ai_insights). REVOKE from anon.
-- The ALTER PUBLICATION line is MANDATORY — a CREATE TABLE + RLS alone does NOT enable Realtime
-- (04-RESEARCH.md Pitfall 2). Placed in the migration (not a Dashboard toggle) so it survives the
-- shared staging/prod project resets (STATE.md).

CREATE TABLE IF NOT EXISTS public.anomaly_alerts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  campaign_id   TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  channel       TEXT NOT NULL CHECK (channel IN ('google_ads', 'meta_ads')),
  metric        TEXT NOT NULL DEFAULT 'roas',
  drop_pct      NUMERIC(6,2) NOT NULL,
  window_hours  INTEGER NOT NULL DEFAULT 24,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anomaly_alerts_tenant_created
  ON public.anomaly_alerts(tenant_id, created_at DESC);

ALTER TABLE public.anomaly_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY anomaly_alerts_super_admin_all ON public.anomaly_alerts
  FOR ALL TO authenticated
  USING ((SELECT public.get_user_role()) = 'super_admin')
  WITH CHECK ((SELECT public.get_user_role()) = 'super_admin');

REVOKE ALL ON public.anomaly_alerts FROM anon;

ALTER PUBLICATION supabase_realtime ADD TABLE public.anomaly_alerts;

COMMENT ON TABLE public.anomaly_alerts IS 'Phase 4 AI-04: ROAS-drop anomalies inserted by N8N, delivered via Supabase Realtime. super_admin-only RLS. Member of supabase_realtime publication.';
