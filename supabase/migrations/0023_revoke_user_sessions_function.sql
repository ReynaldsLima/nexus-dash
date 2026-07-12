-- supabase/migrations/0023_revoke_user_sessions_function.sql
-- Phase 10 (USER-05): admin.signOut(jwt, scope) requires the TARGET user's own JWT, which a
-- Super Admin removing someone else's access never has. This function lets service_role revoke
-- a specific user's sessions by ID instead. Deleting auth.sessions cascades to
-- auth.refresh_tokens (session_id FK), preventing that user from minting a new access token.
-- Does NOT invalidate an already-issued, unexpired access token (stateless JWT — see 10-RESEARCH.md Pitfall 2).
--
-- Cascade FK confirmed live (2026-07-12) via `supabase db query --linked` against pg_constraint:
--   refresh_tokens_session_id_fkey: FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE
-- A single DELETE FROM auth.sessions is therefore sufficient — no second DELETE needed.
CREATE OR REPLACE FUNCTION public.revoke_user_sessions(target_user_id UUID)
RETURNS VOID
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public, auth
AS $$
  DELETE FROM auth.sessions WHERE user_id = target_user_id;
$$;

REVOKE ALL ON FUNCTION public.revoke_user_sessions(UUID) FROM authenticated, anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_user_sessions(UUID) TO service_role;
