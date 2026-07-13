'use client'

import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'

import { resetTenantUserPassword } from '@/lib/actions/tenants'
import { resetAgencyUserPassword } from '@/lib/actions/agencies'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

import type { ManagedUser, UserScope } from './user-scope'

interface ResetUserPasswordDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  user: ManagedUser
  scope: UserScope
}

export function ResetUserPasswordDialog({ open, onOpenChange, user, scope }: ResetUserPasswordDialogProps) {
  const [error, setError] = useState<string | null>(null)
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()

  function reset() {
    setError(null)
    setTempPassword(null)
    setCopied(false)
  }

  function handleOpenChange(v: boolean) {
    onOpenChange(v)
    if (!v) reset()
  }

  function handleConfirm() {
    setError(null)
    startTransition(async () => {
      const result =
        scope.type === 'tenant'
          ? await resetTenantUserPassword({ userId: user.id, tenantId: scope.tenantId })
          : await resetAgencyUserPassword({ userId: user.id, agencyId: scope.agencyId })

      if ('error' in result) {
        setError(result.error)
      } else {
        setTempPassword(result.tempPassword)
      }
    })
  }

  async function handleCopy() {
    if (!tempPassword) return
    try {
      await navigator.clipboard.writeText(tempPassword)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        {tempPassword ? (
          <>
            <DialogHeader>
              <DialogTitle>Senha redefinida</DialogTitle>
              <DialogDescription>
                Comunique a nova senha temporária para <strong>{user.email}</strong>. Ela será exibida apenas uma vez.
              </DialogDescription>
            </DialogHeader>
            <div role="status" className="space-y-2">
              <Label className="text-sm font-semibold">
                Senha temporária (copiar e comunicar ao usuário):
              </Label>
              <code className="block rounded bg-muted p-3 font-mono text-sm break-all">
                {tempPassword}
              </code>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => handleOpenChange(false)}>Fechar</Button>
              <Button onClick={handleCopy}>{copied ? 'Copiado!' : 'Copiar senha'}</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Resetar senha</DialogTitle>
              <DialogDescription>
                Uma nova senha temporária será gerada e exibida uma única vez. Comunique-a ao usuário.
              </DialogDescription>
            </DialogHeader>
            {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)} disabled={isPending}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleConfirm} disabled={isPending}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Resetar senha'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
