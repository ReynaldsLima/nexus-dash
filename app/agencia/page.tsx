import { Suspense } from 'react'
import { redirect } from 'next/navigation'

import { AgencyClientsTable, type AgencyClientRow } from '@/components/agencies/agency-clients-table'
import { Skeleton } from '@/components/ui/skeleton'
import { createClient } from '@/lib/supabase/server'

async function loadGrantedTenants(): Promise<AgencyClientRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tenants')
    .select('id, name, slug, active')
    .order('name', { ascending: true })
  if (error || !data) return []
  return data
}

export default async function AgenciaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tenants = await loadGrantedTenants()

  return (
    <section className="flex flex-col gap-8">
      <header>
        <h1 className="text-xl font-semibold leading-tight">Meus clientes</h1>
        <p className="text-sm text-muted-foreground mt-1">Selecione um cliente para visualizar o dashboard</p>
      </header>
      <Suspense fallback={
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      }>
        <AgencyClientsTable tenants={tenants} />
      </Suspense>
    </section>
  )
}
