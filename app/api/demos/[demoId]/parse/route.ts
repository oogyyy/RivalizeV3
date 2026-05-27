import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { parseAndSaveDemo } from '@/lib/demo-parser/parse-and-save'

/**
 * POST /api/demos/[demoId]/parse
 * Parses a demo synchronously. On Railway (persistent server, not serverless)
 * this runs to completion even if the client disconnects — no timeout issues.
 * The worker service acts as a fallback for any demos this misses.
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

  // Claim the demo atomically so the worker doesn't double-process it
  const { data: claimed } = await admin
    .from('demos')
    .update({ status: 'processing', processing_started_at: new Date().toISOString(), error_message: null })
    .eq('id', demoId)
    .is('processing_started_at', null)
    .select('id')
    .single()

  // Worker already claimed it — let it finish
  if (!claimed) return NextResponse.json({ queued: true })

  try {
    await parseAndSaveDemo(demoId)
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
