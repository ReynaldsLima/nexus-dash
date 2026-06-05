import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

// Node runtime required: service role client uses 'server-only', and Vault writes
// must not be bundled or executed in the Edge runtime.
export const runtime = 'nodejs'

// ─── Request schema ───────────────────────────────────────────────────────────
// accountId: accept raw digits (123456789) or the canonical act_ prefix (act_123456789)
// token: System User token — minimum 20 chars to avoid trivially invalid values
// tenantId: must be a valid UUID (enforced by Zod)
const BodySchema = z.object({
  accountId: z
    .string()
    .trim()
    .min(1, 'accountId é obrigatório')
    .transform((val) => (val.startsWith('act_') ? val : `act_${val}`))
    .refine((val) => /^act_\d+$/.test(val), {
      message: 'accountId deve conter apenas dígitos (ex: 123456789 ou act_123456789)',
    }),
  token: z
    .string()
    .trim()
    .min(20, 'O System User token deve ter pelo menos 20 caracteres'),
  tenantId: z.uuid('tenantId deve ser um UUID válido'),
})

// ─── POST /api/meta-ads/connect ───────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // ── 1. Auth: verify session ───────────────────────────────────────────────
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── 2. Role check: only super_admin or tenant_admin may connect accounts ──
  // Uses get_user_role() RPC (returns 'super_admin' | 'tenant_admin' | 'viewer')
  const { data: role, error: roleErr } = await supabase.rpc('get_user_role')

  if (roleErr || !role) {
    return NextResponse.json({ error: 'Não foi possível verificar o papel do usuário' }, { status: 403 })
  }

  if (role !== 'super_admin' && role !== 'tenant_admin') {
    return NextResponse.json(
      { error: 'Apenas super_admin e tenant_admin podem conectar contas de anúncios' },
      { status: 403 }
    )
  }

  // ── 3. Parse and validate request body ───────────────────────────────────
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido — JSON esperado' }, { status: 400 })
  }

  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Dados inválidos'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  // ── 3b. Tenant ownership: derive tenantId server-side for non-super_admin ─
  // A tenant_admin must only write to their own tenant. Rather than trusting the
  // body tenantId, resolve the caller's tenant from the JWT app_metadata and use
  // that exclusively. super_admin may target any tenant via the body value.
  let tenantId: string
  if (role === 'super_admin') {
    tenantId = parsed.data.tenantId
  } else {
    // getUser() result already has server-verified app_metadata
    const callerTenantId = user.app_metadata?.tenant_id as string | undefined
    if (!callerTenantId) {
      return NextResponse.json({ error: 'Não foi possível verificar o tenant do usuário' }, { status: 403 })
    }
    tenantId = callerTenantId
  }

  const { accountId, token } = parsed.data

  // ── 4. Validate token against Meta Graph API ──────────────────────────────
  // URL is HARDCODED (Threat T-03-02: no SSRF — user input never in the host).
  // Only accountId (validated regex act_\d+) and token are interpolated.
  // Token is NEVER logged (Threat T-03-01).
  const meUrl =
    'https://graph.facebook.com/v22.0/me?fields=id,name&access_token=' +
    encodeURIComponent(token)

  let meRes: Response
  try {
    meRes = await fetch(meUrl)
  } catch (fetchErr) {
    return NextResponse.json(
      { error: 'Não foi possível conectar à Meta Graph API' },
      { status: 502 }
    )
  }

  if (!meRes.ok) {
    const meBody = await meRes.json().catch(() => ({}))
    const reason = (meBody as { error?: { message?: string } })?.error?.message ?? 'Token inválido'
    return NextResponse.json({ error: `Token Meta inválido: ${reason}` }, { status: 400 })
  }

  // ── 5. Validate Ads account permission (Pitfall 5) ────────────────────────
  // Confirms the token actually has access to the specified Ads account.
  const adsUrl =
    'https://graph.facebook.com/v22.0/' +
    accountId +
    '?fields=id&access_token=' +
    encodeURIComponent(token)

  let adsRes: Response
  try {
    adsRes = await fetch(adsUrl)
  } catch {
    return NextResponse.json(
      { error: 'Não foi possível validar permissão de Ads na Meta Graph API' },
      { status: 502 }
    )
  }

  if (!adsRes.ok) {
    return NextResponse.json(
      {
        error:
          'O token não tem permissão para esta conta de Ads. Verifique se o System User tem permissão ads_read.',
      },
      { status: 400 }
    )
  }

  // ── 6. Write token to Supabase Vault (service role — bypasses RLS) ────────
  // Secret name is deterministic per tenant: one secret per tenant_id.
  // If the tenant reconnects, the existing secret is updated in place.
  const service = createServiceClient()
  const secretName = `meta_ads_token_${tenantId}`

  const { data: secretId, error: vaultErr } = await service.rpc(
    'create_or_update_vault_secret',
    { p_name: secretName, p_secret: token }
  )

  if (vaultErr || !secretId) {
    // Do NOT include vaultErr.message in the response — may expose internal details.
    console.error('[meta-ads/connect] Vault write failed:', vaultErr?.message)
    return NextResponse.json({ error: 'Falha ao gravar credencial no Vault' }, { status: 500 })
  }

  // ── 7. Upsert ad_accounts row (service role — RLS blocks tenant_admin INSERT) ─
  // UNIQUE(tenant_id, channel) means onConflict handles re-connection gracefully.
  // vault_secret_id is stored; the token itself is never written to a column.
  const { error: upsertErr } = await service
    .from('ad_accounts')
    .upsert(
      {
        tenant_id: tenantId,
        channel: 'meta_ads',
        account_id: accountId,
        vault_secret_id: secretId as string,
        active: true,
      },
      { onConflict: 'tenant_id,channel' }
    )

  if (upsertErr) {
    console.error('[meta-ads/connect] ad_accounts upsert failed:', upsertErr.message)
    return NextResponse.json(
      { error: 'Falha ao salvar conta de anúncios. Tente novamente.' },
      { status: 500 }
    )
  }

  // ── 8. Success — return only safe fields ──────────────────────────────────
  // Threat T-03-05: vault_secret_id (UUID) and the token are NEVER returned.
  return NextResponse.json({ success: true, accountId })
}
