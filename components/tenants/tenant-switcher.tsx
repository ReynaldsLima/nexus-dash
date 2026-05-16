'use client'

import { useRouter } from 'next/navigation'

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

  return (
    <select
      value={activeSlug}
      onChange={(e) => {
        const slug = e.target.value
        if (slug === '__manage__') router.push('/tenants')
        else router.push(`/${slug}/dashboard`)
      }}
      className="h-8 rounded-md border border-border bg-background px-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
    >
      {tenants.map((t) => (
        <option key={t.id} value={t.slug} disabled={!t.active}>
          {t.name}
        </option>
      ))}
      <option value="__manage__">Gerenciar tenants…</option>
    </select>
  )
}
