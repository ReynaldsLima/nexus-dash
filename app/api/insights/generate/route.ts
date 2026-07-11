import { streamText } from 'ai'
import { insightModel } from '@/lib/ai/anthropic'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { extractStructuredBlock, stripStructuredBlock } from '@/lib/ai/parse-insight-block'
import { buildOnDemandPrompt, resolveTenantId } from '@/lib/ai/insight-prompt'

// Node runtime required: service role client uses 'server-only', and the Anthropic call
// must not be bundled or executed in the Edge runtime.
export const runtime = 'nodejs'
export const maxDuration = 60 // Fluid Compute allows up to 300s on Hobby; 60 is the expected ceiling

export async function POST(req: Request) {
  // ── 1. Auth: verify session ───────────────────────────────────────────────
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  // ── 2. Role check: super_admin ONLY (AI-03 literal wording) ───────────────
  const { data: role, error: roleErr } = await supabase.rpc('get_user_role')
  if (roleErr || !role) return new Response('Forbidden', { status: 403 })
  if (role !== 'super_admin') return new Response('Forbidden', { status: 403 })

  // ── 3. Parse and validate request body ────────────────────────────────────
  let body: { tenantSlug?: string }
  try {
    body = await req.json()
  } catch {
    return new Response('Bad Request', { status: 400 })
  }
  if (!body.tenantSlug) return new Response('Bad Request', { status: 400 })

  const tenantId = await resolveTenantId(body.tenantSlug)
  if (!tenantId) return new Response('Tenant not found', { status: 404 })

  // ── 4. Build prompt (aggregates last 30d of daily_rollups + campaign_metrics) ─
  const prompt = await buildOnDemandPrompt(tenantId)
  const service = createServiceClient()

  // ── 5. Stream the analysis token-by-token (D-01/D-12), auto-persist on finish (D-03) ─
  const result = streamText({
    model: insightModel,
    system: prompt.system,
    prompt: prompt.user,
    onFinish: async ({ text }) => {
      const parsed = extractStructuredBlock(text)
      const prose = stripStructuredBlock(text)
      // Parse-failure policy (D-03 must always hold): persist a fallback row rather than drop.
      await service.from('ai_insights').insert({
        tenant_id: tenantId,
        source: 'on_demand',
        type: parsed?.type ?? 'optimization',
        title: parsed?.title ?? 'Análise de campanhas',
        summary: prose || text,
        metrics: parsed?.metrics ?? [],
        recommendations: parsed?.recommendations ?? [],
        impact: parsed?.impact ?? 'medium',
      })
    },
  })

  return result.toTextStreamResponse()
}
