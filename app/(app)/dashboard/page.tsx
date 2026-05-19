export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Target, Upload, Brain, BarChart3, TrendingUp,
  Crosshair, Clock, ArrowRight, Map, ChevronRight, Shield,
} from 'lucide-react'
import type { AggregatedStats } from '@/types/database'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const { data: memberships } = await admin
    .from('team_members')
    .select('role, team_id')
    .eq('user_id', user.id)

  const teamIds = (memberships ?? []).map((m) => m.team_id).filter(Boolean)
  const primaryTeamId = teamIds[0] ?? null

  // Fetch primary team name for self-demo display
  const { data: primaryTeam } = primaryTeamId
    ? await admin.from('teams').select('name').eq('id', primaryTeamId).single()
    : { data: null }
  const myTeamName = (primaryTeam as { name?: string } | null)?.name ?? 'My Team'

  // Fetch opponent folders
  const { data: folders } = teamIds.length
    ? await admin
        .from('team_folders')
        .select('id, opponent_display_name, opponent_slug, aggregated_stats, user_team_id')
        .in('user_team_id', teamIds)
        .order('updated_at', { ascending: false })
        .limit(6)
    : { data: [] }

  type FolderRow = {
    id: string
    opponent_display_name: string
    opponent_slug: string
    aggregated_stats: AggregatedStats | null
    user_team_id: string
  }
  const folderByKey: Record<string, string> = {}
  for (const f of (folders ?? []) as FolderRow[]) {
    folderByKey[`${f.user_team_id}:${f.opponent_slug}`] = f.id
  }

  // All folders for linking demos not in the top-6
  const { data: allFolders } = teamIds.length
    ? await admin
        .from('team_folders')
        .select('id, opponent_slug, user_team_id')
        .in('user_team_id', teamIds)
    : { data: [] }
  type SlimFolder = { id: string; opponent_slug: string; user_team_id: string }
  for (const f of (allFolders ?? []) as SlimFolder[]) {
    const key = `${f.user_team_id}:${f.opponent_slug}`
    if (!folderByKey[key]) folderByKey[key] = f.id
  }

  // Fetch recent opponent demos and self demos separately
  type DemoRow = {
    id: string; team_id: string; opponent_name: string
    opponent_slug: string | null; map: string
    match_date: string | null; status: string; created_at: string
    demo_type: string
  }

  const { data: recentOpponentDemos } = teamIds.length
    ? await admin
        .from('demos')
        .select('id, team_id, opponent_name, opponent_slug, map, match_date, status, created_at, demo_type')
        .in('team_id', teamIds)
        .eq('demo_type', 'opponent')
        .order('created_at', { ascending: false })
        .limit(5)
    : { data: [] }

  const { data: recentSelfDemos } = teamIds.length
    ? await admin
        .from('demos')
        .select('id, team_id, opponent_name, opponent_slug, map, match_date, status, created_at, demo_type')
        .in('team_id', teamIds)
        .eq('demo_type', 'self')
        .order('created_at', { ascending: false })
        .limit(5)
    : { data: [] }

  // Total counts
  const { data: allDemosMeta } = teamIds.length
    ? await admin
        .from('demos')
        .select('team_id, status, demo_type')
        .in('team_id', teamIds)
    : { data: [] }

  type MetaRow = { team_id: string; status: string; demo_type: string }
  const allMeta = (allDemosMeta ?? []) as MetaRow[]
  const totalDemos    = allMeta.length
  const analyzedDemos = allMeta.filter((d) => d.status === 'completed').length
  const totalOpponents = (allFolders ?? []).length

  const displayName = profile?.display_name || profile?.username || 'Player'

  function statusLabel(status: string) {
    if (status === 'completed') return 'Analyzed'
    if (status === 'processing') return 'Processing'
    return 'Failed'
  }
  function statusVariant(status: string) {
    if (status === 'completed') return 'neon' as const
    if (status === 'processing') return 'processing' as const
    return 'destructive' as const
  }

  const opponentDemos = (recentOpponentDemos ?? []) as DemoRow[]
  const selfDemos     = (recentSelfDemos     ?? []) as DemoRow[]

  return (
    <div className="p-4 md:p-6 space-y-6 md:space-y-8 max-w-7xl mx-auto">
      {/* Welcome header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            Welcome back,{' '}
            <span className="text-neon-green neon-text">{displayName}</span>
          </h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Your match prep hub — study opponents, generate anti-strats, win.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link href="/ai-coach">
            <Button variant="neon" className="gap-2">
              <Brain size={16} />
              AI Scout
            </Button>
          </Link>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Opponents Scouted', value: totalOpponents, icon: Target,    color: 'text-neon-green', bg: 'bg-neon-green/10' },
          { label: 'Demos Uploaded',    value: totalDemos,     icon: BarChart3, color: 'text-foreground', bg: 'bg-accent' },
          { label: 'Demos Analyzed',    value: analyzedDemos,  icon: TrendingUp, color: 'text-neon-green', bg: 'bg-neon-green/10' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label} className="bg-card border-border">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
                </div>
                <div className={`p-3 rounded-lg ${bg}`}>
                  <Icon size={20} className={color} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column: two demo sections stacked */}
        <div className="lg:col-span-2 space-y-6">

          {/* Recent Opponent Demos */}
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Target size={16} className="text-neon-green" />
                  Recent Opponent Demos
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Demos from teams you're preparing to face
                </p>
              </div>
              {opponentDemos.length > 0 && (
                <Link href="/opponents">
                  <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground hover:text-foreground shrink-0">
                    View all <ArrowRight size={12} />
                  </Button>
                </Link>
              )}
            </CardHeader>
            <CardContent className="px-0 pb-2">
              {opponentDemos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center px-6">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                    <Target size={20} className="text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-foreground">No opponent demos yet</p>
                  <p className="text-xs text-muted-foreground mt-1 mb-4">
                    Upload demos to start scouting your next opponents.
                  </p>
                  <Link href="/opponents">
                    <Button variant="neon" size="sm" className="gap-2">
                      <Target size={14} />
                      Add First Opponent
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {opponentDemos.map((d) => {
                    const folderId = d.opponent_slug
                      ? folderByKey[`${d.team_id}:${d.opponent_slug}`]
                      : undefined
                    const href = d.status === 'completed' && folderId
                      ? `/demos/${d.id}?folder=${folderId}`
                      : folderId
                      ? `/opponents/${folderId}`
                      : '/opponents'
                    return (
                      <Link
                        key={d.id}
                        href={href}
                        className="flex items-center gap-4 px-6 py-3.5 hover:bg-accent/30 transition-colors group"
                      >
                        <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center shrink-0 group-hover:bg-neon-green/10 transition-colors border border-transparent group-hover:border-neon-green/20">
                          <span className="text-xs font-bold text-foreground group-hover:text-neon-green transition-colors">
                            {d.opponent_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate group-hover:text-neon-green transition-colors">
                            {d.opponent_name}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                            {d.map && d.map !== 'unknown' && (
                              <>
                                <Map size={10} className="shrink-0" />
                                <span className="font-mono">{d.map}</span>
                                <span className="text-muted-foreground/40">·</span>
                              </>
                            )}
                            <Clock size={10} className="shrink-0" />
                            <span>{d.match_date ? formatDate(d.match_date) : formatDate(d.created_at)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant={statusVariant(d.status)} className="text-[10px]">
                            {statusLabel(d.status)}
                          </Badge>
                          {d.status === 'completed' && (
                            <ChevronRight size={14} className="text-muted-foreground/40 group-hover:text-neon-green transition-colors" />
                          )}
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent My Team Demos */}
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Shield size={16} className="text-neon-green" />
                  Recent My Team Demos
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Your team's own match recordings
                </p>
              </div>
              {selfDemos.length > 0 && (
                <Link href="/my-team">
                  <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground hover:text-foreground shrink-0">
                    View all <ArrowRight size={12} />
                  </Button>
                </Link>
              )}
            </CardHeader>
            <CardContent className="px-0 pb-2">
              {selfDemos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center px-6">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                    <Shield size={20} className="text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-foreground">No team demos yet</p>
                  <p className="text-xs text-muted-foreground mt-1 mb-4">
                    Upload your own match recordings to review your team's performance.
                  </p>
                  <Link href="/my-team">
                    <Button variant="neon" size="sm" className="gap-2">
                      <Upload size={14} />
                      Upload Team Demo
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {selfDemos.map((d) => {
                    const href = d.status === 'completed'
                      ? `/my-team/demos/${d.id}`
                      : '/my-team'
                    return (
                      <Link
                        key={d.id}
                        href={href}
                        className="flex items-center gap-4 px-6 py-3.5 hover:bg-accent/30 transition-colors group"
                      >
                        <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center shrink-0 group-hover:bg-neon-green/10 transition-colors border border-transparent group-hover:border-neon-green/20">
                          <span className="text-xs font-bold text-foreground group-hover:text-neon-green transition-colors">
                            {myTeamName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate group-hover:text-neon-green transition-colors">
                            {myTeamName}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                            {d.map && d.map !== 'unknown' && (
                              <>
                                <Map size={10} className="shrink-0" />
                                <span className="font-mono">{d.map}</span>
                                <span className="text-muted-foreground/40">·</span>
                              </>
                            )}
                            <Clock size={10} className="shrink-0" />
                            <span>{d.match_date ? formatDate(d.match_date) : formatDate(d.created_at)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant={statusVariant(d.status)} className="text-[10px]">
                            {statusLabel(d.status)}
                          </Badge>
                          {d.status === 'completed' && (
                            <ChevronRight size={14} className="text-muted-foreground/40 group-hover:text-neon-green transition-colors" />
                          )}
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* Quick Actions */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/opponents" className="block">
                <Button
                  variant="outline"
                  className="w-full justify-start gap-3 h-11 hover:border-neon-green/50 hover:text-neon-green"
                >
                  <Upload size={16} />
                  Upload Opponent Demo
                </Button>
              </Link>
              <Link href="/my-team" className="block">
                <Button
                  variant="outline"
                  className="w-full justify-start gap-3 h-11 hover:border-neon-green/50 hover:text-neon-green"
                >
                  <Shield size={16} />
                  Upload Team Demo
                </Button>
              </Link>
              <Link href="/opponents" className="block">
                <Button
                  variant="outline"
                  className="w-full justify-start gap-3 h-11 hover:border-neon-green/50 hover:text-neon-green"
                >
                  <Target size={16} />
                  View All Opponents
                </Button>
              </Link>
              <Link href="/ai-coach" className="block">
                <Button
                  variant="outline"
                  className="w-full justify-start gap-3 h-11 hover:border-neon-green/50 hover:text-neon-green"
                >
                  <Brain size={16} />
                  Generate Anti-Strat
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Recent opponents mini-list */}
          {(folders ?? []).length > 0 && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Target size={16} className="text-neon-green" />
                  Opponents
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-0.5 p-2">
                {(folders ?? []).slice(0, 5).map((folder) => {
                  const f = folder as FolderRow
                  const stats = f.aggregated_stats as AggregatedStats | null
                  const wins = stats?.wins ?? 0
                  const losses = stats?.losses ?? 0
                  const total = wins + losses + (stats?.draws ?? 0)
                  const winRate = total > 0 ? Math.round((wins / total) * 100) : null
                  return (
                    <Link
                      key={f.id}
                      href={`/opponents/${f.id}`}
                      className="flex items-center gap-3 rounded-md p-2 hover:bg-accent/50 transition-colors group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-foreground group-hover:text-neon-green transition-colors">
                          {f.opponent_display_name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate group-hover:text-neon-green transition-colors">
                          {f.opponent_display_name}
                        </p>
                        {total > 0 && (
                          <p className={cn(
                            'text-[10px] font-mono',
                            wins > losses ? 'text-neon-green' : losses > wins ? 'text-red-400' : 'text-muted-foreground'
                          )}>
                            {wins}W–{losses}L
                            {winRate !== null && <span className="text-muted-foreground ml-1">· {winRate}%</span>}
                          </p>
                        )}
                      </div>
                      <ArrowRight size={13} className="text-muted-foreground/40 group-hover:text-neon-green shrink-0 transition-colors" />
                    </Link>
                  )
                })}
                {totalOpponents > 5 && (
                  <Link href="/opponents" className="block mt-1">
                    <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground hover:text-foreground">
                      +{totalOpponents - 5} more opponents
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          )}

          {/* AI CTA */}
          {totalDemos > 0 && (
            <Card className="bg-gradient-to-br from-neon-green/10 to-transparent border border-neon-green/20">
              <CardContent className="p-4 text-center">
                <Brain size={22} className="text-neon-green mx-auto mb-2" />
                <p className="text-sm font-semibold text-foreground mb-1">Ready to prep?</p>
                <p className="text-xs text-muted-foreground mb-3">
                  {analyzedDemos} demo{analyzedDemos !== 1 ? 's' : ''} analyzed and ready for AI scouting
                </p>
                <Link href="/ai-coach">
                  <Button variant="neon" size="sm" className="w-full gap-2">
                    <Brain size={14} />
                    Open AI Scout
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
