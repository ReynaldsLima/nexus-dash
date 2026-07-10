import Link from 'next/link'
import { redirect } from 'next/navigation'

import { LogoutButton } from '@/components/auth/logout-button'
import { createClient } from '@/lib/supabase/server'

export default async function AgenciaLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const role = (user.app_metadata?.role as string | null) ?? null
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
