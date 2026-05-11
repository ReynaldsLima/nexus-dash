'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { deactivateTenant, reactivateTenant } from '@/lib/actions/tenants'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

interface DeactivateTenantButtonProps {
  tenantId: string
  tenantName: string
  active: boolean
}

export function DeactivateTenantButton({ tenantId, tenantName, active }: DeactivateTenantButtonProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleConfirm() {
    setError(null)
    startTransition(async () => {
      const result = active
        ? await deactivateTenant(tenantId)
        : await reactivateTenant(tenantId)
      if ('error' in result) {
        setError(result.error)
      } else {
        router.refresh()
      }
    })
  }

  if (!active) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="default" disabled={isPending} onClick={handleConfirm}>
          Reativar tenant
        </Button>
        {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <AlertDialog>
        <AlertDialogTrigger render={<Button variant="destructive" disabled={isPending} />}>
          Desativar tenant
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar tenant?</AlertDialogTitle>
            <AlertDialogDescription>
              O tenant &quot;{tenantName}&quot; e todos os seus usuários perderão acesso imediatamente. Esta ação pode ser revertida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>Sim, desativar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
