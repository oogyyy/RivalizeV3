export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { formatDate, formatFileSize } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import DemoUploadButton from '@/components/teams/DemoUploadButton'
import DeleteDemoButton from '@/components/teams/DeleteDemoButton'
import DeleteFolderButton from '@/components/teams/DeleteFolderButton'
import SetOpponentSideButton from '@/components/teams/SetOpponentSideButton'
import ReparseButton from '@/components/teams/ReparseButton'
import {
  ArrowLeft, Brain, Trophy, Target, BarChart3,
  Crosshair, Calendar, MapPin, TrendingUp, Upload, ExternalLink, BarChart2,
  HardDrive,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AggregatedStats, DemoHeader, PlayerStats } from '@/types/database'

export default async function OpponentPage({
  params,
}: {
  params: Promise<{ folderId: string }>
}) {
  const { folderId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  // Fetch folder (no teamId in URL — look up by folder UUID)
  const { data: folder } = await admin
    .from('team_folders')
    .select('*')
    .eq('id', folderId)
    .single()
  if (!folder) notFound()

  const teamId: string = folder.user_team_id

  // Verify user belongs to this team
  const { data: membership } = await admin
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .single()
  if (!membership) redirect('/opponents')

  const stats = folder.aggregated_stats as AggregatedStats | null

  // Use admin client to bypass RLS — membership already verified above
  const { data: demos } = await admin
    .from('demos')
    .select('*')
    .eq('team_id', teamId)
    .eq('opponent_slug', folder.opponent_slug)
    .order('created_at', { ascending: false })

  const totalDemos = (demos ?? []).length
  const wins = stats?.wins ?? 0
  const losses = stats?.losses ?? 0
  const draws = stats?.draws ?? 0
  const winRate = stats?.win_rate ?? 0
  const avgRating = stats?.avg_rating ?? 0

  const statusVariant = (status: string) => {
    if (status === 'completed') return 'neon' as const
    if (status === 'processing') return 'processing' as const
    return 'destructive' as const
  }
  const statusLabel = (status: string) => {
    if (status === 'completed') return 'Analyzed'
    if (status === 'processing') return 'Processing'
    return 'Failed'
  }

  const isOwnerOrAdmin = membership.role === 'owner' || membership.role === 'admin'

  // Top players: prefer aggregated_stats, fall back to computing from raw demo data
  let topPlayers: PlayerStats[] = stats?.top_players ?? []
  if (topPlayers.length === 0 && (demos ?? []).length > 0) {
    const playerMap: Record<string, PlayerStats & { count: number }> = {}
    for (const demo of demos ?? []) {
      if (demo.status !== 'completed' || !demo.parsed_data) continue
      const pd = demo.parsed_data as { header?: { team1?: string }; players?: PlayerStats[] }
      const ownTeamName = pd.header?.team1 ?? 'My Team'
      for (const p of pd.players ?? []) {
        if (p.team === ownTeamName) continue
        if (!playerMap[p.steam_id]) {
          playerMap[p.steam_id] = { ...p, count: 1 }
        } else {
          const ex = playerMap[p.steam_id]
          ex.kills += p.kills
          ex.deaths += p.deaths
          ex.assists += p.assists
          ex.adr = (ex.adr * ex.count + p.adr) / (ex.count + 1)
          ex.rating = (ex.rating * ex.count + p.rating) / (ex.count + 1)
          ex.count++
        }
      }
    }
    topPlayers = Object.values(playerMap)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 5)
      .map(({ count: _count, ...p }) => p)
  }

  // Most common map for the pro reference link
  const mapCounts: Record<string, number> = {}
  for (const d of demos ?? []) {
    if (d.map) mapCounts[d.map] = (mapCounts[d.map] ?? 0) + 1
  }
  const primaryMap = Object.entries(mapCounts).sort((a, b) => b[1] - a[1])[0]?.[0]
  const proRefUrl = primaryMap
    ? `https://huggingface.co/datasets/blanchon/opencs2_dataset/viewer/default/train?q=${encodeURIComponent(primaryMap)}`
    : 'https://huggingface.co/datasets/blanchon/opencs2_dataset/viewer'

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-5">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-4 flex-wrap">
            <Link href="/opponents" className="hover:text-foreground transition-colors">
              Opponents
            </Link>
            <span>/</span>
            <span className="text-foreground font-medium">{folder.opponent_display_name}</span>
          </nav>

          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <Link
                href="/opponents"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft size={18} />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  <span className="text-neon-green">{folder.opponent_display_name}</span>
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {totalDemos} {totalDemos === 1 ? 'demo' : 'demos'} · Scouting report
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isOwnerOrAdmin && <DemoUploadButton teamId={teamId} />}
              {isOwnerOrAdmin && (
                <DeleteFolderButton folderId={folderId} opponentName={folder.opponent_display_name} />
              )}
              <a href={proRefUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="secondary" className="gap-2 text-sm">
                  <ExternalLink size={14} />
                  <span className="hidden sm:inline">
                    {primaryMap ? `Pro Plays on ${primaryMap}` : 'Pro Plays'}
                  </span>
                  <span className="sm:hidden">Pro Plays</span>
                </Button>
              </a>
              <Link href={`/ai-coach?team=${teamId}&folder=${folderId}`}>
                <Button variant="neon" className="gap-2">
                  <Brain size={16} />
                  <span className="hidden sm:inline">Generate Anti-Strat</span>
                  <span className="sm:hidden">Anti-Strat</span>
                </Button>
              </Link>
            </div>
          </div>

          {/* Aggregated stats bar */}
          <div className="grid grid-cols-2 gap-4 mt-5 sm:grid-cols-4">
            {[
              {
                label: 'Matches',
                value: stats?.total_matches ?? totalDemos,
                icon: BarChart3,
                color: 'text-foreground',
              },
              {
                label: 'Record',
                value: `${wins}W-${losses}L${draws ? `-${draws}D` : ''}`,
                icon: Trophy,
                color: wins > losses ? 'text-neon-green' : wins < losses ? 'text-red-400' : 'text-yellow-400',
              },
              {
                label: 'Win Rate',
                value: `${Math.round(winRate * 100)}%`,
                icon: TrendingUp,
                color: winRate >= 0.5 ? 'text-neon-green' : 'text-red-400',
              },
              {
                label: 'Avg Rating',
                value: avgRating > 0 ? avgRating.toFixed(2) : '—',
                icon: Target,
                color:
                  avgRating >= 1.2 ? 'text-neon-green'
                  : avgRating >= 1.0 ? 'text-green-400'
                  : avgRating >= 0.8 ? 'text-yellow-400'
                  : 'text-foreground',
              },
            ].map(({ label, value, icon: Icon, color }) => (
              <div
                key={label}
                className="flex items-center gap-3 p-3 rounded-lg bg-background/50 border border-border"
              >
                <div className="w-8 h-8 rounded bg-neon-green/10 flex items-center justify-center">
                  <Icon size={15} className="text-neon-green" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className={`text-base font-bold font-mono ${color}`}>{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-6 space-y-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Demos table */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Crosshair size={15} className="text-neon-green" />
              Demo recordings
            </h2>

            {totalDemos === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3">
                    <Upload size={22} className="text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-foreground mb-1">No demos yet</p>
                  <p className="text-xs text-muted-foreground mb-4">
                    Upload demos of {folder.opponent_display_name} to start scouting them
                  </p>
                  {isOwnerOrAdmin && <DemoUploadButton teamId={teamId} />}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {(demos ?? []).map((demo) => {
                  const pd = demo.parsed_data as { header?: DemoHeader; opponentSide?: 'team1' | 'team2' } | null
                  const header = pd?.header
                  const demoOpponentSide = pd?.opponentSide ?? 'team2'

                  // Score from OUR perspective: we are the team that is NOT the opponent
                  const ourScore  = header ? (demoOpponentSide === 'team1' ? (header.score_team2 ?? 0) : (header.score_team1 ?? 0)) : null
                  const theirScore = header ? (demoOpponentSide === 'team1' ? (header.score_team1 ?? 0) : (header.score_team2 ?? 0)) : null
                  const isWin  = ourScore !== null && theirScore !== null ? ourScore > theirScore : null
                  const isDraw = ourScore !== null && theirScore !== null ? ourScore === theirScore : false
                  const href = demo.status === 'completed'
                    ? `/demos/${demo.id}?folder=${folderId}`
                    : null

                  return (
                    <Card key={demo.id} className="bg-card border-border transition-all duration-150 hover:border-border/80">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          {/* Map icon */}
                          <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center shrink-0 border border-border">
                            <MapPin size={15} className="text-muted-foreground" />
                          </div>

                          {/* Main info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-sm font-semibold text-foreground">
                                {demo.map && demo.map !== 'unknown' ? demo.map : 'Unknown map'}
                              </span>
                              {ourScore !== null && theirScore !== null && (
                                <span className={cn(
                                  'text-xs font-bold font-mono',
                                  isWin ? 'text-neon-green' : isDraw ? 'text-yellow-400' : 'text-red-400'
                                )}>
                                  {ourScore}–{theirScore}
                                </span>
                              )}
                              <Badge variant={statusVariant(demo.status)} className="text-[10px] h-4 px-1.5">
                                {statusLabel(demo.status)}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                              <span className="flex items-center gap-1">
                                <Calendar size={10} />
                                {demo.match_date ? formatDate(demo.match_date) : formatDate(demo.created_at)}
                              </span>
                              {demo.file_size_bytes && (
                                <span className="flex items-center gap-1">
                                  <HardDrive size={10} />
                                  {formatFileSize(demo.file_size_bytes)}
                                </span>
                              )}
                              {header && (
                                <span className="flex items-center gap-1">
                                  <BarChart3 size={10} />
                                  {header.total_rounds} rounds
                                </span>
                              )}
                              {isOwnerOrAdmin && demo.status === 'completed' && (
                                <SetOpponentSideButton
                                  demoId={demo.id}
                                  currentSide={demoOpponentSide}
                                />
                              )}
                              {isOwnerOrAdmin && (demo.status === 'completed' || demo.status === 'failed') && (
                                <ReparseButton demoId={demo.id} />
                              )}
                            </div>
                          </div>

                          {/* Right actions — explicit Links, no onClick handlers */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {demo.status === 'completed' && (
                              <>
                                <Link href={`/ai-coach?folder=${folderId}`}>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs gap-1 h-7 text-neon-green hover:bg-neon-green/10"
                                  >
                                    <Brain size={11} />
                                    Scout
                                  </Button>
                                </Link>
                                <Link href={`/demos/${demo.id}?folder=${folderId}`}>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs gap-1 h-7 text-muted-foreground hover:text-foreground"
                                  >
                                    <BarChart2 size={11} />
                                    Stats
                                  </Button>
                                </Link>
                              </>
                            )}
                            {isOwnerOrAdmin && <DeleteDemoButton demoId={demo.id} />}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}

                {isOwnerOrAdmin && (
                  <div className="flex justify-end pt-1">
                    <DemoUploadButton teamId={teamId} />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Target size={15} className="text-neon-green" />
              Key Players
            </h2>

            <Card className="bg-card border-border">
              <CardContent className="px-0 py-0">
                {topPlayers.length === 0 ? (
                  <div className="py-10 text-center">
                    <p className="text-xs text-muted-foreground px-4">
                      Player stats available after demos are analysed
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {topPlayers.slice(0, 5).map((player, idx) => {
                      const role = player.headshot_percentage < 20
                        ? 'AWP'
                        : player.flash_assists >= 4
                        ? 'Support'
                        : player.kills >= 20
                        ? 'Entry'
                        : 'Rifler'
                      const roleColor = role === 'AWP'
                        ? 'text-purple-400 bg-purple-400/10'
                        : role === 'Entry'
                        ? 'text-orange-400 bg-orange-400/10'
                        : role === 'Support'
                        ? 'text-blue-400 bg-blue-400/10'
                        : 'text-muted-foreground bg-accent'
                      return (
                        <div key={player.steam_id} className="flex items-center gap-3 px-4 py-3">
                          <span
                            className={`text-xs font-bold w-4 text-center font-mono ${
                              idx === 0 ? 'text-yellow-400' : 'text-muted-foreground'
                            }`}
                          >
                            #{idx + 1}
                          </span>
                          <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-foreground">
                              {player.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-medium text-foreground truncate">
                                {player.name}
                              </p>
                              <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${roleColor} shrink-0`}>
                                {role}
                              </span>
                            </div>
                            <p className="text-[10px] text-muted-foreground">
                              {player.kills}K {player.deaths}D {player.assists}A · {player.adr.toFixed(0)} ADR
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <span
                              className={`text-xs font-bold font-mono ${
                                player.rating >= 1.2 ? 'text-neon-green'
                                : player.rating >= 1.0 ? 'text-green-400'
                                : 'text-yellow-400'
                              }`}
                            >
                              {player.rating.toFixed(2)}
                            </span>
                            <p className="text-[9px] text-muted-foreground">rating</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Maps Played */}
            {(demos ?? []).length > 0 && (
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <MapPin size={13} className="text-neon-green" />
                    Maps Played
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  {Object.entries(
                    (demos ?? []).reduce((acc: Record<string, number>, d) => {
                      if (d.map) acc[d.map] = (acc[d.map] ?? 0) + 1
                      return acc
                    }, {})
                  )
                    .sort((a, b) => b[1] - a[1])
                    .map(([map, count]) => {
                      const pct = Math.round((count / totalDemos) * 100)
                      return (
                        <div key={map}>
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-xs font-mono text-foreground">{map}</span>
                            <span className="text-[10px] text-muted-foreground">{count}x</span>
                          </div>
                          <div className="h-1 bg-border rounded-full overflow-hidden">
                            <div
                              className="h-full bg-neon-green/60 rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                </CardContent>
              </Card>
            )}

            {/* AI Anti-Strat CTA */}
            <Card className="bg-gradient-to-br from-neon-green/10 to-neon-green/5 border border-neon-green/20">
              <CardContent className="p-4 text-center">
                <Brain size={24} className="text-neon-green mx-auto mb-2" />
                <p className="text-sm font-semibold text-foreground mb-1">
                  Generate Anti-Strat
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  Get AI-powered counter-strats against {folder.opponent_display_name}
                </p>
                <Link href={`/ai-coach?team=${teamId}&folder=${folderId}`} className="block">
                  <Button variant="neon" size="sm" className="w-full gap-2">
                    <Brain size={14} />
                    Generate Anti-Strat
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Pro reference */}
            {primaryMap && (
              <Card className="bg-card border-border">
                <CardContent className="p-4">
                  <div className="flex items-start gap-2.5 mb-3">
                    <div className="w-7 h-7 rounded bg-blue-500/10 flex items-center justify-center shrink-0">
                      <ExternalLink size={13} className="text-blue-400" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">OpenCS2 Pro Dataset</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        200k+ professional matches for additional context
                      </p>
                    </div>
                  </div>
                  <a
                    href={proRefUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-2 rounded-md bg-blue-500/5 border border-blue-500/20 hover:bg-blue-500/10 transition-colors group"
                  >
                    <div>
                      <p className="text-xs font-medium text-foreground">{primaryMap}</p>
                      <p className="text-[10px] text-muted-foreground">View pro matches on this map</p>
                    </div>
                    <ExternalLink size={11} className="text-muted-foreground group-hover:text-blue-400 shrink-0" />
                  </a>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
