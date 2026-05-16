export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Target, Upload, Brain, BarChart3, TrendingUp,
  Crosshair, Clock, ArrowRight, Trophy,
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

  // Fetch all opponent folders
  const { data: folders } = teamIds.length
    ? await admin
        .from('team_folders')
        .select('*')
        .in('user_team_id', teamIds)
        .order('updated_at', { ascending: false, nullsFirst: false })
        .limit(6)
    : { data: [] }

  // Fetch recent demos across all teams
  const { data: recentDemos } = teamIds.length
    ? await admin
        .from('demos')
        .select('id, team_id, opponent_name, map, match_date, status, created_at')
        .in('team_id', teamIds)
        .order('created_at', { ascending: false })
        .limit(6)
    : { data: [] }

  // Fetch demo counts
  const { data: allDemos } = teamIds.length
    ? await admin
        .from('demos')
        .select('team_id, status')
        .in('team_id', teamIds)
    : { data: [] }

  const totalDemos = (allDemos ?? []).length
  const analyzedDemos = (allDemos ?? []).filter((d) => d.status === 'completed').length

  // Total opponents scouted
  const { data: allFolders } = teamIds.length
    ? await admin
        .from('team_folders')
        .select('id')
        .in('user_team_id', teamIds)
    : { data: [] }

  const totalOpponents = (allFolders ?? []).length

  const displayName = profile?.display_name || profile?.username || 'Player'

  const statusVariant = (status: string) => {
    if (status === 'completed') return 'neon' as const
    if (status === 'processing') return 'processing' as const
    return 'destructive' as const
  }

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
          { label: 'Opponents Scouted', value: totalOpponents, icon: Target, color: 'text-neon-green', bg: 'bg-neon-green/10' },
          { label: 'Demos Uploaded', value: totalDemos, icon: BarChart3, color: 'text-foreground', bg: 'bg-accent' },
          { label: 'Demos Analyzed', value: analyzedDemos, icon: TrendingUp, color: 'text-neon-green', bg: 'bg-neon-green/10' },
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
        {/* Recent Activity */}
        <div className="lg:col-span-2">
          <Card className="bg-card border-border h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Clock size={16} className="text-neon-green" />
                Recent Demos
              </CardTitle>
              {totalDemos > 0 && (
                <Link href="/opponents">
                  <Button variant="ghost" size="sm" className="gap-1 text-xs">
                    View all <ArrowRight size={12} />
                  </Button>
                </Link>
              )}
            </CardHeader>
            <CardContent className="px-0">
              {(recentDemos ?? []).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                  <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3">
                    <Upload size={24} className="text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-foreground">No scouting data yet</p>
                  <p className="text-xs text-muted-foreground mt-1 mb-4">
                    Upload opponent demos to start preparing for your next match.
                  </p>
                  <Link href="/opponents">
                    <Button variant="neon" size="sm" className="gap-2">
                      <Target size={14} />
                      Add First Opponent
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {(recentDemos ?? []).map((demo) => (
                    <div
                      key={demo.id}
                      className="flex items-center gap-4 px-6 py-3 hover:bg-accent/30 transition-colors"
                    >
                      <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
                        <Crosshair size={14} className="text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {demo.opponent_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {demo.map}
                          {demo.match_date
                            ? ` · ${formatDate(demo.match_date)}`
                            : demo.created_at
                            ? ` · ${formatDate(demo.created_at)}`
                            : ''}
                        </p>
                      </div>
                      <Badge variant={statusVariant(demo.status)} className="text-xs shrink-0">
                        {demo.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
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
              <CardContent className="space-y-1 p-2">
                {(folders ?? []).slice(0, 5).map((folder) => {
                  const stats = folder.aggregated_stats as AggregatedStats | null
                  const wins = stats?.wins ?? 0
                  const losses = stats?.losses ?? 0
                  return (
                    <Link
                      key={folder.id}
                      href={`/opponents/${folder.id}`}
                      className="flex items-center gap-3 rounded-md p-2 hover:bg-accent/50 transition-colors group"
                    >
                      <div className="w-7 h-7 rounded bg-accent flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-foreground">
                          {folder.opponent_display_name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate group-hover:text-neon-green transition-colors">
                          {folder.opponent_display_name}
                        </p>
                        {(wins + losses) > 0 && (
                          <p className="text-[10px] text-muted-foreground font-mono">
                            {wins}W–{losses}L
                          </p>
                        )}
                      </div>
                      <ArrowRight size={13} className="text-muted-foreground group-hover:text-neon-green shrink-0" />
                    </Link>
                  )
                })}
                {(allFolders ?? []).length > 5 && (
                  <Link href="/opponents">
                    <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground mt-1">
                      +{(allFolders ?? []).length - 5} more opponents
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
