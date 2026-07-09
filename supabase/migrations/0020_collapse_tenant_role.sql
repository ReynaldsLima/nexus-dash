-- Phase 5 D-03 — collapses tenant_users.role from ('tenant_admin', 'viewer') to a single
-- surviving value 'tenant_admin' (reused, not renamed — 12 files in this repo already say the
-- literal string 'tenant_admin'; see 05-RESEARCH.md Tenant Role Migration for the full list).
-- LIVE-DATA migration: promotes existing 'viewer' rows (lukseg, beta-test tenants) to full
-- 'tenant_admin' access. No tenant loses access — some rows gain scope (intentional per D-03).
--
-- Pre-migration verification (Task 1, run via `supabase db query --linked`):
--   SELECT role, count(*) FROM public.tenant_users GROUP BY role;
--   -> {tenant_admin: 1} only. No 'viewer' rows and no unexpected 3rd value present at
--   migration time (2026-07-09), so the promotive UPDATE below is a documented no-op on
--   current data but remains required to widen the CHECK constraint safely for any future rows.

UPDATE public.tenant_users SET role = 'tenant_admin' WHERE role = 'viewer';

ALTER TABLE public.tenant_users DROP CONSTRAINT tenant_users_role_check;
ALTER TABLE public.tenant_users ADD CONSTRAINT tenant_users_role_check CHECK (role = 'tenant_admin');

COMMENT ON COLUMN public.tenant_users.role IS 'Phase 5 D-03: single surviving value tenant_admin (Cliente = full access, including lead status edits). viewer no longer exists as a distinct value; historical rows were promoted, not deleted.';
