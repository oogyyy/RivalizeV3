import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyDiscordSignature } from '@/lib/discord/verify'

// Discord interaction types
const PING = 1
const APPLICATION_COMMAND = 2

// Discord response types
const PONG = 1
const CHANNEL_MESSAGE = 4

function embed(title: string, description: string, color: number, fields?: { name: string; value: string; inline?: boolean }[]) {
  return { title, description, color, fields }
}

function mapLabel(raw: string): string {
  if (!raw || raw === 'unknown') return 'Unknown'
  return raw.replace(/^(de_|cs_|ar_)/, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

async function handleLink(guildId: string, teamCode: string) {
  const admin = createAdminClient()

  const { data: team } = await admin
    .from('teams')
    .select('id, name')
    .eq('discord_link_code', teamCode.toUpperCase())
    .maybeSingle()

  if (!team) {
    return NextResponse.json({
      type: CHANNEL_MESSAGE,
      data: {
        flags: 64, // EPHEMERAL
        embeds: [embed(
          '❌ Invalid Code',
          `No team found with code **${teamCode.toUpperCase()}**.\n\nFind your code in Rivalize under **My Team → Discord Settings**.`,
          0xFF6B7A,
        )],
      },
    })
  }

  // Check if this guild is already linked to a different team
  const { data: existing } = await admin
    .from('discord_integrations')
    .select('team_id')
    .eq('guild_id', guildId)
    .maybeSingle()

  if (existing && existing.team_id !== team.id) {
    return NextResponse.json({
      type: CHANNEL_MESSAGE,
      data: {
        flags: 64,
        embeds: [embed(
          '⚠️ Already Linked',
          'This Discord server is already linked to a different Rivalize team. Remove the existing integration from Rivalize first.',
          0xFFB13E,
        )],
      },
    })
  }

  await admin.from('discord_integrations').upsert(
    { team_id: team.id, guild_id: guildId },
    { onConflict: 'team_id' },
  )

  return NextResponse.json({
    type: CHANNEL_MESSAGE,
    data: {
      flags: 64,
      embeds: [embed(
        '✅ Linked Successfully',
        `This Discord server is now linked to **${team.name}** on Rivalize.\n\nUse \`/rivalize report\` and \`/rivalize standings\` anytime.`,
        0x34E2A0,
      )],
    },
  })
}

async function handleReport(guildId: string) {
  const admin = createAdminClient()

  const { data: integration } = await admin
    .from('discord_integrations')
    .select('team_id, teams(name)')
    .eq('guild_id', guildId)
    .maybeSingle()

  if (!integration) {
    return NextResponse.json({
      type: CHANNEL_MESSAGE,
      data: {
        flags: 64,
        embeds: [embed(
          '🔗 Not Linked',
          'This server isn\'t linked to a Rivalize team yet.\n\nRun `/rivalize link <code>` with your team\'s code from **Rivalize → My Team → Discord Settings**.',
          0xFF6B7A,
        )],
      },
    })
  }

  const { data: demos } = await admin
    .from('demos')
    .select('id, map, parsed_data, created_at')
    .eq('team_id', integration.team_id)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)

  if (!demos || demos.length === 0) {
    return NextResponse.json({
      type: CHANNEL_MESSAGE,
      data: {
        flags: 64,
        embeds: [embed('📊 No Matches Yet', 'No analyzed demos found for this team.', 0x8B7CFF)],
      },
    })
  }

  const demo = demos[0]
  const pd   = demo.parsed_data as Record<string, unknown> | null
  const h    = (pd?.header ?? {}) as Record<string, unknown>
  const os   = (pd?.opponentSide as string | undefined) ?? 'team2'
  const s1   = (h.score_team1 as number) ?? 0
  const s2   = (h.score_team2 as number) ?? 0
  const ours   = os === 'team1' ? s2 : s1
  const theirs = os === 'team1' ? s1 : s2
  const result = ours > theirs ? '✅ Win' : ours < theirs ? '❌ Loss' : '➖ Draw'
  const color  = ours > theirs ? 0x34E2A0 : ours < theirs ? 0xFF6B7A : 0x8B7CFF

  const players       = (pd?.players as Array<{ name: string; kills: number; rating: number; team: string }> | undefined) ?? []
  const opponentLabel = os === 'team1' ? ((h.team1 as string) ?? '') : ((h.team2 as string) ?? '')
  const top = players.filter(p => p.team !== opponentLabel).sort((a, b) => b.rating - a.rating)[0]

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://rivalize.pro'
  const fields = [
    { name: 'Score', value: `**${ours}** — ${theirs}`, inline: true },
    { name: 'Result', value: result, inline: true },
  ]
  if (top) fields.push({ name: '⭐ Top Fragger', value: `**${top.name}** · ${top.kills}K · ${top.rating.toFixed(2)} rating`, inline: false })

  const teamName = ((integration.teams as unknown) as { name: string } | null)?.name ?? 'Your Team'

  return NextResponse.json({
    type: CHANNEL_MESSAGE,
    data: {
      embeds: [{
        title: `🎯 ${teamName} — Latest Match`,
        description: `**${mapLabel(demo.map)}** · ${new Date(demo.created_at).toLocaleDateString()}`,
        color,
        fields,
        url: `${appUrl}/demos/${demo.id}`,
        footer: { text: 'Rivalize · CS2 Analytics' },
      }],
    },
  })
}

async function handleStandings(guildId: string) {
  const admin = createAdminClient()

  const { data: integration } = await admin
    .from('discord_integrations')
    .select('team_id, teams(name)')
    .eq('guild_id', guildId)
    .maybeSingle()

  if (!integration) {
    return NextResponse.json({
      type: CHANNEL_MESSAGE,
      data: {
        flags: 64,
        embeds: [embed(
          '🔗 Not Linked',
          'Run `/rivalize link <code>` to connect this server to your Rivalize team.',
          0xFF6B7A,
        )],
      },
    })
  }

  const { data: demos } = await admin
    .from('demos')
    .select('parsed_data, map')
    .eq('team_id', integration.team_id)
    .eq('demo_type', 'self')
    .eq('status', 'completed')

  let wins = 0, losses = 0, draws = 0
  const mapCounts: Record<string, number> = {}

  for (const d of demos ?? []) {
    const pd = d.parsed_data as Record<string, unknown> | null
    if (!pd) continue
    const h  = (pd.header ?? {}) as Record<string, number & string>
    const os = (pd.opponentSide as string | undefined) ?? 'team2'
    const ours   = os === 'team1' ? (h.score_team2 ?? 0) : (h.score_team1 ?? 0)
    const theirs = os === 'team1' ? (h.score_team1 ?? 0) : (h.score_team2 ?? 0)
    if (ours > theirs) wins++
    else if (ours < theirs) losses++
    else draws++
    if (d.map && d.map !== 'unknown') mapCounts[d.map] = (mapCounts[d.map] ?? 0) + 1
  }

  const total = wins + losses + draws
  const wr = total > 0 ? Math.round(wins / total * 100) : 0
  const topMaps = Object.entries(mapCounts).sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([m, c]) => `${mapLabel(m)} (${c})`)
    .join(', ') || '—'

  const teamName = ((integration.teams as unknown) as { name: string } | null)?.name ?? 'Your Team'

  return NextResponse.json({
    type: CHANNEL_MESSAGE,
    data: {
      embeds: [{
        title: `📊 ${teamName} — Season Stats`,
        color: 0x8B7CFF,
        fields: [
          { name: 'Record', value: `${wins}W  ${losses}L  ${draws}D`, inline: true },
          { name: 'Win Rate', value: `**${wr}%**`, inline: true },
          { name: 'Top Maps', value: topMaps, inline: false },
        ],
        footer: { text: `${total} matches analyzed · Rivalize` },
      }],
    },
  })
}

export async function POST(req: NextRequest) {
  const publicKey = process.env.DISCORD_PUBLIC_KEY
  if (!publicKey) {
    return NextResponse.json({ error: 'Discord not configured' }, { status: 503 })
  }

  const rawBody  = await req.text()
  const sig      = req.headers.get('x-signature-ed25519') ?? ''
  const timestamp = req.headers.get('x-signature-timestamp') ?? ''

  const valid = await verifyDiscordSignature(rawBody, sig, timestamp, publicKey)
  if (!valid) {
    return new NextResponse('Invalid signature', { status: 401 })
  }

  const interaction = JSON.parse(rawBody)

  // Respond to Discord's ping during endpoint verification
  if (interaction.type === PING) {
    return NextResponse.json({ type: PONG })
  }

  if (interaction.type === APPLICATION_COMMAND) {
    const guildId = interaction.guild_id as string | undefined
    if (!guildId) {
      return NextResponse.json({
        type: CHANNEL_MESSAGE,
        data: { flags: 64, content: 'Rivalize commands must be run in a server, not a DM.' },
      })
    }

    const subcommand = (interaction.data?.options?.[0]?.name as string | undefined) ?? ''

    if (subcommand === 'link') {
      const code = (interaction.data.options[0].options?.[0]?.value as string | undefined) ?? ''
      return handleLink(guildId, code)
    }
    if (subcommand === 'report')    return handleReport(guildId)
    if (subcommand === 'standings') return handleStandings(guildId)
  }

  return NextResponse.json({ type: CHANNEL_MESSAGE, data: { content: 'Unknown command.' } })
}
