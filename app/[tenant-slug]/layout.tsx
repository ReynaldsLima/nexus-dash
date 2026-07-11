import Link from 'next/link'
import { redirect } from 'next/navigation'

import { HeaderActions } from '@/components/layout/header-actions'
import { SidebarNav } from '@/components/layout/sidebar-nav'
import { type TenantOption } from '@/components/tenants/tenant-switcher'
import { createClient } from '@/lib/supabase/server'
import { Toaster } from '@/components/ui/sonner'
import { AnomalyListener } from '@/components/insights/anomaly-listener'

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

  // Role MUST come from getClaims() (verified JWT claims), not getUser()'s user.app_metadata.
  // user.app_metadata mirrors the persisted auth.users.raw_app_meta_data column, which the
  // Custom Access Token Hook never writes to — it only injects role/tenant_id/tenant_slug/
  // agency_id into the JWT being minted at sign-in. That column is empty for every user created
  // via admin.createUser() in lib/actions/tenants.ts / agencies.ts, so user.app_metadata.role was
  // always null here for every non-super_admin user. getClaims() verifies and reads the same
  // live JWT that get_user_role()/RLS policies already use. See
  // .planning/debug/resolved/agency-app-metadata-getuser-mismatch.md.
  const { data: claimsData } = await supabase.auth.getClaims()
  const role = (claimsData?.claims?.app_metadata?.role as string | null) ?? null

  // Live, RLS-scoped existence check — replaces the old JWT string-equality guard, which
  // structurally cannot express "member of a set of tenants" (agency) and never re-verified
  // `active` status for a Cliente whose tenant was deactivated after login.
  let tenantId: string | null = null
  if (role !== 'super_admin') {
    const { data: tenantRow } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', urlSlug)
      .eq('active', true)
      .maybeSingle()
    if (!tenantRow) redirect('/')
    tenantId = tenantRow.id
  } else {
    // anomaly_alerts is super_admin-only (RLS); resolve the active tenant's id for the
    // Realtime filter used by AnomalyListener.
    const { data: tenantRow2 } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', urlSlug)
      .maybeSingle()
    tenantId = tenantRow2?.id ?? null
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

      <Toaster
        theme="dark"
        position="top-right"
        richColors={false}
        closeButton
        style={{
          '--normal-bg': 'var(--card)',
          '--normal-border': 'var(--border)',
          '--normal-text': 'var(--foreground)',
        } as React.CSSProperties}
      />
      {role === 'super_admin' && tenantId && (
        <AnomalyListener tenantId={tenantId} tenantSlug={urlSlug} />
      )}
    </div>
  )
}
