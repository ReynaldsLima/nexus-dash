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
// Colours transcribed from prototipos/nexus-dash.html .bdg-accent / .bdg-red / .bdg-amber
// (lines 148-155) and the rendered mapping at lines 495 / 505 / 515.
const TYPE_CONFIG = {
  opportunity: {
    icon: TrendingUp,
    label: 'Oportunidade',
    badgeBg: 'rgba(200,255,0,.1)',
    badgeBorder: 'rgba(200,255,0,.2)',
    badgeColor: 'var(--primary)',
  },
  alert: {
    icon: AlertTriangle,
    label: 'Alerta',
    badgeBg: 'rgba(248,113,113,.12)',
    badgeBorder: 'rgba(248,113,113,.2)',
    badgeColor: 'var(--viz-red)',
  },
  optimization: {
    icon: Lightbulb,
    label: 'Otimização',
    badgeBg: 'rgba(251,191,36,.1)',
    badgeBorder: 'rgba(251,191,36,.2)',
    badgeColor: '#fbbf24',
  },
} as const

const IMPACT_CONFIG = {
  high:   { label: 'Alto impacto',  color: 'var(--viz-red)' },
  medium: { label: 'Médio impacto', color: 'var(--viz-orange)' },
  low:    { label: 'Baixo impacto', color: 'var(--muted-foreground)' },
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
    <div className="lift overflow-hidden rounded-2xl border border-border bg-card hover:border-primary/20">
      <div className="p-[22px]">
        {/* Header */}
        <div className="mb-3.5 flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px]"
              style={{ background: cfg.badgeBg, borderColor: cfg.badgeBorder, color: cfg.badgeColor }}
            >
              <Icon className="size-3" aria-hidden="true" />
              {cfg.label}
            </span>
            <span className="font-mono text-[11px]" style={{ color: impactCfg.color }}>
              · {impactCfg.label}
            </span>
          </div>
          <time
            dateTime={insight.createdAt}
            className="flex-shrink-0 font-mono text-[11px] whitespace-nowrap text-muted-foreground"
          >
            {formatDate(insight.createdAt)}
          </time>
        </div>

        {/* Title */}
        <h2 className="t-heading mb-2.5 text-balance">
          {insight.title}
        </h2>

        {/* Summary */}
        <p className="mb-[18px] text-sm leading-relaxed text-muted-foreground">
          {insight.summary}
        </p>

        {/* Metrics chips */}
        <div className="mb-[18px] flex flex-wrap gap-2.5">
          {insight.metrics.map((m) => (
            <div
              key={m.label}
              className="min-w-[110px] rounded-md border border-border bg-secondary px-3.5 py-2.5"
            >
              <p className="t-label mb-1 text-muted-foreground">{m.label}</p>
              <p className="font-heading text-[15px] font-extrabold tabular-nums">
                <span>{m.value}</span>
                {m.delta && (
                  <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">{m.delta}</span>
                )}
              </p>
            </div>
          ))}
        </div>

        {/* Recommendations */}
        <div>
          <p className="t-label mb-2.5 text-muted-foreground">
            Recomendações
          </p>
          <ul className="space-y-1.5">
            {insight.recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[13px]">
                <CheckCircle2
                  className="mt-0.5 size-3.5 flex-shrink-0"
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
  const abortControllerRef = useRef<AbortController | null>(null)
  const isMountedRef = useRef(true)

  // WR-05: tie the streaming fetch/reader loop and the completion timeout to component
  // lifecycle so navigating away mid-stream doesn't call setState on an unmounted component
  // or race a stale refetch() against a query no longer observed.
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      abortControllerRef.current?.abort()
    }
  }, [])

  const handleGenerate = async () => {
    if (streamState !== 'idle') return

    setStreamState('streaming')
    setStreamedText('')

    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const res = await fetch('/api/insights/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantSlug }),
        signal: controller.signal,
      })

      if (!res.ok || !res.body) {
        if (isMountedRef.current) setStreamState('error')
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let full = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (!isMountedRef.current) {
          await reader.cancel()
          return
        }
        const chunk = decoder.decode(value, { stream: true })
        full += chunk
        const displayText = full.split('<insight_data>')[0]
        setStreamedText(displayText)
      }

      if (!isMountedRef.current) return
      setStreamState('completing')
      setTimeout(async () => {
        if (!isMountedRef.current) return
        await refetch()
        if (!isMountedRef.current) return
        setStreamState('idle')
        setStreamedText('')
      }, 600)
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === 'AbortError'
      if (isMountedRef.current && !isAbort) setStreamState('error')
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
