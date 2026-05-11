import Link from 'next/link'
import { redirect } from 'next/navigation'

import { LogoutButton } from '@/components/auth/logout-button'
import { createClient } from '@/lib/supabase/server'

function decodeRole(token: string | undefined): string | null {
  if (!token) return null
  try {
    const payload = token.split('.')[1]
    return (JSON.parse(Buffer.from(payload, 'base64').toString('utf8'))?.app_metadata?.role ?? null) as string | null
  } catch {
    return null
  }
}

export default async function TenantsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: { session } } = await supabase.auth.getSession()
  const role = decodeRole(session?.access_token)
  if (role !== 'super_admin') redirect('/')

  return (
    <div className="min-h-screen flex flex-col">
      <header className="h-14 w-full bg-card border-b border-border flex items-center justify-between px-6">
        <Link href="/tenants" className="text-sm font-semibold">NEXUS-DASH</Link>
        <LogoutButton />
      </header>
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8">{children}</main>
    </div>
  )
}
