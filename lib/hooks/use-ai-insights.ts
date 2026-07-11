'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { AiInsight } from '@/lib/mock-data'

type AiInsightRow = {
  id: string
  tenant_id: string
  source: string
  type: AiInsight['type']
  title: string
  summary: string
  metrics: AiInsight['metrics']
  recommendations: AiInsight['recommendations']
  impact: AiInsight['impact']
  created_at: string
  tenants: { slug: string } | { slug: string }[]
}

async function fetchAiInsights(tenantSlug: string): Promise<AiInsight[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('ai_insights')
    .select(
      'id, tenant_id, source, type, title, summary, metrics, recommendations, impact, created_at, tenants!inner(slug)',
    )
    .eq('tenants.slug', tenantSlug)
    .order('created_at', { ascending: false })

  if (error) throw error

  return ((data ?? []) as unknown as AiInsightRow[]).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    type: row.type,
    title: row.title,
    summary: row.summary,
    metrics: row.metrics,
    recommendations: row.recommendations,
    impact: row.impact,
  }))
}

export function useAiInsights(tenantSlug: string) {
  return useQuery<AiInsight[]>({
    queryKey: ['ai-insights', tenantSlug],
    queryFn: () => fetchAiInsights(tenantSlug),
    enabled: !!tenantSlug,
  })
}
