import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { createOpenAI } from '@ai-sdk/openai'
import { streamText } from 'ai'

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
    includeProDataset?: boolean
    mode?: 'opponent' | 'myteam'
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { teamId, folderId, messages = [], focusArea, playerName, mapName, includeProDataset, mode = 'opponent' } = body

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

  if (mode === 'myteam' && teamId) {
    // My Team mode: fetch ONLY self-demos (demo_type = 'self').
    // Use admin client to bypass RLS — the user has already been authenticated above.
    const adminDb = createAdminClient()
    console.log('[AI Coach] myteam mode — querying demos for teamId:', teamId)
    const { data: recentDemos, error: demosError } = await adminDb
      .from('demos')
      .select('parsed_data, map, match_date, opponent_name')
      .eq('team_id', teamId)
      .eq('status', 'completed')
      .eq('demo_type', 'self')
      .order('created_at', { ascending: false })
      .limit(5)
    console.log('[AI Coach] demos fetched:', recentDemos?.length ?? 0, 'error:', demosError?.message ?? null)

    if (recentDemos && recentDemos.length > 0) {
      type PD = {
        header?: { map?: string; score_team1?: number; score_team2?: number; total_rounds?: number; team1?: string; team2?: string }
        opponentSide?: string
        players?: Array<{ name: string; kills: number; deaths: number; assists: number; rating: number; adr: number; team: string }>
      }
      contextText += `\nTeam: ${teamName}\nMatches analysed: ${recentDemos.length}\n\nRecent match details:\n`
      recentDemos.forEach((demo, i) => {
        const pd = demo.parsed_data as PD | null
        const h = pd?.header
        const opponentSide = pd?.opponentSide ?? 'team2'
        if (h) {
          const ourScore   = opponentSide === 'team1' ? (h.score_team2 ?? 0) : (h.score_team1 ?? 0)
          const theirScore = opponentSide === 'team1' ? (h.score_team1 ?? 0) : (h.score_team2 ?? 0)
          contextText += `Match ${i + 1}: ${h.map} — Score ${ourScore}-${theirScore} (${h.total_rounds ?? '?'} rounds)\n`
          if (pd?.players) {
            const opLabel = opponentSide === 'team1' ? (h.team1 ?? 'T-Side') : (h.team2 ?? 'CT-Side')
            const myPlayers = pd.players.filter(p => p.team !== opLabel)
            if (myPlayers.length > 0) {
              const sorted = [...myPlayers].sort((a, b) => b.rating - a.rating).slice(0, 5)
              contextText += `My team players:\n${sorted.map(p => `  ${p.name}: ${p.kills}/${p.deaths}/${p.assists}, Rating ${p.rating.toFixed(2)}, ADR ${p.adr.toFixed(1)}`).join('\n')}\n`
            }
          }
        }
      })
    }
  } else if (folderId) {
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

      // Fetch recent completed opponent demos for richer scouting context.
      // Only demo_type = 'opponent' — self-demos must never pollute opponent analysis.
      if (teamId) {
        const { data: recentDemos } = await supabase
          .from('demos')
          .select('parsed_data, map, match_date')
          .eq('team_id', teamId)
          .eq('opponent_slug', folder.opponent_slug)
          .eq('status', 'completed')
          .eq('demo_type', 'opponent')  // STRICT: only scouting demos for opponent analysis
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

  // Annotate context sparseness so the AI knows when it must stay conservative
  const matchCount = (contextText.match(/Match \d+:/g) || []).length
  const hasPlayerData = contextText.includes('Rating')
  const noDataMessage = mode === 'myteam'
    ? '\n⚠ DATA AVAILABILITY: No completed self-demos are available for this team yet. You MUST NOT invent or assume any maps, players, scores, or strategies. Tell the user warmly that you need their uploaded demos to provide specific analysis — let them know they should upload demos in My Team and wait for parsing to complete, then come back.'
    : '\n⚠ DATA AVAILABILITY: No completed demos are available for this analysis. You MUST NOT invent or assume any maps, players, scores, or strategies. Acknowledge the lack of data and tell the user to upload demos before you can provide specific analysis.'
  const dataWarning = matchCount === 0
    ? noDataMessage
    : matchCount < 2
      ? `\n⚠ DATA AVAILABILITY: Only ${matchCount} match is available. Base your entire analysis EXCLUSIVELY on the data shown above. Do NOT reference any maps, rounds, players, or tendencies not explicitly listed in the context. If the data is insufficient to answer confidently, say so.`
      : !hasPlayerData
        ? '\n⚠ DATA AVAILABILITY: Match data exists but contains no individual player stats. Base analysis only on the aggregate stats provided. Do NOT invent player names, ratings, or individual tendencies.'
        : ''

  // Build system prompt
  const opponentFocusInstructions: Record<string, string> = {
    weakness: `Focus on identifying the OPPONENT's biggest weaknesses and patterns your team can exploit. What mistakes do they repeat? Where are their rotations slow? What setups are predictable? Prioritize by impact and provide specific round-by-round examples where possible.`,
    antistrat: `Create a detailed anti-strat against this opponent. Identify their tendencies, preferred T-side executes, common CT setups, and economic patterns. Provide specific counters for each pattern — how to read their plays and punish them before they can execute.`,
    strategy: `Develop counter-strategies for the upcoming match${mapName ? ` on ${mapName}` : ''}. Provide CT and T-side setups tailored to shut down what this opponent does best. Include specific utility lineups, timings, and positioning that exploit their weaknesses.`,
    player: `Analyze opponent player ${playerName || 'key players'} in depth — their strengths, habits, positioning tendencies, and decision-making patterns. How should our team play around or neutralize this player? What situations do they struggle in?`,
    general: `Provide a comprehensive scouting report on this opponent. Cover: their T-side and CT-side tendencies, most dangerous players, predictable patterns, exploitable weaknesses, recommended map bans, and key preparation advice for our upcoming match.`,
  }

  const myTeamFocusInstructions: Record<string, string> = {
    weakness: `Analyse the team's demos and identify their most critical weaknesses — poor utility usage, rotation mistakes, predictable T-side patterns, CT anchor issues, or economic decision errors. Be specific about which situations keep costing them rounds and how to fix each one.`,
    executes: `Review how the team executes onto sites — their entry timing, utility choreography, trade setups, and post-plant positioning. Identify what's working, what's breaking down, and give concrete recommendations to improve their execute quality on the maps in the data.`,
    rounds: `Go round by round through key moments — won clutches, lost force buys, pistol rounds, and close eco fights. Identify patterns in how they win and lose rounds. What mental or tactical adjustments would have the highest impact?`,
    drills: `Based on the team's stats and performance patterns, recommend a tailored practice routine. Include: aim-training focus areas for underperforming players, specific map utility lineups to drill, team coordination exercises, and retake/execute scenarios to workshop together.`,
    strategy: `Help the team build a structured playbook. Analyse their T-side defaults and CT setups, then suggest a cohesive strategy with defined roles, a clear calling structure, default rotations, and 2–3 set executes per map that fit their playstyle.`,
    general: `Provide a comprehensive self-analysis of the team. Cover: strengths to build on, critical weaknesses to address, player role fit, map pool assessment, and a prioritised improvement roadmap for the next month.`,
  }

  const isMyTeam = mode === 'myteam'

  const systemPrompt = isMyTeam
    ? `You are an experienced CS2 coach. Analyze the provided team demo data to give honest, specific, and actionable feedback on weaknesses, strengths, and improvements. You specialise in team self-analysis — reviewing a team's OWN demos to help them grow, fix weaknesses, and build a stronger playbook. You communicate like a dedicated coaching staff member who genuinely wants the team to improve.

IMPORTANT CONTEXT: The demos provided are of the USER'S OWN TEAM — not an opponent. Your analysis should always focus on what ${teamName} can do better, what patterns to build on, and how to maximise their potential.

CRITICAL — DATA INTEGRITY RULE: You MUST base your entire analysis ONLY on the data explicitly provided below. Never invent, assume, or extrapolate maps, player names, scores, rounds, strategies, or statistics that are not present in the context. If the available data is insufficient to answer a question, clearly state what data is missing and ask the user to upload more demos.

Your coaching style:
- Team-focused and constructive — frame insights as "we do X, which costs us Y — here's how to fix it"
- Data-driven and specific — reference player names, maps, round scores, and stats when available
- Actionable improvement advice — every insight should connect to a concrete drill, adjustment, or decision change
- Deep tactical knowledge: executes, utility setups, rotations, economy, CT defaults, T-side timings, role clarity
- Use CS2 terminology correctly (executes, retakes, defaults, eco rounds, force buys, mid-round calls, lurks, entry fragging, etc.)
- Format responses clearly with markdown headers and bullet points
- Be honest but encouraging — highlight what's working as well as what needs fixing
${dataWarning}

${contextText ? `My Team Performance Data:\n${contextText}` : 'No demo data available.'}
${focusArea ? `Coaching focus: ${myTeamFocusInstructions[focusArea] || myTeamFocusInstructions.general}` : ''}
${mapName ? `Map focus: ${mapName}` : ''}`
    : `You are an elite Counter-Strike 2 scout and tactical analyst specializing in pre-match preparation. You analyze OPPONENT demos to help teams prepare anti-strats and exploit weaknesses before upcoming matches. You communicate like a professional analyst briefing a team before a big game.

IMPORTANT CONTEXT: The demos uploaded are of the OPPONENT team — not the user's own team. Your analysis should always focus on what the opponent does, their tendencies, weaknesses, and how the user's team can counter them.

CRITICAL — DATA INTEGRITY RULE: You MUST base your entire analysis ONLY on the data explicitly provided below. Never invent, assume, or extrapolate maps, player names, scores, rounds, strategies, or statistics that are not present in the context. If the available data is insufficient to answer a question, clearly state what data is missing and ask the user to upload more demos.

Your analysis style:
- Opponent-focused and tactical — always frame insights as "they do X, so we should Y"
- Data-driven and specific — reference rounds, players, maps, and stats when available
- Actionable preparation advice — every insight should connect to a concrete counter-play
- Deep tactical knowledge: executes, utility setups, rotations, economy, CT defaults, T-side timings
- Use CS2 terminology correctly (executes, retakes, defaults, eco rounds, force buys, mid-round calls, etc.)
- Format responses clearly with markdown headers and bullet points
${dataWarning}

${contextText ? `Opponent Scout Context:\n${contextText}` : 'No demo data available.'}
${focusArea ? `Analysis focus: ${opponentFocusInstructions[focusArea] || opponentFocusInstructions.general}` : ''}
${playerName && focusArea === 'player' ? `Opponent player to analyze: ${playerName}` : ''}
${mapName && focusArea === 'strategy' ? `Map focus: ${mapName}` : ''}
${includeProDataset ? `
PRO DATASET CONTEXT (OpenCS2 — https://huggingface.co/datasets/blanchon/opencs2_dataset):
The user has enabled professional match insights. Supplement your analysis with pro-level context drawn from general professional CS2 knowledge:
- Reference how professional teams typically execute and default on this map
- Note common professional CT anchor positions, rotations, and retake patterns
- Highlight pro-level T-side timings, utility choreography, and fake sequences
- Point out where this opponent's tendencies align with or deviate from professional meta
- Flag exploits or counters that are well-established in the professional scene

CRITICAL RULES for pro dataset references:
- Only reference well-established, widely-known professional tendencies — NEVER invent specific plays, round outcomes, or player actions that you cannot verify
- If you are uncertain whether something is a confirmed professional standard, omit it rather than speculate
- Always label every pro-meta observation with [Pro Meta] so the user can clearly distinguish it from opponent-specific findings derived from their uploaded demos
- Frame [Pro Meta] insights as "professional teams generally..." or "the established meta on this map is..." — never as hard facts about a specific match` : ''}`

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: 'Groq API key not configured' }, { status: 503 })
  }

  const groq = createOpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1',
  })

  try {
    const result = streamText({
      model: groq('llama-3.3-70b-versatile'),
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

    return result.toDataStreamResponse({
      headers: {
        // Prevent Railway/nginx from buffering the stream, which would break
        // the SSE protocol and cause useChat to error on every request.
        'X-Accel-Buffering': 'no',
      },
      getErrorMessage: (error) => {
        console.error('[AI Coach] streaming error:', error)
        if (error instanceof Error) return error.message
        return 'AI service error'
      },
    })
  } catch (err: unknown) {
    console.error('[AI Coach] route error:', err)
    const message = err instanceof Error ? err.message : 'AI service unavailable'
    return NextResponse.json({ error: message }, { status: 503 })
  }
}
