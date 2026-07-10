import { Suspense } from 'react'
import { redirect } from 'next/navigation'

import { CreateAgencyForm } from '@/components/agencies/create-agency-form'
import { AgenciesTable, type AgencyRow } from '@/components/agencies/agencies-table'
import { Skeleton } from '@/components/ui/skeleton'
import { createClient } from '@/lib/supabase/server'

async function loadAgencies(): Promise<AgencyRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('agencies')
    .select('id, name, active')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[/agencies] load error:', error)
    return []
  }
  return data ?? []
}

export default async function AgenciesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const agencies = await loadAgencies()

  return (
    <section className="flex flex-col gap-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold leading-tight">Agências</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie as agências e seus clientes vinculados</p>
        </div>
        <CreateAgencyForm />
      </header>
      <Suspense fallback={
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      }>
        <AgenciesTable agencies={agencies} />
      </Suspense>
    </section>
  )
}
