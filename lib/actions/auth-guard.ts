import { createClient } from '@/lib/supabase/server'

export type GuardResult = { ok: true } | { error: string }

/**
 * Phase 10: re-verify the caller is super_admin INSIDE each sensitive Server Action.
 * MUST use the user-session client (createClient) — get_user_role() reads request.jwt.claims,
 * which PostgREST only populates from the caller's own JWT. Calling it via the service client
 * returns NULL and would make the gate reject everyone (10-RESEARCH.md anti-pattern).
 */
export async function requireSuperAdmin(): Promise<GuardResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }
  const { data: role, error } = await supabase.rpc('get_user_role')
  if (error || role !== 'super_admin') {
    return { error: 'Apenas super_admin pode executar esta ação.' }
  }
  return { ok: true }
}
