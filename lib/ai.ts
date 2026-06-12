import { createOpenAI } from '@ai-sdk/openai'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Central AI provider configuration.
 *
 * Defaults to OpenAI gpt-oss-120b on Groq (open-weight reasoning model on the
 * free tier — substantially better tactical reasoning and tool use than the
 * previous Llama 3.3 70B default), but any OpenAI-compatible provider can be
 * swapped in via env without code changes:
 *   AI_API_KEY   — provider API key  (falls back to GROQ_API_KEY)
 *   AI_BASE_URL  — OpenAI-compatible base URL (falls back to Groq)
 *   AI_MODEL     — model id (falls back to openai/gpt-oss-120b)
 */
const DEFAULT_BASE_URL = 'https://api.groq.com/openai/v1'
const DEFAULT_MODEL    = 'openai/gpt-oss-120b'

export function aiConfigured(): boolean {
  return Boolean(process.env.AI_API_KEY ?? process.env.GROQ_API_KEY)
}

export function getAIModelId(): string {
  return process.env.AI_MODEL ?? DEFAULT_MODEL
}

export function getAIModel() {
  const apiKey = process.env.AI_API_KEY ?? process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('AI provider not configured')
  const provider = createOpenAI({
    apiKey,
    baseURL: process.env.AI_BASE_URL ?? DEFAULT_BASE_URL,
  })
  return provider(getAIModelId())
}

/**
 * Best-effort token usage logging into ai_usage — never throws, never blocks
 * the response path.
 */
export async function logAIUsage(params: {
  userId: string
  feature: string
  promptTokens?: number
  completionTokens?: number
}): Promise<void> {
  try {
    const admin = createAdminClient()
    await admin.from('ai_usage').insert({
      user_id:           params.userId,
      feature:           params.feature,
      model:             getAIModelId(),
      prompt_tokens:     Number.isFinite(params.promptTokens) ? params.promptTokens : null,
      completion_tokens: Number.isFinite(params.completionTokens) ? params.completionTokens : null,
    })
  } catch (err) {
    console.warn('[ai] usage logging failed:', (err as Error).message)
  }
}

/**
 * Sanitizes user-controlled values (team names, opponent names, player names)
 * before interpolation into system prompts, so a renamed team can't smuggle
 * instructions into the prompt.
 */
export function sanitizePromptValue(value: string, maxLength = 64): string {
  return value
    .replace(/[\r\n<>`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}
