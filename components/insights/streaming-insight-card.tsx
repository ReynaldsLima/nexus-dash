'use client'

import { AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'

export type StreamingInsightCardState = 'streaming' | 'completing' | 'error'

type StreamingInsightCardProps = {
  state: StreamingInsightCardState
  text: string
  onRetry: () => void
}

const STATE_CONFIG = {
  streaming: {
    icon: Sparkles,
    label: 'Analisando campanhas…',
    badgeBg: 'rgba(200,255,0,.1)',
    badgeBorder: 'rgba(200,255,0,.2)',
    badgeColor: 'var(--primary)',
  },
  completing: {
    icon: CheckCircle2,
    label: 'Análise concluída',
    badgeBg: 'rgba(74,222,128,.12)',
    badgeBorder: 'rgba(74,222,128,.2)',
    badgeColor: 'var(--viz-green)',
  },
  error: {
    icon: AlertTriangle,
    label: 'Falha na análise',
    badgeBg: 'rgba(248,113,113,.12)',
    badgeBorder: 'rgba(248,113,113,.2)',
    badgeColor: 'var(--viz-red)',
  },
} as const

export function StreamingInsightCard({ state, text, onRetry }: StreamingInsightCardProps) {
  const cfg = STATE_CONFIG[state]
  const Icon = cfg.icon

  return (
    <div className="min-h-[140px] overflow-hidden rounded-2xl border border-border bg-card p-[22px]">
      {/* Badge */}
      <div className="mb-3.5 flex flex-wrap items-center gap-2">
        <span
          className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px]"
          style={{ background: cfg.badgeBg, borderColor: cfg.badgeBorder, color: cfg.badgeColor }}
        >
          <span className="size-1.5 animate-pulse rounded-full bg-current" aria-hidden="true" />
          <Icon className="size-3" aria-hidden="true" />
          {cfg.label}
        </span>
      </div>

      {/* Body */}
      {state === 'error' ? (
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground" aria-live="polite">
            Não foi possível concluir a análise. Tente novamente.
          </p>
          <Button variant="outline" size="sm" onClick={onRetry} className="flex-shrink-0">
            Tentar novamente
          </Button>
        </div>
      ) : (
        <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground" aria-live="polite">
          {text}
          {state === 'streaming' && (
            <span
              className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-primary"
              aria-hidden="true"
            />
          )}
        </p>
      )}
    </div>
  )
}
