'use client'

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
type KpiCardProps = {
  icon: React.ReactNode
  label: string
  value: string
  pct: number | null   // null → exibir em-dash (sem período anterior)
  positivePolarity: boolean  // true = subir é bom, false = subir é ruim
  sub?: string
}

function KpiCard({ icon, label, value, pct, positivePolarity, sub }: KpiCardProps) {
  const hasDelta = pct !== null
  const isGood = hasDelta
    ? (positivePolarity ? pct > 0 : pct < 0)
    : true  // neutro quando sem delta
  const isUp = hasDelta && pct > 0

  return (
    <Card className="relative overflow-hidden">
      <div
        className="absolute inset-x-0 top-0 h-0.5"
        style={{
          background: isGood
            ? 'linear-gradient(90deg, var(--chart-3), transparent)'
            : 'linear-gradient(90deg, var(--chart-5), transparent)',
        }}
      />
      <CardContent className="pt-5 pb-5 px-5">
        <div className="flex items-start justify-between mb-3">
          <div className="p-1.5 rounded-md bg-muted text-muted-foreground">
            {icon}
          </div>
          <span
            className="inline-flex items-center gap-0.5 text-xs font-semibold rounded-full px-2 py-0.5"
            style={{
              background: !hasDelta
                ? 'oklch(0.6 0 0 / 0.10)'
                : isGood
                  ? 'oklch(0.75 0.18 155 / 0.15)'
                  : 'oklch(0.65 0.20 15 / 0.15)',
              color: !hasDelta
                ? 'oklch(0.6 0 0)'
                : isGood
                  ? 'oklch(0.75 0.18 155)'
                  : 'oklch(0.65 0.20 15)',
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
        <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
        <p
          className="text-2xl font-bold tracking-tight tabular-nums"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {value}
        </p>
        {sub && (
          <p className="text-xs text-muted-foreground/60 mt-1">{sub}</p>
        )}
      </CardContent>
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
                >
                  <Cell fill="var(--chart-1)" />
                  <Cell fill="var(--chart-2)" />
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
    </section>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDateLabel(dateStr: string): string {
  // dateStr is ISO 'YYYY-MM-DD' — extract dd/MM without Date parsing timezone issues
  const [, month, day] = dateStr.split('-')
  return `${day}/${month}`
}
