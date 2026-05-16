import { loadLastSyncByTenantChannel, type SyncStatusRow } from '@/lib/sync-status'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

const CHANNELS: Array<'google_ads' | 'meta_ads'> = ['google_ads', 'meta_ads']

const CHANNEL_LABELS: Record<'google_ads' | 'meta_ads', string> = {
  google_ads: 'Google Ads',
  meta_ads: 'Meta Ads',
}

function StatusBadge({ status }: { status: SyncStatusRow['status'] }) {
  if (status === 'success') return <Badge variant="default" className="bg-green-600 hover:bg-green-700">Sucesso</Badge>
  if (status === 'failed')  return <Badge variant="destructive">Falha</Badge>
  if (status === 'running') return <Badge variant="secondary">Em execução</Badge>
  return <Badge variant="outline">Sem sync</Badge>
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

/**
 * SYNC-03 / SYNC-04 UI section embedded in /tenants page.
 * Mostra o último sync_job por (tenant, channel). Server Component — RSC fetches
 * direto via createClient(). Sem TanStack Query (dados estáticos por load).
 */
export async function SyncStatusSection() {
  const rows = await loadLastSyncByTenantChannel()

  // Agrupar por tenant: { tenant_id: { tenant_name, slug, google_ads?, meta_ads? } }
  const byTenant = new Map<string, { name: string; slug: string; entries: Partial<Record<'google_ads' | 'meta_ads', SyncStatusRow>> }>()
  for (const row of rows) {
    if (!byTenant.has(row.tenant_id)) {
      byTenant.set(row.tenant_id, { name: row.tenant_name, slug: row.tenant_slug, entries: {} })
    }
    byTenant.get(row.tenant_id)!.entries[row.channel] = row
  }

  const tenantList = Array.from(byTenant.entries())

  return (
    <section className="flex flex-col gap-4">
      <header>
        <h2 className="text-lg font-semibold leading-tight">Status de Sync</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Último sync de campanhas por tenant e canal — SYNC-03
        </p>
      </header>

      {tenantList.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhum sync registrado ainda. Os workflows N8N (Google Ads e Meta Ads) gravarão aqui após a primeira execução.
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tenant</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Último sync</TableHead>
              <TableHead className="text-right">Registros</TableHead>
              <TableHead>Erro</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tenantList.flatMap(([tenantId, info]) =>
              CHANNELS.map((ch) => {
                const row = info.entries[ch]
                return (
                  <TableRow key={`${tenantId}::${ch}`}>
                    <TableCell className="font-semibold">{info.name}</TableCell>
                    <TableCell>{CHANNEL_LABELS[ch]}</TableCell>
                    <TableCell><StatusBadge status={row?.status ?? null} /></TableCell>
                    <TableCell className="font-mono text-xs">
                      {row ? formatTimestamp(row.completed_at ?? row.started_at) : '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {row?.records_synced ?? '—'}
                    </TableCell>
                    <TableCell className="text-xs text-destructive">
                      {row?.status === 'failed' && row.error_message
                        ? row.error_message.length > 80
                          ? row.error_message.slice(0, 80) + '…'
                          : row.error_message
                        : ''}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      )}
    </section>
  )
}
