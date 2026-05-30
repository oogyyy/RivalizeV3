import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

/**
 * POST /api/demos/[demoId]/parse
 *
 * Now just enqueues the demo for the worker.
 * No more synchronous parsing (the old source of most stuck jobs).
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
    .select('team_id, status')
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

  // Reset to queued so the worker can pick it up
  await admin
    .from('demos')
    .update({
      status: 'queued',
      processing_started_at: null,
      queued_at: new Date().toISOString(),
      error_message: null,
      retry_count: 0,
    })
    .eq('id', demoId)

  return NextResponse.json({ success: true, enqueued: true })
}
