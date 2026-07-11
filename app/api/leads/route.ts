import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Lead } from '@/lib/leads'

export const runtime = 'nodejs' // getClaims() usa RS256 (módulo crypto do Node) — não roda no Edge

export async function GET(req: NextRequest) {
  // 1. Validar param de tenant primeiro (antes de tocar auth)
  const tenantSlug = req.nextUrl.searchParams.get('tenant')
  if (!tenantSlug) return NextResponse.json({ error: 'tenant param required' }, { status: 400 })

  // 2. Auth
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 3. Role gate — mesmo conjunto que PATCH /api/leads/[id]/status (AGENCY-08)
  const { data: role, error: roleErr } = await supabase.rpc('get_user_role')
  if (roleErr || !role) {
    return NextResponse.json({ error: 'Não foi possível verificar o papel do usuário' }, { status: 403 })
  }
  if (role !== 'super_admin' && role !== 'tenant_admin' && role !== 'agency') {
    return NextResponse.json({ error: 'Apenas super_admin, tenant_admin e agency podem acessar leads' }, { status: 403 })
  }

  // 4. Escopo tenant/agency via getClaims() — NUNCA via app_metadata de getUser() — idêntico ao PATCH step 5
  const { data: claimsData } = await supabase.auth.getClaims()
  const callerAppMetadata = claimsData?.claims?.app_metadata as
    | { tenant_slug?: string; agency_id?: string }
    | undefined

  if (role === 'tenant_admin') {
    if (callerAppMetadata?.tenant_slug !== tenantSlug) {
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
  // role === 'super_admin' cai direto sem checagem extra

  // 5. Lookup do tenant + leitura da planilha — INALTERADO
  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('sheet_id, sheets_api_key')
    .eq('slug', tenantSlug)
    .eq('active', true)
    .single()

  if (error || !tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  if (!tenant.sheet_id || !tenant.sheets_api_key) {
    return NextResponse.json({ leads: [], configured: false })
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${tenant.sheet_id}/values/Leads!A2:H500?key=${tenant.sheets_api_key}`
  const res = await fetch(url, { next: { revalidate: 60, tags: [`leads-${tenantSlug}`] } })
  if (!res.ok) {
    const text = await res.text()
    return NextResponse.json({ error: `Sheets API error: ${res.status} ${text}` }, { status: 502 })
  }

  const json = await res.json()
  const rows: string[][] = json.values ?? []
  const leads: Lead[] = rows.map((r, i) => ({
    id: i,
    nome: r[0] ?? '',
    telefone: r[1] ?? '',
    email: r[2] ?? '',
    empresa: r[3] ?? '',
    criado_em: r[4] ?? '',
    status: r[5] ?? '',
    hora_resposta: r[6] ?? '',
    tipo_seguro: r[7] ?? '',
  }))

  return NextResponse.json({ leads, configured: true })
}
