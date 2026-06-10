import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateText } from 'ai'
import { z } from 'zod'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { aiConfigured, getAIModel, logAIUsage, sanitizePromptValue } from '@/lib/ai'

const bodySchema = z.object({
  selfMapStats: z.record(z.object({ wins: z.number(), losses: z.number(), winRate: z.number() })),
  opponentMapPicks: z.record(z.number()).optional(),
  opponentName: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 10 veto recommendations per user per minute
  if (!rateLimit(`ai:veto:${user.id}`, 10, 60_000)) {
    return rateLimitResponse()
  }

  if (!aiConfigured()) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 503 })
  }

  let raw: unknown
  try { raw = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const { selfMapStats, opponentMapPicks } = parsed.data
  const opponentName = parsed.data.opponentName ? sanitizePromptValue(parsed.data.opponentName) : undefined

  const selfLines = Object.entries(selfMapStats)
    .sort(([, a], [, b]) => b.winRate - a.winRate)
    .map(([map, s]) => `  ${map}: ${Math.round(s.winRate * 100)}% win rate (${s.wins}W-${s.losses}L)`)
    .join('\n')

  const oppLines = opponentMapPicks
    ? Object.entries(opponentMapPicks)
        .sort(([, a], [, b]) => b - a)
        .map(([map, count]) => `  ${map}: picked ${count}x`)
        .join('\n')
    : null

  const prompt = opponentName && oppLines
    ? `You are a CS2 tactical coach helping a team prepare their map veto against ${opponentName}.

Your team's map performance (active duty maps only):
${selfLines}

${opponentName}'s map picks (from demo data):
${oppLines}

Generate a 7-step veto order recommendation (Bo1 format). For each step specify:
- Which team acts (Your Team / Opponent)
- Action (Ban or Pick)
- Map name
- Brief reason (1 sentence)

Then add a final "Decider" prediction if it goes to a third map.
Keep it concise and tactical.`
    : `You are a CS2 tactical coach analysing a team's map pool.

Team's map performance:
${selfLines}

Based on this data, recommend:
1. Their 3 strongest maps to pick/protect
2. Their 3 weakest maps to ban early
3. One "wildcard" map that could surprise opponents

Keep it concise (3-4 bullet points per section).`

  const { text, usage } = await generateText({
    model: getAIModel(),
    prompt,
    maxTokens: 600,
    temperature: 0.5,
  })

  await logAIUsage({
    userId: user.id,
    feature: 'veto',
    promptTokens: usage?.promptTokens,
    completionTokens: usage?.completionTokens,
  })

  return NextResponse.json({ recommendation: text })
}
