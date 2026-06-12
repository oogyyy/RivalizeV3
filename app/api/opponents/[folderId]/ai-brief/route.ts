import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateText } from 'ai'
import type { PlayerStats, Round, Kill, GrenadeEvent } from '@/types/database'
import { detectTacticalPatterns } from '@/lib/cs2-zones'
import { cs2Doctrine } from '@/lib/cs2-doctrine'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { aiConfigured, getAIModel, logAIUsage } from '@/lib/ai'
import { checkUserFeature } from '@/lib/billing'

type ParsedDemo = {
  header?: { map?: string; team1?: string; team2?: string; score_team1?: number; score_team2?: number; total_rounds?: number }
  opponentSide?: string
  players?: PlayerStats[]
  rounds?: Round[]
}

function buildBriefContext(demos: ParsedDemo[], opponentName: string): string {
  if (demos.length === 0) return 'No analyzed demos available.'

  const lines: string[] = [`Opponent: ${opponentName}`, `Analyzed demos: ${demos.length}`]

  // Aggregate player stats across all demos
  const playerAgg: Record<string, { kills: number; deaths: number; adr: number; rating: number; games: number }> = {}
  const mapCounts: Record<string, { played: number; wins: number }> = {}
  let totalPlants = 0, totalRounds = 0
  const allRoundSets: Round[][] = []

  for (const pd of demos) {
    const h = pd.header ?? {}
    const map = h.map ?? 'unknown'
    const opSide = pd.opponentSide ?? 'team2'
    const rounds = pd.rounds ?? []
    const opLabel = opSide === 'team1' ? (h.team1 ?? '') : (h.team2 ?? '')

    // Map record
    if (!mapCounts[map]) mapCounts[map] = { played: 0, wins: 0 }
    mapCounts[map].played++
    const ourScore  = opSide === 'team1' ? (h.score_team2 ?? 0) : (h.score_team1 ?? 0)
    const theirScore = opSide === 'team1' ? (h.score_team1 ?? 0) : (h.score_team2 ?? 0)
    if (theirScore > ourScore) mapCounts[map].wins++ // their wins = their map strength

    totalRounds += rounds.length
    totalPlants += rounds.filter((r) => r.bomb_planted).length
    if (rounds.length > 0) allRoundSets.push(rounds)

    // Player aggregation (opponent side only)
    for (const p of pd.players ?? []) {
      if (p.team !== opLabel) continue
      if (!playerAgg[p.name]) playerAgg[p.name] = { kills: 0, deaths: 0, adr: 0, rating: 0, games: 0 }
      const agg = playerAgg[p.name]
      agg.kills  += p.kills
      agg.deaths += p.deaths
      agg.adr    += p.adr
      agg.rating += p.rating
      agg.games  += 1
    }
  }

  // Map preferences
  const sortedMaps = Object.entries(mapCounts).sort((a, b) => b[1].played - a[1].played)
  lines.push(`\nMap pool (${sortedMaps.length} maps):`)
  for (const [map, { played, wins }] of sortedMaps) {
    lines.push(`  ${map}: ${played} demos, ${wins}W / ${played - wins}L`)
  }

  // Top players
  const topPlayers = Object.entries(playerAgg)
    .map(([name, s]) => ({
      name,
      avgRating: s.games > 0 ? s.rating / s.games : 0,
      avgAdr: s.games > 0 ? s.adr / s.games : 0,
      kd: s.deaths > 0 ? s.kills / s.deaths : 0,
      games: s.games,
    }))
    .sort((a, b) => b.avgRating - a.avgRating)
    .slice(0, 5)

  lines.push(`\nKey players (avg across ${demos.length} demos):`)
  for (const p of topPlayers) {
    lines.push(`  ${p.name}: Rating ${p.avgRating.toFixed(2)}, K/D ${p.kd.toFixed(2)}, ADR ${p.avgAdr.toFixed(0)} (${p.games} demos)`)
  }

  // Plant rate
  if (totalRounds > 0) {
    lines.push(`\nBomb plant rate: ${Math.round((totalPlants / totalRounds) * 100)}% (${totalPlants}/${totalRounds} rounds)`)
  }

  // Cross-demo execute patterns
  if (allRoundSets.length >= 2) {
    const firstMap = demos[0]?.header?.map ?? 'unknown'
    const patterns = detectTacticalPatterns(allRoundSets, firstMap)
    if (patterns.hasData) {
      lines.push(`\nTactical patterns:`)
      lines.push(...patterns.text)
    }
  }

  return lines.join('\n')
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ folderId: string }> },
) {
  const { folderId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: folder } = await admin
    .from('team_folders')
    .select('id, user_team_id, opponent_slug, opponent_display_name, ai_brief, ai_brief_updated_at')
    .eq('id', folderId)
    .single()

  if (!folder) return NextResponse.json({ error: 'Folder not found' }, { status: 404 })

  // Auth
  const { data: membership } = await admin
    .from('team_members')
    .select('role')
    .eq('team_id', folder.user_team_id)
    .eq('user_id', user.id)
    .single()
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const feature = await checkUserFeature(user.id, 'aiCoaching')
  if (!feature.allowed) {
    return NextResponse.json(
      { error: 'plan_required', message: 'AI scouting briefs require a Pro plan or higher.', upgradeRequired: feature.upgradeRequired },
      { status: 402 },
    )
  }

  const body = await req.json().catch(() => ({})) as { regenerate?: boolean }

  // Return cached brief unless regenerate is requested
  if (folder.ai_brief && !body.regenerate) {
    return NextResponse.json({ brief: folder.ai_brief, cached: true, updatedAt: folder.ai_brief_updated_at })
  }

  // 5 brief generations per user per minute (cache hits above are unaffected)
  if (!rateLimit(`ai:brief:${user.id}`, 5, 60_000)) {
    return rateLimitResponse()
  }

  if (!aiConfigured()) return NextResponse.json({ error: 'AI not configured' }, { status: 503 })

  // Fetch analyzed demos
  const { data: demos } = await admin
    .from('demos')
    .select('parsed_data')
    .eq('team_id', folder.user_team_id)
    .eq('opponent_slug', folder.opponent_slug)
    .eq('demo_type', 'opponent')
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(8)

  const parsedDemos = (demos ?? []).map((d) => d.parsed_data as ParsedDemo | null).filter(Boolean) as ParsedDemo[]

  if (parsedDemos.length === 0) {
    return NextResponse.json({ error: 'No analyzed demos available for this opponent' }, { status: 400 })
  }

  const context = buildBriefContext(parsedDemos, folder.opponent_display_name)

  const systemPrompt = `You are a professional CS2 analyst preparing a pre-match intelligence brief for a competitive team. Write a concise, structured match-prep brief in markdown.

Structure your brief in exactly these 5 sections:
## 🎯 Threat Assessment
Rate the opponent's overall danger level (Low/Medium/High/Elite) with 1-2 sentence justification.

## 👥 Players to Watch
List their 2-3 most dangerous players with specific stats and what they do.

## 🗺️ Map Tendencies
Their preferred maps, win rates, and tactical tendencies per map.

## ⚔️ How They Attack
Their T-side patterns: site preferences, utility habits, timing tendencies.

## 🛡️ How They Defend
Their CT-side tendencies: anchor positions, aggression level, rotation speed.

## 🔑 Key Exploit Points
3 specific, actionable weaknesses we can attack. For every repeated tendency in the data (cite its frequency), give a trigger→response counter the team can run: who does what, where, with which utility.
${cs2Doctrine({ counterStrat: true })}

Be specific and data-driven. Use real player names. Only state tendencies present in the data — never invent rounds or plays. Keep the brief printable and scannable — 450 words max.`

  try {
    const { text, usage } = await generateText({
      model: getAIModel(),
      system: systemPrompt,
      prompt: `Intelligence data:\n${context}`,
      maxTokens: 1100,
      temperature: 0.4,
    })

    await logAIUsage({
      userId: user.id,
      feature: 'opponent_brief',
      promptTokens: usage?.promptTokens,
      completionTokens: usage?.completionTokens,
    })

    await admin.from('team_folders').update({
      ai_brief: text,
      ai_brief_updated_at: new Date().toISOString(),
    }).eq('id', folderId)

    return NextResponse.json({ brief: text, cached: false, updatedAt: new Date().toISOString() })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'AI generation failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
