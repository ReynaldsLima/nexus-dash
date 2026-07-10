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

  // Read claims from server-verified app_metadata instead of decoding the raw JWT cookie.
  // getUser() validates the token server-side; app_metadata is populated by that verified token.
  const role = (user.app_metadata?.role as string | null) ?? null

  // Live, RLS-scoped existence check — replaces the old JWT string-equality guard, which
  // structurally cannot express "member of a set of tenants" (agency) and never re-verified
  // `active` status for a Cliente whose tenant was deactivated after login.
  if (role !== 'super_admin') {
    const { data: tenantRow } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', urlSlug)
      .eq('active', true)
      .maybeSingle()
    if (!tenantRow) redirect('/')
  }

  const tenants = (role === 'super_admin' || role === 'agency') ? await loadTenantsForSwitcher() : []

  const manageHref = role === 'agency' ? '/agencia' : '/tenants'
  const manageLabel = role === 'agency' ? 'Gerenciar clientes…' : 'Gerenciar tenants…'

  return (
    <div className="min-h-screen flex flex-col">
      <header className="h-14 w-full bg-card border-b border-border flex-shrink-0 flex items-center justify-between px-6 z-40">
        <Link href="/" className="flex items-center gap-1.5 text-sm font-semibold tracking-tight" style={{ fontFamily: 'var(--font-syne)' }}>
          NEXUS<span className="logo-dot" />DASH
        </Link>
        <HeaderActions role={role} tenants={tenants} activeSlug={urlSlug} manageHref={manageHref} manageLabel={manageLabel} />
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-56 flex-shrink-0 border-r border-border bg-sidebar overflow-y-auto">
          <SidebarNav slug={urlSlug} role={role} />
        </aside>
        <main className="flex-1 overflow-y-auto">
          <div className="px-8 py-8">{children}</div>
        </main>
      </div>
    </div>
  )
}
