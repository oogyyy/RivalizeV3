export const maxDuration = 60

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ demoId: string }> }
) {
  const { demoId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: demo } = await admin
    .from('demos')
    .select('team_id, raw_file_path, status')
    .eq('id', demoId)
    .single()

  if (!demo) return NextResponse.json({ error: 'Demo not found' }, { status: 404 })
  if (!demo.raw_file_path) return NextResponse.json({ error: 'No file path on record' }, { status: 400 })

  const { data: member } = await admin
    .from('team_members')
    .select('role')
    .eq('team_id', demo.team_id)
    .eq('user_id', user.id)
    .single()

  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Enqueue for the worker (no more synchronous long-running parse)
  await admin.from('demos').update({
    status: 'queued',
    error_message: null,
    processing_started_at: null,
    queued_at: new Date().toISOString(),
    retry_count: 0,
  }).eq('id', demoId)

  return NextResponse.json({ success: true, enqueued: true })
}
