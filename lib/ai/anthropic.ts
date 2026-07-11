import { anthropic } from '@ai-sdk/anthropic'

// claude-sonnet-4-6 is the non-negotiable model per CLAUDE.md Constraints.
// @ai-sdk/anthropic reads ANTHROPIC_API_KEY from the environment automatically.
export const MODEL_ID = 'claude-sonnet-4-6'
export const insightModel = anthropic(MODEL_ID)
