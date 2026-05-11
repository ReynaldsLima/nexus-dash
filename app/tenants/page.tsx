import { Suspense } from 'react'
import { redirect } from 'next/navigation'

import { CreateTenantForm } from '@/components/tenants/create-tenant-form'
import { TenantsTable, type TenantRow } from '@/components/tenants/tenants-table'
import { Skeleton } from '@/components/ui/skeleton'
import { createClient } from '@/lib/supabase/server'

async function loadTenants(): Promise<TenantRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tenants')
    .select('id, name, slug, active')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[/tenants] load error:', error)
    return []
  }
  return data ?? []
}

export default async function TenantsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tenants = await loadTenants()

  return (
    <section className="flex flex-col gap-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold leading-tight">Tenants</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie os tenants da plataforma</p>
        </div>
        <CreateTenantForm />
      </header>
      <Suspense fallback={
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      }>
        <TenantsTable tenants={tenants} />
      </Suspense>
    </section>
  )
}
