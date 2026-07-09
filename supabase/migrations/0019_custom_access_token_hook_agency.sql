-- Phase 5 — extends the Custom Access Token Hook (0005) with an agency membership branch.
-- Precedence: agency membership is checked BEFORE tenant_users. D-04 says a user is never in
-- both tables; this branch order is the tie-breaker if that invariant is ever violated by a
-- data-entry mistake (05-RESEARCH.md Pitfall 4). Same function name/signature as 0005 — no
-- re-selection of the hook in Supabase Dashboard is needed (only required once, at initial
-- activation, per 0005's ACTIVATION comment).

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
  v_agency_id   UUID;
  v_existing    TEXT;
  claims        JSONB;
BEGIN
  v_user_id := (event ->> 'user_id')::UUID;
  claims    := event -> 'claims';

  IF claims -> 'app_metadata' IS NULL OR jsonb_typeof(claims -> 'app_metadata') = 'null' THEN
    claims := jsonb_set(claims, '{app_metadata}', '{}'::jsonb);
  END IF;

  v_existing := claims -> 'app_metadata' ->> 'role';

  IF v_existing = 'super_admin' THEN
    claims := jsonb_set(claims, '{app_metadata,role}', '"super_admin"'::jsonb, true);
    claims := jsonb_set(claims, '{app_metadata,tenant_id}', 'null'::jsonb, true);
    claims := jsonb_set(claims, '{app_metadata,tenant_slug}', 'null'::jsonb, true);
    claims := jsonb_set(claims, '{app_metadata,agency_id}', 'null'::jsonb, true);
  ELSE
    -- Branch: agency membership (checked BEFORE tenant_users — D-04/Pitfall 4)
    SELECT au.agency_id INTO v_agency_id
      FROM public.agency_users au
      JOIN public.agencies a ON a.id = au.agency_id AND a.active = TRUE
     WHERE au.user_id = v_user_id
     LIMIT 1;

    IF v_agency_id IS NOT NULL THEN
      claims := jsonb_set(claims, '{app_metadata,role}', '"agency"'::jsonb, true);
      claims := jsonb_set(claims, '{app_metadata,agency_id}', to_jsonb(v_agency_id::TEXT), true);
      claims := jsonb_set(claims, '{app_metadata,tenant_id}', 'null'::jsonb, true);
      claims := jsonb_set(claims, '{app_metadata,tenant_slug}', 'null'::jsonb, true);
    ELSE
      -- Branch: tenant membership (unchanged from 0005), plus agency_id explicitly null
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
      claims := jsonb_set(claims, '{app_metadata,agency_id}', 'null'::jsonb, true);
    END IF;
  END IF;

  RETURN jsonb_set(event, '{claims}', claims, true);
END;
$$;

GRANT SELECT ON TABLE public.agency_users TO supabase_auth_admin;
GRANT SELECT ON TABLE public.agencies      TO supabase_auth_admin;
REVOKE SELECT ON TABLE public.agency_users FROM anon, PUBLIC;
REVOKE SELECT ON TABLE public.agencies      FROM anon, PUBLIC;

COMMENT ON FUNCTION public.custom_access_token_hook IS 'Phase 1 D-13 + Phase 5 D-04: injects tenant_id/tenant_slug/role/agency_id into JWT app_metadata. Agency branch checked before tenant_users. Hook activation in Supabase Dashboard is unaffected by this CREATE OR REPLACE (already activated in Phase 1).';
