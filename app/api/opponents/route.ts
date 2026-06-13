import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { slugify } from '@/lib/utils'
import { parseFaceitTeamId, getTeam, isFaceitConfigured } from '@/lib/faceit'

const createSchema = z.object({
  teamId: z.string().uuid(),
  // Provide a name and/or a FACEIT team URL/id. When a FACEIT id is given we
  // resolve the team name from FACEIT and link the folder to it.
  name: z.string().min(1).max(100).optional(),
  faceitInput: z.string().min(1).max(200).optional(),
}).refine(d => d.name || d.faceitInput, { message: 'A name or FACEIT team is required' })

/** Create an opponent folder, optionally linked to a FACEIT/ESEA team. */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = createSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  const { teamId, name, faceitInput } = parsed.data

  const admin = createAdminClient()

  // Caller must be an owner/admin of the team.
  const { data: member } = await admin
    .from('team_members').select('role')
    .eq('team_id', teamId).eq('user_id', user.id).single()
  if (!member || !['owner', 'admin'].includes(member.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let faceitTeamId: string | null = null
  let faceitTeamName: string | null = null
  let displayName = name?.trim() ?? ''

  if (faceitInput) {
    faceitTeamId = parseFaceitTeamId(faceitInput)
    if (!faceitTeamId) {
      return NextResponse.json(
        { error: 'Could not find a FACEIT team id in that link.' }, { status: 400 },
      )
    }
    if (!isFaceitConfigured()) {
      return NextResponse.json({ error: 'FACEIT integration is not configured.' }, { status: 503 })
    }
    try {
      const team = await getTeam(faceitTeamId)
      faceitTeamName = team.name || team.nickname
      if (!displayName) displayName = faceitTeamName
    } catch {
      return NextResponse.json(
        { error: 'No FACEIT team found for that id.' }, { status: 404 },
      )
    }
  }

  if (!displayName) {
    return NextResponse.json({ error: 'Opponent name is required' }, { status: 400 })
  }

  const slug = slugify(displayName)

  const { data: folder, error } = await admin
    .from('team_folders')
    .upsert({
      user_team_id: teamId,
      opponent_slug: slug,
      opponent_display_name: displayName,
      faceit_team_id: faceitTeamId,
      faceit_team_name: faceitTeamName,
    } as Record<string, unknown>, { onConflict: 'user_team_id,opponent_slug' })
    .select('id')
    .single()

  if (error || !folder) {
    return NextResponse.json({ error: error?.message ?? 'Failed to create opponent' }, { status: 500 })
  }

  return NextResponse.json({ folderId: folder.id, slug, name: displayName }, { status: 201 })
}

/** Returns all opponent folders across all teams the user belongs to. */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: memberships } = await admin
    .from('team_members')
    .select('team_id')
    .eq('user_id', user.id)

  const teamIds = (memberships ?? []).map((m) => m.team_id).filter(Boolean)
  if (!teamIds.length) return NextResponse.json([])

  const { data: folders, error } = await admin
    .from('team_folders')
    .select('*')
    .in('user_team_id', teamIds)
    .order('opponent_display_name')

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json(folders ?? [])
}
