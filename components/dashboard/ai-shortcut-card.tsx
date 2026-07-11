'use client'

import { useRouter } from 'next/navigation'
import { Sparkles } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'

type AiShortcutCardProps = {
  tenantSlug: string
}

export function AiShortcutCard({ tenantSlug }: AiShortcutCardProps) {
  const router = useRouter()

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-3">
          <div
            className="p-1.5 rounded-md flex-shrink-0"
            style={{ background: 'oklch(0.6 0.22 258 / 0.12)' }}
          >
            <Sparkles className="size-4" style={{ color: 'var(--chart-1)' }} aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold">Análise sob demanda</p>
            <p className="text-sm text-muted-foreground">
              A IA revisa as campanhas dos últimos 30 dias e sugere otimizações.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => router.push(`/${tenantSlug}/insights?trigger=1`)}
          className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-all duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60 flex-shrink-0"
          style={{
            background: 'var(--sidebar-primary)',
            color: 'var(--sidebar-primary-foreground)',
          }}
        >
          <Sparkles className="size-4" aria-hidden="true" />
          Analisar agora
        </button>
      </CardContent>
    </Card>
  )
}
