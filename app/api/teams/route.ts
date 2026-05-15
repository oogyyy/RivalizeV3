import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const createTeamSchema = z.object({
  name: z.string().min(2).max(50),
  slug: z.string().min(2).max(30).regex(/^[a-z0-9-]+$/),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = createTeamSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { name, slug } = parsed.data

  // Use admin client only for slug uniqueness check (user can't see other teams via RLS)
  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('teams')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'A team with this slug already exists. Please choose a different one.' },
      { status: 400 }
    )
  }

  // Insert team using the USER's auth client so auth.uid() is set in the RLS context.
  // The teams INSERT policy is: auth.uid() = created_by — this works correctly here.
  const { data: team, error } = await supabase
    .from('teams')
    .insert({ name, slug, created_by: user.id })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'A team with this slug already exists. Please choose a different one.' },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // Insert team_member using the USER's auth client so auth.uid() = user_id in RLS.
  // The team_members INSERT policy is: auth.uid() = user_id AND role = 'owner' AND is_team_creator(team_id).
  // is_team_creator (SECURITY DEFINER) will find the team we just inserted above.
  const { error: memberError } = await supabase
    .from('team_members')
    .insert({ team_id: team.id, user_id: user.id, role: 'owner' })

  if (memberError) {
    // Clean up via admin since the user has no DELETE policy on teams yet
    await admin.from('teams').delete().eq('id', team.id)
    return NextResponse.json({ error: memberError.message }, { status: 400 })
  }

  return NextResponse.json(team, { status: 201 })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch memberships then team details separately (avoids nested RLS circular dependency)
  const { data: memberships, error } = await supabase
    .from('team_members')
    .select('team_id, role')
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const teamIds = (memberships ?? []).map((m) => m.team_id).filter(Boolean)
  if (!teamIds.length) return NextResponse.json([])

  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select('*')
    .in('id', teamIds)

  if (teamsError) return NextResponse.json({ error: teamsError.message }, { status: 400 })

  return NextResponse.json(teams)
}
