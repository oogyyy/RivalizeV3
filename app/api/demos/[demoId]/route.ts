import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { deleteObject } from '@/lib/r2'

// Returns the demo status and the parsed_data fields needed for team selection.
// Used by the upload modal to poll until parsing completes.
export async function GET(
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
    .select('id, team_id, status, parsed_data')
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

  return NextResponse.json({
    id: demo.id,
    status: demo.status,
    parsed_data: demo.parsed_data,
  })
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ demoId: string }> }
) {
  const { demoId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { opponentSide } = body
  if (opponentSide !== 'team1' && opponentSide !== 'team2') {
    return NextResponse.json({ error: 'opponentSide must be "team1" or "team2"' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: demo } = await admin
    .from('demos')
    .select('id, team_id, parsed_data')
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

  const updatedParsedData = {
    ...(typeof demo.parsed_data === 'object' && demo.parsed_data !== null ? demo.parsed_data : {}),
    opponentSide,
  }

  const { error } = await admin
    .from('demos')
    .update({ parsed_data: updatedParsedData })
    .eq('id', demoId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ demoId: string }> }
) {
  const { demoId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Fetch the demo to verify ownership and get the R2 key
  const { data: demo } = await admin
    .from('demos')
    .select('id, team_id, raw_file_path')
    .eq('id', demoId)
    .single()

  if (!demo) return NextResponse.json({ error: 'Demo not found' }, { status: 404 })

  // Confirm the caller is a member of the demo's team
  const { data: member } = await admin
    .from('team_members')
    .select('role')
    .eq('team_id', demo.team_id)
    .eq('user_id', user.id)
    .single()

  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Delete the R2 file first (best-effort — don't fail if missing)
  if (demo.raw_file_path) {
    try {
      await deleteObject(demo.raw_file_path)
    } catch (err) {
      console.warn('[delete-demo] R2 delete failed (continuing):', String(err))
    }
  }

  // Delete the DB record
  const { error } = await admin.from('demos').delete().eq('id', demoId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
