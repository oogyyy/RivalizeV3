export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth/get-user'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Shield } from 'lucide-react'
import PlayerDeepDive from '@/components/demos/PlayerDeepDive'
import type { ParsedDemoData, PlayerStats, Kill } from '@/types/database'

export default async function MyTeamPlayerPage({
  params,
}: {
  params: Promise<{ playerName: string }>
}) {
  const { playerName } = await params
  const decodedName = decodeURIComponent(playerName)

  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: memberships } = await admin
    .from('team_members')
    .select('team_id')
    .eq('user_id', user.id)

  const teamIds = (memberships ?? []).map((m: { team_id: string }) => m.team_id).filter(Boolean)
  if (!teamIds.length) redirect('/my-team')

  const primaryTeamId = teamIds[0]
  const { data: team } = await admin
    .from('teams')
    .select('name')
    .eq('id', primaryTeamId)
    .single()
  const teamName = team?.name ?? 'My Team'

  const { data: demos } = await admin
    .from('demos')
    .select('id, map, match_date, created_at, parsed_data')
    .in('team_id', teamIds)
    .eq('demo_type', 'self')
    .eq('status', 'completed')
    .order('match_date', { ascending: true })

  type DemoEntry = {
    demoId: string
    map: string
    date: string | null
    stats: PlayerStats
    kills: Kill[]
    deaths: Kill[]
    result?: 'Win' | 'Loss' | 'Draw' | null
  }

  function getResult(pd: ParsedDemoData): 'Win' | 'Loss' | 'Draw' | null {
    const opSide = ((pd as unknown) as Record<string, unknown>).opponentSide as string ?? 'team2'
    const h = pd.header ?? {} as Record<string, number>
    const our   = opSide === 'team1' ? (h.score_team2 ?? 0) : (h.score_team1 ?? 0)
    const their = opSide === 'team1' ? (h.score_team1 ?? 0) : (h.score_team2 ?? 0)
    if (our === 0 && their === 0) return null
    return our > their ? 'Win' : our < their ? 'Loss' : 'Draw'
  }

  const demoEntries: DemoEntry[] = []
  for (const demo of demos ?? []) {
    const pd = demo.parsed_data as ParsedDemoData | null
    if (!pd?.players) continue

    const player = pd.players.find(
      (p) => p.name.toLowerCase() === decodedName.toLowerCase(),
    )
    if (!player) continue

    const allKills = pd.rounds?.flatMap((r) => r.kills ?? []) ?? []
    const playerKills  = allKills.filter((k) => k.killer_name.toLowerCase() === decodedName.toLowerCase())
    const playerDeaths = allKills.filter((k) => k.victim_name.toLowerCase() === decodedName.toLowerCase())

    demoEntries.push({
      demoId: demo.id,
      map: demo.map,
      date: demo.match_date ?? demo.created_at,
      stats: player,
      kills: playerKills,
      deaths: playerDeaths,
      result: getResult(pd),
    })
  }

  if (demoEntries.length === 0) notFound()

  return (
    <div className="min-h-full">
      <div className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-4">
          <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
            <Link href="/my-team" className="hover:text-foreground flex items-center gap-1">
              <Shield size={13} />
              My Team
            </Link>
            <span>/</span>
            <span className="text-foreground font-medium">{decodedName}</span>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/my-team" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-foreground">{decodedName}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {demoEntries.length} {demoEntries.length === 1 ? 'demo' : 'demos'} · {teamName}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6">
        <PlayerDeepDive
          playerName={decodedName}
          folderId=""
          demoEntries={demoEntries as Parameters<typeof PlayerDeepDive>[0]['demoEntries']}
          teamName={teamName}
        />
      </div>
    </div>
  )
}
