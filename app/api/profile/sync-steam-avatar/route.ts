import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('steam_id')
    .eq('id', user.id)
    .single()

  if (!profile?.steam_id) {
    return NextResponse.json({ error: 'No Steam account linked' }, { status: 400 })
  }

  const apiKey = process.env.STEAM_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Steam API not configured' }, { status: 503 })
  }

  try {
    const res = await fetch(
      `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${apiKey}&steamids=${profile.steam_id}`,
    )
    if (!res.ok) return NextResponse.json({ error: 'Steam API error' }, { status: 502 })

    const data = await res.json() as {
      response: { players: Array<{ avatarfull?: string }> }
    }
    const avatarUrl = data.response?.players?.[0]?.avatarfull

    if (!avatarUrl) return NextResponse.json({ error: 'No avatar found' }, { status: 404 })

    await admin
      .from('profiles')
      .update({ avatar_url: avatarUrl })
      .eq('id', user.id)

    return NextResponse.json({ avatar_url: avatarUrl })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch Steam avatar' }, { status: 500 })
  }
}
