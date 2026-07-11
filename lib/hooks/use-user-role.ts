'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

/**
 * Client-side role lookup (mirrors the `get_user_role()` RPC already used server-side in
 * app/api/insights/generate/route.ts). Used to gate UI surfaces — e.g. AI Insights (AI-03:
 * super_admin only) — for client components rendered as page children, which cannot receive
 * the `role` prop TenantLayout already resolves via getClaims() for SidebarNav/HeaderActions.
 *
 * NOTE: this is a UX/visibility gate only. Actual data access is enforced server-side by RLS
 * and route auth checks regardless of what this hook returns.
 */
async function fetchUserRole(): Promise<string | null> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('get_user_role')
  if (error) return null
  return (data as string | null) ?? null
}

export function useUserRole() {
  return useQuery<string | null>({
    queryKey: ['user-role'],
    queryFn: fetchUserRole,
    staleTime: Infinity,
  })
}
