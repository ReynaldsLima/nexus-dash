import Link from 'next/link'
import { redirect } from 'next/navigation'

import { LogoutButton } from '@/components/auth/logout-button'
import { TenantSwitcher, type TenantOption } from '@/components/tenants/tenant-switcher'
import { createClient } from '@/lib/supabase/server'

interface TenantLayoutProps {
  children: React.ReactNode
  params: Promise<{ 'tenant-slug': string }>
}

type AppMetadata = {
  role?: 'super_admin' | 'tenant_admin' | 'viewer' | 'none' | null
  tenant_slug?: string | null
}

function decodeClaims(token: string | undefined): AppMetadata | null {
  if (!token) return null
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    return (JSON.parse(Buffer.from(payload, 'base64').toString('utf8'))?.app_metadata ?? null) as AppMetadata | null
  } catch {
    return null
  }
}

async function loadTenantsForSwitcher(): Promise<TenantOption[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tenants')
    .select('id, name, slug, active')
    .order('name', { ascending: true })
  if (error || !data) return []
  return data
}

export default async function TenantLayout({ children, params }: TenantLayoutProps) {
  const { 'tenant-slug': urlSlug } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: { session } } = await supabase.auth.getSession()
  const claims = decodeClaims(session?.access_token)
  const role = claims?.role ?? null
  const tokenSlug = claims?.tenant_slug ?? null

  if (role !== 'super_admin' && tokenSlug !== urlSlug) {
    redirect('/')
  }

  const tenants = role === 'super_admin' ? await loadTenantsForSwitcher() : []

  return (
    <div className="min-h-screen flex flex-col">
      <header className="h-14 w-full bg-card border-b border-border flex items-center justify-between px-6">
        <Link href="/" className="text-sm font-semibold">NEXUS-DASH</Link>
        <div className="flex items-center gap-2">
          <TenantSwitcher role={role} tenants={tenants} activeSlug={urlSlug} />
          <LogoutButton />
        </div>
      </header>
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8">{children}</main>
    </div>
  )
}
