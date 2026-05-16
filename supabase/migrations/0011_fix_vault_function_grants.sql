-- Phase 2 — Data Pipeline (Fix)
-- Bug: migration 0010 fez REVOKE EXECUTE FROM PUBLIC, removendo acesso do role 'authenticator'
-- que o PostgREST usa como intermediário antes de fazer SET ROLE service_role.
-- Sem GRANT para authenticator, PostgREST não consegue chamar as funções mesmo com service_role JWT.
--
-- Fix: GRANT EXECUTE ON read_vault_secret e refresh_daily_rollups TO authenticator.
-- O authenticator ainda não pode chamar diretamente — após SET ROLE service_role é que
-- a lógica da função executa. A separação de segurança é mantida pela SECURITY DEFINER
-- e pelo check do JWT role = service_role feito pelo PostgREST antes do SET ROLE.
--
-- Referência: https://docs.postgrest.org/en/v12/references/transactions.html
-- "PostgREST connects as authenticator role, then switches to the request role via SET LOCAL ROLE"

GRANT EXECUTE ON FUNCTION public.read_vault_secret(TEXT) TO authenticator;
GRANT EXECUTE ON FUNCTION public.refresh_daily_rollups(UUID, DATE, DATE) TO authenticator;

COMMENT ON FUNCTION public.read_vault_secret(TEXT) IS 'Phase 2 D-05: lê secret do Supabase Vault. SECURITY DEFINER + GRANT service_role + authenticator (PostgREST intermediário). Threat T-2-03 mitigado por REVOKE de anon/authenticated.';
COMMENT ON FUNCTION public.refresh_daily_rollups(UUID, DATE, DATE) IS 'Phase 2 D-09/D-10: UPSERT agregado em daily_rollups. SECURITY DEFINER + GRANT service_role + authenticator (PostgREST intermediário).';
