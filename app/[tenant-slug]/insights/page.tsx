'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { AlertTriangle, CheckCircle2, Lightbulb, Loader2, Sparkles, TrendingUp } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type { AiInsight } from '@/lib/mock-data'
import { useAiInsights } from '@/lib/hooks/use-ai-insights'
import { useUserRole } from '@/lib/hooks/use-user-role'
import { StreamingInsightCard } from '@/components/insights/streaming-insight-card'

// ─── Type helpers ─────────────────────────────────────────────────────────────
const TYPE_CONFIG = {
  opportunity: {
    icon: TrendingUp,
    label: 'Oportunidade',
    borderColor: 'var(--chart-1)',
    bgColor: 'oklch(0.60 0.22 258 / 0.08)',
    badgeBg: 'oklch(0.60 0.22 258 / 0.15)',
    badgeColor: 'oklch(0.72 0.16 258)',
  },
  alert: {
    icon: AlertTriangle,
    label: 'Alerta',
    borderColor: 'var(--chart-5)',
    bgColor: 'oklch(0.65 0.20 15 / 0.06)',
    badgeBg: 'oklch(0.65 0.20 15 / 0.15)',
    badgeColor: 'oklch(0.65 0.20 15)',
  },
  optimization: {
    icon: Lightbulb,
    label: 'Otimização',
    borderColor: 'var(--chart-3)',
    bgColor: 'oklch(0.75 0.18 155 / 0.06)',
    badgeBg: 'oklch(0.75 0.18 155 / 0.15)',
    badgeColor: 'oklch(0.75 0.18 155)',
  },
} as const

const IMPACT_CONFIG = {
  high:   { label: 'Alto impacto',  color: 'oklch(0.65 0.20 15)' },
  medium: { label: 'Médio impacto', color: 'oklch(0.72 0.19 47)' },
  low:    { label: 'Baixo impacto', color: 'oklch(0.556 0 0)' },
} as const

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

// ─── Insight Card ─────────────────────────────────────────────────────────────
function InsightCard({ insight }: { insight: AiInsight }) {
  const cfg = TYPE_CONFIG[insight.type]
  const impactCfg = IMPACT_CONFIG[insight.impact]
  const Icon = cfg.icon

  return (
    <div
      className="rounded-xl border overflow-hidden transition-all duration-200 hover:shadow-md"
      style={{
        borderColor: cfg.borderColor,
        background: cfg.bgColor,
        borderLeftWidth: '3px',
      }}
    >
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
              style={{ background: cfg.badgeBg, color: cfg.badgeColor }}
            >
              <Icon className="size-3" aria-hidden="true" />
              {cfg.label}
            </span>
            <span
              className="text-xs font-medium"
              style={{ color: impactCfg.color }}
            >
              · {impactCfg.label}
            </span>
          </div>
          <time
            dateTime={insight.createdAt}
            className="text-xs text-muted-foreground/60 whitespace-nowrap flex-shrink-0"
          >
            {formatDate(insight.createdAt)}
          </time>
        </div>

        {/* Title */}
        <h2 className="text-sm font-semibold leading-snug mb-2 text-balance">
          {insight.title}
        </h2>

        {/* Summary */}
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
          {insight.summary}
        </p>

        {/* Metrics chips */}
        <div className="flex flex-wrap gap-2 mb-4">
          {insight.metrics.map((m) => (
            <div
              key={m.label}
              className="rounded-md border border-border/60 bg-card px-3 py-1.5"
            >
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{m.label}</p>
              <p className="text-sm font-semibold tabular-nums mt-0.5">
                <span>{m.value}</span>
                {m.delta && (
                  <span className="text-xs font-normal text-muted-foreground ml-1.5">{m.delta}</span>
                )}
              </p>
            </div>
          ))}
        </div>

        {/* Recommendations */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Recomendações
          </p>
          <ul className="space-y-1.5">
            {insight.recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <CheckCircle2
                  className="size-3.5 flex-shrink-0 mt-0.5"
                  style={{ color: cfg.badgeColor }}
                  aria-hidden="true"
                />
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function InsightsPage() {
  const params = useParams()
  const tenantSlug = params['tenant-slug'] as string
  const router = useRouter()
  const searchParams = useSearchParams()

  const { data: insights, isLoading, isError, refetch } = useAiInsights(tenantSlug)
  const { data: role, isLoading: isRoleLoading } = useUserRole()

  const [streamState, setStreamState] = useState<'idle' | 'streaming' | 'completing' | 'error'>('idle')
  const [streamedText, setStreamedText] = useState('')
  const hasTriggeredRef = useRef(false)

  const handleGenerate = async () => {
    if (streamState !== 'idle') return

    setStreamState('streaming')
    setStreamedText('')

    try {
      const res = await fetch('/api/insights/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantSlug }),
      })

      if (!res.ok || !res.body) {
        setStreamState('error')
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let full = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        full += chunk
        const displayText = full.split('<insight_data>')[0]
        setStreamedText(displayText)
      }

      setStreamState('completing')
      setTimeout(async () => {
        await refetch()
        setStreamState('idle')
        setStreamedText('')
      }, 600)
    } catch {
      setStreamState('error')
    }
  }

  // Trigger param (D-02): auto-invoke generation when arriving from the dashboard shortcut
  useEffect(() => {
    if (searchParams.get('trigger') === '1' && !hasTriggeredRef.current) {
      hasTriggeredRef.current = true
      handleGenerate()
      router.replace(`/${tenantSlug}/insights`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, tenantSlug])

  // AI-03: AI Insights is super_admin-only. RLS/route auth already block data access for other
  // roles, but the page itself should not be reachable — redirect away once role is resolved.
  useEffect(() => {
    if (!isRoleLoading && role !== 'super_admin') {
      router.replace(`/${tenantSlug}/dashboard`)
    }
  }, [isRoleLoading, role, router, tenantSlug])

  if (isRoleLoading || role !== 'super_admin') return null

  return (
    <section className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Insights</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Recomendações geradas por Claude&nbsp;·&nbsp;{insights?.length ?? 0} análises
          </p>
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={streamState !== 'idle'}
          className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-all duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
          style={{
            background: 'var(--sidebar-primary)',
            color: 'var(--sidebar-primary-foreground)',
          }}
          aria-live="polite"
        >
          {streamState !== 'idle' ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Analisando…
            </>
          ) : (
            <>
              <Sparkles className="size-4" aria-hidden="true" />
              Analisar agora
            </>
          )}
        </button>
      </div>

      {/* Streaming card */}
      {streamState !== 'idle' && (
        <StreamingInsightCard
          state={streamState}
          text={streamedText}
          onRetry={handleGenerate}
        />
      )}

      {/* Insight list */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : isError ? (
        <Card>
          <CardContent className="pt-6 pb-6 text-center text-sm text-muted-foreground">
            Erro ao carregar insights. Tente recarregar a página.
          </CardContent>
        </Card>
      ) : insights && insights.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
          <Sparkles className="size-8 text-muted-foreground/40" aria-hidden="true" />
          <p className="text-sm font-semibold">Nenhuma análise ainda</p>
          <p className="text-sm text-muted-foreground">
            Clique em &quot;Analisar agora&quot; para gerar a primeira recomendação de IA para este tenant.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {insights?.map((insight) => (
            <InsightCard key={insight.id} insight={insight} />
          ))}
        </div>
      )}

      {/* Footer note */}
      <p className="text-xs text-muted-foreground/50 text-center pb-2">
        Análises geradas por claude-sonnet-4-6 com base em dados sincronizados via N8N.
        Recomendações são sugestivas — valide antes de aplicar.
      </p>
    </section>
  )
}
