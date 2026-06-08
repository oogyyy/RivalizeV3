import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { testWebhook } from '@/lib/discord/notify'
import { z } from 'zod'

const connectSchema = z.object({
  teamId:     z.string().uuid(),
  webhookUrl: z.string().url().startsWith('https://discord.com/api/webhooks/'),
})

const disconnectSchema = z.object({
  teamId: z.string().uuid(),
})

// GET /api/discord/setup?teamId=... — return connection status + link code
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const teamId = req.nextUrl.searchParams.get('teamId')
  if (!teamId) return NextResponse.json({ error: 'teamId required' }, { status: 400 })

  const admin = createAdminClient()

  // Verify membership
  const { data: member } = await admin
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!member) return NextResponse.json({ error: 'Not a member of this team' }, { status: 403 })

  const [{ data: team }, { data: integration }] = await Promise.all([
    admin.from('teams').select('discord_link_code').eq('id', teamId).single(),
    admin.from('discord_integrations').select('id, guild_id, guild_name, channel_id, created_at').eq('team_id', teamId).maybeSingle(),
  ])

  return NextResponse.json({
    linkCode:    team?.discord_link_code ?? null,
    integration: integration ?? null,
  })
}

// POST /api/discord/setup — connect webhook
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let raw: unknown
  try { raw = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = connectSchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })

  const { teamId, webhookUrl } = parsed.data
  const admin = createAdminClient()

  // Only owner/admin can connect
  const { data: member } = await admin
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!member || !['owner', 'admin'].includes(member.role)) {
    return NextResponse.json({ error: 'Only team owner or admin can manage Discord integration' }, { status: 403 })
  }

  // Resolve webhook metadata from Discord API to get guild_id
  const webhookIdToken = webhookUrl.replace('https://discord.com/api/webhooks/', '')
  const [webhookId, webhookToken] = webhookIdToken.split('/')
  let guildId: string | null = null
  const guildName: string | null = null
  let channelId: string | null = null

  try {
    const discordRes = await fetch(`https://discord.com/api/v10/webhooks/${webhookId}/${webhookToken}`, {
      headers: { 'User-Agent': 'Rivalize/1.0' },
    })
    if (discordRes.ok) {
      const wh = await discordRes.json() as { guild_id?: string; channel_id?: string; guild?: { name?: string } }
      guildId   = wh.guild_id ?? null
      channelId = wh.channel_id ?? null
    }
  } catch {
    // Non-fatal — store without guild_id
  }

  if (!guildId) {
    return NextResponse.json({ error: 'Could not resolve guild from webhook URL. Make sure the URL is a valid Discord server webhook.' }, { status: 422 })
  }

  // Check if this guild is already linked to another team
  const { data: conflicting } = await admin
    .from('discord_integrations')
    .select('team_id')
    .eq('guild_id', guildId)
    .neq('team_id', teamId)
    .maybeSingle()
  if (conflicting) {
    return NextResponse.json({ error: 'This Discord server is already linked to a different Rivalize team.' }, { status: 409 })
  }

  // Send a test message to confirm the webhook works
  const test = await testWebhook(webhookUrl)
  if (!test.ok) {
    return NextResponse.json({ error: `Webhook test failed: ${test.error}` }, { status: 422 })
  }

  // Upsert
  const { error: upsertErr } = await admin
    .from('discord_integrations')
    .upsert(
      { team_id: teamId, guild_id: guildId, guild_name: guildName, channel_id: channelId, webhook_url: webhookUrl, created_by: user.id },
      { onConflict: 'team_id' },
    )
  if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, guildId, channelId })
}

// DELETE /api/discord/setup — disconnect
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let raw: unknown
  try { raw = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = disconnectSchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const { teamId } = parsed.data
  const admin = createAdminClient()

  const { data: member } = await admin
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!member || !['owner', 'admin'].includes(member.role)) {
    return NextResponse.json({ error: 'Only team owner or admin can manage Discord integration' }, { status: 403 })
  }

  await admin.from('discord_integrations').delete().eq('team_id', teamId)
  return NextResponse.json({ ok: true })
}
