import { NextRequest, NextResponse } from 'next/server'
import { streamText } from 'ai'
import { z } from 'zod/v4'
import { createClient } from '@/lib/supabase/server'
import { insightModel } from '@/lib/ai/anthropic'
import { checkRateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs' // getClaims() usa RS256 (crypto do Node) — não roda no Edge

const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1),
})
const BodySchema = z.object({
  tenant: z.string().min(1),            // D-05 — campo novo obrigatório
  system: z.string().min(1),
  messages: z.array(MessageSchema).min(1),
})

export async function POST(req: NextRequest) {
  // 1. Auth
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 2. Role gate — mesmo conjunto que PATCH /api/leads/[id]/status
  const { data: role, error: roleErr } = await supabase.rpc('get_user_role')
  if (roleErr || !role) {
    return NextResponse.json({ error: 'Não foi possível verificar o papel do usuário' }, { status: 403 })
  }
  if (role !== 'super_admin' && role !== 'tenant_admin' && role !== 'agency') {
    return NextResponse.json({ error: 'Apenas super_admin, tenant_admin e agency podem usar o Agente IA' }, { status: 403 })
  }

  // 3. Validar body (inclui o novo campo `tenant`, D-05)
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Body inválido — JSON esperado' }, { status: 400 })
  }
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })
  }
  const { tenant: tenantSlug, system, messages } = parsed.data

  // 4. Escopo tenant/agency via getClaims() (nunca o app_metadata bruto de getUser()) — idêntico ao PATCH step 5
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
  // role === 'super_admin' cai direto

  // 5. Rate limit — por user_id, 20/5min (D-03). DEPOIS do auth para ter uma chave de usuário real
  //    (requests não autorizados nunca consomem a cota do usuário — Pitfall 5).
  const rl = checkRateLimit(user.id, { max: 20, windowMs: 5 * 60 * 1000 })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Limite de mensagens atingido. Tente novamente em ${rl.retryAfterSeconds}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
    )
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada.' }, { status: 500 })
  }

  // 6. Chamar Claude via o wrapper compartilhado (D-06) em vez de fetch raw
  const result = streamText({
    model: insightModel,
    system,
    messages, // Array<{role: 'user'|'assistant', content: string}> — casa com ModelMessage
  })

  return result.toTextStreamResponse()
}
