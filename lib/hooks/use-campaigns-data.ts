'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useDateRangeStore } from '@/lib/stores/date-range'
import type { CampaignMetricRow } from '@/lib/campaign-aggregation'

const toDateStr = (d: Date): string => d.toISOString().split('T')[0]

/**
 * useCampaignsData — fetches all campaign_metrics rows for the active tenant
 * within the global date range. Tenant isolation via RLS (JWT-based get_tenant_id()).
 * Returns raw rows; caller aggregates with groupCampaignMetrics() (Plan 01).
 */
export function useCampaignsData(tenantSlug: string) {
  const { from, to } = useDateRangeStore()

  return useQuery<CampaignMetricRow[]>({
    queryKey: ['campaigns', tenantSlug, from.toISOString(), to.toISOString()],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('campaign_metrics')
        .select(
          'campaign_id,campaign_name,channel,status,date,impressions,clicks,spend,conversions,conversion_value'
        )
        .gte('date', toDateStr(from))
        .lte('date', toDateStr(to))

      if (error) throw error
      return (data ?? []) as CampaignMetricRow[]
    },
    enabled: !!tenantSlug,
  })
}

/**
 * useCampaignTimeseries — fetches campaign_metrics rows for a single campaign
 * within the global date range, ordered by date ascending (for trend charts).
 * Only fires when a campaignId is selected (enabled guard).
 */
export function useCampaignTimeseries(
  tenantSlug: string,
  campaignId: string | null
) {
  const { from, to } = useDateRangeStore()

  return useQuery<CampaignMetricRow[]>({
    queryKey: [
      'campaign-ts',
      tenantSlug,
      campaignId,
      from.toISOString(),
      to.toISOString(),
    ],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('campaign_metrics')
        .select(
          'campaign_id,campaign_name,channel,status,date,impressions,clicks,spend,conversions,conversion_value'
        )
        .eq('campaign_id', campaignId!)
        .gte('date', toDateStr(from))
        .lte('date', toDateStr(to))
        .order('date', { ascending: true })

      if (error) throw error
      return (data ?? []) as CampaignMetricRow[]
    },
    enabled: !!tenantSlug && !!campaignId,
  })
}
