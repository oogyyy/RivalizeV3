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
    weakness: `Focus on identifying the team's biggest weaknesses and patterns opponents can exploit. Be specific and prioritize by impact. Suggest concrete drills and improvements.`,
    antistrat: `Create a detailed anti-strat against the opponent. Identify their tendencies, preferred executes, and CT setups. Provide specific counters for each pattern.`,
    strategy: `Develop custom strategies${mapName ? ` for ${mapName}` : ''}. Provide CT and T-side setups with specific utility lineups, timings, and positioning. Be tactical and precise.`,
    player: `Analyze ${playerName || 'individual player'} performance in depth — strengths, weaknesses, positioning habits, decision making. Provide specific improvement tips.`,
    general: `Provide a comprehensive performance analysis covering overall team coordination, individual performances, economy management, and key improvement areas.`,
  }

  const systemPrompt = `You are an elite Counter-Strike 2 coach and analyst with years of experience at the highest competitive levels. You analyze demo data with precision and communicate like a professional coach who genuinely wants to help teams win.

Your coaching style:
- Direct, data-driven, and actionable — no fluff or vague advice
- Reference specific rounds, players, and stats when available
- Provide concrete solutions alongside identified problems
- Deep tactical knowledge: economy, utility usage, positioning, rotations, anti-strat, mid-round calls
- Use CS2 terminology correctly (executes, retakes, defaults, eco rounds, force buys, etc.)
- Format responses clearly with markdown headers and bullet points

${contextText ? `Match Context:\n${contextText}` : ''}
${focusArea ? `Analysis focus: ${focusInstructions[focusArea] || focusInstructions.general}` : ''}
${playerName && focusArea === 'player' ? `Player to analyze: ${playerName}` : ''}
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
