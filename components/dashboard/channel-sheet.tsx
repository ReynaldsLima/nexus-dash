'use client'

import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { useCampaignsData } from '@/lib/hooks/use-campaigns-data'
import { groupCampaignMetrics } from '@/lib/campaign-aggregation'
import type { AggregatedCampaign } from '@/lib/campaign-aggregation'
import { brl, num } from '@/lib/formatters'
import type { DailyRollupRow } from '@/lib/hooks/use-dashboard-data'

// ─── Lookup maps ──────────────────────────────────────────────────────────────

const CHANNEL_DB_KEY: Record<'Google Ads' | 'Meta Ads', 'google_ads' | 'meta_ads'> = {
  'Google Ads': 'google_ads',
  'Meta Ads': 'meta_ads',
}

const CHART_COLOR: Record<'Google Ads' | 'Meta Ads', string> = {
  'Google Ads': 'var(--chart-1)',
  'Meta Ads': 'var(--chart-2)',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

// TODO: extract to shared when refactoring Phase 3 components
function ChannelBadge({ channel }: { channel: 'google_ads' | 'meta_ads' }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-1 text-[11px] font-medium whitespace-nowrap"
      style={
        channel === 'google_ads'
          ? { background: 'oklch(0.60 0.22 258 / 0.15)', color: 'oklch(0.72 0.16 258)' }
          : { background: 'oklch(0.68 0.20 305 / 0.15)', color: 'oklch(0.75 0.16 305)' }
      }
    >
      {channel === 'google_ads' ? 'Google Ads' : 'Meta Ads'}
    </span>
  )
}

function StatusDot({ status }: { status: 'active' | 'paused' }) {
  return (
    <span
      className="size-1.5 rounded-full flex-shrink-0"
      style={{ background: status === 'active' ? 'oklch(0.75 0.18 155)' : 'oklch(0.556 0 0)' }}
      aria-hidden="true"
    />
  )
}

// TODO: extract to shared when refactoring Phase 3 components
type TotalsRowProps = { label: string; value: string }

function TotalsRow({ label, value }: TotalsRowProps) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  )
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function formatDateLabel(dateStr: string): string {
  const [, month, day] = dateStr.split('-')
  return `${day}/${month}`
}

// ─── ChannelSheet ─────────────────────────────────────────────────────────────

type ChannelSheetProps = {
  channel: 'Google Ads' | 'Meta Ads' | null
  channelRows: DailyRollupRow[]
  tenantSlug: string
  onClose: () => void
}

export function ChannelSheet({ channel, channelRows, tenantSlug, onClose }: ChannelSheetProps) {
  const { data: rawRows, isLoading: campaignsLoading, isError: campaignsError } = useCampaignsData(tenantSlug)

  // Aggregate and filter campaigns for the selected channel
  const channelKey = channel ? CHANNEL_DB_KEY[channel] : null
  const topCampaigns: AggregatedCampaign[] = channel
    ? groupCampaignMetrics(rawRows ?? [])
        .filter((c) => c.channel === channelKey)
        .sort((a, b) => b.spend - a.spend)
        .slice(0, 5)
    : []

  // Spend chart data from channelRows
  const spendData = channelRows
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((row) => ({
      date: formatDateLabel(row.date),
      spend: Number(row.total_spend),
    }))

  // Aggregated metrics from channelRows
  const totalImpressions = channelRows.reduce((s, r) => s + Number(r.total_impressions), 0)
  const totalClicks      = channelRows.reduce((s, r) => s + Number(r.total_clicks), 0)
  const totalSpend       = channelRows.reduce((s, r) => s + Number(r.total_spend), 0)
  const totalConversions = channelRows.reduce((s, r) => s + Number(r.total_conversions), 0)
  const totalConvValue   = channelRows.reduce((s, r) => s + Number(r.total_conv_value), 0)
  const ctr  = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
  const roas = totalSpend > 0 ? totalConvValue / totalSpend : 0

  // Dynamic chart config based on channel
  const spendConfig = channel
    ? { spend: { label: 'Gasto', color: CHART_COLOR[channel] } }
    : {}

  return (
    <Sheet
      open={!!channel}
      onOpenChange={(open, eventDetails) => {
        if (!open && eventDetails?.reason === 'outside-press') return
        if (!open) onClose()
      }}
      disablePointerDismissal
    >
      <SheetContent side="right" className="w-[520px] sm:max-w-[520px] overflow-y-auto">
        {channel && (
          <>
            {/* ── Header ── */}
            <SheetHeader className="pb-4 border-b border-border">
              <SheetTitle className="text-base font-medium leading-tight pr-8">
                {channel}
              </SheetTitle>
              <div className="flex items-center gap-2 mt-1">
                <ChannelBadge channel={CHANNEL_DB_KEY[channel]} />
                <span className="text-xs text-muted-foreground">
                  {brl(totalSpend)} no período
                </span>
              </div>
            </SheetHeader>

            {/* ── Seção 1: Gasto no Período ── */}
            <div className="px-4 pt-4">
              <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">
                GASTO NO PERÍODO
              </p>

              {channelRows.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">
                  Sem dados para {channel} no período selecionado.
                  <br />
                  <span className="text-xs">
                    Selecione outro período no date range picker ou verifique se o sync foi executado.
                  </span>
                </p>
              ) : (
                <ChartContainer config={spendConfig} className="h-44 w-full">
                  <AreaChart
                    data={spendData}
                    margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
                  >
                    <defs>
                      <linearGradient id="gChannelSpend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={CHART_COLOR[channel]} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={CHART_COLOR[channel]} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--border)"
                      strokeOpacity={0.5}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis hide />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value) => brl(Number(value))}
                        />
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="spend"
                      stroke={CHART_COLOR[channel]}
                      fill="url(#gChannelSpend)"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 3, strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ChartContainer>
              )}
            </div>

            {/* ── Seção 2: Métricas do Canal ── */}
            <div className="px-4 pt-6">
              <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">
                MÉTRICAS DO CANAL
              </p>
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="px-3 py-1">
                  <TotalsRow label="Impressões"  value={num(totalImpressions)} />
                  <TotalsRow label="Cliques"     value={num(totalClicks)} />
                  <TotalsRow label="CTR"         value={`${ctr.toFixed(2)}%`} />
                  <TotalsRow label="Gasto"       value={brl(totalSpend)} />
                  <TotalsRow label="Conversões"  value={num(totalConversions)} />
                  <TotalsRow label="ROAS"        value={roas > 0 ? `${roas.toFixed(2)}×` : '—'} />
                </div>
              </div>
            </div>

            {/* ── Seção 3: Top Campanhas ── */}
            <div className="px-4 pt-6 pb-6">
              <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">
                TOP CAMPANHAS
              </p>

              {campaignsLoading ? (
                <div aria-busy="true" aria-label="Carregando campanhas">
                  <Skeleton className="h-12 w-full rounded-md mb-2" />
                  <Skeleton className="h-12 w-full rounded-md mb-2" />
                  <Skeleton className="h-12 w-full rounded-md mb-2" />
                </div>
              ) : campaignsError ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Erro ao carregar campanhas. Tente recarregar a página.
                </p>
              ) : topCampaigns.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Nenhuma campanha encontrada para este canal no período.
                </p>
              ) : (
                <div>
                  {topCampaigns.map((campaign) => (
                    <div
                      key={campaign.id}
                      className="py-2 border-b border-border/50 last:border-0 flex items-start justify-between"
                    >
                      <div className="flex items-start gap-1.5 min-w-0 flex-1">
                        <StatusDot status={campaign.status} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate max-w-[60%]">
                            {campaign.name}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <ChannelBadge channel={campaign.channel} />
                            <span className="text-xs text-muted-foreground">
                              ROAS: {campaign.roas > 0 ? `${campaign.roas.toFixed(2)}×` : '—'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <span className="text-sm tabular-nums font-medium text-right ml-2 flex-shrink-0">
                        {brl(campaign.spend)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
