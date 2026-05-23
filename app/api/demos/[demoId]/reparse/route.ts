export const maxDuration = 300

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { parseAndSaveDemo } from '@/lib/demo-parser/parse-and-save'

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

  await admin.from('demos').update({ status: 'processing', error_message: null }).eq('id', demoId)

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
