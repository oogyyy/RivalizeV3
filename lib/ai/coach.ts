import { openai } from '@ai-sdk/openai'
import { streamText, generateText } from 'ai'
import type { ParsedDemoData, PlayerStats, AggregatedStats } from '@/types/database'

export interface CoachContext {
  teamName: string
  opponentName?: string
  demos: ParsedDemoData[]
  aggregatedStats?: AggregatedStats
  focusArea?: 'weakness' | 'antistrat' | 'strategy' | 'player' | 'general'
  playerName?: string
  mapName?: string
}

function buildSystemPrompt(): string {
  return `You are an elite Counter-Strike 2 coach and analyst with years of experience at the highest competitive levels. You analyze demo data with the precision of a professional analyst and communicate like an experienced coach who genuinely wants to help teams improve.

Your analysis style:
- Direct and actionable — no fluff
- Data-driven but explained in plain language
- Positive and constructive — you identify problems but always provide solutions
- Deep tactical understanding of CS2 (economy, utility, positioning, rotations, anti-strat)
- You reference specific rounds, players, and moments from the data when possible

Format your responses with clear sections using markdown. Use bullet points for lists of insights.`
}

function buildAnalysisPrompt(context: CoachContext): string {
  const { teamName, opponentName, demos, aggregatedStats, focusArea, playerName, mapName } = context

  const demoSummaries = demos.slice(0, 5).map((demo, i) => {
    const header = demo.header
    const players = demo.players || []
    return `
Match ${i + 1}: ${header.team1} vs ${header.team2} on ${header.map}
Score: ${header.score_team1} - ${header.score_team2}
Top performers:
${players.slice(0, 5).map(p =>
  `  - ${p.name}: ${p.kills}K/${p.deaths}D/${p.assists}A | Rating: ${p.rating.toFixed(2)} | ADR: ${p.adr.toFixed(1)} | HS: ${p.headshot_percentage.toFixed(1)}%`
).join('\n')}`
  }).join('\n')

  const statsContext = aggregatedStats ? `
Overall Statistics (${aggregatedStats.total_matches} matches):
- Win Rate: ${(aggregatedStats.win_rate * 100).toFixed(1)}% (${aggregatedStats.wins}W/${aggregatedStats.losses}L)
- Average Rating: ${aggregatedStats.avg_rating.toFixed(2)}
- Most played maps: ${Object.entries(aggregatedStats.maps_played).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([map, count]) => `${map} (${count})`).join(', ')}
` : ''

  const focusInstructions: Record<string, string> = {
    weakness: `Identify the team's biggest weaknesses and vulnerabilities. What patterns do you see that opponents can exploit? Prioritize the top 3-5 issues by impact.`,
    antistrat: `Create a detailed anti-strat for playing against ${opponentName || 'this opponent'}. Based on their tendencies and patterns, what specific counters should ${teamName} use?`,
    strategy: `Create custom strategies for ${teamName}${mapName ? ` on ${mapName}` : ''}. Provide specific CT-side and T-side setups with utility usage and positioning.`,
    player: `Provide detailed analysis for ${playerName || 'each player'} — their strengths, weaknesses, and specific improvement areas with drills.`,
    general: `Provide a comprehensive match analysis covering team performance, key moments, and the most important areas for improvement.`,
  }

  return `
Team: ${teamName}
${opponentName ? `Opponent being analyzed: ${opponentName}` : ''}
${mapName ? `Map focus: ${mapName}` : ''}

${statsContext}

Match Data:
${demoSummaries}

Task: ${focusInstructions[focusArea || 'general']}

Please provide a thorough, actionable analysis based on this data.`
}

export async function streamCoachAnalysis(
  context: CoachContext,
  onChunk: (chunk: string) => void
) {
  const model = openai('gpt-4o')

  const result = streamText({
    model,
    system: buildSystemPrompt(),
    prompt: buildAnalysisPrompt(context),
    maxTokens: 2000,
    temperature: 0.7,
  })

  for await (const chunk of (await result).textStream) {
    onChunk(chunk)
  }
}

export async function generateCoachResponse(
  context: CoachContext,
  userMessage: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
) {
  const model = openai('gpt-4o')

  const contextualSystem = `${buildSystemPrompt()}

Current analysis context:
${buildAnalysisPrompt(context)}`

  const { text } = await generateText({
    model,
    system: contextualSystem,
    messages: [
      ...conversationHistory,
      { role: 'user', content: userMessage },
    ],
    maxTokens: 1500,
    temperature: 0.7,
  })

  return text
}
