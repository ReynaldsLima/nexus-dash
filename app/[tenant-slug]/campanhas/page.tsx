'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { ArrowUpDown, Search } from 'lucide-react'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CampaignSheet } from '@/components/campanhas/campaign-sheet'
import { useCampaignsData } from '@/lib/hooks/use-campaigns-data'
import { groupCampaignMetrics, type AggregatedCampaign } from '@/lib/campaign-aggregation'
import { brl, num } from '@/lib/formatters'

// ─── Types ────────────────────────────────────────────────────────────────────
type Channel = 'google_ads' | 'meta_ads'
type SortKey = 'spend' | 'roas' | 'cpa' | 'ctr' | 'conversions'

// ─── Sub-components ───────────────────────────────────────────────────────────
function ChannelBadge({ channel }: { channel: Channel }) {
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

function StatusDot({ status }: { status: AggregatedCampaign['status'] }) {
  return (
    <span className="flex items-center gap-1.5 text-xs">
      <span
        className="size-1.5 rounded-full"
        style={{ background: status === 'active' ? 'oklch(0.75 0.18 155)' : 'oklch(0.556 0 0)' }}
        aria-hidden="true"
      />
      <span className="text-muted-foreground capitalize">
        {status === 'active' ? 'Ativa' : 'Pausada'}
      </span>
    </span>
  )
}

function RoasValue({ value }: { value: number }) {
  const color =
    value >= 4.0
      ? 'oklch(0.75 0.18 155)'
      : value >= 2.5
        ? 'oklch(0.72 0.19 47)'
        : 'oklch(0.65 0.20 15)'
  return (
    <span className="font-semibold tabular-nums" style={{ color }}>
      {value.toFixed(2)}×
    </span>
  )
}

// ─── Table Skeleton ───────────────────────────────────────────────────────────
function TableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full rounded" />
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function CampanhasPage() {
  const params = useParams()
  const tenantSlug = params['tenant-slug'] as string

  const { data: rawRows, isLoading, isError } = useCampaignsData(tenantSlug)
  const campaigns = rawRows ? groupCampaignMetrics(rawRows) : []

  const [channelFilter, setChannelFilter] = useState<Channel | 'all'>('all')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('roas')
  const [sortAsc, setSortAsc] = useState(false)
  const [selected, setSelected] = useState<AggregatedCampaign | null>(null)

  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortAsc((v) => !v)
    else { setSortKey(key); setSortAsc(false) }
  }

  const filtered = campaigns
    .filter((c) => channelFilter === 'all' || c.channel === channelFilter)
    .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const diff = a[sortKey] - b[sortKey]
      return sortAsc ? diff : -diff
    })

  const totals = filtered.reduce(
    (acc, c) => ({
      spend: acc.spend + c.spend,
      conversions: acc.conversions + c.conversions,
      impressions: acc.impressions + c.impressions,
      clicks: acc.clicks + c.clicks,
    }),
    { spend: 0, conversions: 0, impressions: 0, clicks: 0 },
  )

  const tabs: { label: string; value: Channel | 'all' }[] = [
    { label: 'Todos', value: 'all' },
    { label: 'Google Ads', value: 'google_ads' },
    { label: 'Meta Ads', value: 'meta_ads' },
  ]

  const cols: { label: string; key?: SortKey; align?: 'right' }[] = [
    { label: 'Campanha' },
    { label: 'Canal' },
    { label: 'Status' },
    { label: 'Impressões', key: undefined, align: 'right' },
    { label: 'Cliques',    key: undefined, align: 'right' },
    { label: 'CTR',        key: 'ctr',        align: 'right' },
    { label: 'Gasto',      key: 'spend',       align: 'right' },
    { label: 'Conv.',      key: 'conversions', align: 'right' },
    { label: 'CPA',        key: 'cpa',         align: 'right' },
    { label: 'ROAS',       key: 'roas',        align: 'right' },
  ]

  return (
    <section className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Campanhas</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {isLoading
            ? 'Carregando…'
            : isError
              ? 'Erro ao carregar campanhas'
              : `${campaigns.length} campanha${campaigns.length !== 1 ? 's' : ''} no período selecionado`}
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Gasto Total',   value: isLoading ? '—' : brl(totals.spend) },
          { label: 'Impressões',    value: isLoading ? '—' : num(totals.impressions) },
          { label: 'Cliques',       value: isLoading ? '—' : num(totals.clicks) },
          { label: 'Conversões',    value: isLoading ? '—' : num(totals.conversions) },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-lg border border-border bg-card px-4 py-3"
          >
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-bold tabular-nums mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      {/* Filters + Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {/* Channel tabs (CAMP-02) */}
            <div className="flex rounded-md border border-border overflow-hidden">
              {tabs.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setChannelFilter(tab.value)}
                  className="px-3 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  style={
                    channelFilter === tab.value
                      ? { background: 'var(--sidebar-primary)', color: 'var(--sidebar-primary-foreground)' }
                      : { background: 'transparent', color: 'var(--muted-foreground)' }
                  }
                  aria-pressed={channelFilter === tab.value}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative flex-1 max-w-xs">
              <Search
                className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                type="search"
                placeholder="Buscar campanha…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-md border border-input bg-transparent pl-8 pr-3 py-1.5 text-xs placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                spellCheck={false}
                autoComplete="off"
              />
            </div>

            <span className="text-xs text-muted-foreground ml-auto">
              {isLoading ? '…' : `${filtered.length} resultado${filtered.length !== 1 ? 's' : ''}`}
            </span>
          </div>
        </CardHeader>

        <CardContent className="pt-0 overflow-x-auto">
          {isLoading ? (
            <TableSkeleton />
          ) : isError ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Erro ao carregar dados de campanhas. Tente recarregar a página.
            </p>
          ) : (
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="border-b border-border">
                  {cols.map((col) => (
                    <th
                      key={col.label}
                      className={`pb-2.5 text-xs font-medium text-muted-foreground first:pl-0 last:pr-0 px-3 ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                    >
                      {col.key ? (
                        <button
                          type="button"
                          onClick={() => handleSort(col.key!)}
                          className="inline-flex items-center gap-1 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:underline"
                          aria-label={`Ordenar por ${col.label}`}
                        >
                          {col.label}
                          <ArrowUpDown
                            className="size-3"
                            style={{ opacity: sortKey === col.key ? 1 : 0.4 }}
                            aria-hidden="true"
                          />
                        </button>
                      ) : (
                        col.label
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={cols.length} className="py-10 text-center text-sm text-muted-foreground">
                      Nenhuma campanha no período selecionado.
                    </td>
                  </tr>
                ) : (
                  filtered.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => setSelected(c)}
                      className="border-b border-border/50 last:border-0 hover:bg-accent/30 transition-colors cursor-pointer"
                    >
                      <td className="py-3 pl-0 pr-3">
                        <span className="font-medium truncate max-w-[160px] block">
                          {c.name}
                        </span>
                      </td>
                      <td className="py-3 px-3"><ChannelBadge channel={c.channel} /></td>
                      <td className="py-3 px-3"><StatusDot status={c.status} /></td>
                      <td className="py-3 px-3 text-right tabular-nums text-muted-foreground">{num(c.impressions)}</td>
                      <td className="py-3 px-3 text-right tabular-nums">{num(c.clicks)}</td>
                      <td className="py-3 px-3 text-right tabular-nums">{c.ctr.toFixed(2)}%</td>
                      <td className="py-3 px-3 text-right tabular-nums font-medium">{brl(c.spend)}</td>
                      <td className="py-3 px-3 text-right tabular-nums">{num(c.conversions)}</td>
                      <td className="py-3 px-3 text-right tabular-nums text-muted-foreground">{brl(c.cpa)}</td>
                      <td className="py-3 pr-0 pl-3 text-right"><RoasValue value={c.roas} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Drill-down Sheet (CAMP-04) — does not close on outside click (D-11) */}
      <CampaignSheet
        tenantSlug={tenantSlug}
        campaign={selected}
        onClose={() => setSelected(null)}
      />
    </section>
  )
}
