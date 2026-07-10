import Link from 'next/link'
import { redirect } from 'next/navigation'

import { LogoutButton } from '@/components/auth/logout-button'
import { createClient } from '@/lib/supabase/server'

export default async function AgenciaLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Role MUST come from the verified JWT claims (getClaims()), not from getUser()'s
  // user.app_metadata. That field mirrors the persisted auth.users.raw_app_meta_data column,
  // which the Custom Access Token Hook never writes to — it only injects role/agency_id into
  // the JWT being minted. Reading user.app_metadata here caused every non-super_admin user
  // (whose raw_app_meta_data is empty) to resolve role=null and get redirected in a loop with
  // proxy.ts (which correctly reads the JWT). See .planning/debug/resolved/agency-app-metadata-getuser-mismatch.md.
  const { data: claimsData } = await supabase.auth.getClaims()
  const role = (claimsData?.claims?.app_metadata?.role as string | null) ?? null
  if (role !== 'agency') redirect('/')

  return (
    <div className="min-h-screen flex flex-col">
      <header className="h-14 w-full bg-card border-b border-border flex items-center justify-between px-6">
        <Link href="/agencia" className="text-sm font-semibold">NEXUS-DASH</Link>
        <LogoutButton />
      </header>
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8">{children}</main>
    </div>
  )
}
