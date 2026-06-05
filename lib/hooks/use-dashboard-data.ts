'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useDateRangeStore } from '@/lib/stores/date-range'
import { computePriorRange } from '@/lib/dashboard-kpis'

// Shape of a row returned from daily_rollups for this hook
export type DailyRollupRow = {
  channel: string
  date: string
  total_spend: number
  total_impressions: number
  total_clicks: number
  total_conversions: number
  total_conv_value: number
}

export type DashboardData = {
  current: DailyRollupRow[]
  prior: DailyRollupRow[]
}

const toDateStr = (d: Date) => d.toISOString().split('T')[0]

async function fetchRollups(
  from: Date,
  to: Date,
): Promise<DailyRollupRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('daily_rollups')
    .select('channel,date,total_spend,total_impressions,total_clicks,total_conversions,total_conv_value')
    .gte('date', toDateStr(from))
    .lte('date', toDateStr(to))

  if (error) throw error
  return (data ?? []) as DailyRollupRow[]
}

export function useDashboardData(tenantSlug: string) {
  const { from, to } = useDateRangeStore()
  const { priorFrom, priorTo } = computePriorRange(from, to)

  return useQuery<DashboardData>({
    queryKey: ['dashboard', tenantSlug, from.toISOString(), to.toISOString()],
    queryFn: async () => {
      const [current, prior] = await Promise.all([
        fetchRollups(from, to),
        fetchRollups(priorFrom, priorTo),
      ])
      return { current, prior }
    },
    enabled: !!tenantSlug,
  })
}
