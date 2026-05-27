import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

/**
 * POST /api/demos/[demoId]/parse
 * Resets a demo so the polling worker picks it up for (re-)parsing.
 * Returns immediately — the worker processes the demo asynchronously.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ demoId: string }> },
) {
  const { demoId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: demo } = await admin
    .from('demos')
    .select('team_id')
    .eq('id', demoId)
    .single()

  if (!demo) return NextResponse.json({ error: 'Demo not found' }, { status: 404 })

  const { data: member } = await admin
    .from('team_members')
    .select('role')
    .eq('team_id', demo.team_id)
    .eq('user_id', user.id)
    .single()

  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Reset so the worker reclaims it on the next poll
  await admin
    .from('demos')
    .update({ status: 'processing', processing_started_at: null, error_message: null })
    .eq('id', demoId)

  return NextResponse.json({ queued: true })
}
