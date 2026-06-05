-- Phase 3 — Dashboard UI / Settings
-- Plan 05: Settings page — Meta Ads connection via System User token.
-- Decisions implemented: SET-02 (token stored in Vault, not plain text column).
-- Threat T-03-01: token never in plain text; T-03-06: RPC restricted to service_role.
--
-- CONTEXT: read_vault_secret already exists (migration 0010).
-- This migration creates the complementary WRITE function.
-- vault.create_secret(secret, name) → UUID  (new secret)
-- vault.update_secret(id, secret)   → void  (update existing secret)

-- ------------------------------------------------------------
-- create_or_update_vault_secret(p_name TEXT, p_secret TEXT) → UUID
-- Grava ou atualiza um secret no Supabase Vault.
-- Retorna o UUID do secret (novo ou existente).
-- Chamado pelo Route Handler /api/meta-ads/connect via service role.
-- NUNCA deve ser executável por anon/authenticated (Threat T-03-06).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_or_update_vault_secret(
  p_name   TEXT,
  p_secret TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_id UUID;
BEGIN
  -- Check if a secret with this name already exists
  SELECT id INTO v_id
  FROM vault.secrets
  WHERE name = p_name
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    -- Secret exists — update in place (Vault encrypts the new value)
    PERFORM vault.update_secret(v_id, p_secret);
    RETURN v_id;
  ELSE
    -- Secret does not exist — create and return new UUID
    v_id := vault.create_secret(p_secret, p_name);
    RETURN v_id;
  END IF;
END;
$$;

-- Threat T-03-06 mitigation: SOMENTE service_role pode executar.
-- Igual ao padrão de read_vault_secret (migration 0010) + authenticator fix (migration 0011).
REVOKE EXECUTE ON FUNCTION public.create_or_update_vault_secret(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_or_update_vault_secret(TEXT, TEXT) TO service_role;
-- authenticator é o role intermediário do PostgREST (migration 0011 explica o motivo)
GRANT EXECUTE ON FUNCTION public.create_or_update_vault_secret(TEXT, TEXT) TO authenticator;

COMMENT ON FUNCTION public.create_or_update_vault_secret(TEXT, TEXT) IS
  'Phase 3 SET-02: cria ou atualiza secret no Supabase Vault. SECURITY DEFINER + GRANT apenas a service_role + authenticator (PostgREST intermediário). Threat T-03-06 mitigado por REVOKE de anon/authenticated.';
