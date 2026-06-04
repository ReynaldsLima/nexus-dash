export type RollupRow = {
  total_spend: number
  total_impressions: number
  total_clicks: number
  total_conversions: number
  total_conv_value: number
}

export type AggregatedKpis = {
  spend: number
  roas: number
  cpa: number
  ctr: number
  conversions: number
  clicks: number
  impressions: number
}

export function aggregateRollups(rows: RollupRow[]): AggregatedKpis {
  const totalSpend = rows.reduce((s, r) => s + Number(r.total_spend), 0)
  const totalImpressions = rows.reduce((s, r) => s + Number(r.total_impressions), 0)
  const totalClicks = rows.reduce((s, r) => s + Number(r.total_clicks), 0)
  const totalConversions = rows.reduce((s, r) => s + Number(r.total_conversions), 0)
  const totalConvValue = rows.reduce((s, r) => s + Number(r.total_conv_value), 0)

  return {
    spend: totalSpend,
    roas: totalSpend > 0 ? totalConvValue / totalSpend : 0,
    cpa: totalConversions > 0 ? totalSpend / totalConversions : 0,
    ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
    conversions: totalConversions,
    clicks: totalClicks,
    impressions: totalImpressions,
  }
}

export function calcDelta(
  current: number,
  prior: number,
): { absolute: number; pct: number | null } {
  const absolute = current - prior
  const pct = prior > 0 ? ((current - prior) / prior) * 100 : null
  return { absolute, pct }
}

export function computePriorRange(
  from: Date,
  to: Date,
): { priorFrom: Date; priorTo: Date } {
  const durationMs = to.getTime() - from.getTime()
  const priorTo = new Date(from.getTime() - 86400000) // dia antes do período atual
  const priorFrom = new Date(priorTo.getTime() - durationMs)
  return { priorFrom, priorTo }
}

export function computeChannelSplit(
  googleSpend: number,
  metaSpend: number,
): {
  google: { value: number; pct: number }
  meta: { value: number; pct: number }
} {
  const total = googleSpend + metaSpend
  return {
    google: {
      value: googleSpend,
      pct: total > 0 ? (googleSpend / total) * 100 : 0,
    },
    meta: {
      value: metaSpend,
      pct: total > 0 ? (metaSpend / total) * 100 : 0,
    },
  }
}
