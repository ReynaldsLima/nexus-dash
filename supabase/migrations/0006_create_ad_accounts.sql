-- Phase 2 — Data Pipeline
-- Decisions implemented: D-04 (Super Admin insere via Dashboard), D-05 (tokens no Vault), D-06 (schema)
-- Per RESEARCH.md §Padrão 6, refresh_token e access_token nunca vivem em colunas em texto plano —
-- vault_secret_id aponta para vault.decrypted_secrets. refresh_token coluna existe apenas para
-- Google Ads (legacy migration path) e também deve ser movida para Vault em produção.

CREATE TABLE IF NOT EXISTS public.ad_accounts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  channel           TEXT NOT NULL CHECK (channel IN ('google_ads', 'meta_ads')),
  account_id        TEXT NOT NULL,
  vault_secret_id   UUID NOT NULL,
  refresh_token     TEXT,
  token_expires_at  TIMESTAMPTZ,
  active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_ad_accounts_tenant_channel_active
  ON public.ad_accounts(tenant_id, channel) WHERE active = TRUE;

ALTER TABLE public.ad_accounts ENABLE ROW LEVEL SECURITY;

-- Super Admin: full access
CREATE POLICY ad_accounts_super_admin_all ON public.ad_accounts
  FOR ALL TO authenticated
  USING ((SELECT public.get_user_role()) = 'super_admin')
  WITH CHECK ((SELECT public.get_user_role()) = 'super_admin');

-- Tenant members: SELECT only on own tenant — INSERT/UPDATE/DELETE bloqueado em v1 (D-04)
CREATE POLICY ad_accounts_tenant_select ON public.ad_accounts
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

REVOKE ALL ON public.ad_accounts FROM anon;

COMMENT ON TABLE public.ad_accounts IS 'Phase 2 D-04/D-05/D-06: credenciais de API por tenant. vault_secret_id referencia secret no Supabase Vault. UNIQUE(tenant_id, channel) = uma conta por canal em v1.';
COMMENT ON POLICY ad_accounts_tenant_select ON public.ad_accounts IS 'D-04: tenant_admin/viewer somente leem; gestão de credenciais é do Super Admin via Dashboard em v1.';
