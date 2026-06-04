export type CampaignMetricRow = {
  campaign_id: string
  campaign_name: string
  channel: string
  status: string | null
  date: string
  impressions: number
  clicks: number
  spend: number
  conversions: number
  conversion_value: number
}

export type AggregatedCampaign = {
  id: string
  name: string
  channel: 'google_ads' | 'meta_ads'
  status: 'active' | 'paused'
  impressions: number
  clicks: number
  ctr: number
  spend: number
  conversions: number
  convValue: number
  cpa: number
  roas: number
}

export function groupCampaignMetrics(rows: CampaignMetricRow[]): AggregatedCampaign[] {
  if (rows.length === 0) return []

  // Agrupar linhas por campaign_id usando Map para preservar ordem de inserção
  const grouped = new Map<
    string,
    {
      name: string
      channel: string
      impressions: number
      clicks: number
      spend: number
      conversions: number
      convValue: number
      // track latest date para determinar status
      latestDate: string
      latestStatus: string | null
    }
  >()

  for (const row of rows) {
    const existing = grouped.get(row.campaign_id)
    if (!existing) {
      grouped.set(row.campaign_id, {
        name: row.campaign_name,
        channel: row.channel,
        impressions: Number(row.impressions),
        clicks: Number(row.clicks),
        spend: Number(row.spend),
        conversions: Number(row.conversions),
        convValue: Number(row.conversion_value),
        latestDate: row.date,
        latestStatus: row.status,
      })
    } else {
      existing.impressions += Number(row.impressions)
      existing.clicks += Number(row.clicks)
      existing.spend += Number(row.spend)
      existing.conversions += Number(row.conversions)
      existing.convValue += Number(row.conversion_value)

      // Atualizar status com a linha de maior date
      if (row.date > existing.latestDate) {
        existing.latestDate = row.date
        existing.latestStatus = row.status
      }
    }
  }

  return Array.from(grouped.entries()).map(([campaignId, agg]) => ({
    id: campaignId,
    name: agg.name,
    channel: agg.channel as 'google_ads' | 'meta_ads',
    status: agg.latestStatus === 'ENABLED' ? 'active' : 'paused',
    impressions: agg.impressions,
    clicks: agg.clicks,
    ctr: agg.impressions > 0 ? (agg.clicks / agg.impressions) * 100 : 0,
    spend: agg.spend,
    conversions: agg.conversions,
    convValue: agg.convValue,
    cpa: agg.conversions > 0 ? agg.spend / agg.conversions : 0,
    roas: agg.spend > 0 ? agg.convValue / agg.spend : 0,
  }))
}
