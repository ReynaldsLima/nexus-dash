'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { removeTenantUserAccess } from '@/lib/actions/tenants'
import { removeAgencyUserAccess } from '@/lib/actions/agencies'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

import type { ManagedUser, UserScope } from './user-scope'

interface RemoveUserAccessDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  user: ManagedUser
  scope: UserScope
}

export function RemoveUserAccessDialog({ open, onOpenChange, user, scope }: RemoveUserAccessDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleConfirm() {
    setError(null)
    startTransition(async () => {
      const result =
        scope.type === 'tenant'
          ? await removeTenantUserAccess({ userId: user.id, tenantId: scope.tenantId })
          : await removeAgencyUserAccess({ userId: user.id, agencyId: scope.agencyId })

      if ('error' in result) {
        setError(result.error)
        toast.error(result.error)
      } else {
        onOpenChange(false)
        router.refresh()
        toast.success('Acesso removido e sessão encerrada')
      }
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remover acesso?</AlertDialogTitle>
          <AlertDialogDescription>
            O usuário perderá o acesso a {scope.label} e sua sessão será encerrada. A conta é preservada e o acesso pode ser concedido novamente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={handleConfirm} disabled={isPending}>
            Sim, remover acesso
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
