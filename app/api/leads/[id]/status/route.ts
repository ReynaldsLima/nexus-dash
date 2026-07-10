import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { z } from 'zod/v4' // import é 'zod/v4' (padrão do projeto)
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { updateLeadStatus, mapSheetsError } from '@/lib/sheets'
import { CATEGORY_LABELS } from '@/lib/leads'

export const runtime = 'nodejs' // OBRIGATÓRIO: assinatura RS256 do JWT usa o módulo crypto do Node — não roda no Edge

// status é gravado com valueInputOption=USER_ENTERED (Sheets interpreta fórmulas). O dropdown só
// envia um dos 4 labels canônicos — restringir ao enum elimina injeção de fórmula na origem
// (não é mitigação de "texto livre", já que nenhum texto livre deveria chegar aqui).
const VALID_STATUSES = Object.values(CATEGORY_LABELS) as [string, ...string[]]
const BodySchema = z.object({
  tenant: z.string().min(1),
  status: z.enum(VALID_STATUSES),
})

// Shape mínimo esperado em tenants.sheets_service_account (JSONB sem validação de schema no
// Postgres) — validado em runtime antes de usar, em vez de um type assertion cego.
const ServiceAccountSchema = z.object({
  client_email: z.string().min(1),
  private_key: z.string().min(1),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // 1. Validar id ANTES de tudo (V5 — evita range injection na URL da Sheets API, Threat T-03.1-03)
  const { id } = await params
  const rowIndex = Number(id)
  if (!Number.isInteger(rowIndex) || rowIndex < 0) {
    return NextResponse.json({ error: 'id inválido' }, { status: 400 })
  }

  // 2. Auth
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 3. Role gate — super_admin/tenant_admin/agency (OQ #1, AUTH-05, AGENCY-05, Threat T-03.1-01)
  const { data: role, error: roleErr } = await supabase.rpc('get_user_role')
  if (roleErr || !role) {
    return NextResponse.json({ error: 'Não foi possível verificar o papel do usuário' }, { status: 403 })
  }
  if (role !== 'super_admin' && role !== 'tenant_admin' && role !== 'agency') {
    return NextResponse.json({ error: 'Apenas super_admin, tenant_admin e agency podem editar status de leads' }, { status: 403 })
  }

  // 4. Validar body
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Body inválido — JSON esperado' }, { status: 400 })
  }
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })
  }
  const { tenant: tenantSlug, status } = parsed.data

  // 5. Verificar escopo do tenant — NUNCA confiar no `tenant` do body para papéis não-super_admin
  //    (Threat T-05-13, IDOR/BOLA — OWASP API1:2023, mesma classe do gap fechado em meta-ads/connect)
  //
  // tenant_slug/agency_id MUST come from getClaims() (verified JWT claims), not from
  // user.app_metadata (getUser()'s result). user.app_metadata mirrors the persisted
  // auth.users.raw_app_meta_data column, which the Custom Access Token Hook never writes to —
  // only the JWT being minted at sign-in gets role/tenant_slug/agency_id injected. That column
  // is empty for every user created via admin.createUser() (lib/actions/tenants.ts /
  // agencies.ts), so this check always fell through to the "unverifiable" 403 branch for BOTH
  // tenant_admin and agency callers. See
  // .planning/debug/resolved/agency-app-metadata-getuser-mismatch.md.
  const { data: claimsData } = await supabase.auth.getClaims()
  const callerAppMetadata = claimsData?.claims?.app_metadata as
    | { tenant_slug?: string; agency_id?: string }
    | undefined

  if (role === 'tenant_admin') {
    const callerSlug = callerAppMetadata?.tenant_slug
    if (callerSlug !== tenantSlug) {
      return NextResponse.json({ error: 'Sem acesso a este tenant' }, { status: 403 })
    }
  } else if (role === 'agency') {
    const agencyId = callerAppMetadata?.agency_id
    if (!agencyId) {
      return NextResponse.json({ error: 'Não foi possível verificar a agência do usuário' }, { status: 403 })
    }
    const { data: grant } = await supabase
      .from('agency_tenants')
      .select('tenant_id, tenants!inner(slug)')
      .eq('agency_id', agencyId)
      .eq('tenants.slug', tenantSlug)
      .maybeSingle()
    if (!grant) {
      return NextResponse.json({ error: 'Sem acesso a este tenant' }, { status: 403 })
    }
  }
  // role === 'super_admin' falls through with no additional check — unchanged behavior

  // 6. Buscar credencial — SELECT EXPLÍCITO (nunca '*'). Usa service_role: sheets_service_account
  // não é SELECT-ável por 'authenticated' (migration 0016) — tenants_member_select libera a linha
  // para qualquer membro do tenant, então a coluna sensível só pode ser lida server-side, após o
  // gate de papel acima (Threat T-03.1-02/05).
  const service = createServiceClient()
  const { data: t, error: tErr } = await service
    .from('tenants')
    .select('sheet_id, sheets_service_account')
    .eq('slug', tenantSlug)
    .eq('active', true)
    .single()

  if (tErr || !t?.sheet_id || !t?.sheets_service_account) {
    return NextResponse.json({ error: 'Planilha ou credencial de escrita não configurada' }, { status: 404 })
  }

  // 7. Escrever na planilha
  const parsedSA = ServiceAccountSchema.safeParse(t.sheets_service_account)
  if (!parsedSA.success) {
    return NextResponse.json({ error: 'Credencial de escrita da planilha malformada' }, { status: 500 })
  }
  const sa = parsedSA.data
  try {
    await updateLeadStatus(t.sheet_id, sa, rowIndex, status)
    revalidateTag(`leads-${tenantSlug}`, 'max') // invalida o cache de 60s da leitura (GET /api/leads) para este tenant — Next 16 exige profile no 2º argumento
    return NextResponse.json({ success: true }) // NUNCA retornar `sa` (Threat T-03.1-02)
  } catch (e) {
    const mapped = mapSheetsError(e) // sem retry (D-07)
    return NextResponse.json({ error: mapped.message }, { status: mapped.status })
  }
}
