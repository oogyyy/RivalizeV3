import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { getAIModelId } from '@/lib/ai'
import { z } from 'zod'

const bodySchema = z.object({
  feature: z.enum(['coach', 'playbook', 'opponent_brief', 'demo_report']),
  rating:  z.union([z.literal(1), z.literal(-1)]),
  content: z.string().min(1).max(20_000),
  prompt:  z.string().max(4_000).optional(),
  model:   z.string().max(64).optional(),
  context: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!rateLimit(`ai:feedback:${user.id}`, 30, 60_000)) {
    return rateLimitResponse()
  }

  let raw: unknown
  try { raw = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const { feature, rating, content, prompt, model, context } = parsed.data

  const { error } = await supabase.from('ai_feedback').insert({
    user_id: user.id,
    feature,
    rating,
    content,
    prompt:  prompt ?? null,
    model:   model ?? getAIModelId(),
    context: context ?? {},
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true }, { status: 201 })
}
