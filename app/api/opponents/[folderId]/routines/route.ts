import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { detectRoutines } from '@/lib/routines'
import type { ParsedDemoData, Round } from '@/types/database'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ folderId: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { folderId } = await params
  const admin = createAdminClient()

  const { data: folder } = await admin
    .from('team_folders')
    .select('id, user_team_id, opponent_slug, opponent_display_name')
    .eq('id', folderId)
    .single()

  if (!folder) return NextResponse.json({ error: 'Folder not found' }, { status: 404 })

  const { data: member } = await admin
    .from('team_members')
    .select('role')
    .eq('team_id', folder.user_team_id)
    .eq('user_id', user.id)
    .single()

  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: demos } = await admin
    .from('demos')
    .select('parsed_data')
    .eq('team_id', folder.user_team_id)
    .eq('opponent_slug', folder.opponent_slug)
    .eq('demo_type', 'opponent')
    .eq('status', 'completed')

  const allRounds: Round[] = []
  for (const demo of demos ?? []) {
    const parsed = demo.parsed_data as ParsedDemoData | null
    if (!parsed?.rounds) continue
    allRounds.push(...parsed.rounds)
  }

  const routines = detectRoutines(allRounds)

  return NextResponse.json({ routines, totalRounds: allRounds.length })
}
