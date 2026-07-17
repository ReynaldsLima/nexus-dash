'use client'

import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'

import { createClient } from '@/lib/supabase/client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { MetaAdsForm } from '@/components/settings/meta-ads-form'
import { GoogleAdsForm } from '@/components/settings/google-ads-form'
import { BackfillWindowControl } from '@/components/settings/backfill-window-control'

// ─── Types ────────────────────────────────────────────────────────────────────
type ConnectionStatus = 'connected' | 'not_configured' | 'invalid'

interface AdAccountStatus {
  channel: string
  active: boolean
  account_id: string | null
  backfill_days: number
}

interface TenantSettingsData {
  tenantId: string
  metaStatus: ConnectionStatus
  googleStatus: ConnectionStatus
  googleAccountId?: string
  metaBackfillDays?: number
  googleBackfillDays?: number
}

// ─── Helper ───────────────────────────────────────────────────────────────────
function deriveStatus(accounts: AdAccountStatus[], channel: string): ConnectionStatus {
  const account = accounts.find((a) => a.channel === channel)
  if (!account) return 'not_configured'
  return account.active ? 'connected' : 'invalid'
}

// ─── Data fetching ────────────────────────────────────────────────────────────
async function fetchTenantSettings(tenantSlug: string): Promise<TenantSettingsData> {
  const supabase = createClient()

  // Resolve slug → tenant id
  const { data: tenant, error: tenantErr } = await supabase
    .from('tenants')
    .select('id')
    .eq('slug', tenantSlug)
    .single()

  if (tenantErr || !tenant) {
    throw new Error('Tenant não encontrado')
  }

  // Read ad_accounts (RLS tenant_select allows the tenant's own rows)
  const { data: accounts, error: accountsErr } = await supabase
    .from('ad_accounts')
    .select('channel, active, account_id, backfill_days')

  if (accountsErr) {
    throw new Error('Erro ao carregar contas de anúncios')
  }

  const rows = (accounts ?? []) as AdAccountStatus[]
  const metaAccount = rows.find((a) => a.channel === 'meta_ads')
  const googleAccount = rows.find((a) => a.channel === 'google_ads')

  return {
    tenantId: tenant.id,
    metaStatus: deriveStatus(rows, 'meta_ads'),
    googleStatus: deriveStatus(rows, 'google_ads'),
    googleAccountId: googleAccount?.account_id ?? undefined,
    metaBackfillDays: metaAccount?.backfill_days,
    googleBackfillDays: googleAccount?.backfill_days,
  }
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function ChannelStatusBadge({ status }: { status: ConnectionStatus }) {
  if (status === 'connected') {
    return (
      <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
        Conectado
      </Badge>
    )
  }
  if (status === 'invalid') {
    return <Badge variant="destructive">Token inválido</Badge>
  }
  return <Badge variant="secondary">Não configurado</Badge>
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    </div>
  )
}

// ─── Settings page ────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const params = useParams<{ 'tenant-slug': string }>()
  const tenantSlug = params['tenant-slug'] ?? ''

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['settings', tenantSlug],
    queryFn: () => fetchTenantSettings(tenantSlug),
    enabled: !!tenantSlug,
    staleTime: 1000 * 60 * 5, // 5 minutes — settings data changes infrequently
  })

  if (isLoading) {
    return (
      <div className="max-w-2xl">
        <SettingsSkeleton />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-xl font-semibold mb-2">Configurações</h1>
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {(error as Error)?.message ?? 'Erro ao carregar configurações.'}
        </div>
      </div>
    )
  }

  const {
    tenantId,
    metaStatus,
    googleStatus,
    googleAccountId,
    metaBackfillDays,
    googleBackfillDays,
  } = data!

  return (
    <div className="max-w-2xl space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Gerencie as conexões com as plataformas de anúncios do tenant.
        </p>
      </div>

      {/* ── Meta Ads section (SET-02) ───────────────────────────────────── */}
      <Card>
        <CardHeader className="border-b">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Meta Ads</CardTitle>
              <CardDescription className="mt-0.5">
                Conecte via System User token para sincronização automática das campanhas.
              </CardDescription>
            </div>
            <ChannelStatusBadge status={metaStatus} />
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <MetaAdsForm tenantId={tenantId} initialStatus={metaStatus} />
          {metaStatus !== 'not_configured' && (
            <div className="mt-4 border-t pt-4">
              <BackfillWindowControl
                tenantId={tenantId}
                tenantSlug={tenantSlug}
                channel="meta_ads"
                initialDays={metaBackfillDays ?? 90}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Google Ads section (SET-01) ─────────────────────────────────── */}
      <Card>
        <CardHeader className="border-b">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Google Ads</CardTitle>
              <CardDescription className="mt-0.5">
                Conecte via OAuth2 para sincronização automática das campanhas.
              </CardDescription>
            </div>
            <ChannelStatusBadge status={googleStatus} />
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <GoogleAdsForm
            tenantId={tenantId}
            tenantSlug={tenantSlug}
            initialStatus={googleStatus}
            initialCustomerId={googleAccountId}
          />
          {googleStatus !== 'not_configured' && (
            <div className="mt-4 border-t pt-4">
              <BackfillWindowControl
                tenantId={tenantId}
                tenantSlug={tenantSlug}
                channel="google_ads"
                initialDays={googleBackfillDays ?? 90}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
