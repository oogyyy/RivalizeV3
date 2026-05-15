import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { openai } from '@ai-sdk/openai'
import { streamText } from 'ai'

export const runtime = 'edge'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    teamId?: string
    folderId?: string
    messages?: Array<{ role: string; content: string }>
    focusArea?: string
    playerName?: string
    mapName?: string
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { teamId, folderId, messages = [], focusArea, playerName, mapName } = body

  // Build context from team/folder data
  let contextText = ''
  let teamName = 'the team'

  if (teamId) {
    const { data: team } = await supabase
      .from('teams')
      .select('name')
      .eq('id', teamId)
      .single()

    if (team) {
      teamName = team.name
      contextText += `Team: ${team.name}\n`
    }
  }

  if (folderId) {
    const { data: folder } = await supabase
      .from('team_folders')
      .select('*')
      .eq('id', folderId)
      .single()

    if (folder) {
      const stats = folder.aggregated_stats as {
        total_matches?: number
        wins?: number
        losses?: number
        win_rate?: number
        avg_rating?: number
        maps_played?: Record<string, number>
      } | null

      contextText += `
Opponent: ${folder.opponent_display_name}
Matches played: ${stats?.total_matches || 0}
Record: ${stats?.wins || 0}W - ${stats?.losses || 0}L
Win rate: ${((stats?.win_rate || 0) * 100).toFixed(1)}%
Average rating: ${stats?.avg_rating?.toFixed(2) || 'N/A'}
`
      if (stats?.maps_played && Object.keys(stats.maps_played).length > 0) {
        const mapEntries = Object.entries(stats.maps_played)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([map, count]) => `${map} (${count}x)`)
          .join(', ')
        contextText += `Most played maps: ${mapEntries}\n`
      }

      // Fetch recent completed demos for this folder for richer context
      if (teamId) {
        const { data: recentDemos } = await supabase
          .from('demos')
          .select('parsed_data, map, match_date')
          .eq('team_id', teamId)
          .eq('opponent_slug', folder.opponent_slug)
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(3)

        if (recentDemos && recentDemos.length > 0) {
          contextText += '\nRecent match details:\n'
          recentDemos.forEach((demo, i) => {
            const pd = demo.parsed_data as {
              header?: {
                map?: string
                score_team1?: number
                score_team2?: number
                total_rounds?: number
              }
              players?: Array<{
                name: string
                kills: number
                deaths: number
                assists: number
                rating: number
                adr: number
              }>
            } | null

            if (pd?.header) {
              const h = pd.header
              contextText += `Match ${i + 1}: ${h.map} — Score ${h.score_team1}-${h.score_team2} (${h.total_rounds} rounds)\n`

              if (pd.players && pd.players.length > 0) {
                const topPlayers = [...pd.players]
                  .sort((a, b) => b.rating - a.rating)
                  .slice(0, 5)
                  .map(p => `  ${p.name}: ${p.kills}/${p.deaths}/${p.assists}, Rating ${p.rating.toFixed(2)}, ADR ${p.adr.toFixed(1)}`)
                  .join('\n')
                contextText += `Top performers:\n${topPlayers}\n`
              }
            }
          })
        }
      }
    }
  }

  // Build system prompt
  const focusInstructions: Record<string, string> = {
    weakness: `Focus on identifying the OPPONENT's biggest weaknesses and patterns your team can exploit. What mistakes do they repeat? Where are their rotations slow? What setups are predictable? Prioritize by impact and provide specific round-by-round examples where possible.`,
    antistrat: `Create a detailed anti-strat against this opponent. Identify their tendencies, preferred T-side executes, common CT setups, and economic patterns. Provide specific counters for each pattern — how to read their plays and punish them before they can execute.`,
    strategy: `Develop counter-strategies for the upcoming match${mapName ? ` on ${mapName}` : ''}. Provide CT and T-side setups tailored to shut down what this opponent does best. Include specific utility lineups, timings, and positioning that exploit their weaknesses.`,
    player: `Analyze opponent player ${playerName || 'key players'} in depth — their strengths, habits, positioning tendencies, and decision-making patterns. How should our team play around or neutralize this player? What situations do they struggle in?`,
    general: `Provide a comprehensive scouting report on this opponent. Cover: their T-side and CT-side tendencies, most dangerous players, predictable patterns, exploitable weaknesses, recommended map bans, and key preparation advice for our upcoming match.`,
  }

  const systemPrompt = `You are an elite Counter-Strike 2 scout and tactical analyst specializing in pre-match preparation. You analyze OPPONENT demos to help teams prepare anti-strats and exploit weaknesses before upcoming matches. You communicate like a professional analyst briefing a team before a big game.

IMPORTANT CONTEXT: The demos uploaded are of the OPPONENT team — not the user's own team. Your analysis should always focus on what the opponent does, their tendencies, weaknesses, and how the user's team can counter them.

// NOTE: Self-analysis (user's own team demos) is planned for v2.

Your analysis style:
- Opponent-focused and tactical — always frame insights as "they do X, so we should Y"
- Data-driven and specific — reference rounds, players, maps, and stats when available
- Actionable preparation advice — every insight should connect to a concrete counter-play
- Deep tactical knowledge: executes, utility setups, rotations, economy, CT defaults, T-side timings
- Use CS2 terminology correctly (executes, retakes, defaults, eco rounds, force buys, mid-round calls, etc.)
- Format responses clearly with markdown headers and bullet points

${contextText ? `Opponent Scout Context:\n${contextText}` : ''}
${focusArea ? `Analysis focus: ${focusInstructions[focusArea] || focusInstructions.general}` : ''}
${playerName && focusArea === 'player' ? `Opponent player to analyze: ${playerName}` : ''}
${mapName && focusArea === 'strategy' ? `Map focus: ${mapName}` : ''}`

  try {
    const result = streamText({
      model: openai('gpt-4o'),
      system: systemPrompt,
      messages: messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      maxTokens: 2000,
      temperature: 0.7,
    })

    return (await result).toDataStreamResponse()
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'AI service unavailable'
    return NextResponse.json({ error: message }, { status: 503 })
  }
}
