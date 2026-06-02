import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

/**
 * GET /api/extension/connect
 * Called by the content-rivalize.js content script on any rivalize.pro page.
 * Because it's a same-origin browser fetch, Supabase session cookies are
 * included automatically — no auth headers needed.
 *
 * Returns the access_token so the extension can authenticate subsequent
 * cross-origin requests to /api/extension from chrome-extension:// origin.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ connected: false })
  }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('faceit_player_id')
    .eq('id', session.user.id)
    .single()

  return NextResponse.json({
    connected: true,
    access_token: session.access_token,
    user: {
      id: session.user.id,
      email: session.user.email,
      faceit_player_id: profile?.faceit_player_id ?? null,
    },
  })
}
