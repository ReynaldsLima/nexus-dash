'use client'

import { useState, useTransition } from 'react'

import { grantTenant, revokeTenant } from '@/lib/actions/agencies'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

export interface GrantableTenant {
  id: string
  name: string
  slug: string
}

interface AgencyTenantGrantsProps {
  agencyId: string
  tenants: GrantableTenant[]
  initialGrantedIds: string[]
}

export function AgencyTenantGrants({ agencyId, tenants, initialGrantedIds }: AgencyTenantGrantsProps) {
  const [granted, setGranted] = useState<Set<string>>(new Set(initialGrantedIds))
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  function toggle(tenantId: string, checked: boolean) {
    setError(null)
    // Optimistic update — no confirmation dialog (05-UI-SPEC.md: one-row, instantly-reversible action)
    setGranted((prev) => {
      const next = new Set(prev)
      if (checked) next.add(tenantId)
      else next.delete(tenantId)
      return next
    })
    startTransition(async () => {
      const result = checked ? await grantTenant(agencyId, tenantId) : await revokeTenant(agencyId, tenantId)
      if ('error' in result) {
        // Revert on failure
        setGranted((prev) => {
          const next = new Set(prev)
          if (checked) next.delete(tenantId)
          else next.add(tenantId)
          return next
        })
        setError('Não foi possível atualizar o acesso. Tente novamente.')
      }
    })
  }

  if (tenants.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum tenant ativo disponível para vincular.</p>
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="divide-y divide-border rounded-md border border-border">
        {tenants.map((tenant) => (
          <div key={tenant.id} className="flex items-center gap-3 px-4 py-3">
            <Checkbox
              id={`grant-${tenant.id}`}
              checked={granted.has(tenant.id)}
              onCheckedChange={(checked) => toggle(tenant.id, checked === true)}
            />
            <Label htmlFor={`grant-${tenant.id}`} className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
              {tenant.name}
              <span className="text-xs text-muted-foreground font-mono font-normal">{tenant.slug}</span>
            </Label>
          </div>
        ))}
      </div>
      {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
