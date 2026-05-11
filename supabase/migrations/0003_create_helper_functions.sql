-- Phase 1 — Foundation
-- Decision implemented: D-13 (read from JWT, no DB lookup per request)
-- These helpers MUST always be called as `(SELECT get_tenant_id())` in RLS policies (D-14).

CREATE OR REPLACE FUNCTION public.get_tenant_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NULLIF(
    current_setting('request.jwt.claims', true)::jsonb
      -> 'app_metadata'
      ->> 'tenant_id',
    ''
  )::UUID
$$;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT current_setting('request.jwt.claims', true)::jsonb
    -> 'app_metadata'
    ->> 'role'
$$;

CREATE OR REPLACE FUNCTION public.get_tenant_slug()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT current_setting('request.jwt.claims', true)::jsonb
    -> 'app_metadata'
    ->> 'tenant_slug'
$$;

-- These helpers are safe to grant to authenticated — they only read the caller's own JWT
GRANT EXECUTE ON FUNCTION public.get_tenant_id() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_tenant_slug() TO authenticated, anon;

COMMENT ON FUNCTION public.get_tenant_id IS 'Phase 1 D-13/D-14: reads tenant_id from JWT app_metadata. ALWAYS call as (SELECT get_tenant_id()) in policies to avoid 100-1000x per-row evaluation.';
COMMENT ON FUNCTION public.get_user_role IS 'Phase 1 D-13: reads role from JWT app_metadata. Returns super_admin, tenant_admin, viewer, or NULL.';
