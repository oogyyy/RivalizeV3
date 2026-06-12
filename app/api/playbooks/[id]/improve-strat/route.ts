import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateText } from 'ai'
import { z } from 'zod'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { aiConfigured, getAIModel, logAIUsage } from '@/lib/ai'
import { calloutGuide } from '@/lib/map-callouts'
import { cs2Doctrine } from '@/lib/cs2-doctrine'

const stratSchema = z.object({
  id:   z.string().max(64),
  name: z.string().max(120),
  side: z.enum(['t', 'ct']),
  assignments: z.array(z.object({
    player:      z.string().max(64),
    instruction: z.string().max(1000),
  })).length(5),
})

const bodySchema = z.object({ strat: stratSchema })

type Strat = z.infer<typeof stratSchema>

function parseImproved(text: string, original: Strat): Strat | null {
  // Models sometimes wrap JSON in markdown fences or add prose around it
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    const raw = JSON.parse(match[0]) as { name?: unknown; assignments?: unknown }
    const assignments = Array.isArray(raw.assignments) ? raw.assignments : []
    if (assignments.length !== 5) return null
    return {
      id:   original.id,
      side: original.side,
      name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 120) : original.name,
      assignments: original.assignments.map((a, i) => {
        const out = assignments[i] as { instruction?: unknown } | undefined
        const instruction = typeof out?.instruction === 'string' ? out.instruction.trim().slice(0, 1000) : a.instruction
        // Player assignments belong to the user — the AI only rewrites instructions
        return { player: a.player, instruction }
      }),
    }
  } catch {
    return null
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!rateLimit(`ai:strat:${user.id}`, 15, 60_000)) {
    return rateLimitResponse()
  }

  let raw: unknown
  try { raw = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  const { strat } = parsed.data

  // RLS-scoped read doubles as the access check
  const { data: playbook } = await supabase
    .from('playbooks')
    .select('map, name, opponent_name')
    .eq('id', id)
    .single()
  if (!playbook) return NextResponse.json({ error: 'Playbook not found' }, { status: 404 })

  if (!aiConfigured()) {
    return NextResponse.json({ error: 'AI provider not configured' }, { status: 503 })
  }

  const sideLabel = strat.side === 't' ? 'T-side (attacking)' : 'CT-side (defending)'
  const rows = strat.assignments
    .map((a, i) => `${i + 1}. ${a.player || `Player ${i + 1}`}: ${a.instruction || '(empty)'}`)
    .join('\n')

  const systemPrompt = `You are an expert CS2 coach refining a team's set play on ${playbook.map}.
${cs2Doctrine()}
${calloutGuide(playbook.map)}

The coach wrote a ${sideLabel} strat as five per-player instructions. Rewrite each instruction to be sharper and more professional:
- Keep the coach's INTENT — refine and complete it, do not replace the play with a different one
- Use exact ${playbook.map} callouts, add timings and utility details where missing
- Each instruction: 1-2 sentences, readable aloud in a team meeting
- All five instructions must be side-consistent (${sideLabel}) and physically possible together as ONE coordinated play
- If an instruction is empty, infer a sensible job that supports the other four

Respond with ONLY this JSON, no other text:
{"name": "improved strat name (keep it if already good)", "assignments": [{"instruction": "..."}, {"instruction": "..."}, {"instruction": "..."}, {"instruction": "..."}, {"instruction": "..."}]}
The 5 assignments must be in the same order as the input rows.`

  try {
    const result = await generateText({
      model: getAIModel(),
      system: systemPrompt,
      prompt: `Strat: "${strat.name}" (${sideLabel})\n${rows}`,
      maxTokens: 1200,
      temperature: 0.3,
    })

    await logAIUsage({
      userId: user.id,
      feature: 'playbook',
      promptTokens: result.usage?.promptTokens,
      completionTokens: result.usage?.completionTokens,
    })

    const improved = parseImproved(result.text, strat)
    if (!improved) return NextResponse.json({ error: 'AI returned an unusable response — try again' }, { status: 502 })
    return NextResponse.json({ strat: improved })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'AI generation failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
