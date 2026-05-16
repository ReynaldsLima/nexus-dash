-- Phase 2 — Data Pipeline
-- Decisions implemented: D-07 (log de execuções), D-08 (schema exato).
-- SYNC-04: status e erros gravados aqui, Super Admin inspeciona via UI (Plan 05) e SQL.

CREATE TABLE IF NOT EXISTS public.sync_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  channel         TEXT NOT NULL CHECK (channel IN ('google_ads', 'meta_ads')),
  status          TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed')),
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  records_synced  INTEGER NOT NULL DEFAULT 0,
  date_from       DATE,
  date_to         DATE,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for "last sync per tenant/channel" query (Plan 05 UI)
CREATE INDEX IF NOT EXISTS idx_sync_jobs_tenant_channel_completed
  ON public.sync_jobs(tenant_id, channel, completed_at DESC NULLS LAST);
-- Index for Pattern 10 "detectar primeira execução"
CREATE INDEX IF NOT EXISTS idx_sync_jobs_tenant_channel_status
  ON public.sync_jobs(tenant_id, channel, status);

ALTER TABLE public.sync_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY sync_jobs_super_admin_all ON public.sync_jobs
  FOR ALL TO authenticated
  USING ((SELECT public.get_user_role()) = 'super_admin')
  WITH CHECK ((SELECT public.get_user_role()) = 'super_admin');

CREATE POLICY sync_jobs_tenant_select ON public.sync_jobs
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

REVOKE ALL ON public.sync_jobs FROM anon;

COMMENT ON TABLE public.sync_jobs IS 'Phase 2 D-07/D-08 SYNC-04: log de execuções de sync. service_role (N8N) bypassa RLS para INSERT/UPDATE.';
