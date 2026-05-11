-- Phase 1 — Foundation
-- Decisions implemented: D-07, D-08, D-09
-- Creates the multi-tenant data model. RLS is enabled here but policies live in 0004.

CREATE TABLE IF NOT EXISTS public.tenants (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]+$' AND char_length(slug) BETWEEN 2 AND 50),
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tenant_users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('tenant_admin', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, user_id)
);

-- Indexes for Custom Access Token Hook performance (per-login lookup must be fast)
CREATE INDEX IF NOT EXISTS idx_tenant_users_user_id ON public.tenant_users(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant_id ON public.tenant_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON public.tenants(slug) WHERE active = TRUE;

-- Enable RLS — policies created in 0004
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.tenants IS 'Phase 1 D-07: minimal tenant model (id, name, slug, active, created_at). Deactivation per D-08 is soft delete via active=false.';
COMMENT ON TABLE public.tenant_users IS 'Phase 1 D-09: associates auth.users to tenants with role. super_admin is NOT stored here (D-12).';
