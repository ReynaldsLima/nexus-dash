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
    badgeBg: 'oklch(0.60 0.22 258 / 0.15)',
    badgeColor: 'oklch(0.72 0.16 258)',
  },
  completing: {
    icon: CheckCircle2,
    label: 'Análise concluída',
    badgeBg: 'oklch(0.75 0.18 155 / 0.15)',
    badgeColor: 'oklch(0.75 0.18 155)',
  },
  error: {
    icon: AlertTriangle,
    label: 'Falha na análise',
    badgeBg: 'oklch(0.65 0.20 15 / 0.15)',
    badgeColor: 'oklch(0.65 0.20 15)',
  },
} as const

export function StreamingInsightCard({ state, text, onRetry }: StreamingInsightCardProps) {
  const cfg = STATE_CONFIG[state]
  const Icon = cfg.icon

  return (
    <div
      className="rounded-xl border overflow-hidden p-5 min-h-[140px]"
      style={{
        borderLeftWidth: '3px',
        borderColor: 'var(--chart-1)',
        background: 'oklch(0.60 0.22 258 / 0.08)',
      }}
    >
      {/* Badge */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
          style={{ background: cfg.badgeBg, color: cfg.badgeColor }}
        >
          <span className="size-1.5 rounded-full bg-current animate-pulse" aria-hidden="true" />
          <Icon className="size-3" aria-hidden="true" />
          {cfg.label}
        </span>
      </div>

      {/* Body */}
      {state === 'error' ? (
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap" aria-live="polite">
            Não foi possível concluir a análise. Tente novamente.
          </p>
          <Button variant="outline" size="sm" onClick={onRetry} className="flex-shrink-0">
            Tentar novamente
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap" aria-live="polite">
          {text}
          {state === 'streaming' && (
            <span
              className="inline-block w-1.5 h-3.5 ml-0.5 animate-pulse"
              style={{ background: 'var(--chart-1)' }}
              aria-hidden="true"
            />
          )}
        </p>
      )}
    </div>
  )
}
