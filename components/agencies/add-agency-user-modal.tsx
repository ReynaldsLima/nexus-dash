'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

import { createAgencyUser } from '@/lib/actions/agencies'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface AddAgencyUserModalProps {
  agencyId: string
  agencyName: string
}

export function AddAgencyUserModal({ agencyId, agencyName }: AddAgencyUserModalProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ email: string; password: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()

  function reset() {
    setError(null)
    setSuccess(null)
    setCopied(false)
  }

  async function handleSubmit(formData: FormData) {
    setError(null)
    const email = String(formData.get('email') ?? '')

    startTransition(async () => {
      const result = await createAgencyUser({ email, agencyId })
      if ('error' in result) {
        setError(result.error)
      } else {
        setSuccess({ email, password: result.tempPassword })
        router.refresh()
      }
    })
  }

  async function handleCopy() {
    if (!success) return
    try {
      await navigator.clipboard.writeText(success.password)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) reset()
      }}
    >
      <DialogTrigger render={<Button variant="default" />}>
        + Adicionar usuário
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        {success ? (
          <>
            <DialogHeader>
              <DialogTitle>Usuário criado</DialogTitle>
              <DialogDescription>
                Comunique a senha temporária para <strong>{success.email}</strong>. Ela será exibida apenas uma vez.
              </DialogDescription>
            </DialogHeader>
            <div role="status" className="space-y-2">
              <Label className="text-sm font-semibold">
                Senha temporária (copiar e comunicar ao usuário):
              </Label>
              <code className="block rounded bg-muted p-3 font-mono text-sm break-all">
                {success.password}
              </code>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Fechar</Button>
              <Button onClick={handleCopy}>{copied ? 'Copiado!' : 'Copiar senha'}</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Adicionar usuário</DialogTitle>
              <DialogDescription>
                O usuário receberá acesso à agência <strong>{agencyName}</strong> e poderá visualizar todos os clientes vinculados a ela.
              </DialogDescription>
            </DialogHeader>
            <form action={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="agency-user-email" className="text-sm font-semibold">E-mail</Label>
                <Input id="agency-user-email" name="email" type="email" required autoComplete="off" />
              </div>
              {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar usuário'}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
