import { notFound } from 'next/navigation'

import { AddAgencyUserModal } from '@/components/agencies/add-agency-user-modal'
import { DeactivateAgencyButton } from '@/components/agencies/deactivate-agency-button'
import { AgencyTenantGrants } from '@/components/agencies/agency-tenant-grants'
import { TenantStatusBadge } from '@/components/tenants/tenant-status-badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'

interface AgencyDetailProps {
  params: Promise<{ id: string }>
}

export default async function AgencyDetailPage({ params }: AgencyDetailProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: agency, error } = await supabase
    .from('agencies')
    .select('id, name, active')
    .eq('id', id)
    .maybeSingle()

  if (error || !agency) notFound()

  const { data: allTenants } = await supabase
    .from('tenants')
    .select('id, name, slug')
    .eq('active', true)
    .order('name', { ascending: true })
  const { data: grants } = await supabase
    .from('agency_tenants')
    .select('tenant_id')
    .eq('agency_id', id)
  const grantedIds = (grants ?? []).map((g) => g.tenant_id)

  return (
    <section className="flex flex-col gap-8">
      <header>
        <h1 className="text-xl font-semibold leading-tight">Detalhes da agência</h1>
        <p className="mt-1 text-sm text-muted-foreground">{agency.name}</p>
      </header>

      <Card>
        <CardHeader><CardTitle className="text-base font-semibold">Informações</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Nome</p>
              <p className="font-semibold">{agency.name}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Status</p>
              <TenantStatusBadge active={agency.active} />
            </div>
          </div>
          <div className="pt-2">
            <DeactivateAgencyButton agencyId={agency.id} agencyName={agency.name} active={agency.active} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold">Usuários</CardTitle>
          <AddAgencyUserModal agencyId={agency.id} agencyName={agency.name} />
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            A listagem de usuários é gerenciada via Supabase Dashboard em v1.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Clientes vinculados</CardTitle>
          <p className="text-sm text-muted-foreground">Marque os tenants que esta agência pode acessar.</p>
        </CardHeader>
        <CardContent>
          <AgencyTenantGrants agencyId={agency.id} tenants={allTenants ?? []} initialGrantedIds={grantedIds} />
        </CardContent>
      </Card>
    </section>
  )
}
