export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import DemoUploadButton from '@/components/teams/DemoUploadButton'
import {
  ArrowLeft, Brain, Trophy, Target, BarChart3,
  Crosshair, Calendar, MapPin, TrendingUp, Upload, ExternalLink,
} from 'lucide-react'
import type { AggregatedStats, DemoHeader, PlayerStats } from '@/types/database'

export default async function FolderPage({
  params,
}: {
  params: Promise<{ teamId: string; folderId: string }>
}) {
  const { teamId, folderId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Verify membership
  const { data: membership } = await supabase
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .single()
  if (!membership) redirect('/teams')

  // Fetch team
  const { data: team } = await supabase
    .from('teams')
    .select('id, name')
    .eq('id', teamId)
    .single()
  if (!team) notFound()

  // Fetch folder
  const { data: folder } = await supabase
    .from('team_folders')
    .select('*')
    .eq('id', folderId)
    .eq('user_team_id', teamId)
    .single()
  if (!folder) notFound()

  const stats = folder.aggregated_stats as AggregatedStats | null

  // Fetch demos for this folder's opponent
  const { data: demos } = await supabase
    .from('demos')
    .select('*')
    .eq('team_id', teamId)
    .eq('opponent_slug', folder.opponent_slug)
    .order('match_date', { ascending: false, nullsFirst: false })

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

  const isOwnerOrAdmin = membership.role === 'owner' || membership.role === 'admin'

  // Top players from aggregated stats
  const topPlayers: PlayerStats[] = stats?.top_players ?? []

  // Most common map for the pro reference link
  const mapCounts: Record<string, number> = {}
  for (const d of demos ?? []) {
    if (d.map) mapCounts[d.map] = (mapCounts[d.map] ?? 0) + 1
  }
  const primaryMap = Object.entries(mapCounts).sort((a, b) => b[1] - a[1])[0]?.[0]
  // HF dataset viewer supports ?q= as a full-text row search across all columns
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
            <Link href="/teams" className="hover:text-foreground transition-colors">Teams</Link>
            <span>/</span>
            <Link href={`/teams/${teamId}`} className="hover:text-foreground transition-colors">
              {team.name}
            </Link>
            <span>/</span>
            <Link
              href={`/teams/${teamId}?tab=folders`}
              className="hover:text-foreground transition-colors"
            >
              Folders
            </Link>
            <span>/</span>
            <span className="text-foreground font-medium">{folder.opponent_display_name}</span>
          </nav>

          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <Link
                href={`/teams/${teamId}?tab=folders`}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft size={18} />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  vs{' '}
                  <span className="text-neon-green">{folder.opponent_display_name}</span>
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {totalDemos} {totalDemos === 1 ? 'demo' : 'demos'} · Scouting history
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isOwnerOrAdmin && <DemoUploadButton teamId={teamId} teamName={team.name} />}
              <a href={proRefUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="secondary" className="gap-2 text-sm">
                  <ExternalLink size={14} />
                  <span className="hidden sm:inline">
                    {primaryMap ? `View Pro Plays on ${primaryMap}` : 'View Pro Plays'}
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
                  avgRating >= 1.2
                    ? 'text-neon-green'
                    : avgRating >= 1.0
                    ? 'text-green-400'
                    : avgRating >= 0.8
                    ? 'text-yellow-400'
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
              Opponent demos in this folder
            </h2>

            {totalDemos === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3">
                    <Upload size={22} className="text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-foreground mb-1">No opponent demos yet</p>
                  <p className="text-xs text-muted-foreground mb-4">
                    Upload demos of this opponent to start scouting them
                  </p>
                  {isOwnerOrAdmin && <DemoUploadButton teamId={teamId} teamName={team.name} />}
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-card border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-accent/30">
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Map</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Score</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {(demos ?? []).map((demo) => {
                        const pd = demo.parsed_data as {
                          header?: DemoHeader
                        } | null
                        const header = pd?.header
                        const scoreStr = header
                          ? `${header.score_team1} - ${header.score_team2}`
                          : '—'
                        const isWin =
                          header &&
                          (header.score_team1 ?? 0) > (header.score_team2 ?? 0)

                        return (
                          <tr key={demo.id} className="hover:bg-accent/20 transition-colors">
                            <td className="px-4 py-3 font-mono text-xs text-foreground">
                              {demo.map}
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Calendar size={11} />
                                {demo.match_date
                                  ? formatDate(demo.match_date)
                                  : formatDate(demo.created_at)}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {header ? (
                                <span
                                  className={`text-xs font-bold font-mono ${
                                    isWin ? 'text-neon-green' : 'text-red-400'
                                  }`}
                                >
                                  {scoreStr}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
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
                                    Scout
                                  </Button>
                                </Link>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>

          {/* Top players sidebar */}
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Target size={15} className="text-neon-green" />
              Opponent Key Players
            </h2>

            <Card className="bg-card border-border">
              <CardContent className="px-0 py-0">
                {topPlayers.length === 0 ? (
                  <div className="py-10 text-center">
                    <p className="text-xs text-muted-foreground px-4">
                      Opponent player stats available after demos are analysed
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {topPlayers.slice(0, 5).map((player, idx) => (
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
                          <p className="text-xs font-medium text-foreground truncate">
                            {player.name}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {player.kills}K {player.deaths}D {player.assists}A
                          </p>
                        </div>
                        <span
                          className={`text-xs font-bold font-mono ${
                            player.rating >= 1.2
                              ? 'text-neon-green'
                              : player.rating >= 1.0
                              ? 'text-green-400'
                              : 'text-yellow-400'
                          }`}
                        >
                          {player.rating.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Map breakdown for this matchup */}
            {(demos ?? []).length > 0 && (
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <MapPin size={13} className="text-neon-green" />
                    Maps Played
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  {(() => {
                    const mapCounts: Record<string, number> = {}
                    for (const d of demos ?? []) {
                      if (d.map) mapCounts[d.map] = (mapCounts[d.map] ?? 0) + 1
                    }
                    return Object.entries(mapCounts)
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
                      })
                  })()}
                </CardContent>
              </Card>
            )}

            {/* Start AI Analysis CTA */}
            <Card className="bg-gradient-to-br from-neon-green/10 to-neon-green/5 border border-neon-green/20">
              <CardContent className="p-4 text-center">
                <Brain size={24} className="text-neon-green mx-auto mb-2" />
                <p className="text-sm font-semibold text-foreground mb-1">
                  Generate Anti-Strat
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  Get AI-powered anti-strats and scouting report vs {folder.opponent_display_name}
                </p>
                <Link href={`/ai-coach?team=${teamId}&folder=${folderId}`} className="block">
                  <Button variant="neon" size="sm" className="w-full gap-2">
                    <Brain size={14} />
                    Generate Anti-Strat
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* OpenCS2 Pro References */}
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-start gap-2.5 mb-3">
                  <div className="w-7 h-7 rounded bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
                    <ExternalLink size={13} className="text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">OpenCS2 Pro Dataset</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                      200k+ professional matches. Browse pro plays for additional context.
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  {primaryMap ? (
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
                      <ExternalLink size={11} className="text-muted-foreground group-hover:text-blue-400 transition-colors shrink-0" />
                    </a>
                  ) : null}
                  <a
                    href="https://huggingface.co/datasets/blanchon/opencs2_dataset"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-2 rounded-md hover:bg-accent transition-colors group"
                  >
                    <p className="text-[10px] text-muted-foreground group-hover:text-foreground">Browse full dataset →</p>
                    <ExternalLink size={10} className="text-muted-foreground shrink-0" />
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
