'use client'

import { useRouter } from 'next/navigation'
import { ChevronDown } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

export interface TenantOption {
  id: string
  name: string
  slug: string
  active: boolean
}

interface TenantSwitcherProps {
  role: 'super_admin' | 'tenant_admin' | 'viewer' | string | null
  tenants: TenantOption[]
  activeSlug: string
}

export function TenantSwitcher({ role, tenants, activeSlug }: TenantSwitcherProps) {
  const router = useRouter()
  if (role !== 'super_admin') return null

  const active = tenants.find((t) => t.slug === activeSlug)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" className="h-10 gap-2 text-sm font-semibold" />}>
        {active?.name ?? 'Selecionar tenant'}
        <ChevronDown size={14} aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Tenants</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {tenants.map((t) => (
          <DropdownMenuItem
            key={t.id}
            disabled={!t.active}
            onSelect={() => router.push(`/${t.slug}/dashboard`)}
          >
            <span className="flex-1 truncate">{t.name}</span>
            {t.slug === activeSlug ? <span className="text-xs text-muted-foreground">atual</span> : null}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push('/tenants')}>
          Gerenciar tenants…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
