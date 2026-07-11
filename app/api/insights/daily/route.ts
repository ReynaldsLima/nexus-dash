import { timingSafeEqual } from 'node:crypto'
import { generateText } from 'ai'
import { insightModel } from '@/lib/ai/anthropic'
import { createServiceClient } from '@/lib/supabase/service'
import { extractStructuredBlock, stripStructuredBlock } from '@/lib/ai/parse-insight-block'
import { buildDailyPrompt } from '@/lib/ai/insight-prompt'

// Node runtime required: service role client uses 'server-only', and the Anthropic call
// must not be bundled or executed in the Edge runtime.
export const runtime = 'nodejs'
export const maxDuration = 60 // no human watching; well under Fluid Compute's 300s ceiling

/** Constant-time string comparison to avoid a timing side-channel on the shared secret. */
function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

export async function POST(req: Request) {
  // Shared-secret auth (no Supabase session — server-to-server call from N8N)
  const secret = req.headers.get('x-n8n-secret')
  const expected = process.env.N8N_INSIGHTS_SECRET
  if (!secret || !expected || !safeCompare(secret, expected)) {
    return new Response('Unauthorized', { status: 401 })
  }

  let body: { tenantId?: string }
  try {
    body = await req.json()
  } catch {
    return new Response('Bad Request', { status: 400 })
  }
  if (!body.tenantId) return new Response('Bad Request', { status: 400 })

  const service = createServiceClient()

  // D-07 eligibility: only tenants with >= 1 ad_accounts row. Never trust the payload tenantId
  // blindly (04-RESEARCH.md anti-pattern) — validate server-side.
  const { data: accounts } = await service
    .from('ad_accounts')
    .select('id')
    .eq('tenant_id', body.tenantId)
    .limit(1)
  if (!accounts || accounts.length === 0) {
    return new Response(JSON.stringify({ skipped: true, reason: 'no ad_accounts' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }

  const prompt = await buildDailyPrompt(body.tenantId)
  const { text } = await generateText({ model: insightModel, system: prompt.system, prompt: prompt.user })

  const parsed = extractStructuredBlock(text)
  const prose = stripStructuredBlock(text)
  const { error: insertError } = await service.from('ai_insights').insert({
    tenant_id: body.tenantId,
    source: 'daily',
    type: parsed?.type ?? 'optimization',
    title: parsed?.title ?? 'Análise diária de campanhas',
    summary: prose || text,
    metrics: parsed?.metrics ?? [],
    recommendations: parsed?.recommendations ?? [],
    impact: parsed?.impact ?? 'medium',
  })
  if (insertError) {
    console.error('[insights/daily] insert failed', insertError)
    return new Response(JSON.stringify({ ok: false, error: insertError.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}
