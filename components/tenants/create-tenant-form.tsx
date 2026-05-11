'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

import { createTenant } from '@/lib/actions/tenants'
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

export function CreateTenantForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await createTenant({
        name: String(formData.get('name') ?? ''),
        slug: String(formData.get('slug') ?? ''),
      })
      if ('error' in result) {
        setError(result.error)
      } else {
        setOpen(false)
        router.refresh()
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setError(null) }}>
      <DialogTrigger render={<Button variant="default" />}>
        + Novo tenant
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo tenant</DialogTitle>
          <DialogDescription>Crie um novo tenant para gerenciar campanhas.</DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tenant-name" className="text-sm font-semibold">Nome</Label>
            <Input id="tenant-name" name="name" required placeholder="Acme Corp" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tenant-slug" className="text-sm font-semibold">Slug</Label>
            <Input
              id="tenant-slug"
              name="slug"
              required
              pattern="[a-z0-9-]+"
              placeholder="acme"
              aria-describedby="slug-hint"
            />
            <p id="slug-hint" className="text-xs text-muted-foreground">
              Letras minúsculas, números e hifens (ex: acme-corp).
            </p>
          </div>
          {error ? (
            <p role="alert" className="text-xs text-destructive">{error}</p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar tenant'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
