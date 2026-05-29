import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/teams/players?teamId=... — returns unique player names from completed self demos
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const teamId = req.nextUrl.searchParams.get('teamId')
  if (!teamId) return NextResponse.json({ error: 'teamId required' }, { status: 400 })

  const admin = createAdminClient()

  // Verify membership
  const { data: member } = await admin
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .single()
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: demos } = await admin
    .from('demos')
    .select('parsed_data')
    .eq('team_id', teamId)
    .eq('demo_type', 'self')
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(10)

  // Collect unique player names across all demos, sorted by frequency
  const nameCount: Record<string, number> = {}
  for (const demo of demos ?? []) {
    const pd = demo.parsed_data as { players?: Array<{ name: string }> } | null
    for (const p of pd?.players ?? []) {
      if (p.name) nameCount[p.name] = (nameCount[p.name] ?? 0) + 1
    }
  }

  const names = Object.entries(nameCount)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name)

  return NextResponse.json(names)
}
