import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateText } from 'ai'
import type { PlayerStats, Round, Kill, GrenadeEvent } from '@/types/database'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { aiConfigured, getAIModel, logAIUsage } from '@/lib/ai'

type ParsedData = {
  header?: {
    map?: string; team1?: string; team2?: string
    score_team1?: number; score_team2?: number; total_rounds?: number
  }
  opponentSide?: string
  players?: PlayerStats[]
  rounds?: Round[]
}

function buildReportContext(pd: ParsedData, demoType: string): string {
  const h = pd.header ?? {}
  const lines: string[] = []
  const map = h.map ?? 'unknown'
  const opSide = pd.opponentSide ?? 'team2'

  lines.push(`Map: ${map}`)
  lines.push(`Score: ${h.team1 ?? 'Team 1'} ${h.score_team1 ?? 0} – ${h.score_team2 ?? 0} ${h.team2 ?? 'Team 2'}`)
  lines.push(`Total rounds: ${h.total_rounds ?? 0}`)
  lines.push(`Demo type: ${demoType}`)

  const allKills: Kill[] = (pd.rounds ?? []).flatMap((r) => r.kills ?? [])
  const grenades: GrenadeEvent[] = (pd.rounds ?? []).flatMap((r) => r.grenades ?? [])
  const plants = (pd.rounds ?? []).filter((r) => r.bomb_planted).length

  if (h.total_rounds) lines.push(`Bomb plants: ${plants}/${h.total_rounds} rounds (${Math.round((plants / h.total_rounds) * 100)}%)`)

  if (allKills.length > 0) {
    const hs = allKills.filter((k) => k.headshot).length
    lines.push(`Total kills: ${allKills.length}, HS%: ${Math.round((hs / allKills.length) * 100)}%`)

    const weaponCounts: Record<string, number> = {}
    for (const k of allKills) {
      const w = k.weapon.includes('awp') ? 'AWP' : k.weapon.includes('ak') ? 'AK-47' : k.weapon.includes('m4') ? 'M4' : k.weapon
      weaponCounts[w] = (weaponCounts[w] ?? 0) + 1
    }
    const topWeapons = Object.entries(weaponCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([w, c]) => `${w}(${c})`).join(', ')
    lines.push(`Top weapons: ${topWeapons}`)
  }

  if (grenades.length > 0) {
    const byType: Record<string, number> = {}
    for (const g of grenades) byType[g.type] = (byType[g.type] ?? 0) + 1
    lines.push(`Utility: ${Object.entries(byType).map(([t, c]) => `${c} ${t}s`).join(', ')}`)
  }

  const players = pd.players ?? []
  if (players.length > 0) {
    const opLabel = opSide === 'team1' ? (h.team1 ?? '') : (h.team2 ?? '')
    const ourPlayers  = players.filter((p) => p.team !== opLabel).sort((a, b) => b.rating - a.rating)
    const theirPlayers = players.filter((p) => p.team === opLabel).sort((a, b) => b.rating - a.rating)

    if (ourPlayers.length > 0) {
      lines.push('\nOur players (by rating):')
      for (const p of ourPlayers.slice(0, 5)) {
        const kast = p.kast != null ? `, KAST ${Math.round(p.kast * 100)}%` : ''
        lines.push(`  ${p.name}: Rating ${p.rating.toFixed(2)}, K/D ${p.kills}/${p.deaths}, ADR ${p.adr.toFixed(0)}, HS ${Math.round(p.headshot_percentage)}%${kast}`)
      }
    }

    if (theirPlayers.length > 0) {
      lines.push('\nOpponent players (by rating):')
      for (const p of theirPlayers.slice(0, 5)) {
        lines.push(`  ${p.name}: Rating ${p.rating.toFixed(2)}, K/D ${p.kills}/${p.deaths}, ADR ${p.adr.toFixed(0)}`)
      }
    }
  }

  // Economy
  const rounds: Round[] = pd.rounds ?? []
  if (rounds.length > 0) {
    const ecoRounds = rounds.filter((r) => (r.team1_economy ?? 0) < 2000 || (r.team2_economy ?? 0) < 2000).length
    if (ecoRounds > 0) lines.push(`\nEco/force rounds: ${ecoRounds}/${rounds.length}`)
  }

  return lines.join('\n')
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ demoId: string }> },
) {
  const { demoId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: demo } = await admin
    .from('demos')
    .select('id, team_id, map, demo_type, parsed_data, ai_report, status')
    .eq('id', demoId)
    .single()

  if (!demo) return NextResponse.json({ error: 'Demo not found' }, { status: 404 })
  if (demo.status !== 'completed') return NextResponse.json({ error: 'Demo not parsed yet' }, { status: 400 })

  // Return cached report if recent
  if (demo.ai_report) {
    return NextResponse.json({ report: demo.ai_report, cached: true })
  }

  // Auth: user must be a member of the demo's team
  const { data: membership } = await admin
    .from('team_members')
    .select('role')
    .eq('team_id', demo.team_id)
    .eq('user_id', user.id)
    .single()
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // 5 report generations per user per minute (cache hits above are unaffected)
  if (!rateLimit(`ai:report:${user.id}`, 5, 60_000)) {
    return rateLimitResponse()
  }

  if (!aiConfigured()) return NextResponse.json({ error: 'AI not configured' }, { status: 503 })

  const pd = demo.parsed_data as ParsedData | null
  if (!pd) return NextResponse.json({ error: 'No parsed data' }, { status: 400 })

  const context = buildReportContext(pd, demo.demo_type)
  const isSelf = demo.demo_type === 'self'

  const systemPrompt = isSelf
    ? `You are a CS2 performance analyst. Given match data for MY TEAM's demo, write a structured post-match report in markdown.

Focus on:
1. **Match Result** — brief summary of the scoreline and key moments
2. **Top Performers** — highlight standout players with specific stats
3. **Weaknesses** — identify 2-3 specific areas where the team struggled (low KAST players, poor economy rounds, weak maps)
4. **Key Takeaways** — 3 actionable bullet points the team should work on

Be specific, data-driven, and concise. Use real player names and real numbers. 4 sections, maximum 350 words.`
    : `You are a CS2 analyst. Given match data for an OPPONENT's demo, write a structured opponent scouting report in markdown.

Focus on:
1. **Scoreline & Context** — brief summary of the match
2. **Dangerous Players** — their top performers with stats to watch
3. **Tactical Tendencies** — patterns in utility, aggression, site preferences
4. **Exploit Opportunities** — 3 specific weaknesses or habits we can exploit

Be specific, concise, data-driven. Use real player names. 4 sections, maximum 350 words.`

  try {
    const { text, usage } = await generateText({
      model: getAIModel(),
      system: systemPrompt,
      prompt: `Match data:\n${context}`,
      maxTokens: 800,
      temperature: 0.5,
    })

    await logAIUsage({
      userId: user.id,
      feature: 'demo_report',
      promptTokens: usage?.promptTokens,
      completionTokens: usage?.completionTokens,
    })

    await admin.from('demos').update({ ai_report: text }).eq('id', demoId)

    return NextResponse.json({ report: text, cached: false })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'AI generation failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
