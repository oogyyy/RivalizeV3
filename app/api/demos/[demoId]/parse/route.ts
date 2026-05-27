import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { parseAndSaveDemo } from '@/lib/demo-parser/parse-and-save'

/**
 * POST /api/demos/[demoId]/parse
 * Parses a demo synchronously on the Railway persistent server (no timeout).
 * Does NOT set processing_started_at — that is the worker's domain.
 * If the server process is killed mid-parse (e.g. deployment), the demo stays
 * status='processing' with processing_started_at=null so retries always work.
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

  // Reset to processing so the UI shows the right state
  await admin
    .from('demos')
    .update({ status: 'processing', processing_started_at: null, error_message: null })
    .eq('id', demoId)

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
