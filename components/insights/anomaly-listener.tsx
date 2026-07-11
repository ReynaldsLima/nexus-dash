'use client'

import { useAnomalyAlerts } from '@/lib/hooks/use-anomaly-alerts'

export function AnomalyListener({ tenantId, tenantSlug }: { tenantId: string; tenantSlug: string }) {
  useAnomalyAlerts(tenantId, tenantSlug)
  return null
}
