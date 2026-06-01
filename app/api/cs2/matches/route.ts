import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { isSteamApiConfigured } from '@/lib/steam'

/**
 * GET /api/cs2/matches
 * Returns the user's discovered CS2 matches with any linked demo stats.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const [profileRes, matchesRes] = await Promise.all([
    admin.from('profiles')
      .select('steam_id, steam_auth_token, cs2_last_sharecode')
      .eq('id', user.id)
      .single(),
    admin.from('cs2_matches')
      .select(`
        id, sharecode, match_id, reservation_id, discovered_at, demo_id,
        demos ( id, status, map, parsed_data, match_date )
      `)
      .eq('user_id', user.id)
      .order('discovered_at', { ascending: false })
      .limit(50),
  ])

  const profile = profileRes.data as Record<string, unknown> | null

  return NextResponse.json({
    configured:    isSteamApiConfigured(),
    linked:        Boolean(profile?.steam_auth_token && profile?.cs2_last_sharecode),
    steamId:       profile?.steam_id ?? null,
    matches:       matchesRes.data ?? [],
  })
}
