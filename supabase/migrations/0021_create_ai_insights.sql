-- Phase 4 — AI Insights (AI-01/AI-02/AI-03)
-- ai_insights stores both on-demand (source='on_demand') and daily N8N (source='daily') analyses.
-- Columns map 1:1 to the AiInsight type in lib/mock-data.ts (D-10 schema contract).
-- RLS: super_admin ONLY. AI-03 says "accessible only to Super Admin" — deliberately NO
-- tenant_select policy (unlike campaign_metrics/daily_rollups). See 04-RESEARCH.md Assumption A2.

CREATE TABLE IF NOT EXISTS public.ai_insights (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source          TEXT NOT NULL CHECK (source IN ('on_demand', 'daily')),
  type            TEXT NOT NULL CHECK (type IN ('optimization', 'alert', 'opportunity')),
  title           TEXT NOT NULL,
  summary         TEXT NOT NULL,
  metrics         JSONB NOT NULL DEFAULT '[]',
  recommendations JSONB NOT NULL DEFAULT '[]',
  impact          TEXT NOT NULL CHECK (impact IN ('high', 'medium', 'low')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_insights_tenant_created
  ON public.ai_insights(tenant_id, created_at DESC);

ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_insights_super_admin_all ON public.ai_insights
  FOR ALL TO authenticated
  USING ((SELECT public.get_user_role()) = 'super_admin')
  WITH CHECK ((SELECT public.get_user_role()) = 'super_admin');

REVOKE ALL ON public.ai_insights FROM anon;

COMMENT ON TABLE public.ai_insights IS 'Phase 4 AI-01/02/03: Claude-generated insights, on_demand or daily. super_admin-only RLS (AI-03 literal wording — no tenant_select policy by design, see 04-RESEARCH.md A2).';
