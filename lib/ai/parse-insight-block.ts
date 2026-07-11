import { z } from 'zod/v4'

export const InsightBlockSchema = z.object({
  type: z.enum(['optimization', 'alert', 'opportunity']),
  title: z.string().min(1),
  impact: z.enum(['high', 'medium', 'low']),
  metrics: z.array(z.object({ label: z.string(), value: z.string(), delta: z.string().optional() })),
  recommendations: z.array(z.string()).min(1),
})

export type InsightBlock = z.infer<typeof InsightBlockSchema>

/** Extracts and validates the trailing <insight_data> JSON block. Returns null on any failure. */
export function extractStructuredBlock(fullText: string): InsightBlock | null {
  const match = fullText.match(/<insight_data>([\s\S]*?)<\/insight_data>/)
  if (!match) return null
  try {
    const json = JSON.parse(match[1])
    return InsightBlockSchema.parse(json)
  } catch {
    return null
  }
}

/** Returns the human-readable prose with the trailing <insight_data> block stripped off. */
export function stripStructuredBlock(fullText: string): string {
  return fullText.split('<insight_data>')[0].trim()
}
