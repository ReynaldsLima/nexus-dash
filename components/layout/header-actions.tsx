'use client'

import { TenantSwitcher, type TenantOption } from '@/components/tenants/tenant-switcher'
import { DateRangePicker } from '@/components/dashboard/date-range-picker'
import { LogoutButton } from '@/components/auth/logout-button'

type HeaderActionsProps = {
  role: string | null
  tenants: TenantOption[]
  activeSlug: string
  manageHref?: string
  manageLabel?: string
}

export function HeaderActions({ role, tenants, activeSlug, manageHref, manageLabel }: HeaderActionsProps) {
  return (
    <div className="flex items-center gap-2">
      <DateRangePicker />
      <TenantSwitcher role={role} tenants={tenants} activeSlug={activeSlug} manageHref={manageHref} manageLabel={manageLabel} />
      <LogoutButton />
    </div>
  )
}
