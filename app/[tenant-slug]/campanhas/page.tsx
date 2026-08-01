'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { ArrowUpDown, Search } from 'lucide-react'

import { cn } from '@/lib/utils'
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
      className="inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-[11px] font-medium whitespace-nowrap"
      style={
        channel === 'google_ads'
          ? { background: 'rgba(96,165,250,.1)', color: 'var(--viz-blue)' }
          : { background: 'rgba(167,139,250,.1)', color: 'var(--viz-purple)' }
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
        style={{ background: status === 'active' ? 'var(--viz-green)' : 'var(--muted-foreground)' }}
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
      ? 'var(--primary)'
      : value >= 2.5
        ? 'var(--viz-orange)'
        : 'var(--viz-red)'
  return (
    <span className="font-mono text-xs font-medium tabular-nums" style={{ color }}>
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
        <h1 className="t-display">Campanhas</h1>
        <p className="t-label text-muted-foreground mt-1.5">
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
            className="lift hover:border-primary/20 rounded-2xl border border-border bg-card px-5 py-4"
          >
            <p className="t-label text-muted-foreground mb-1.5">{label}</p>
            <p className="t-display tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      {/* Filters + Table */}
      <Card>
        <CardHeader className="border-b pb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {/* Channel tabs (CAMP-02) */}
            <div className="flex gap-0.5 rounded-md border border-border bg-secondary p-[3px]">
              {tabs.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setChannelFilter(tab.value)}
                  className={cn(
                    'rounded px-3 py-1 text-xs transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                    channelFilter === tab.value
                      ? 'bg-primary/10 font-medium text-primary'
                      : 'font-medium text-muted-foreground hover:bg-border hover:text-foreground',
                  )}
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
                className="input-accent w-full rounded-md border border-input bg-secondary pl-8 pr-3 py-1.5 text-xs transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                spellCheck={false}
                autoComplete="off"
              />
            </div>

            <span className="ml-auto font-mono text-[11px] whitespace-nowrap text-muted-foreground">
              {isLoading ? '…' : `${filtered.length} resultado${filtered.length !== 1 ? 's' : ''}`}
            </span>
          </div>
        </CardHeader>

        <CardContent className="overflow-x-auto px-0 pt-0">
          {isLoading ? (
            <TableSkeleton />
          ) : isError ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Erro ao carregar dados de campanhas. Tente recarregar a página.
            </p>
          ) : (
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="border-b border-border bg-secondary">
                  {cols.map((col) => (
                    <th
                      key={col.label}
                      className={cn(
                        't-label px-4 py-2.5 whitespace-nowrap text-muted-foreground first:pl-[22px] last:pr-[22px]',
                        col.align === 'right' ? 'text-right' : 'text-left',
                        sortKey === col.key && 'text-primary',
                      )}
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
                    <td colSpan={cols.length} className="px-[22px] py-10 text-center text-sm text-muted-foreground">
                      Nenhuma campanha no período selecionado.
                    </td>
                  </tr>
                ) : (
                  filtered.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => setSelected(c)}
                      className="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-secondary"
                    >
                      <td className="py-3 pr-4 pl-[22px]">
                        <span className="block max-w-[180px] truncate text-[13px] font-medium">
                          {c.name}
                        </span>
                      </td>
                      <td className="px-4 py-3"><ChannelBadge channel={c.channel} /></td>
                      <td className="px-4 py-3"><StatusDot status={c.status} /></td>
                      <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-muted-foreground">{num(c.impressions)}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">{num(c.clicks)}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">{c.ctr.toFixed(2)}%</td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-medium tabular-nums">{brl(c.spend)}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">{num(c.conversions)}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-muted-foreground">{brl(c.cpa)}</td>
                      <td className="py-3 pr-[22px] pl-4 text-right"><RoasValue value={c.roas} /></td>
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
