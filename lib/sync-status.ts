import 'server-only'
import { createClient } from '@/lib/supabase/server'

export interface SyncStatusRow {
  tenant_id: string
  tenant_name: string
  tenant_slug: string
  channel: 'google_ads' | 'meta_ads'
  status: 'running' | 'success' | 'failed' | null
  completed_at: string | null
  started_at: string | null
  records_synced: number | null
  error_message: string | null
}

/**
 * SYNC-03 / SYNC-04 UI surface.
 * Retorna o ÚLTIMO sync_job por (tenant_id, channel).
 *
 * Implementação: query simples ordenada DESC + dedupe in-memory. Em v1 com 1-3 tenants
 * × 2 channels, isso é ≤6 linhas após dedupe e ≤200 linhas brutas mesmo após 90 dias
 * de execuções a cada 3h/6h. Para escala maior, usar DISTINCT ON via .rpc().
 */
export async function loadLastSyncByTenantChannel(): Promise<SyncStatusRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('sync_jobs')
    .select(`
      tenant_id,
      channel,
      status,
      completed_at,
      started_at,
      records_synced,
      error_message,
      tenants:tenant_id (
        name,
        slug
      )
    `)
    .order('completed_at', { ascending: false, nullsFirst: false })
    .limit(500)

  if (error) {
    console.error('[lib/sync-status] load error:', error)
    return []
  }
  if (!data) return []

  // Dedupe in-memory: pegar o primeiro (mais recente) por (tenant_id, channel)
  const seen = new Set<string>()
  const result: SyncStatusRow[] = []
  for (const row of data) {
    const key = `${row.tenant_id}::${row.channel}`
    if (seen.has(key)) continue
    seen.add(key)
    // tenants pode ser objeto único ou array dependendo do shape do PostgREST embed
    const t = Array.isArray((row as any).tenants) ? (row as any).tenants[0] : (row as any).tenants
    result.push({
      tenant_id: row.tenant_id,
      tenant_name: t?.name ?? '(unknown)',
      tenant_slug: t?.slug ?? '',
      channel: row.channel as 'google_ads' | 'meta_ads',
      status: row.status as SyncStatusRow['status'],
      completed_at: row.completed_at,
      started_at: row.started_at,
      records_synced: row.records_synced,
      error_message: row.error_message,
    })
  }
  return result
}
