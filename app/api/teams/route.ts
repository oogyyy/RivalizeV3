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

  // Admin client bypasses RLS entirely (service role key required in SUPABASE_SERVICE_ROLE_KEY).
  // Do NOT use the user's client here — the team_members INSERT policies call is_team_admin()
  // which queries team_members, causing infinite RLS recursion.
  const admin = createAdminClient()

  // Check slug uniqueness
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

  // Insert team
  const { data: team, error: teamError } = await admin
    .from('teams')
    .insert({ name, slug, created_by: user.id })
    .select()
    .single()

  if (teamError) {
    if (teamError.code === '23505') {
      return NextResponse.json(
        { error: 'A team with this slug already exists. Please choose a different one.' },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: teamError.message }, { status: 400 })
  }

  // Insert team owner membership — admin client bypasses the RLS policies that
  // would otherwise trigger infinite recursion via is_team_admin → team_members → RLS loop
  const { error: memberError } = await admin
    .from('team_members')
    .insert({ team_id: team.id, user_id: user.id, role: 'owner' })

  if (memberError) {
    await admin.from('teams').delete().eq('id', team.id)
    return NextResponse.json({ error: memberError.message }, { status: 400 })
  }

  return NextResponse.json(team, { status: 201 })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: memberships, error } = await admin
    .from('team_members')
    .select('team_id, role')
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const teamIds = (memberships ?? []).map((m) => m.team_id).filter(Boolean)
  if (!teamIds.length) return NextResponse.json([])

  const { data: teams, error: teamsError } = await admin
    .from('teams')
    .select('*')
    .in('id', teamIds)

  if (teamsError) return NextResponse.json({ error: teamsError.message }, { status: 400 })

  return NextResponse.json(teams)
}
