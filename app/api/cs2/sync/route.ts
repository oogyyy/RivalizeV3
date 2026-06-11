export const maxDuration = 60
export const runtime = 'nodejs'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { discoverMatchesForUser } from '@/lib/cs2-sync'

/**
 * POST /api/cs2/sync
 *
 * Manual trigger for CS2 match discovery. Tries Steam bot GC first (if
 * configured), then falls back to the sharecode chain. The discovery logic is
 * shared with the worker's background auto-sync via lib/cs2-sync.
 */
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('steam_id, steam_auth_token, cs2_last_sharecode')
    .eq('id', user.id)
    .single()

  const result = await discoverMatchesForUser(admin, {
    userId:        user.id,
    steamId:       (profile?.steam_id as string | null) ?? null,
    authToken:     (profile?.steam_auth_token as string | null) ?? null,
    lastSharecode: (profile?.cs2_last_sharecode as string | null) ?? null,
  })

  return NextResponse.json(result)
}
