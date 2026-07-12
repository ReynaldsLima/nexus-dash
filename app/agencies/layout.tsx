import Link from 'next/link'
import { redirect } from 'next/navigation'

import { LogoutButton } from '@/components/auth/logout-button'
import { createClient } from '@/lib/supabase/server'
import { Toaster } from '@/components/ui/sonner'

export default async function AgenciesLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Role MUST come from getClaims() (verified JWT claims), not getUser()'s user.app_metadata —
  // see .planning/debug/resolved/agency-app-metadata-getuser-mismatch.md.
  const { data: claimsData } = await supabase.auth.getClaims()
  const role = (claimsData?.claims?.app_metadata?.role as string | null) ?? null
  if (role !== 'super_admin') redirect('/')

  return (
    <div className="min-h-screen flex flex-col">
      <header className="h-14 w-full bg-card border-b border-border flex items-center justify-between px-6">
        <div className="flex items-center gap-6">
          <Link href="/tenants" className="text-sm font-semibold">NEXUS-DASH</Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/tenants" className="text-muted-foreground hover:text-foreground">Tenants</Link>
            <Link href="/agencies" className="font-semibold text-foreground" aria-current="page">Agências</Link>
          </nav>
        </div>
        <LogoutButton />
      </header>
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8">{children}</main>
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
    </div>
  )
}
