import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createOpenAI } from '@ai-sdk/openai'
import { streamText } from 'ai'
import { z } from 'zod'
import type { Round, Kill, GrenadeEvent, PlayerStats } from '@/types/database'
import { detectTacticalPatterns } from '@/lib/cs2-zones'

const bodySchema = z.object({
  sectionType: z.enum(['t_side', 'ct_side', 'a_execute', 'b_execute', 'roles', 'economy']),
  teamId:      z.string().uuid().optional(),
})

// ── Prompt sets ──────────────────────────────────────────────────────────────

const UTILITY_FORMAT_INSTRUCTION = `
UTILITY FORMATTING RULES (follow for every grenade/molotov/flash mentioned):
1. Name the EXACT throw position using the map's standard callout (e.g. "B Apps", "Top Mid", "CT Spawn").
2. Name the EXACT target/landing callout — never say "towards the site". Say "CT smoke", "Van smoke", "Market Window smoke", "Short corner flash", etc.
3. After each utility entry append a markdown link: [▶ Watch lineup](https://www.youtube.com/results?search_query=cs2+{map}+UTILITY_TYPE+FROM_CALLOUT+to+LANDING_CALLOUT) — substitute real callout names, lowercase, spaces replaced with +.
Example: [▶ Watch lineup](https://www.youtube.com/results?search_query=cs2+mirage+smoke+b+apps+to+ct)
`

const SELF_PROMPTS: Record<string, string> = {
  t_side:    'Generate a detailed T-Side default for {map}. Cover: opening utility usage, info-gathering positions for each player, default split routes, timing breakpoints (first 30s / mid-round / late), and how to adapt when CT reads develop. Be specific with player positions and roles. Use exact {map} callouts throughout.',
  ct_side:   'Generate a detailed CT-Side default for {map}. Cover: anchor positions for each player, initial utility (smokes/flashes for aggressive info denial), rotation triggers (when to rotate based on info), crossfire setups, and late-round retake coordination. Use exact {map} callouts throughout.',
  a_execute: 'Generate a complete A site execute for {map}. Cover: full utility sequence (who throws what, from which exact callout, landing on which exact callout, and at what time), entry player role, trading partners, post-plant positions, and how to adjust if the execute is read early.',
  b_execute: 'Generate a complete B site execute for {map}. Cover: full utility sequence (who throws what, from which exact callout, landing on which exact callout, and at what time), entry player role, trading partners, post-plant positions, and fake potential to draw rotations.',
  roles:     'Define clear role assignments for a 5-player team on {map}. Cover: Entry Fragger, AWPer, Support, Lurker, IGL — specific to T and CT side on this map.',
  economy:   'Create detailed economy rules for {map}. Cover: full buy threshold, force buy triggers, eco discipline, pistol round strategy, save rules, and weapon priority.',
}

const ANTISTRAT_PROMPTS: Record<string, string> = {
  t_side:    'Based on this opponent\'s CT-side patterns on {map}, design our T-side attack plan to exploit their weaknesses. Cover: their typical CT anchor positions and rotations, which site is most attackable and why, specific utility to neutralise their setups, timing windows when their rotations are slow, and fake options to open up the map. Use exact {map} callouts throughout.',
  ct_side:   'Based on this opponent\'s T-side tendencies on {map}, design our CT-side setup to shut them down. Cover: their most common executes and default routes, CT positions that counter their entry paths, utility to deny their setups, rotation triggers based on their patterns, and how to stop their key bomb plant locations. Use exact {map} callouts throughout.',
  a_execute: 'Analyse how this opponent defends A site on {map} and build our A execute to beat their setup. Cover: their A anchor positions and utility stack, our smoke/flash sequence (from which exact callout, landing on which exact callout) to clear those positions, entry angles that bypass their crossfires, trading setups, and post-plant positioning against their retake patterns.',
  b_execute: 'Analyse how this opponent defends B site on {map} and build our B execute to beat their setup. Cover: their B defensive positions and timings, our utility (from which exact callout, landing on which exact callout) to clear their setup, coordinated entry plan, and how to use a B fake to draw their CT rotations and create an opening.',
  roles:     'Based on this opponent\'s player tendencies and stats on {map}, assign our team roles to maximise counter-play. For each role (Entry Fragger, AWPer, Support, Lurker, IGL) explain how they should specifically play against this opponent\'s personnel and patterns to gain maximum advantage.',
  economy:   'Based on this opponent\'s economic patterns on {map}, build our economy counter-strategy. Cover: when they typically force buy and how we punish it, how we play against their eco rounds, their buy preferences on CT vs T side, when we should drop weapons vs. save, and how to create economic pressure through consistent round wins.',
}

// ── Demo context helpers ─────────────────────────────────────────────────────

type DemoParsedData = {
  header?: { map?: string; team1?: string; team2?: string; score_team1?: number; score_team2?: number; total_rounds?: number }
  opponentSide?: string
  players?: PlayerStats[]
  rounds?: Round[]
}

function buildDemoContext(
  demos: Array<{ parsed_data: unknown }>,
  map: string,
  label: string,
): string {
  const mapDemos = demos
    .filter(d => (d.parsed_data as DemoParsedData | null)?.header?.map === map)
    .slice(0, 5)

  if (mapDemos.length === 0) return ''

  const lines: string[] = [`\n${label} demo data for ${map}:`]
  const allRoundSets: Round[][] = []

  mapDemos.forEach((demo, i) => {
    const pd = demo.parsed_data as DemoParsedData | null
    if (!pd?.header) return
    const h = pd.header
    lines.push(`Match ${i + 1}: Score ${h.score_team1}-${h.score_team2} (${h.total_rounds} rounds)`)

    const rounds = pd.rounds ?? []
    if (rounds.length > 0) {
      allRoundSets.push(rounds)

      const allKills: Kill[] = rounds.flatMap(r => r.kills ?? [])
      const plants = rounds.filter(r => r.bomb_planted).length
      if (allKills.length > 0) {
        const hs = allKills.filter((k: Kill) => k.headshot).length
        lines.push(`  Kills: ${allKills.length}, HS% ${Math.round((hs / allKills.length) * 100)}%`)
      }
      if (plants > 0) lines.push(`  Bomb planted: ${plants}/${rounds.length} rounds`)

      const nades = rounds.flatMap(r => r.grenades ?? [])
      if (nades.length > 0) {
        const byType: Record<string, number> = {}
        nades.forEach((g: GrenadeEvent) => { byType[g.type] = (byType[g.type] ?? 0) + 1 })
        lines.push(`  Grenades: ${Object.entries(byType).map(([t, c]) => `${c} ${t}s`).join(', ')}`)
      }

      // Economy pattern
      const ecoPct = Math.round((rounds.filter(r => (r.team1_economy ?? 0) < 2000 || (r.team2_economy ?? 0) < 2000).length / Math.max(rounds.length, 1)) * 100)
      if (ecoPct > 0) lines.push(`  Eco/force rounds: ~${ecoPct}%`)
    }

    if (pd.players && pd.players.length > 0) {
      const top = [...pd.players].sort((a, b) => b.rating - a.rating).slice(0, 5)
      lines.push(`  Players: ${top.map(p => `${p.name} (Rtg ${p.rating.toFixed(2)}, ADR ${p.adr.toFixed(0)}${p.kast != null ? `, KAST ${Math.round(p.kast * 100)}%` : ''})`).join(', ')}`)
    }
  })

  // Cross-demo execute patterns (only useful with 2+ demos on the same map)
  if (allRoundSets.length >= 2) {
    const patterns = detectTacticalPatterns(allRoundSets, map)
    if (patterns.hasData) {
      lines.push(`\nCross-demo execute tendencies on ${map} (${allRoundSets.length} demos):`)
      lines.push(...patterns.text)
    }
  }

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
    .select('map, name, folder_id, opponent_name, team_id, players')
    .eq('id', id)
    .single()

  if (!playbook) return NextResponse.json({ error: 'Playbook not found' }, { status: 404 })

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: 'Groq API key not configured' }, { status: 503 })
  }

  const isAntistrat = !!playbook.folder_id
  const admin = createAdminClient()
  let demoContext = ''

  if (isAntistrat && playbook.folder_id) {
    // Fetch opponent folder stats
    const { data: folder } = await supabase
      .from('team_folders')
      .select('opponent_display_name, aggregated_stats')
      .eq('id', playbook.folder_id)
      .single()

    if (folder) {
      const stats = folder.aggregated_stats as {
        total_matches?: number; wins?: number; losses?: number; win_rate?: number; avg_rating?: number; maps_played?: Record<string, number>
      } | null
      const foldTeamId = teamId ?? playbook.team_id
      demoContext += `\nOpponent: ${folder.opponent_display_name}`
      demoContext += `\nRecord: ${stats?.wins ?? 0}W-${stats?.losses ?? 0}L (${Math.round((stats?.win_rate ?? 0) * 100)}% win rate), avg rating ${stats?.avg_rating?.toFixed(2) ?? 'N/A'}`
      if (stats?.maps_played) {
        const mapPref = Object.entries(stats.maps_played).sort((a,b) => b[1]-a[1]).slice(0,3).map(([m,c]) => `${m}(${c}x)`).join(', ')
        demoContext += `\nMap preferences: ${mapPref}`
      }

      // Fetch opponent demos
      const { data: oppDemos } = await supabase
        .from('demos')
        .select('parsed_data')
        .eq('team_id', foldTeamId)
        .eq('opponent_slug', (folder as { opponent_slug?: string } & typeof folder).opponent_slug ?? '')
        .eq('status', 'completed')
        .eq('demo_type', 'opponent')
        .order('created_at', { ascending: false })
        .limit(5)

      demoContext += buildDemoContext(oppDemos ?? [], playbook.map, `${folder.opponent_display_name} opponent`)
    }
  } else if (teamId) {
    // Self-improvement: use own demos
    const { data: selfDemos } = await admin
      .from('demos')
      .select('parsed_data')
      .eq('team_id', teamId)
      .eq('status', 'completed')
      .eq('demo_type', 'self')
      .order('created_at', { ascending: false })
      .limit(5)
    demoContext = buildDemoContext(selfDemos ?? [], playbook.map, 'Team')
  }

  const prompts    = isAntistrat ? ANTISTRAT_PROMPTS : SELF_PROMPTS
  const promptTmpl = prompts[sectionType] ?? prompts.t_side
  const prompt     = promptTmpl.replace(/{map}/g, playbook.map)

  // Build roster instruction — use stored names, or role labels, never invented names
  const storedPlayers: string[] = (playbook as { players?: string[] }).players ?? []
  const rosterInstruction = storedPlayers.length > 0
    ? `\nTeam roster — use ONLY these exact names for players, never invent names:\n${storedPlayers.map((n, i) => `${i + 1}. ${n}`).join('\n')}`
    : `\nDo NOT invent player names. Refer to players by role only (Entry Fragger, AWPer, Support, Lurker, IGL).`

  const utilityInstruction = UTILITY_FORMAT_INSTRUCTION.replace(/{map}/g, playbook.map.replace('de_', ''))

  const systemPrompt = isAntistrat
    ? `You are an expert CS2 anti-strat analyst building a pre-match counter-strategy playbook against a specific opponent.
Map: ${playbook.map}
Playbook: ${playbook.name}
${demoContext}
${rosterInstruction}
${utilityInstruction}
Write tactical anti-strat content for the requested section. Use markdown with headers and bullet points.
Be specific to ${playbook.map} callouts and positions — never use vague phrases like "towards the site".
Base your analysis directly on the opponent demo data above — reference their specific tendencies, players, and patterns.
Every recommendation should directly counter what this opponent does.`
    : `You are an expert CS2 tactical coach writing a structured playbook for a competitive team.
Map: ${playbook.map}
Playbook: ${playbook.name}
${demoContext}
${rosterInstruction}
${utilityInstruction}
Write clear, structured tactical content. Use markdown with headers and bullet points.
Be specific to ${playbook.map} — use real callout names for every position, throw point, and landing spot. Never use vague phrases like "towards the site".
${demoContext ? 'Incorporate the team demo data above to tailor recommendations.' : ''}
Keep it practical — coaches should be able to read this to players directly.`

  const groq = createOpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1',
  })

  const result = streamText({
    model: groq('llama-3.3-70b-versatile'),
    system: systemPrompt,
    prompt,
    maxTokens: 1600,
    temperature: 0.6,
  })

  return new Response(
    result.textStream.pipeThrough(new TextEncoderStream()),
    { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Accel-Buffering': 'no' } }
  )
}
