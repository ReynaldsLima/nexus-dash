import Link from 'next/link'
import { redirect } from 'next/navigation'

import { HeaderActions } from '@/components/layout/header-actions'
import { SidebarNav } from '@/components/layout/sidebar-nav'
import { type TenantOption } from '@/components/tenants/tenant-switcher'
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
      <header className="h-14 w-full bg-card border-b border-border flex-shrink-0 flex items-center justify-between px-6 z-40">
        <Link href="/" className="flex items-center gap-1.5 text-sm font-semibold tracking-tight" style={{ fontFamily: 'var(--font-syne)' }}>
          NEXUS<span className="logo-dot" />DASH
        </Link>
        <HeaderActions role={role} tenants={tenants} activeSlug={urlSlug} />
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-56 flex-shrink-0 border-r border-border bg-sidebar overflow-y-auto">
          <SidebarNav slug={urlSlug} />
        </aside>
        <main className="flex-1 overflow-y-auto">
          <div className="px-8 py-8">{children}</div>
        </main>
      </div>
    </div>
  )
}
