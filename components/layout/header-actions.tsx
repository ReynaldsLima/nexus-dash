'use client'

import { TenantSwitcher, type TenantOption } from '@/components/tenants/tenant-switcher'
import { DateRangePicker } from '@/components/dashboard/date-range-picker'
import { LogoutButton } from '@/components/auth/logout-button'

type HeaderActionsProps = {
  role: string | null
  tenants: TenantOption[]
  activeSlug: string
}

export function HeaderActions({ role, tenants, activeSlug }: HeaderActionsProps) {
  return (
    <div className="flex items-center gap-2">
      <DateRangePicker />
      <TenantSwitcher role={role} tenants={tenants} activeSlug={activeSlug} />
      <LogoutButton />
    </div>
  )
}
