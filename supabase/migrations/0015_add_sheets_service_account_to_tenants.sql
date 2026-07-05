-- Phase 03.1 — Leads status write-back
-- Adiciona credencial de ESCRITA (Service Account) à tabela tenants.
-- A sheets_api_key existente (0012) permanece para LEITURA; a service account
-- é usada APENAS nas rotas de escrita (Google Sheets API v4 values.update).
-- Ver 03.1-RESEARCH.md (D-05, Pitfall 1: API key não autentica escrita).

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS sheets_service_account JSONB;

COMMENT ON COLUMN public.tenants.sheets_service_account IS
  'Google Service Account JSON (client_email + private_key) para escrita na Sheets API — server-side only, NUNCA exposto ao client, NUNCA retornado em resposta HTTP, NUNCA logado.';
