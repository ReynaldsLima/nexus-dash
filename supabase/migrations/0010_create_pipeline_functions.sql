-- Phase 2 — Data Pipeline
-- Decisions implemented: D-05 (Vault read via SECURITY DEFINER), D-10 (refresh_daily_rollups via RPC).
-- Per RESEARCH.md §Padrão 6 e §Padrão 7. Estas funções são chamadas pelo N8N via PostgREST /rpc/.
-- Threat T-2-03: read_vault_secret SÓ pode ser executada por service_role.

-- ------------------------------------------------------------
-- read_vault_secret(p_secret_name TEXT) → TEXT
-- Lê decrypted_secret do Supabase Vault. Encapsulamento necessário porque
-- vault.decrypted_secrets não é acessível via PostgREST diretamente.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.read_vault_secret(p_secret_name TEXT)
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT decrypted_secret
  FROM vault.decrypted_secrets
  WHERE name = p_secret_name
  LIMIT 1;
$$;

-- Threat T-2-03 mitigation: SOMENTE service_role pode executar
REVOKE EXECUTE ON FUNCTION public.read_vault_secret(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.read_vault_secret(TEXT) TO service_role;

COMMENT ON FUNCTION public.read_vault_secret(TEXT) IS 'Phase 2 D-05: lê secret do Supabase Vault. SECURITY DEFINER + GRANT apenas a service_role (Threat T-2-03).';

-- ------------------------------------------------------------
-- refresh_daily_rollups(p_tenant_id UUID, p_date_from DATE, p_date_to DATE) → VOID
-- UPSERT agregado em daily_rollups a partir de campaign_metrics.
-- Cria 1 linha por (channel, date) E 1 linha cross-channel ('all', date).
-- Chamado pelo N8N via POST /rest/v1/rpc/refresh_daily_rollups após cada sync bem-sucedido.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refresh_daily_rollups(
  p_tenant_id UUID,
  p_date_from DATE,
  p_date_to   DATE
)
RETURNS VOID
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.daily_rollups (
    tenant_id, channel, date,
    total_spend, total_impressions, total_clicks,
    total_conversions, total_conv_value, campaign_count,
    updated_at
  )
  SELECT
    p_tenant_id,
    channel,
    date,
    COALESCE(SUM(spend), 0),
    COALESCE(SUM(impressions), 0),
    COALESCE(SUM(clicks), 0),
    COALESCE(SUM(conversions), 0),
    COALESCE(SUM(conversion_value), 0),
    COUNT(DISTINCT campaign_id),
    NOW()
  FROM public.campaign_metrics
  WHERE tenant_id = p_tenant_id
    AND date BETWEEN p_date_from AND p_date_to
  GROUP BY channel, date

  UNION ALL

  SELECT
    p_tenant_id,
    'all',
    date,
    COALESCE(SUM(spend), 0),
    COALESCE(SUM(impressions), 0),
    COALESCE(SUM(clicks), 0),
    COALESCE(SUM(conversions), 0),
    COALESCE(SUM(conversion_value), 0),
    COUNT(DISTINCT campaign_id),
    NOW()
  FROM public.campaign_metrics
  WHERE tenant_id = p_tenant_id
    AND date BETWEEN p_date_from AND p_date_to
  GROUP BY date

  ON CONFLICT (tenant_id, channel, date) DO UPDATE SET
    total_spend       = EXCLUDED.total_spend,
    total_impressions = EXCLUDED.total_impressions,
    total_clicks      = EXCLUDED.total_clicks,
    total_conversions = EXCLUDED.total_conversions,
    total_conv_value  = EXCLUDED.total_conv_value,
    campaign_count    = EXCLUDED.campaign_count,
    updated_at        = EXCLUDED.updated_at;
$$;

REVOKE EXECUTE ON FUNCTION public.refresh_daily_rollups(UUID, DATE, DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_daily_rollups(UUID, DATE, DATE) TO service_role;

COMMENT ON FUNCTION public.refresh_daily_rollups(UUID, DATE, DATE) IS 'Phase 2 D-09/D-10: UPSERT agregado em daily_rollups (per channel + cross-channel "all"). Chamado pelo N8N via PostgREST RPC após sync.';
