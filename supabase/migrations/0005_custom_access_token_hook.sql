-- Phase 1 — Foundation
-- Decisions implemented: D-12 (super_admin in auth.users.app_metadata), D-13 (hook injects claims)
-- Resolves RESEARCH.md Open Question 1: tenant_slug is injected alongside tenant_id.
--
-- ACTIVATION (manual): after this migration runs, an operator MUST go to
-- Supabase Dashboard → Authentication → Hooks → Custom Access Token →
-- select `public.custom_access_token_hook`. Without this manual step the hook
-- is created but never fires (RESEARCH.md Pitfall 3 — CRITICAL).

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id     UUID;
  v_role        TEXT;
  v_tenant_id   UUID;
  v_tenant_slug TEXT;
  v_existing    TEXT;
  claims        JSONB;
BEGIN
  v_user_id := (event ->> 'user_id')::UUID;
  claims    := event -> 'claims';

  -- Ensure app_metadata key exists in claims
  IF claims -> 'app_metadata' IS NULL OR jsonb_typeof(claims -> 'app_metadata') = 'null' THEN
    claims := jsonb_set(claims, '{app_metadata}', '{}'::jsonb);
  END IF;

  -- Branch 1: user is already flagged super_admin in auth.users.app_metadata.role
  v_existing := claims -> 'app_metadata' ->> 'role';

  IF v_existing = 'super_admin' THEN
    claims := jsonb_set(claims, '{app_metadata,role}', '"super_admin"'::jsonb, true);
    claims := jsonb_set(claims, '{app_metadata,tenant_id}', 'null'::jsonb, true);
    claims := jsonb_set(claims, '{app_metadata,tenant_slug}', 'null'::jsonb, true);
  ELSE
    -- Branch 2: look up tenant membership
    SELECT tu.role, tu.tenant_id, t.slug
      INTO v_role, v_tenant_id, v_tenant_slug
      FROM public.tenant_users tu
      JOIN public.tenants t ON t.id = tu.tenant_id AND t.active = TRUE
     WHERE tu.user_id = v_user_id
     LIMIT 1;

    claims := jsonb_set(
      claims, '{app_metadata,role}',
      COALESCE(to_jsonb(v_role), '"none"'::jsonb), true
    );
    claims := jsonb_set(
      claims, '{app_metadata,tenant_id}',
      CASE WHEN v_tenant_id IS NULL THEN 'null'::jsonb ELSE to_jsonb(v_tenant_id::TEXT) END,
      true
    );
    claims := jsonb_set(
      claims, '{app_metadata,tenant_slug}',
      CASE WHEN v_tenant_slug IS NULL THEN 'null'::jsonb ELSE to_jsonb(v_tenant_slug) END,
      true
    );
  END IF;

  RETURN jsonb_set(event, '{claims}', claims, true);
END;
$$;

-- Required grants (without these, the hook cannot read tenant_users / tenants)
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, PUBLIC;

GRANT SELECT ON TABLE public.tenant_users TO supabase_auth_admin;
GRANT SELECT ON TABLE public.tenants      TO supabase_auth_admin;
REVOKE SELECT ON TABLE public.tenant_users FROM anon, PUBLIC;
REVOKE SELECT ON TABLE public.tenants      FROM anon, PUBLIC;

COMMENT ON FUNCTION public.custom_access_token_hook IS 'Phase 1 D-13: injects tenant_id, tenant_slug, role into JWT app_metadata. Must be activated in Supabase Dashboard → Authentication → Hooks.';
