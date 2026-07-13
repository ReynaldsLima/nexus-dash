'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { editTenantUserEmail } from '@/lib/actions/tenants'
import { editAgencyUserEmail } from '@/lib/actions/agencies'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import type { ManagedUser, UserScope } from './user-scope'

interface EditUserEmailDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  user: ManagedUser
  scope: UserScope
}

export function EditUserEmailDialog({ open, onOpenChange, user, scope }: EditUserEmailDialogProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleOpenChange(v: boolean) {
    onOpenChange(v)
    if (!v) setError(null)
  }

  async function handleSubmit(formData: FormData) {
    setError(null)
    const email = String(formData.get('email') ?? '')

    startTransition(async () => {
      const result =
        scope.type === 'tenant'
          ? await editTenantUserEmail({ userId: user.id, email, tenantId: scope.tenantId })
          : await editAgencyUserEmail({ userId: user.id, email, agencyId: scope.agencyId })

      if ('error' in result) {
        setError(result.error)
      } else {
        router.refresh()
        toast.success('E-mail atualizado')
        handleOpenChange(false)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar e-mail</DialogTitle>
          <DialogDescription>Alterar o e-mail deste usuário.</DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-user-email" className="text-sm font-semibold">E-mail</Label>
            <Input key={open ? user.id : `${user.id}-closed`} id="edit-user-email" name="email" type="email" defaultValue={user.email} required autoComplete="off" />
          </div>
          {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
