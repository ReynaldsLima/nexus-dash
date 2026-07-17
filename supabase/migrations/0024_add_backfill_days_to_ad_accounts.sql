-- Phase 11 — Janela de Histórico Retroativo (SET-03/SET-04/SET-05)
-- Adds a per-account/channel backfill window used by the N8N sync workflows on the
-- FIRST sync of each ad_accounts row. Default 90 preserves the current global
-- Set Constants BACKFILL_DAYS behavior for every existing row with zero migration risk.
-- CHECK (7–365) matches the Zod validation on the connect routes and the
-- updateBackfillWindow Server Action.
ALTER TABLE public.ad_accounts
  ADD COLUMN IF NOT EXISTS backfill_days INTEGER NOT NULL DEFAULT 90
  CHECK (backfill_days BETWEEN 7 AND 365);

COMMENT ON COLUMN public.ad_accounts.backfill_days IS
  'Phase 11 SET-03/04/05: dias de histórico retroativo (7-365, default 90) puxados pelo N8N no PRIMEIRO sync desta conta/canal. Editável pós-conexão via updateBackfillWindow; não é retroativo (afeta só futuros primeiros syncs).';
