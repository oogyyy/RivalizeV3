export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth/get-user'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import PlayerDeepDive from '@/components/demos/PlayerDeepDive'
import type { ParsedDemoData, PlayerStats, Kill } from '@/types/database'

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ folderId: string; playerName: string }>
}) {
  const { folderId, playerName } = await params
  const decodedName = decodeURIComponent(playerName)

  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: folder } = await admin
    .from('team_folders')
    .select('id, user_team_id, opponent_slug, opponent_display_name')
    .eq('id', folderId)
    .single()
  if (!folder || !folder.user_team_id) notFound()

  const { data: member } = await admin
    .from('team_members')
    .select('role')
    .eq('team_id', folder.user_team_id)
    .eq('user_id', user.id)
    .single()
  if (!member) redirect('/opponents')

  const { data: demos } = await admin
    .from('demos')
    .select('id, map, match_date, created_at, parsed_data')
    .eq('team_id', folder.user_team_id)
    .eq('opponent_slug', folder.opponent_slug)
    .eq('demo_type', 'opponent')
    .eq('status', 'completed')
    .order('match_date', { ascending: true })
    .limit(200)

  // Extract per-demo stats for this player
  type DemoEntry = {
    demoId: string
    map: string
    date: string | null
    stats: PlayerStats
    kills: Kill[]
    deaths: Kill[]
  }

  const demoEntries: DemoEntry[] = []
  for (const demo of demos ?? []) {
    const pd = demo.parsed_data as ParsedDemoData | null
    if (!pd?.players) continue

    const player = pd.players.find(
      p => p.name.toLowerCase() === decodedName.toLowerCase(),
    )
    if (!player) continue

    const allKills = pd.rounds?.flatMap(r => r.kills ?? []) ?? []
    const playerKills  = allKills.filter(k => k.killer_name.toLowerCase() === decodedName.toLowerCase())
    const playerDeaths = allKills.filter(k => k.victim_name.toLowerCase() === decodedName.toLowerCase())

    demoEntries.push({
      demoId: demo.id,
      map: demo.map,
      date: demo.match_date ?? demo.created_at,
      stats: player,
      kills: playerKills,
      deaths: playerDeaths,
    })
  }

  if (demoEntries.length === 0) notFound()

  const first = demoEntries[0].stats

  return (
    <div className="min-h-full">
      <div className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-4">
          <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
            <Link href="/opponents" className="hover:text-foreground">Opponents</Link>
            <span>/</span>
            <Link href={`/opponents/${folderId}`} className="hover:text-foreground">{folder.opponent_display_name}</Link>
            <span>/</span>
            <span className="text-foreground font-medium">{decodedName}</span>
          </nav>
          <div className="flex items-center gap-3">
            <Link href={`/opponents/${folderId}`} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-foreground">{decodedName}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {demoEntries.length} {demoEntries.length === 1 ? 'demo' : 'demos'} · {folder.opponent_display_name}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6">
        <PlayerDeepDive
          playerName={decodedName}
          folderId={folderId}
          demoEntries={demoEntries as Parameters<typeof PlayerDeepDive>[0]['demoEntries']}
          teamName={first.team}
        />
      </div>
    </div>
  )
}
