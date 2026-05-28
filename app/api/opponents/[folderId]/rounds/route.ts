import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import type { Round, Kill } from '@/types/database'

// GET /api/opponents/[folderId]/rounds?side=T&outcome=win&min_kills=3&weapon=awp
export async function GET(
  request: Request,
  { params }: { params: Promise<{ folderId: string }> }
) {
  const { folderId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const side = searchParams.get('side')       // 'T' | 'CT'
  const outcome = searchParams.get('outcome') // 'win' | 'loss'
  const weapon = searchParams.get('weapon')   // e.g. 'awp', 'ak47'
  const minKills = searchParams.get('min_kills') ? parseInt(searchParams.get('min_kills')!) : null
  const bombPlanted = searchParams.get('bomb_planted') // 'true' | 'false'
  const mapFilter = searchParams.get('map')

  const admin = createAdminClient()

  // Verify folder access
  const { data: folder } = await admin
    .from('team_folders')
    .select('id, user_team_id, opponent_slug')
    .eq('id', folderId)
    .single()
  if (!folder) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: membership } = await admin
    .from('team_members')
    .select('role')
    .eq('team_id', folder.user_team_id)
    .eq('user_id', user.id)
    .single()
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Fetch all completed demos in this folder
  let demoQuery = admin
    .from('demos')
    .select('id, map, opponent_name, match_date, parsed_data')
    .eq('team_id', folder.user_team_id)
    .eq('opponent_slug', folder.opponent_slug)
    .eq('demo_type', 'opponent')
    .eq('status', 'completed')
    .not('parsed_data', 'is', null)

  if (mapFilter) demoQuery = demoQuery.eq('map', mapFilter)

  const { data: demos, error } = await demoQuery
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Extract and filter rounds across all demos
  const results: Array<{
    demo_id: string
    demo_map: string
    demo_opponent: string
    demo_date: string | null
    round: Round & { opponent_side?: string }
    kill_count: number
    top_weapon: string | null
  }> = []

  for (const demo of demos ?? []) {
    const pd = demo.parsed_data as {
      rounds?: Round[]
      header?: { team1?: string; team2?: string }
      opponentSide?: string
    }
    if (!pd?.rounds) continue

    const opponentSide = pd.opponentSide ?? 'team2' // 'team1' or 'team2'
    // Map to 'T' or 'CT': this is per-round; we use the round winner to infer
    // For simplicity we attach the opponentSide string and let the client decide,
    // but we can filter server-side using win_reason patterns

    for (const round of pd.rounds) {
      // Side filter: compare against win_reason — T wins = bomb/elimination of CTs
      const tWinReasons = ['bomb_detonated', 'terrorists_win', 'target_bombed']
      const ctWinReasons = ['bomb_defused', 'counter_terrorists_win', 'target_saved', 'hostage_rescued']
      const roundWinner = round.winner // team1 or team2 name

      // Determine opponent's side this round
      // We use round number: typically T for first 15, CT for second 15
      const opponentIsT = round.number <= 15
        ? opponentSide === 'team1'   // team1 starts T in standard match
        : opponentSide === 'team2'

      const opponentCurrentSide = opponentIsT ? 'T' : 'CT'

      if (side && opponentCurrentSide !== side) continue

      // Outcome filter
      if (outcome) {
        const opponentTeam = opponentSide === 'team1' ? pd.header?.team1 : pd.header?.team2
        const opponentWon = roundWinner === opponentTeam ||
          (outcome === 'win' && opponentIsT && tWinReasons.includes(round.win_reason)) ||
          (outcome === 'win' && !opponentIsT && ctWinReasons.includes(round.win_reason))
        const opponentLost = !opponentWon

        if (outcome === 'win' && opponentLost) continue
        if (outcome === 'loss' && opponentWon) continue
      }

      // Bomb planted filter
      if (bombPlanted === 'true' && !round.bomb_planted) continue
      if (bombPlanted === 'false' && round.bomb_planted) continue

      // Count kills and filter by weapon
      const kills: Kill[] = round.kills ?? []
      const filteredKills = weapon
        ? kills.filter(k => k.weapon.toLowerCase().includes(weapon.toLowerCase()))
        : kills

      const totalKills = filteredKills.length
      if (minKills !== null && totalKills < minKills) continue

      // Top weapon used
      const weaponCounts: Record<string, number> = {}
      for (const k of kills) {
        weaponCounts[k.weapon] = (weaponCounts[k.weapon] ?? 0) + 1
      }
      const topWeapon = Object.entries(weaponCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

      results.push({
        demo_id: demo.id,
        demo_map: demo.map,
        demo_opponent: demo.opponent_name,
        demo_date: demo.match_date,
        round: { ...round, opponent_side: opponentCurrentSide },
        kill_count: kills.length,
        top_weapon: topWeapon,
      })
    }
  }

  // Sort: bomb planted first, then by kill count descending
  results.sort((a, b) => {
    if (a.round.bomb_planted && !b.round.bomb_planted) return -1
    if (!a.round.bomb_planted && b.round.bomb_planted) return 1
    return b.kill_count - a.kill_count
  })

  return NextResponse.json({
    total: results.length,
    rounds: results.slice(0, 100), // cap at 100 results
  })
}
