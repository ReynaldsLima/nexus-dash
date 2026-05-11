'use client'

import { LogOut } from 'lucide-react'

import { signOut } from '@/lib/actions/auth'
import { Button } from '@/components/ui/button'

export function LogoutButton() {
  return (
    <form action={signOut}>
      <Button
        type="submit"
        variant="ghost"
        className="h-11 gap-2"
        aria-label="Sair da conta"
      >
        <LogOut size={16} aria-hidden="true" />
        <span className="hidden sm:inline text-sm font-semibold">Sair</span>
      </Button>
    </form>
  )
}
