-- Phase 3 — Security fix (CR-02)
-- Migration 0013 incorrectly granted EXECUTE on create_or_update_vault_secret TO authenticator.
-- In Supabase's PostgREST stack, `authenticator` is the HTTP gateway role — granting it
-- EXECUTE on a SECURITY DEFINER Vault function means any browser client with a valid JWT
-- can call `POST /rest/v1/rpc/create_or_update_vault_secret` directly, bypassing the
-- Route Handler's authorization checks entirely.
--
-- The correct pattern for "callable only from service-role, never from browser":
--   - GRANT only to service_role
--   - Do NOT grant to authenticator
--   - The Route Handler calls via the service role client; PostgREST never reaches this function
--
-- This compensating migration revokes the authenticator grant.
-- GRANT to service_role (already present in 0013) is left untouched.

REVOKE EXECUTE ON FUNCTION public.create_or_update_vault_secret(TEXT, TEXT) FROM authenticator;

COMMENT ON FUNCTION public.create_or_update_vault_secret(TEXT, TEXT) IS
  'Phase 3 SET-02 (patched by 0014): cria ou atualiza secret no Supabase Vault. SECURITY DEFINER + GRANT apenas a service_role. Threat T-03-06 mitigado: authenticator REVOGADO para impedir chamada direta via PostgREST RPC.';
