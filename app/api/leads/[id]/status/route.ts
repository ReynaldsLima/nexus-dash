import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { z } from 'zod/v4' // import é 'zod/v4' (padrão do projeto)
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { updateLeadStatus, mapSheetsError, type ServiceAccountCreds } from '@/lib/sheets'

export const runtime = 'nodejs' // OBRIGATÓRIO: assinatura RS256 do JWT usa o módulo crypto do Node — não roda no Edge

const BodySchema = z.object({
  tenant: z.string().min(1),
  status: z.string().min(1).max(200), // status vem de texto livre na planilha; cat() em lib/leads.ts parseia por keyword
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

  // 3. Role gate — só super_admin/tenant_admin (OQ #1, AUTH-05, Threat T-03.1-01)
  const { data: role, error: roleErr } = await supabase.rpc('get_user_role')
  if (roleErr || !role) {
    return NextResponse.json({ error: 'Não foi possível verificar o papel do usuário' }, { status: 403 })
  }
  if (role !== 'super_admin' && role !== 'tenant_admin') {
    return NextResponse.json({ error: 'Apenas super_admin e tenant_admin podem editar status de leads' }, { status: 403 })
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

  // 5. Buscar credencial — SELECT EXPLÍCITO (nunca '*'). Usa service_role: sheets_service_account
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

  // 6. Escrever na planilha
  const sa = t.sheets_service_account as unknown as ServiceAccountCreds
  try {
    await updateLeadStatus(t.sheet_id, sa, rowIndex, status)
    revalidateTag(`leads-${tenantSlug}`, 'max') // invalida o cache de 60s da leitura (GET /api/leads) para este tenant — Next 16 exige profile no 2º argumento
    return NextResponse.json({ success: true }) // NUNCA retornar `sa` (Threat T-03.1-02)
  } catch (e) {
    const mapped = mapSheetsError(e) // sem retry (D-07)
    return NextResponse.json({ error: mapped.message }, { status: mapped.status })
  }
}
