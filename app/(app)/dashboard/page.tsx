export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth/get-user'
import { redirect } from 'next/navigation'
import DashboardPageClient, { type RecentDemoItem, type MapPerfItem, type CommunityFeedItem } from '@/components/dashboard/DashboardPageClient'

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSelfDemoResult(parsedData: unknown): 'Win' | 'Loss' | 'Draw' | null {
  if (!parsedData || typeof parsedData !== 'object') return null
  const pd = parsedData as Record<string, unknown> & { opponentSide?: string; header?: Record<string, number>; rounds?: Array<{ win_reason: string }> }
  const opponentSide = pd.opponentSide ?? 'team2'
  const h = pd.header ?? {}
  let myScore    = opponentSide === 'team1' ? (h.score_team2 ?? 0) : (h.score_team1 ?? 0)
  let theirScore = opponentSide === 'team1' ? (h.score_team1 ?? 0) : (h.score_team2 ?? 0)

  if (myScore === 0 && theirScore === 0 && pd.rounds?.length) {
    const T_WIN  = new Set(['ct_killed', 'bomb_exploded', 'target_bombed', 'terrorists_win'])
    const CT_WIN = new Set(['t_killed', 'bomb_defused', 'hostage_rescued', 'cts_win', 'time_expired'])
    const half   = 12
    let s1 = 0, s2 = 0
    for (let i = 0; i < pd.rounds.length; i++) {
      const reason = pd.rounds[i].win_reason
      const tWon = T_WIN.has(reason) ? true : CT_WIN.has(reason) ? false : null
      if (tWon === null) continue
      const isSecondHalf = i >= half
      if (!isSecondHalf) { if (tWon) s1++; else s2++ }
      else               { if (tWon) s2++; else s1++ }
    }
    if (s1 > 0 || s2 > 0) {
      myScore    = opponentSide === 'team1' ? s2 : s1
      theirScore = opponentSide === 'team1' ? s1 : s2
    }
  }

  if (myScore === 0 && theirScore === 0) return null
  return myScore > theirScore ? 'Win' : myScore < theirScore ? 'Loss' : 'Draw'
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const supabase = await createClient()
  const admin = createAdminClient()

  // ── Fetch memberships first (needed to scope all other queries) ──────────────
  const { data: memberships } = await admin
    .from('team_members')
    .select('role, team_id')
    .eq('user_id', user.id)

  const teamIds       = (memberships ?? []).map((m) => m.team_id).filter(Boolean)
  const primaryTeamId = teamIds[0] ?? null

  // ── Parallel fetch: all queries that depend only on teamIds ──────────────────
  const none = { data: null as null }
  const empty = { data: [] as unknown[] }

  const [
    teamResult,
    folderResult,
    recentResult,
    metaResult,
    statsResult,
    publicResult,
  ] = await Promise.all([
    primaryTeamId
      ? admin.from('teams').select('name').eq('id', primaryTeamId).single()
      : Promise.resolve(none),
    primaryTeamId
      ? admin
          .from('team_folders')
          .select('id, opponent_display_name, opponent_slug')
          .eq('user_team_id', primaryTeamId)
          .order('updated_at', { ascending: false })
          .limit(1)
          .single()
      : Promise.resolve(none),
    teamIds.length
      ? admin
          .from('demos')
          .select('id, team_id, opponent_name, opponent_slug, map, match_date, status, created_at, parsed_data')
          .in('team_id', teamIds)
          .eq('demo_type', 'self')
          .order('created_at', { ascending: false })
          .limit(5)
      : Promise.resolve(empty),
    teamIds.length
      ? admin.from('demos').select('status').in('team_id', teamIds)
      : Promise.resolve(empty),
    teamIds.length
      ? admin
          .from('demos')
          .select('parsed_data')
          .in('team_id', teamIds)
          .eq('demo_type', 'self')
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(30)
      : Promise.resolve(empty),
    admin
      .from('team_folders')
      .select('id, opponent_display_name, published_at, aggregated_stats')
      .eq('is_public', true)
      .order('published_at', { ascending: false })
      .limit(6),
  ])

  const primaryTeam    = teamResult.data   as { name?: string } | null
  const topFolder      = folderResult.data as { id: string; opponent_display_name: string; opponent_slug: string } | null
  const recentSelfDemos = recentResult.data as unknown[]
  const allDemosMeta   = metaResult.data   as unknown[]
  const allSelfDemosData = statsResult.data as unknown[]
  const publicFolders  = publicResult.data as Array<{ id: string; opponent_display_name: string; published_at: string | null; aggregated_stats: unknown }> | null

  const myTeamName   = primaryTeam?.name ?? 'My Team'
  const nextOpponent = topFolder?.opponent_display_name ?? null

  type DemoRow = {
    id: string; team_id: string; opponent_name: string
    opponent_slug: string | null; map: string
    match_date: string | null; status: string; created_at: string
    parsed_data?: unknown
  }

  type SelfDemoMeta = { parsed_data: unknown }
  const selfCompleted = (allSelfDemosData ?? []) as SelfDemoMeta[]

  // ── Compute aggregate stats ──────────────────────────────────────────────────
  let selfWins = 0, selfTotal = 0, selfKills = 0, selfDeaths = 0, selfPlayerCount = 0

  const mapWins: Record<string, { wins: number; total: number }> = {}

  for (const d of selfCompleted) {
    const result = getSelfDemoResult(d.parsed_data)
    if (result !== null) {
      selfTotal++
      if (result === 'Win') selfWins++
    }
    const pd = d.parsed_data as Record<string, unknown> | null
    const players = (pd?.players ?? []) as Array<{ team: string; kills: number; deaths: number; rating: number }>
    const opSide = (pd?.opponentSide as string | undefined) ?? 'team2'
    const header = (pd?.header ?? {}) as Record<string, string | number>
    const opLabel = opSide === 'team1' ? (header.team1 as string ?? '') : (header.team2 as string ?? '')
    for (const p of players) {
      if (p.team === opLabel) continue
      selfKills  += p.kills
      selfDeaths += p.deaths
      selfPlayerCount++
    }

    // Map performance grouping
    const mapKey = ((header.map as string) ?? '').toLowerCase()
    if (mapKey && mapKey !== 'unknown') {
      const mapName = mapKey.replace(/^de_/, '').replace(/^(.)/, (c: string) => c.toUpperCase())
      if (!mapWins[mapName]) mapWins[mapName] = { wins: 0, total: 0 }
      if (result !== null) {
        mapWins[mapName].total++
        if (result === 'Win') mapWins[mapName].wins++
      }
    }
  }

  const winRateDisplay = selfTotal > 0 ? `${Math.round((selfWins / selfTotal) * 100)}%` : '—'
  const avgKDDisplay   = selfDeaths > 0 && selfPlayerCount > 0
    ? (selfKills / selfDeaths).toFixed(2)
    : '—'

  const totalDemos    = (allDemosMeta ?? []).length
  const analyzedDemos = (allDemosMeta ?? []).filter((d) => (d as { status: string }).status === 'completed').length

  // ── Recent demos list ────────────────────────────────────────────────────────
  const recentDemos: RecentDemoItem[] = ((recentSelfDemos ?? []) as DemoRow[]).map((d) => {
    const result = d.status === 'completed' ? getSelfDemoResult(d.parsed_data) : null
    const wl: RecentDemoItem['wl'] = result === 'Win' ? 'W' : result === 'Loss' ? 'L' : result === 'Draw' ? 'D' : null

    const pd = d.parsed_data as Record<string, unknown> | null
    const players = (pd?.players ?? []) as Array<{ team: string; kills: number; deaths: number; rating: number }>
    const opSide = (pd?.opponentSide as string | undefined) ?? 'team2'
    const header = (pd?.header ?? {}) as Record<string, string | number>
    const opLabel = opSide === 'team1' ? (header.team1 as string ?? '') : (header.team2 as string ?? '')
    const ourPlayers = players.filter(p => p.team !== opLabel)
    const avgRating = ourPlayers.length > 0
      ? (ourPlayers.reduce((sum, p) => sum + (p.rating ?? 0), 0) / ourPlayers.length).toFixed(2)
      : '—'

    const mapRaw = (header.map as string | undefined) ?? d.map ?? 'unknown'
    const mapName = mapRaw !== 'unknown'
      ? mapRaw.replace(/^de_/, '').replace(/^(.)/, (c: string) => c.toUpperCase())
      : '?'

    const dateStr = d.match_date ?? d.created_at
    const href = d.status === 'completed' ? `/my-team/demos/${d.id}` : '/my-team'

    return {
      id: d.id,
      map: mapName,
      opponent: d.opponent_name || myTeamName,
      wl,
      date: formatShortDate(dateStr),
      rating: avgRating,
      href,
    }
  })

  // ── Map performance (top 5 maps by game count) ───────────────────────────────
  const mapPerformance: MapPerfItem[] = Object.entries(mapWins)
    .filter(([, v]) => v.total > 0)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 5)
    .map(([name, v]) => ({
      name,
      ct: v.total > 0 ? Math.round(v.wins / v.total * 100) : 50,
    }))

  // ── Community feed ratings ───────────────────────────────────────────────────
  type RatingRow = { folder_id: string; rating: number }
  const folderIds = (publicFolders ?? []).map(f => f.id)

  const { data: communityRatings } = folderIds.length
    ? await admin
        .from('opponent_ratings')
        .select('folder_id, rating')
        .in('folder_id', folderIds)
        .eq('rating', 1)
    : { data: [] }

  const upCountMap: Record<string, number> = {}
  for (const r of (communityRatings ?? []) as RatingRow[]) {
    upCountMap[r.folder_id] = (upCountMap[r.folder_id] ?? 0) + 1
  }

  const communityFeed: CommunityFeedItem[] = (publicFolders ?? []).map(f => {
    const s = f.aggregated_stats as Record<string, unknown> | null
    const wins   = (s?.wins   as number | undefined) ?? 0
    const losses = (s?.losses as number | undefined) ?? 0
    const draws  = (s?.draws  as number | undefined) ?? 0
    const total  = wins + losses + draws
    const wr     = total > 0 ? Math.round((wins / total) * 100) : null
    const mapPerf = s?.map_performance as Record<string, { wins: number; total: number }> | undefined
    const topMap  = mapPerf
      ? Object.entries(mapPerf).sort((a, b) => b[1].total - a[1].total)[0]?.[0] ?? null
      : null
    return {
      id:          f.id,
      name:        f.opponent_display_name,
      publishedAt: f.published_at ?? new Date().toISOString(),
      winRate:     wr,
      total,
      upRatings:   upCountMap[f.id] ?? 0,
      topMap,
    }
  })

  return (
    <DashboardPageClient
      winRate={winRateDisplay}
      mapsPlayed={totalDemos}
      demosAnalyzed={analyzedDemos}
      avgRating={avgKDDisplay}
      nextOpponent={nextOpponent}
      recentDemos={recentDemos}
      mapPerformance={mapPerformance}
      communityFeed={communityFeed}
    />
  )
}
