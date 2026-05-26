import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createOpenAI } from '@ai-sdk/openai'
import { streamText } from 'ai'
import { z } from 'zod'
import type { Round, Kill, GrenadeEvent, PlayerStats } from '@/types/database'

const bodySchema = z.object({
  sectionType: z.enum(['t_side', 'ct_side', 'a_execute', 'b_execute', 'roles', 'economy']),
  teamId:      z.string().uuid().optional(),
})

const SECTION_PROMPTS: Record<string, string> = {
  t_side:    'Generate a detailed T-Side default for {map}. Cover: opening utility usage, info-gathering positions for each player, default split routes, timing breakpoints (first 30s / mid-round / late), and how to adapt when CT reads develop. Be specific with player positions and roles.',
  ct_side:   'Generate a detailed CT-Side default for {map}. Cover: anchor positions for each player, initial utility (smokes/flashes for aggressive info denial), rotation triggers (when to rotate based on info), crossfire setups, and late-round retake coordination.',
  a_execute:'Generate a complete A site execute for {map}. Cover: full utility sequence (who throws what, in which order, at what time), entry player role, trading partners, post-plant positions, and how to adjust if the execute is read early.',
  b_execute: 'Generate a complete B site execute for {map}. Cover: full utility sequence (who throws what, in which order, at what time), entry player role, trading partners, post-plant positions, and fake potential to draw rotations.',
  roles:     'Define clear role assignments for a 5-player team on {map}. Cover: Entry Fragger (opening duels, trade bait), AWPer (angle prioritisation, economy responsibility), Support (utility execution, trade setups), Lurker (timing reads, back-line pressure), IGL (info processing, mid-round call structure). Be specific about what each role does on T and CT side.',
  economy:   'Create detailed economy rules for {map}. Cover: full buy threshold (minimum team economy), force buy trigger conditions (when trailing rounds), eco round discipline (no rogue weapons), pistol round strategy (CT vs T differences), save rules vs. risky last-round buys, and weapon priority order (rifles → AWP → pistols).',
}

type DemoParsedData = {
  header?: { map?: string; team1?: string; team2?: string; score_team1?: number; score_team2?: number; total_rounds?: number }
  opponentSide?: string
  players?: PlayerStats[]
  rounds?: Round[]
}

function buildDemoContext(demos: Array<{ parsed_data: unknown }>, map: string): string {
  const mapDemos = demos.filter(d => {
    const pd = d.parsed_data as DemoParsedData | null
    return pd?.header?.map === map
  }).slice(0, 3)

  if (mapDemos.length === 0) return ''

  const lines: string[] = [`\nTeam demo data for ${map}:`]
  mapDemos.forEach((demo, i) => {
    const pd = demo.parsed_data as DemoParsedData | null
    if (!pd?.header) return
    const h = pd.header
    lines.push(`Match ${i + 1}: Score ${h.score_team1}-${h.score_team2} (${h.total_rounds} rounds)`)

    const rounds = pd.rounds ?? []
    if (rounds.length > 0) {
      const allKills: Kill[] = rounds.flatMap(r => r.kills ?? [])
      const plants = rounds.filter(r => r.bomb_planted).length
      if (allKills.length > 0) {
        const hs = allKills.filter((k: Kill) => k.headshot).length
        lines.push(`  Kill stats: ${allKills.length} kills, ${Math.round((hs / allKills.length) * 100)}% headshots`)
      }
      if (plants > 0) lines.push(`  Bomb planted: ${plants}/${rounds.length} rounds`)

      const nades = rounds.flatMap(r => r.grenades ?? [])
      if (nades.length > 0) {
        const byType: Record<string, number> = {}
        nades.forEach((g: GrenadeEvent) => { byType[g.type] = (byType[g.type] ?? 0) + 1 })
        lines.push(`  Grenades: ${Object.entries(byType).map(([t, c]) => `${c} ${t}s`).join(', ')}`)
      }
    }

    if (pd.players && pd.players.length > 0) {
      const top = [...pd.players].sort((a, b) => b.rating - a.rating).slice(0, 5)
      lines.push(`  Players: ${top.map(p => `${p.name} (Rtg ${p.rating.toFixed(2)}, ADR ${p.adr.toFixed(0)})`).join(', ')}`)
    }
  })
  return lines.join('\n')
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let raw: unknown
  try { raw = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const { sectionType, teamId } = parsed.data

  const { data: playbook } = await supabase
    .from('playbooks')
    .select('map, name')
    .eq('id', id)
    .single()

  if (!playbook) return NextResponse.json({ error: 'Playbook not found' }, { status: 404 })

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: 'Groq API key not configured' }, { status: 503 })
  }

  let demoContext = ''
  if (teamId) {
    const admin = createAdminClient()
    const { data: demos } = await admin
      .from('demos')
      .select('parsed_data')
      .eq('team_id', teamId)
      .eq('status', 'completed')
      .eq('demo_type', 'self')
      .order('created_at', { ascending: false })
      .limit(6)
    demoContext = buildDemoContext(demos ?? [], playbook.map)
  }

  const promptTemplate = SECTION_PROMPTS[sectionType] ?? SECTION_PROMPTS.t_side
  const prompt = promptTemplate.replace(/{map}/g, playbook.map)

  const systemPrompt = `You are an expert CS2 tactical coach writing a structured playbook for a competitive team.
Map: ${playbook.map}
Playbook: ${playbook.name}
${demoContext}

Write clear, structured tactical content for the requested section. Use markdown with headers and bullet points.
Be specific to ${playbook.map} — reference real callouts, angles, and positions on this map.
${demoContext ? 'Incorporate the team demo data above to tailor recommendations to this team.' : ''}
Keep the response focused and practical — coaches should be able to read this to players directly.`

  const groq = createOpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1',
  })

  const result = streamText({
    model: groq('llama-3.3-70b-versatile'),
    system: systemPrompt,
    prompt,
    maxTokens: 1200,
    temperature: 0.6,
  })

  return new Response(
    result.textStream.pipeThrough(new TextEncoderStream()),
    {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Accel-Buffering': 'no',
      },
    }
  )
}
