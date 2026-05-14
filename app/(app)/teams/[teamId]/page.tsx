import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import FolderCard from '@/components/teams/FolderCard'
import DemoUploadButton from '@/components/teams/DemoUploadButton'
import TeamTabNav from './TeamTabNav'
import {
  Users, Upload, Brain, Trophy, Crosshair, ArrowLeft,
  Crown, Shield, User, Plus, BarChart3, Target, MapPin,
} from 'lucide-react'
import type { PlayerStats, AggregatedStats } from '@/types/database'

export default async function TeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { teamId } = await params
  const { tab = 'overview' } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch team
  const { data: team } = await supabase
    .from('teams')
    .select('*')
    .eq('id', teamId)
    .single()

  if (!team) notFound()

  // Check membership
  const { data: myMembership } = await supabase
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .single()

  if (!myMembership) redirect('/teams')

  const isOwnerOrAdmin = myMembership.role === 'owner' || myMembership.role === 'admin'

  // Fetch all team members with profiles
  const { data: members } = await supabase
    .from('team_members')
    .select('role, user_id, profiles(id, username, display_name, avatar_url)')
    .eq('team_id', teamId)

  // Fetch all demos
  const { data: demos } = await supabase
    .from('demos')
    .select('*')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false })

  // Fetch folders
  const { data: folders } = await supabase
    .from('team_folders')
    .select('*')
    .eq('user_team_id', teamId)

  // Build folder -> demos count map
  const demosByOpponent: Record<string, typeof demos> = {}
  for (const demo of demos ?? []) {
    const key = demo.opponent_slug ?? demo.opponent_name
    if (!demosByOpponent[key]) demosByOpponent[key] = []
    demosByOpponent[key].push(demo)
  }

  // Compute top players across all completed demos
  const playerMap: Record<string, PlayerStats & { count: number }> = {}
  for (const demo of demos ?? []) {
    if (demo.status === 'completed' && demo.parsed_data) {
      const pd = demo.parsed_data as { players?: PlayerStats[] }
      for (const p of pd.players ?? []) {
        if (!playerMap[p.steam_id]) {
          playerMap[p.steam_id] = { ...p, count: 0 }
        } else {
          playerMap[p.steam_id].kills += p.kills
          playerMap[p.steam_id].deaths += p.deaths
          playerMap[p.steam_id].assists += p.assists
          playerMap[p.steam_id].adr = (playerMap[p.steam_id].adr + p.adr) / 2
          playerMap[p.steam_id].rating = (playerMap[p.steam_id].rating + p.rating) / 2
        }
        playerMap[p.steam_id].count++
      }
    }
  }
  const topPlayers = Object.values(playerMap)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 5)

  // Map stats
  const mapCount: Record<string, number> = {}
  for (const demo of demos ?? []) {
    if (demo.map) mapCount[demo.map] = (mapCount[demo.map] ?? 0) + 1
  }
  const topMaps = Object.entries(mapCount).sort((a, b) => b[1] - a[1]).slice(0, 6)

  // Win/loss from parsed demos
  const completedDemos = (demos ?? []).filter((d) => d.status === 'completed' && d.parsed_data)
  let wins = 0
  let losses = 0
  let draws = 0
  for (const demo of completedDemos) {
    const pd = demo.parsed_data as { header?: { score_team1?: number; score_team2?: number } }
    if (pd?.header) {
      const s1 = pd.header.score_team1 ?? 0
      const s2 = pd.header.score_team2 ?? 0
      if (s1 > s2) wins++
      else if (s2 > s1) losses++
      else draws++
    }
  }
  const totalMatches = wins + losses + draws
  const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0

  const statusVariant = (status: string) => {
    if (status === 'completed') return 'neon' as const
    if (status === 'processing') return 'processing' as const
    return 'destructive' as const
  }

  const roleIcon = { owner: Crown, admin: Shield, member: User }
  const roleVariant = {
    owner: 'neon' as const,
    admin: 'warning' as const,
    member: 'secondary' as const,
  }

  return (
    <div className="min-h-full">
      {/* Team header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link
                href="/teams"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft size={18} />
              </Link>
              {/* Team logo */}
              <div className="w-14 h-14 rounded-xl bg-neon-green/10 border border-neon-green/20 flex items-center justify-center shrink-0">
                {team.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={team.logo_url}
                    alt={team.name}
                    className="w-full h-full object-cover rounded-xl"
                  />
                ) : (
                  <span className="text-2xl font-bold text-neon-green">
                    {team.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-foreground">{team.name}</h1>
                  <Badge variant={roleVariant[myMembership.role]}>
                    {myMembership.role}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users size={13} />
                    {(members ?? []).length} members
                  </span>
                  <span className="text-border">·</span>
                  <span className="flex items-center gap-1">
                    <BarChart3 size={13} />
                    {(demos ?? []).length} demos
                  </span>
                  {totalMatches > 0 && (
                    <>
                      <span className="text-border">·</span>
                      <span className="flex items-center gap-1 text-neon-green font-medium">
                        <Trophy size={13} />
                        {winRate}% win rate
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Link href={`/ai-coach?team=${teamId}`}>
                <Button variant="outline" className="gap-2">
                  <Brain size={16} />
                  AI Coach
                </Button>
              </Link>
              {isOwnerOrAdmin && (
                <DemoUploadButton teamId={teamId} />
              )}
            </div>
          </div>

          {/* Tab navigation */}
          <TeamTabNav teamId={teamId} activeTab={tab} />
        </div>
      </div>

      {/* Tab content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* ── OVERVIEW TAB ── */}
        {tab === 'overview' && (
          <div className="space-y-6">
            {/* Stats row */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {[
                { label: 'Total Demos', value: (demos ?? []).length, color: 'text-foreground' },
                { label: 'Wins', value: wins, color: 'text-neon-green' },
                { label: 'Losses', value: losses, color: 'text-red-400' },
                { label: 'Win Rate', value: `${winRate}%`, color: winRate >= 50 ? 'text-neon-green' : 'text-red-400' },
              ].map(({ label, value, color }) => (
                <Card key={label} className="bg-card border-border">
                  <CardContent className="p-5 text-center">
                    <p className="text-xs text-muted-foreground mb-1">{label}</p>
                    <p className={`text-3xl font-bold font-mono ${color}`}>{value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Top Players leaderboard */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target size={16} className="text-neon-green" />
                    Top Players
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-0">
                  {topPlayers.length === 0 ? (
                    <div className="px-6 py-8 text-center">
                      <p className="text-sm text-muted-foreground">
                        Upload and analyse demos to see player stats
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {topPlayers.map((player, idx) => (
                        <div key={player.steam_id} className="flex items-center gap-3 px-6 py-3">
                          <span
                            className={`text-sm font-bold w-5 text-center font-mono ${
                              idx === 0 ? 'text-yellow-400' : 'text-muted-foreground'
                            }`}
                          >
                            #{idx + 1}
                          </span>
                          <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center">
                            <span className="text-xs font-bold text-foreground">
                              {player.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{player.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {player.kills}K / {player.deaths}D / {player.assists}A
                            </p>
                          </div>
                          <div className="text-right">
                            <p
                              className={`text-sm font-bold font-mono ${
                                player.rating >= 1.2
                                  ? 'text-neon-green'
                                  : player.rating >= 1.0
                                  ? 'text-green-400'
                                  : player.rating >= 0.8
                                  ? 'text-yellow-400'
                                  : 'text-red-400'
                              }`}
                            >
                              {player.rating.toFixed(2)}
                            </p>
                            <p className="text-[10px] text-muted-foreground">rating</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Map breakdown */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MapPin size={16} className="text-neon-green" />
                    Map Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {topMaps.length === 0 ? (
                    <div className="py-8 text-center">
                      <p className="text-sm text-muted-foreground">No map data yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {topMaps.map(([map, count]) => {
                        const pct = Math.round((count / (demos ?? []).length) * 100)
                        return (
                          <div key={map}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-foreground font-mono">
                                {map}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {count} {count === 1 ? 'demo' : 'demos'} · {pct}%
                              </span>
                            </div>
                            <div className="h-1.5 bg-border rounded-full overflow-hidden">
                              <div
                                className="h-full bg-neon-green rounded-full transition-all duration-700"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ── TEAM FOLDERS TAB ── */}
        {tab === 'folders' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Opponent Folders</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Demos grouped by opponent team
                </p>
              </div>
            </div>

            {(folders ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Crosshair size={24} className="text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">No folders yet</p>
                <p className="text-xs text-muted-foreground mb-4">
                  Folders are created automatically when demos are analysed
                </p>
                {isOwnerOrAdmin && <DemoUploadButton teamId={teamId} />}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(folders ?? []).map((folder) => {
                  const stats = folder.aggregated_stats as AggregatedStats | null
                  const folderDemos = demosByOpponent[folder.opponent_slug] ?? []
                  const lastPlayed = folderDemos[0]?.match_date ?? folderDemos[0]?.created_at
                  return (
                    <FolderCard
                      key={folder.id}
                      folder={{
                        id: folder.id,
                        opponent_display_name: folder.opponent_display_name,
                        demoCount: stats?.total_matches ?? folderDemos.length,
                        wins: stats?.wins ?? 0,
                        losses: stats?.losses ?? 0,
                        draws: stats?.draws ?? 0,
                        lastPlayed: lastPlayed ?? undefined,
                        teamId,
                      }}
                    />
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── ALL DEMOS TAB ── */}
        {tab === 'demos' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">All Demos</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {(demos ?? []).length} total
                </p>
              </div>
              {isOwnerOrAdmin && <DemoUploadButton teamId={teamId} />}
            </div>

            {(demos ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Upload size={24} className="text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">No demos uploaded</p>
                <p className="text-xs text-muted-foreground mb-4">
                  Upload your first CS2 demo to start analysing
                </p>
                {isOwnerOrAdmin && <DemoUploadButton teamId={teamId} />}
              </div>
            ) : (
              <Card className="bg-card border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-accent/30">
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Opponent</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Map</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">League</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {(demos ?? []).map((demo) => (
                        <tr
                          key={demo.id}
                          className="hover:bg-accent/20 transition-colors"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded bg-muted flex items-center justify-center">
                                <Crosshair size={11} className="text-muted-foreground" />
                              </div>
                              <span className="font-medium text-foreground">{demo.opponent_name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-foreground text-xs">{demo.map}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">
                            {demo.match_date
                              ? formatDate(demo.match_date)
                              : formatDate(demo.created_at)}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">
                            {demo.league ?? '—'}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={statusVariant(demo.status)} className="text-xs">
                              {demo.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            {demo.status === 'completed' && (
                              <Link href={`/ai-coach?demo=${demo.id}&team=${teamId}`}>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-xs gap-1 h-7 text-neon-green hover:bg-neon-green/10"
                                >
                                  <Brain size={12} />
                                  Analyse
                                </Button>
                              </Link>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* ── MEMBERS TAB ── */}
        {tab === 'members' && (
          <div className="space-y-4 max-w-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Team Members</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {(members ?? []).length} {(members ?? []).length === 1 ? 'member' : 'members'}
                </p>
              </div>
              {isOwnerOrAdmin && (
                <Button variant="outline" className="gap-2">
                  <Plus size={16} />
                  Invite Member
                </Button>
              )}
            </div>

            <Card className="bg-card border-border overflow-hidden">
              <div className="divide-y divide-border">
                {(members ?? []).map((member) => {
                  const profile = member.profiles as {
                    id: string
                    username: string
                    display_name: string | null
                    avatar_url: string | null
                  } | null
                  const RoleIcon = roleIcon[member.role as keyof typeof roleIcon] ?? User
                  const displayName = profile?.display_name || profile?.username || 'Unknown'
                  const initials = displayName
                    .split(' ')
                    .map((w: string) => w[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)

                  return (
                    <div key={member.user_id} className="flex items-center gap-3 px-5 py-4">
                      {/* Avatar */}
                      {profile?.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={profile.avatar_url}
                          alt={displayName}
                          className="w-9 h-9 rounded-full object-cover ring-1 ring-border"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-neon-green/10 border border-neon-green/20 flex items-center justify-center">
                          <span className="text-xs font-bold text-neon-green">{initials}</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{displayName}</p>
                        {profile?.username && (
                          <p className="text-xs text-muted-foreground">@{profile.username}</p>
                        )}
                      </div>
                      <Badge variant={roleVariant[member.role as keyof typeof roleVariant] ?? 'secondary'} className="flex items-center gap-1">
                        <RoleIcon size={10} />
                        {member.role}
                      </Badge>
                    </div>
                  )
                })}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
