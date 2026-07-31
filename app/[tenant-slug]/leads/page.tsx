'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { Search, Users, Flame, Handshake, PhoneOff, TrendingUp, Bot, CheckCircle2, MapPinOff, Users2, IdCard, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { type Lead, type LeadCategory, cat, CATEGORY_LABELS, CATEGORY_BG } from '@/lib/leads'

// ── Types ──────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string
  value: number
  icon: React.ElementType
  color: string
}

// ── Sub-components ─────────────────────────────────────────────────────────

function KpiCard({ label, value, icon: Icon, color }: KpiCardProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4">
      <div className={cn('size-10 rounded-lg flex items-center justify-center flex-shrink-0', color)}>
        <Icon className="size-5" />
      </div>
      <div>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  )
}

function FunnelBar({ label, count, pct, color }: { label: string; count: number; pct: number; color: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums">{count} <span className="font-normal text-muted-foreground">({pct}%)</span></span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-700', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function StatusDropdown({ lead, disabled, onChange }: {
  lead: Lead
  disabled: boolean
  onChange: (c: LeadCategory) => void
}) {
  const current = cat(lead.status)
  const OPTIONS: LeadCategory[] = ['novo', 'quente', 'negoc', 'fechado', 'desq_regiao', 'qtd_vidas', 'pessoa_fisica', 'engano', 'fim']
  return (
    <select
      value={current}
      disabled={disabled}
      onChange={e => onChange(e.target.value as LeadCategory)}
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border bg-transparent cursor-pointer outline-none disabled:opacity-50',
        CATEGORY_BG[current],
      )}
    >
      {OPTIONS.map(c => (
        <option key={c} value={c} className="bg-card text-foreground">
          {CATEGORY_LABELS[c]}
        </option>
      ))}
    </select>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function LeadsPage() {
  const params = useParams()
  const slug = params['tenant-slug'] as string

  const [leads, setLeads] = useState<Lead[]>([])
  const [configured, setConfigured] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<LeadCategory | 'all'>('all')
  const [sortKey, setSortKey] = useState<keyof Lead>('criado_em')
  const [sortAsc, setSortAsc] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<number | null>(null)

  useEffect(() => {
    fetch(`/api/leads?tenant=${slug}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return }
        setLeads(d.leads ?? [])
        setConfigured(d.configured ?? false)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [slug])

  const stats = useMemo(() => {
    const total = leads.length
    const novo  = leads.filter(l => cat(l.status) === 'novo').length
    const quente = leads.filter(l => cat(l.status) === 'quente').length
    const negoc  = leads.filter(l => cat(l.status) === 'negoc').length
    const fim    = leads.filter(l => cat(l.status) === 'fim').length
    const fechado = leads.filter(l => cat(l.status) === 'fechado').length
    const desqRegiao = leads.filter(l => cat(l.status) === 'desq_regiao').length
    const qtdVidas = leads.filter(l => cat(l.status) === 'qtd_vidas').length
    const pessoaFisica = leads.filter(l => cat(l.status) === 'pessoa_fisica').length
    const engano = leads.filter(l => cat(l.status) === 'engano').length
    const pQuente = total ? Math.round(quente / total * 100) : 0
    const pNegoc  = total ? Math.round(negoc / total * 100) : 0
    const pFechado = total ? Math.round(fechado / total * 100) : 0
    const pDesqRegiao = total ? Math.round(desqRegiao / total * 100) : 0
    const pQtdVidas = total ? Math.round(qtdVidas / total * 100) : 0
    const pPessoaFisica = total ? Math.round(pessoaFisica / total * 100) : 0
    const pEngano = total ? Math.round(engano / total * 100) : 0
    return {
      total, novo, quente, negoc, fim, fechado, pQuente, pNegoc, pFechado,
      desqRegiao, qtdVidas, pessoaFisica, engano,
      pDesqRegiao, pQtdVidas, pPessoaFisica, pEngano,
    }
  }, [leads])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return leads
      .filter(l => (filter === 'all' || cat(l.status) === filter) &&
        (l.nome.toLowerCase().includes(q) || l.empresa.toLowerCase().includes(q) || l.email.toLowerCase().includes(q)))
      .sort((a, b) => {
        const av = a[sortKey] ?? ''
        const bv = b[sortKey] ?? ''
        return sortAsc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
      })
  }, [leads, search, filter, sortKey, sortAsc])

  function toggleSort(key: keyof Lead) {
    if (key === sortKey) setSortAsc(a => !a)
    else { setSortKey(key); setSortAsc(false) }
  }

  async function changeStatus(lead: Lead, nextCat: LeadCategory) {
    const nextStatus = CATEGORY_LABELS[nextCat]
    const prevStatus = lead.status
    // otimista: atualiza local imediatamente
    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: nextStatus } : l))
    setSavingId(lead.id)
    setStatusError(null)
    try {
      const res = await fetch(`/api/leads/${lead.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant: slug, status: nextStatus }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error ?? 'Falha ao salvar status')
      }
    } catch (e) {
      // revert (D-07) — restaura status anterior
      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: prevStatus } : l))
      setStatusError(e instanceof Error ? e.message : 'Falha ao salvar status')
    } finally {
      setSavingId(null)
    }
  }

  useEffect(() => {
    if (!statusError) return
    const t = setTimeout(() => setStatusError(null), 4000)
    return () => clearTimeout(t)
  }, [statusError])

  const TABS: { key: LeadCategory | 'all'; label: string }[] = [
    { key: 'all', label: 'Todos' },
    { key: 'novo', label: 'Novos' },
    { key: 'quente', label: 'Quentes' },
    { key: 'negoc', label: 'Negociando' },
    { key: 'fechado', label: 'Fechados' },
    { key: 'fim', label: 'Sem Resposta' },
  ]

  const COLS: { key: keyof Lead; label: string }[] = [
    { key: 'nome', label: 'Nome' },
    { key: 'empresa', label: 'Empresa' },
    { key: 'tipo_seguro', label: 'Produto' },
    { key: 'status', label: 'Status' },
    { key: 'criado_em', label: 'Criado em' },
    { key: 'hora_resposta', label: 'Resp.' },
  ]

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestão de Leads</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loading ? 'Carregando…' : `${leads.length} leads · últimas 500 entradas da planilha`}
          </p>
        </div>
        <Link
          href={`/${slug}/leads/agente`}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sidebar-primary text-sidebar-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Bot className="size-4" />
          Agente IA
        </Link>
      </div>

      {/* Error / not configured states */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/25 rounded-xl p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {statusError && (
        <div className="bg-destructive/10 border border-destructive/25 rounded-xl p-3 text-sm text-destructive">
          {statusError}
        </div>
      )}

      {!loading && !error && !configured && (
        <div className="bg-card border border-border rounded-xl p-8 text-center space-y-2">
          <p className="font-medium">Planilha não configurada</p>
          <p className="text-sm text-muted-foreground">
            Adicione <code className="text-xs bg-muted px-1 py-0.5 rounded">sheet_id</code> e{' '}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">sheets_api_key</code> no cadastro do tenant para visualizar leads.
          </p>
        </div>
      )}

      {!loading && !error && configured && (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <KpiCard label="Total" value={stats.total} icon={Users} color="bg-blue-500/15 text-blue-400" />
            <KpiCard label="Novos" value={stats.novo} icon={TrendingUp} color="bg-sky-500/15 text-sky-400" />
            <KpiCard label="Quentes" value={stats.quente} icon={Flame} color="bg-emerald-500/15 text-emerald-400" />
            <KpiCard label="Negociando" value={stats.negoc} icon={Handshake} color="bg-orange-500/15 text-orange-400" />
            <KpiCard label="Fechados" value={stats.fechado} icon={CheckCircle2} color="bg-[#B5E701]/15 text-[#B5E701]" />
            <KpiCard label="Desqualif. por Região" value={stats.desqRegiao} icon={MapPinOff} color="bg-rose-500/15 text-rose-400" />
            <KpiCard label="Qtd. de Vidas" value={stats.qtdVidas} icon={Users2} color="bg-rose-500/15 text-rose-400" />
            <KpiCard label="Pessoa Física" value={stats.pessoaFisica} icon={IdCard} color="bg-rose-500/15 text-rose-400" />
            <KpiCard label="Engano" value={stats.engano} icon={AlertTriangle} color="bg-rose-500/15 text-rose-400" />
            <KpiCard label="Sem Resposta" value={stats.fim} icon={PhoneOff} color="bg-muted/60 text-muted-foreground" />
          </div>

          {/* Funnel + table row */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
            {/* Table card */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              {/* Filters */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border flex-wrap">
                <div className="flex gap-1">
                  {TABS.map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => setFilter(key)}
                      className={cn(
                        'px-3 py-1 rounded-md text-xs font-medium transition-colors',
                        filter === key
                          ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 ml-auto min-w-0">
                  <Search className="size-3.5 text-muted-foreground shrink-0" />
                  <input
                    type="search"
                    placeholder="Buscar lead…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="bg-transparent text-sm outline-none placeholder:text-muted-foreground/60 w-40"
                  />
                  <span className="text-xs text-muted-foreground shrink-0">{filtered.length} result.</span>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      {COLS.map(({ key, label }) => (
                        <th
                          key={key}
                          onClick={() => toggleSort(key)}
                          className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground whitespace-nowrap"
                        >
                          {label} {sortKey === key ? (sortAsc ? '↑' : '↓') : '↕'}
                        </th>
                      ))}
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Telefone</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-muted-foreground text-sm">Carregando leads…</td>
                      </tr>
                    )}
                    {!loading && filtered.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-muted-foreground text-sm">Nenhum lead encontrado.</td>
                      </tr>
                    )}
                    {filtered.map(lead => (
                      <tr key={lead.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                        <td className="px-4 py-3 font-medium">{lead.nome || '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground">{lead.empresa || '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground">{lead.tipo_seguro || '—'}</td>
                        <td className="px-4 py-3">
                          <StatusDropdown
                            lead={lead}
                            disabled={savingId === lead.id}
                            onChange={c => changeStatus(lead, c)}
                          />
                        </td>
                        <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{lead.criado_em || '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{lead.hora_resposta || '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{lead.telefone || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Funnel sidebar */}
            <div className="bg-card border border-border rounded-xl p-5 space-y-5 h-fit">
              <h2 className="text-sm font-semibold">Funil de Conversão</h2>
              <div className="space-y-4">
                <FunnelBar label="Leads Quentes" count={stats.quente} pct={stats.pQuente} color="bg-emerald-500" />
                <FunnelBar label="Em Negociação" count={stats.negoc} pct={stats.pNegoc} color="bg-orange-500" />
                <FunnelBar label="Fechados" count={stats.fechado} pct={stats.pFechado} color="bg-[#B5E701]" />
                <FunnelBar label="Desqualif. por Região" count={stats.desqRegiao} pct={stats.pDesqRegiao} color="bg-rose-500" />
                <FunnelBar label="Qtd. de Vidas" count={stats.qtdVidas} pct={stats.pQtdVidas} color="bg-rose-500" />
                <FunnelBar label="Pessoa Física" count={stats.pessoaFisica} pct={stats.pPessoaFisica} color="bg-rose-500" />
                <FunnelBar label="Engano" count={stats.engano} pct={stats.pEngano} color="bg-rose-500" />
              </div>

              <div className="border-t border-border pt-4">
                <h3 className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">Distribuição</h3>
                <div className="space-y-0.5">
                  {(['fechado', 'negoc', 'quente', 'novo', 'desq_regiao', 'qtd_vidas', 'pessoa_fisica', 'engano', 'fim'] as LeadCategory[]).map(c => {
                    const count = leads.filter(l => cat(l.status) === c).length
                    return (
                      <div key={c} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                        <span className="text-xs text-muted-foreground">{CATEGORY_LABELS[c]}</span>
                        <span className={cn('text-xs font-semibold font-mono', {
                          'text-[#B5E701]': c === 'fechado',
                          'text-orange-400': c === 'negoc',
                          'text-emerald-400': c === 'quente',
                          'text-blue-400': c === 'novo',
                          'text-rose-400': c === 'desq_regiao' || c === 'qtd_vidas' || c === 'pessoa_fisica' || c === 'engano',
                          'text-muted-foreground': c === 'fim',
                        })}>{count}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
