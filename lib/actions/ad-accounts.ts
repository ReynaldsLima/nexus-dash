'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

const updateBackfillSchema = z.object({
  tenantId: z.string().uuid(),
  tenantSlug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
  channel: z.enum(['google_ads', 'meta_ads']),
  days: z.number().int().min(7).max(365),
})

export type UpdateBackfillResult = { ok: true } | { error: string }

// SET-05: super_admin OR own-tenant tenant_admin may edit an already-connected
// account's backfill window without reconnecting. ad_accounts RLS (migration 0006)
// blocks tenant_admin UPDATE entirely, so the write uses the service-role client,
// gated by an app-layer authorization check (mirrors app/api/google-ads/connect/route.ts
// steps 3+5). The shared super_admin-only auth-guard helper is NOT usable here —
// SET-05 explicitly allows tenant_admin to reach this action too.
export async function updateBackfillWindow(input: {
  tenantId: string
  tenantSlug: string
  channel: 'google_ads' | 'meta_ads'
  days: number
}): Promise<UpdateBackfillResult> {
  const parsed = updateBackfillSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }
  }

  // ── Authorization: super_admin OR own-tenant tenant_admin (SET-05) ──────────
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const { data: role, error: roleErr } = await supabase.rpc('get_user_role')
  if (roleErr || !role) return { error: 'Não foi possível verificar o papel do usuário.' }

  if (role !== 'super_admin') {
    if (role !== 'tenant_admin') {
      return { error: 'Você não tem permissão para alterar a janela de histórico.' }
    }
    // tenant_admin: tenant_id MUST come from verified JWT claims, never the input.
    const { data: claimsData } = await supabase.auth.getClaims()
    const claimTenantId = claimsData?.claims?.app_metadata?.tenant_id as string | undefined
    if (!claimTenantId || claimTenantId !== parsed.data.tenantId) {
      return { error: 'Você não tem permissão para alterar esta conta.' }
    }
  }

  // ── Write (service role — ad_accounts UPDATE is RLS-blocked for tenant_admin) ─
  const service = createServiceClient()
  const { error } = await service
    .from('ad_accounts')
    .update({ backfill_days: parsed.data.days })
    .eq('tenant_id', parsed.data.tenantId)
    .eq('channel', parsed.data.channel)

  if (error) return { error: error.message }

  revalidatePath(`/${parsed.data.tenantSlug}/settings`)
  return { ok: true }
}
