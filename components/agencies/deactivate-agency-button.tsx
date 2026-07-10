'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { deactivateAgency, reactivateAgency } from '@/lib/actions/agencies'
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

interface DeactivateAgencyButtonProps {
  agencyId: string
  agencyName: string
  active: boolean
}

export function DeactivateAgencyButton({ agencyId, agencyName, active }: DeactivateAgencyButtonProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleConfirm() {
    setError(null)
    startTransition(async () => {
      const result = active
        ? await deactivateAgency(agencyId)
        : await reactivateAgency(agencyId)
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
          Reativar agência
        </Button>
        {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <AlertDialog>
        <AlertDialogTrigger render={<Button variant="destructive" disabled={isPending} />}>
          Desativar agência
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar agência?</AlertDialogTitle>
            <AlertDialogDescription>
              A agência &quot;{agencyName}&quot; e seus usuários perderão acesso a todos os clientes vinculados imediatamente. Esta ação pode ser revertida.
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
