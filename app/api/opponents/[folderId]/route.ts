import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { deleteObject } from '@/lib/r2'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ folderId: string }> }
) {
  const { folderId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Fetch the folder to verify it exists and get the team
  const { data: folder } = await admin
    .from('team_folders')
    .select('id, user_team_id, opponent_slug')
    .eq('id', folderId)
    .single()

  if (!folder) return NextResponse.json({ error: 'Folder not found' }, { status: 404 })

  // Confirm the caller belongs to this team
  const { data: member } = await admin
    .from('team_members')
    .select('role')
    .eq('team_id', folder.user_team_id)
    .eq('user_id', user.id)
    .single()

  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Fetch all demos for this folder so we can clean up R2 files
  const { data: demos } = await admin
    .from('demos')
    .select('id, raw_file_path')
    .eq('team_id', folder.user_team_id)
    .eq('opponent_slug', folder.opponent_slug)

  // Delete R2 files (best-effort)
  type DemoRow = { id: string; raw_file_path: string | null }
  await Promise.allSettled(
    (demos as DemoRow[] ?? [])
      .filter((d: DemoRow) => d.raw_file_path)
      .map((d: DemoRow) => deleteObject(d.raw_file_path!))
  )

  // Delete all demo records for this folder
  await admin
    .from('demos')
    .delete()
    .eq('team_id', folder.user_team_id)
    .eq('opponent_slug', folder.opponent_slug)

  // Delete the folder record
  const { error } = await admin.from('team_folders').delete().eq('id', folderId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
