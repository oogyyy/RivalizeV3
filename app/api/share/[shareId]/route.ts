import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { PlayerStats } from '@/types/database'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ shareId: string }> },
) {
  const { shareId } = await params

  const admin = createAdminClient()

  const { data: demo } = await admin
    .from('demos')
    .select('id, map, match_date, demo_type, opponent_name, parsed_data, share_id')
    .eq('share_id', shareId)
    .single()

  if (!demo) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const pd = demo.parsed_data as {
    header?: { map?: string; team1?: string; team2?: string; score_team1?: number; score_team2?: number; total_rounds?: number }
    players?: PlayerStats[]
    rounds?: { bomb_planted?: boolean }[]
  } | null

  return NextResponse.json({
    map: demo.map,
    matchDate: demo.match_date,
    demoType: demo.demo_type,
    opponentName: demo.opponent_name,
    header: pd?.header ?? null,
    players: (pd?.players ?? []).map(p => ({
      name: p.name,
      team: p.team,
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
      adr: p.adr,
      rating: p.rating,
      headshot_percentage: p.headshot_percentage,
    })),
    totalRounds: pd?.header?.total_rounds ?? 0,
    bombPlants: (pd?.rounds ?? []).filter(r => r.bomb_planted).length,
  })
}
