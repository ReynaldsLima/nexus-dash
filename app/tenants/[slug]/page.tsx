import { notFound } from 'next/navigation'

import { AddUserModal } from '@/components/tenants/add-user-modal'
import { DeactivateTenantButton } from '@/components/tenants/deactivate-tenant-button'
import { TenantStatusBadge } from '@/components/tenants/tenant-status-badge'
import { UsersTable } from '@/components/users/users-table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import { listTenantUsers } from '@/lib/users'

interface TenantDetailProps {
  params: Promise<{ slug: string }>
}

export default async function TenantDetailPage({ params }: TenantDetailProps) {
  const { slug } = await params

  const supabase = await createClient()
  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('id, name, slug, active')
    .eq('slug', slug)
    .maybeSingle()

  if (error || !tenant) notFound()

  const users = await listTenantUsers(tenant.id)

  return (
    <section className="flex flex-col gap-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold leading-tight">Detalhes do tenant</h1>
          <p className="mt-1 text-sm text-muted-foreground">{tenant.name}</p>
        </div>
      </header>

      <Card>
        <CardHeader><CardTitle className="text-base font-semibold">Informações</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Nome</p>
              <p className="font-semibold">{tenant.name}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Slug</p>
              <p className="font-mono text-xs">{tenant.slug}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Status</p>
              <TenantStatusBadge active={tenant.active} />
            </div>
          </div>
          <div className="pt-2">
            <DeactivateTenantButton
              tenantId={tenant.id}
              tenantName={tenant.name}
              active={tenant.active}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold">Usuários</CardTitle>
          <AddUserModal tenantId={tenant.id} tenantName={tenant.name} />
        </CardHeader>
        <CardContent>
          <UsersTable users={users} scope={{ type: 'tenant', tenantId: tenant.id, label: tenant.name }} />
        </CardContent>
      </Card>
    </section>
  )
}
