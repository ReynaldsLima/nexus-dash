import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Lead } from '@/lib/leads'

export async function GET(req: NextRequest) {
  const tenantSlug = req.nextUrl.searchParams.get('tenant')
  if (!tenantSlug) return NextResponse.json({ error: 'tenant param required' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
  const res = await fetch(url, { next: { revalidate: 60 } })
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
