import { createAdminClient } from '@/lib/supabase/admin'

interface ParsedHeader {
  map?: string
  score_team1?: number
  score_team2?: number
  team1?: string
  team2?: string
}

interface ParsedPlayer {
  name: string
  kills: number
  rating: number
  team: string
}

function mapLabel(raw: string): string {
  if (!raw || raw === 'unknown') return 'Unknown Map'
  return raw.replace(/^(de_|cs_|ar_)/, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function buildEmbed(
  demoId: string,
  map: string,
  ours: number,
  theirs: number,
  topPlayer: ParsedPlayer | null,
  demoType: 'self' | 'opponent',
  opponentName?: string,
) {
  const result: 'Win' | 'Loss' | 'Draw' =
    ours > theirs ? 'Win' : ours < theirs ? 'Loss' : 'Draw'

  const resultEmoji = result === 'Win' ? '✅' : result === 'Loss' ? '❌' : '➖'
  const color       = result === 'Win' ? 0x34E2A0 : result === 'Loss' ? 0xFF6B7A : 0x8B7CFF

  const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? 'https://rivalize.pro'
  const demoUrl = `${appUrl}${demoType === 'self' ? '/my-team/demos/' : '/opponents/demos/'}${demoId}`

  const fields: { name: string; value: string; inline?: boolean }[] = []

  if (demoType === 'opponent' && opponentName) {
    fields.push({ name: 'Opponent', value: opponentName, inline: true })
  }
  fields.push({ name: 'Score', value: `**${ours}** — ${theirs}`, inline: true })
  fields.push({ name: 'Result', value: `${resultEmoji} **${result}**`, inline: true })

  if (topPlayer) {
    fields.push({
      name: '⭐ Top Fragger',
      value: `**${topPlayer.name}** · ${topPlayer.kills}K · ${topPlayer.rating.toFixed(2)} rating`,
      inline: false,
    })
  }

  return {
    title: `🎯 ${mapLabel(map)} — Demo Analyzed`,
    color,
    fields,
    url: demoUrl,
    footer: { text: 'Rivalize · CS2 Analytics' },
    timestamp: new Date().toISOString(),
  }
}

export async function notifyDiscordDemoCompleted(
  teamId: string,
  demoId: string,
  parsedData: Record<string, unknown>,
  demoType: 'self' | 'opponent',
  opponentName?: string,
): Promise<void> {
  try {
    const admin = createAdminClient()
    const { data: integration } = await admin
      .from('discord_integrations')
      .select('webhook_url')
      .eq('team_id', teamId)
      .maybeSingle()

    if (!integration?.webhook_url) return

    const header       = (parsedData.header ?? {}) as ParsedHeader
    const opponentSide = (parsedData.opponentSide as string | undefined) ?? 'team2'
    const s1 = header.score_team1 ?? 0
    const s2 = header.score_team2 ?? 0
    const ours   = opponentSide === 'team1' ? s2 : s1
    const theirs = opponentSide === 'team1' ? s1 : s2

    const players       = (parsedData.players as ParsedPlayer[] | undefined) ?? []
    const opponentLabel = opponentSide === 'team1' ? (header.team1 ?? '') : (header.team2 ?? '')
    const ourPlayers    = players.filter(p => p.team !== opponentLabel)
    const topPlayer     = ourPlayers.sort((a, b) => b.rating - a.rating)[0] ?? null

    const embed = buildEmbed(
      demoId,
      header.map ?? 'unknown',
      ours,
      theirs,
      topPlayer,
      demoType,
      opponentName,
    )

    await fetch(integration.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    })
  } catch (err) {
    console.warn('[discord] Failed to post demo notification:', err)
  }
}

export async function testWebhook(webhookUrl: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: '✅ Rivalize Connected',
          description: 'This channel will receive match summaries when your demos finish processing.',
          color: 0x8B7CFF,
          footer: { text: 'Rivalize · CS2 Analytics' },
        }],
      }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { ok: false, error: body || `HTTP ${res.status}` }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Network error' }
  }
}
