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
    <Card className="lift hover:ring-primary/20">
      <CardContent className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-[30px] flex-shrink-0 items-center justify-center rounded-md border border-primary/25 bg-primary/10">
            <Sparkles className="size-4 text-primary" aria-hidden="true" />
          </div>
          <div>
            <p className="font-heading text-[13px] font-bold">Análise sob demanda</p>
            <p className="text-sm text-muted-foreground">
              A IA revisa as campanhas dos últimos 30 dias e sugere otimizações.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => router.push(`/${tenantSlug}/insights?trigger=1`)}
          className="btn-accent flex-shrink-0 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Sparkles className="size-4" aria-hidden="true" />
          Analisar agora
        </button>
      </CardContent>
    </Card>
  )
}
