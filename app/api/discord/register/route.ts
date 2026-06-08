import { type NextRequest, NextResponse } from 'next/server'

// Called once (manually or via admin) to register slash commands with Discord.
// Requires DISCORD_APPLICATION_ID and DISCORD_BOT_TOKEN env vars.
// Protect with DISCORD_REGISTER_SECRET to prevent public misuse.
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-register-secret')
  if (!secret || secret !== process.env.DISCORD_REGISTER_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const appId    = process.env.DISCORD_APPLICATION_ID
  const botToken = process.env.DISCORD_BOT_TOKEN
  if (!appId || !botToken) {
    return NextResponse.json({ error: 'DISCORD_APPLICATION_ID and DISCORD_BOT_TOKEN required' }, { status: 503 })
  }

  const commands = [
    {
      name:        'rivalize',
      description: 'Rivalize CS2 analytics commands',
      options: [
        {
          name:        'link',
          type:        1, // SUB_COMMAND
          description: 'Link this Discord server to your Rivalize team',
          options: [
            {
              name:        'code',
              type:        3, // STRING
              description: 'Your team linking code from Rivalize → My Team → Discord',
              required:    true,
            },
          ],
        },
        {
          name:        'report',
          type:        1,
          description: "Post your team's latest match result",
        },
        {
          name:        'standings',
          type:        1,
          description: "Post your team's season stats and win rate",
        },
      ],
    },
  ]

  const res = await fetch(`https://discord.com/api/v10/applications/${appId}/commands`, {
    method:  'PUT',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bot ${botToken}`,
    },
    body: JSON.stringify(commands),
  })

  if (!res.ok) {
    const body = await res.text()
    return NextResponse.json({ error: 'Discord API error', details: body }, { status: 500 })
  }

  const data = await res.json()
  return NextResponse.json({ ok: true, registered: (data as unknown[]).length })
}
