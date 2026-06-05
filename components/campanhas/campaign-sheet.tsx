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
import { useCampaignTimeseries } from '@/lib/hooks/use-campaigns-data'
import { brl, num } from '@/lib/formatters'
import type { AggregatedCampaign } from '@/lib/campaign-aggregation'

// ─── Sub-components ───────────────────────────────────────────────────────────

function ChannelBadge({ channel }: { channel: 'google_ads' | 'meta_ads' }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap"
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
    <span className="flex items-center gap-1.5 text-xs">
      <span
        className="size-1.5 rounded-full"
        style={{ background: status === 'active' ? 'oklch(0.75 0.18 155)' : 'oklch(0.556 0 0)' }}
        aria-hidden="true"
      />
      <span className="text-muted-foreground">
        {status === 'active' ? 'Ativa' : 'Pausada'}
      </span>
    </span>
  )
}

// ─── Chart config ─────────────────────────────────────────────────────────────

const tsConfig = {
  spend: { label: 'Gasto',   color: 'var(--chart-1)' },
  roas:  { label: 'ROAS',    color: 'var(--chart-2)' },
  ctr:   { label: 'CTR (%)', color: 'var(--chart-3)' },
}

// ─── Totals row ───────────────────────────────────────────────────────────────

type TotalsRowProps = { label: string; value: string }

function TotalsRow({ label, value }: TotalsRowProps) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  )
}

// ─── CampaignSheet ────────────────────────────────────────────────────────────

type CampaignSheetProps = {
  tenantSlug: string
  campaign: AggregatedCampaign | null
  onClose: () => void
}

export function CampaignSheet({ tenantSlug, campaign, onClose }: CampaignSheetProps) {
  const { data: tsRows, isLoading: tsLoading } = useCampaignTimeseries(
    tenantSlug,
    campaign?.id ?? null
  )

  // Build per-day series for trend chart (Spend, daily ROAS, daily CTR)
  const trendData = (tsRows ?? []).map((row) => {
    const spend = Number(row.spend)
    const convValue = Number(row.conversion_value)
    const clicks = Number(row.clicks)
    const impressions = Number(row.impressions)
    const [, month, day] = row.date.split('-')
    return {
      date: `${day}/${month}`,
      spend,
      roas: spend > 0 ? convValue / spend : 0,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    }
  })

  return (
    // D-11: Sheet não fecha ao clicar fora.
    // Base UI usa disablePointerDismissal (não onPointerDownOutside do Radix).
    // Equivalente a e.preventDefault() no handler de interação externa.
    // Esc e botão X continuam fechando normalmente.
    <Sheet
      open={!!campaign}
      onOpenChange={(open, eventDetails) => {
        // Bloqueia fechamento por clique externo via preventDefault semântico
        if (!open && eventDetails?.reason === 'outside-press') {
          // disablePointerDismissal já bloqueia; esta guard é redundante mas explícita
          return
        }
        if (!open) onClose()
      }}
      disablePointerDismissal
    >
      <SheetContent side="right" className="w-[520px] sm:max-w-[520px] overflow-y-auto">
        {campaign && (
          <>
            {/* ── Header ── */}
            <SheetHeader className="pb-4 border-b border-border">
              <SheetTitle className="text-base font-semibold leading-tight pr-8">
                {campaign.name}
              </SheetTitle>
              <div className="flex items-center gap-2 mt-1">
                <ChannelBadge channel={campaign.channel} />
                <StatusDot status={campaign.status} />
              </div>
            </SheetHeader>

            {/* ── Trend Lines ── */}
            <div className="px-4 pt-4">
              <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">
                Tendência — período selecionado
              </p>

              {tsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-40 w-full rounded-lg" />
                </div>
              ) : trendData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum dado de tendência no período selecionado.
                </p>
              ) : (
                <ChartContainer config={tsConfig} className="h-44 w-full">
                  <AreaChart
                    data={trendData}
                    margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
                  >
                    <defs>
                      <linearGradient id="gSpend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="var(--chart-1)" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="gRoas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="var(--chart-2)" stopOpacity={0.28} />
                        <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="gCtr" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="var(--chart-3)" stopOpacity={0.28} />
                        <stop offset="95%" stopColor="var(--chart-3)" stopOpacity={0.02} />
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
                          formatter={(value, name) => {
                            if (name === 'spend') return brl(Number(value))
                            if (name === 'roas') return `${Number(value).toFixed(2)}×`
                            return `${Number(value).toFixed(2)}%`
                          }}
                        />
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="spend"
                      stroke="var(--chart-1)"
                      fill="url(#gSpend)"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 3, strokeWidth: 0 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="roas"
                      stroke="var(--chart-2)"
                      fill="url(#gRoas)"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 3, strokeWidth: 0 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="ctr"
                      stroke="var(--chart-3)"
                      fill="url(#gCtr)"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 3, strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ChartContainer>
              )}
            </div>

            {/* ── Aggregated Totals ── */}
            <div className="px-4 pt-5">
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                Totais agregados
              </p>
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="px-3 py-1">
                  <TotalsRow label="Impressões"      value={num(campaign.impressions)} />
                  <TotalsRow label="Cliques"         value={num(campaign.clicks)} />
                  <TotalsRow label="CTR"             value={`${campaign.ctr.toFixed(2)}%`} />
                  <TotalsRow label="Gasto"           value={brl(campaign.spend)} />
                  <TotalsRow label="Conversões"      value={num(campaign.conversions)} />
                  <TotalsRow label="Conv. Value"     value={brl(campaign.convValue)} />
                  <TotalsRow label="CPA"             value={campaign.cpa > 0 ? brl(campaign.cpa) : '—'} />
                  <TotalsRow label="ROAS"            value={campaign.roas > 0 ? `${campaign.roas.toFixed(2)}×` : '—'} />
                </div>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
