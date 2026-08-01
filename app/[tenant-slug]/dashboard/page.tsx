'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ArrowDownRight,
  ArrowUpRight,
  Eye,
  MousePointerClick,
  RefreshCw,
  ShoppingCart,
  Target,
  TrendingUp,
  Wallet,
} from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import { useDashboardData } from '@/lib/hooks/use-dashboard-data'
import {
  aggregateRollups,
  calcDelta,
  computeChannelSplit,
} from '@/lib/dashboard-kpis'
import { brl, num } from '@/lib/formatters'
import { ChannelSheet } from '@/components/dashboard/channel-sheet'
import { AiShortcutCard } from '@/components/dashboard/ai-shortcut-card'
import { useUserRole } from '@/lib/hooks/use-user-role'

// ─── Chart configs ────────────────────────────────────────────────────────────
const spendConfig = {
  google: { label: 'Google Ads', color: 'var(--chart-1)' },
  meta:   { label: 'Meta Ads',   color: 'var(--chart-2)' },
}

const channelConfig = {
  'Google Ads': { label: 'Google Ads', color: 'var(--chart-1)' },
  'Meta Ads':   { label: 'Meta Ads',   color: 'var(--chart-2)' },
}

// ─── KPI Card ────────────────────────────────────────────────────────────────
type KpiCategory = 'accent' | 'green' | 'blue' | 'orange'

type KpiCardProps = {
  icon: React.ReactNode
  label: string
  value: string
  pct: number | null   // null → exibir em-dash (sem período anterior)
  positivePolarity: boolean  // true = subir é bom, false = subir é ruim
  sub?: string
  category: KpiCategory
}

// Locked category map — first 4 transcribed from prototipos/nexus-dash.html lines 409-431,
// last 3 assigned in 12-03-PLAN.md. `color` tints the icon glyph + numeric value,
// `glow` feeds .kpi-glow's --kpi-glow-color, `barOpacity` matches the prototype's .kpi-bar.
const KPI_CATEGORY: Record<KpiCategory, { color: string; glow: string; barOpacity: number }> = {
  accent: { color: 'var(--primary)',    glow: 'rgba(200,255,0,.07)',  barOpacity: 0.25 },
  green:  { color: 'var(--viz-green)',  glow: 'rgba(74,222,128,.08)', barOpacity: 0.3 },
  blue:   { color: 'var(--viz-blue)',   glow: 'rgba(96,165,250,.08)', barOpacity: 0.3 },
  orange: { color: 'var(--viz-orange)', glow: 'rgba(251,146,60,.08)', barOpacity: 0.3 },
}

function KpiCard({ icon, label, value, pct, positivePolarity, sub, category }: KpiCardProps) {
  const hasDelta = pct !== null
  const isGood = hasDelta
    ? (positivePolarity ? pct > 0 : pct < 0)
    : true  // neutro quando sem delta
  const isUp = hasDelta && pct > 0
  const cat = KPI_CATEGORY[category]

  return (
    <Card
      className="kpi-glow lift hover:ring-primary/20 flex flex-col py-0"
      style={{ ['--kpi-glow-color' as string]: cat.glow }}
    >
      <CardContent className="relative pt-4 px-6 pb-0 flex-1">
        <div className="flex items-start justify-between mb-3">
          <div
            className="flex size-[30px] items-center justify-center rounded-md border border-border bg-secondary"
            style={{ color: cat.color }}
          >
            {icon}
          </div>
          <span
            className="t-label inline-flex items-center gap-0.5 rounded-full px-2 py-0.5"
            style={{
              letterSpacing: '0.04em',
              background: !hasDelta
                ? 'var(--secondary)'
                : isGood
                  ? 'rgba(74,222,128,.12)'
                  : 'rgba(248,113,113,.12)',
              color: !hasDelta
                ? 'var(--muted-foreground)'
                : isGood
                  ? 'var(--viz-green)'
                  : 'var(--viz-red)',
            }}
          >
            {hasDelta ? (
              <>
                {isUp
                  ? <ArrowUpRight className="size-3" aria-hidden="true" />
                  : <ArrowDownRight className="size-3" aria-hidden="true" />
                }
                {Math.abs(pct).toFixed(1)}%
              </>
            ) : (
              <span aria-label="sem período anterior">—</span>
            )}
          </span>
        </div>
        <p className="t-label text-muted-foreground mb-1">{label}</p>
        <p
          className="t-display tabular-nums"
          style={{ color: cat.color, fontVariantNumeric: 'tabular-nums' }}
        >
          {value}
        </p>
        {sub && (
          <p className="text-xs text-muted-foreground mt-1 mb-3">{sub}</p>
        )}
      </CardContent>
      <div
        className="h-[3px] w-full"
        style={{ background: cat.color, opacity: cat.barOpacity }}
        aria-hidden="true"
      />
    </Card>
  )
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────
function DashboardSkeleton() {
  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-8 w-32" />
      </div>
      {/* KPI grid skeletons */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      {/* Charts skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Skeleton className="lg:col-span-3 h-72 rounded-xl" />
        <Skeleton className="lg:col-span-2 h-72 rounded-xl" />
      </div>
    </section>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const params = useParams()
  const tenantSlug = params['tenant-slug'] as string

  const { data, isLoading, isError } = useDashboardData(tenantSlug)
  const { data: role } = useUserRole()
  const [selectedChannel, setSelectedChannel] = useState<'Google Ads' | 'Meta Ads' | null>(null)

  if (isLoading) return <DashboardSkeleton />

  if (isError || !data) {
    return (
      <section className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        </div>
        <Card>
          <CardContent className="pt-6 pb-6 text-center text-sm text-muted-foreground">
            Erro ao carregar dados do dashboard. Tente recarregar a página.
          </CardContent>
        </Card>
      </section>
    )
  }

  // ── Aggregate totals from channel='all' rows ──────────────────────────────
  const cur = aggregateRollups(data.current.filter((r) => r.channel === 'all'))
  const prev = aggregateRollups(data.prior.filter((r) => r.channel === 'all'))

  // ── Deltas ──────────────────────────────────────────────────────────────────
  const deltaSpend       = calcDelta(cur.spend, prev.spend)
  const deltaRoas        = calcDelta(cur.roas, prev.roas)
  const deltaCpa         = calcDelta(cur.cpa, prev.cpa)
  const deltaCtr         = calcDelta(cur.ctr, prev.ctr)
  const deltaImpressions = calcDelta(cur.impressions, prev.impressions)
  const deltaClicks      = calcDelta(cur.clicks, prev.clicks)
  const deltaConversions = calcDelta(cur.conversions, prev.conversions)

  // ── Channel split (DASH-03) ─────────────────────────────────────────────────
  const googleSpend = data.current
    .filter((r) => r.channel === 'google_ads')
    .reduce((s, r) => s + Number(r.total_spend), 0)
  const metaSpend = data.current
    .filter((r) => r.channel === 'meta_ads')
    .reduce((s, r) => s + Number(r.total_spend), 0)
  const channelSplit = computeChannelSplit(googleSpend, metaSpend)

  const channelSplitData = [
    { name: 'Google Ads', value: channelSplit.google.value, pct: channelSplit.google.pct.toFixed(1) },
    { name: 'Meta Ads',   value: channelSplit.meta.value,   pct: channelSplit.meta.pct.toFixed(1) },
  ]

  // ── Channel drill-down (GAP-03-01) ──────────────────────────────────────────
  const CHANNEL_KEY_MAP: Record<'Google Ads' | 'Meta Ads', string> = {
    'Google Ads': 'google_ads',
    'Meta Ads': 'meta_ads',
  }
  const channelKey = selectedChannel ? CHANNEL_KEY_MAP[selectedChannel] : null
  const channelRows = data.current.filter((r) => r.channel === channelKey)

  // ── Trend chart (DASH-02): pivot daily rows into { date, google, meta } ────
  const trendMap = new Map<string, { google: number; meta: number }>()
  for (const row of data.current) {
    if (row.channel !== 'google_ads' && row.channel !== 'meta_ads') continue
    const existing = trendMap.get(row.date) ?? { google: 0, meta: 0 }
    if (row.channel === 'google_ads') {
      existing.google = Number(row.total_spend)
    } else {
      existing.meta = Number(row.total_spend)
    }
    trendMap.set(row.date, existing)
  }
  const trendData = Array.from(trendMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, vals]) => ({
      date: formatDateLabel(date),
      ...vals,
    }))

  return (
    <section className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Período atual&nbsp;·&nbsp;2 canais
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground border border-border rounded-full px-3 py-1.5">
          <RefreshCw className="size-3" aria-hidden="true" />
          Dados sincronizados
        </div>
      </div>

      {/* KPI Grid — 7 cards (DASH-01) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<Wallet className="size-4" />}
          label="Gasto Total"
          value={brl(cur.spend)}
          pct={deltaSpend.pct}
          positivePolarity={false}
          sub="vs período anterior"
        />
        <KpiCard
          icon={<TrendingUp className="size-4" />}
          label="ROAS"
          value={`${cur.roas.toFixed(2)}×`}
          pct={deltaRoas.pct}
          positivePolarity={true}
          sub="retorno sobre gasto"
        />
        <KpiCard
          icon={<Target className="size-4" />}
          label="CPA"
          value={brl(cur.cpa)}
          pct={deltaCpa.pct}
          positivePolarity={false}
          sub="custo por conversão"
        />
        <KpiCard
          icon={<MousePointerClick className="size-4" />}
          label="CTR"
          value={`${cur.ctr.toFixed(2)}%`}
          pct={deltaCtr.pct}
          positivePolarity={true}
          sub="taxa de clique"
        />
        <KpiCard
          icon={<Eye className="size-4" />}
          label="Impressões"
          value={num(cur.impressions)}
          pct={deltaImpressions.pct}
          positivePolarity={true}
          sub="total de impressões"
        />
        <KpiCard
          icon={<MousePointerClick className="size-4" />}
          label="Cliques"
          value={num(cur.clicks)}
          pct={deltaClicks.pct}
          positivePolarity={true}
          sub="total de cliques"
        />
        <KpiCard
          icon={<ShoppingCart className="size-4" />}
          label="Conversões"
          value={num(cur.conversions)}
          pct={deltaConversions.pct}
          positivePolarity={true}
          sub="total de conversões"
        />
      </div>

      {/* AI on-demand shortcut (D-02) — super_admin only (AI-03) */}
      {role === 'super_admin' && <AiShortcutCard tenantSlug={tenantSlug} />}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Spend over time (DASH-02) */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Gasto por Canal — período selecionado</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ChartContainer config={spendConfig} className="h-56 w-full">
              <AreaChart
                data={trendData}
                margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
              >
                <defs>
                  <linearGradient id="gGoogle" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--chart-1)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gMeta" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--chart-2)" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0.02} />
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
                  tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                  tickLine={false}
                  axisLine={false}
                  interval={4}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `R$${(v / 1000).toFixed(1)}k`}
                  width={52}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => brl(Number(value))}
                    />
                  }
                />
                <Area
                  type="monotone"
                  dataKey="google"
                  stroke="var(--chart-1)"
                  fill="url(#gGoogle)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 3, strokeWidth: 0 }}
                />
                <Area
                  type="monotone"
                  dataKey="meta"
                  stroke="var(--chart-2)"
                  fill="url(#gMeta)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 3, strokeWidth: 0 }}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Channel split (DASH-03) */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Split por Canal</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 flex flex-col items-center gap-4">
            <ChartContainer config={channelConfig} className="h-40 w-full max-w-[180px]">
              <PieChart>
                <Pie
                  data={channelSplitData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={70}
                  stroke="none"
                  paddingAngle={3}
                  onClick={(data) => setSelectedChannel(data.name as 'Google Ads' | 'Meta Ads')}
                >
                  <Cell fill="var(--chart-1)" style={{ cursor: 'pointer' }} />
                  <Cell fill="var(--chart-2)" style={{ cursor: 'pointer' }} />
                </Pie>
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => brl(Number(value))}
                    />
                  }
                />
              </PieChart>
            </ChartContainer>

            <div className="w-full space-y-2">
              {channelSplitData.map((item, i) => (
                <div key={item.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="size-2.5 rounded-sm flex-shrink-0"
                      style={{ background: i === 0 ? 'var(--chart-1)' : 'var(--chart-2)' }}
                      aria-hidden="true"
                    />
                    <span className="text-muted-foreground">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2 tabular-nums">
                    <span className="font-medium">{brl(item.value)}</span>
                    <span className="text-muted-foreground/60">{item.pct}%</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <ChannelSheet
        channel={selectedChannel}
        channelRows={channelRows}
        tenantSlug={tenantSlug}
        onClose={() => setSelectedChannel(null)}
      />
    </section>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDateLabel(dateStr: string): string {
  // dateStr is ISO 'YYYY-MM-DD' — extract dd/MM without Date parsing timezone issues
  const [, month, day] = dateStr.split('-')
  return `${day}/${month}`
}
