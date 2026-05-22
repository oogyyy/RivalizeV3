import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { deleteObject } from '@/lib/r2'
import { NextResponse } from 'next/server'

export async function DELETE(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { demoIds?: unknown }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { demoIds } = body
  if (!Array.isArray(demoIds) || demoIds.length === 0 || demoIds.length > 100) {
    return NextResponse.json({ error: 'demoIds must be a non-empty array (max 100)' }, { status: 400 })
  }
  if (!demoIds.every(id => typeof id === 'string')) {
    return NextResponse.json({ error: 'All demoIds must be strings' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Fetch all requested demos in one query
  const { data: demos } = await admin
    .from('demos')
    .select('id, team_id, raw_file_path')
    .in('id', demoIds)

  if (!demos || demos.length === 0) {
    return NextResponse.json({ error: 'No demos found' }, { status: 404 })
  }

  // Verify the caller is a member of every team that owns these demos
  const teamIds = [...new Set(demos.map(d => d.team_id).filter(Boolean))]
  const { data: memberships } = await admin
    .from('team_members')
    .select('team_id')
    .eq('user_id', user.id)
    .in('team_id', teamIds)

  const allowedTeams = new Set((memberships ?? []).map(m => m.team_id))
  const forbidden = demos.filter(d => !allowedTeams.has(d.team_id))
  if (forbidden.length > 0) {
    return NextResponse.json({ error: 'Forbidden: some demos do not belong to your teams' }, { status: 403 })
  }

  // Delete R2 objects best-effort (don't abort the whole operation on failure)
  await Promise.allSettled(
    demos
      .filter(d => d.raw_file_path)
      .map(d => deleteObject(d.raw_file_path).catch(err =>
        console.warn('[bulk-delete] R2 delete failed for', d.id, String(err))
      ))
  )

  // Delete DB records
  const { error } = await admin
    .from('demos')
    .delete()
    .in('id', demos.map(d => d.id))

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ deleted: demos.length })
}
