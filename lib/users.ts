import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'
import type { ManagedUser } from '@/components/users/user-scope'

export type { ManagedUser }

export async function listTenantUsers(tenantId: string): Promise<ManagedUser[]> {
  const service = createServiceClient()
  const { data: links, error } = await service
    .from('tenant_users')
    .select('user_id')
    .eq('tenant_id', tenantId)

  if (error || !links) return []

  return Promise.all(
    links.map(async (l) => {
      const { data } = await service.auth.admin.getUserById(l.user_id)
      return { id: l.user_id, email: data?.user?.email ?? '(desconhecido)' }
    })
  )
}

export async function listAgencyUsers(agencyId: string): Promise<ManagedUser[]> {
  const service = createServiceClient()
  const { data: links, error } = await service
    .from('agency_users')
    .select('user_id')
    .eq('agency_id', agencyId)

  if (error || !links) return []

  return Promise.all(
    links.map(async (l) => {
      const { data } = await service.auth.admin.getUserById(l.user_id)
      return { id: l.user_id, email: data?.user?.email ?? '(desconhecido)' }
    })
  )
}
