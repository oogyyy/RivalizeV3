import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Users, Upload, Brain, BarChart3, TrendingUp,
  Trophy, Crosshair, Clock, Plus, ArrowRight,
} from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Fetch team memberships with team details
  const { data: memberships } = await supabase
    .from('team_members')
    .select('role, teams(*)')
    .eq('user_id', user.id)

  const teams = (memberships ?? []).map((m) => ({
    ...(m.teams as Record<string, unknown>),
    userRole: m.role,
  })) as Array<{ id: string; name: string; slug: string; logo_url: string | null; userRole: string }>

  const teamIds = teams.map((t) => t.id)

  // Fetch recent demos across all teams
  const { data: recentDemos } = teamIds.length
    ? await supabase
        .from('demos')
        .select('id, team_id, opponent_name, map, match_date, status, created_at')
        .in('team_id', teamIds)
        .order('created_at', { ascending: false })
        .limit(5)
    : { data: [] }

  // Fetch demo counts per team
  const { data: demoCounts } = teamIds.length
    ? await supabase
        .from('demos')
        .select('team_id, status')
        .in('team_id', teamIds)
    : { data: [] }

  const demoCountMap: Record<string, number> = {}
  for (const d of demoCounts ?? []) {
    demoCountMap[d.team_id] = (demoCountMap[d.team_id] ?? 0) + 1
  }

  const totalDemos = (demoCounts ?? []).length
  const completedDemos = (demoCounts ?? []).filter((d) => d.status === 'completed').length

  const displayName = profile?.display_name || profile?.username || 'Player'

  const statsCards = [
    {
      label: 'Total Teams',
      value: teams.length,
      icon: Users,
      color: 'text-neon-green',
      bg: 'bg-neon-green/10',
    },
    {
      label: 'Total Demos',
      value: totalDemos,
      icon: BarChart3,
      color: 'text-neon-blue',
      bg: 'bg-neon-blue/10',
    },
    {
      label: 'Demos Analysed',
      value: completedDemos,
      icon: TrendingUp,
      color: 'text-neon-green',
      bg: 'bg-neon-green/10',
    },
    {
      label: 'Active Teams',
      value: teams.length,
      icon: Trophy,
      color: 'text-yellow-400',
      bg: 'bg-yellow-400/10',
    },
  ]

  const statusVariant = (status: string) => {
    if (status === 'completed') return 'neon'
    if (status === 'processing') return 'processing'
    return 'destructive'
  }

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      {/* Welcome header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Welcome back,{' '}
            <span className="text-neon-green neon-text">{displayName}</span>
          </h1>
          <p className="mt-1 text-muted-foreground">
            Here&apos;s what&apos;s happening with your teams today.
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/teams">
            <Button variant="outline" className="gap-2">
              <Plus size={16} />
              New Team
            </Button>
          </Link>
          <Link href="/ai-coach">
            <Button variant="neon" className="gap-2">
              <Brain size={16} />
              AI Coach
            </Button>
          </Link>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statsCards.map(({ label, value, icon: Icon, color, bg }) => (
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
              {teams.length > 0 && (
                <Link href="/teams">
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
                  <p className="text-sm font-medium text-foreground">No demos yet</p>
                  <p className="text-xs text-muted-foreground mt-1 mb-4">
                    Upload your first CS2 demo to get started with analysis.
                  </p>
                  <Link href="/teams">
                    <Button variant="neon" size="sm" className="gap-2">
                      <Plus size={14} />
                      Upload Demo
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {(recentDemos ?? []).map((demo) => {
                    const team = teams.find((t) => t.id === demo.team_id)
                    return (
                      <div
                        key={demo.id}
                        className="flex items-center gap-4 px-6 py-3 hover:bg-accent/30 transition-colors"
                      >
                        <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
                          <Crosshair size={14} className="text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            vs {demo.opponent_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {demo.map} {team ? `· ${team.name}` : ''}{' '}
                            {demo.match_date
                              ? `· ${formatDate(demo.match_date)}`
                              : demo.created_at
                              ? `· ${formatDate(demo.created_at)}`
                              : ''}
                          </p>
                        </div>
                        <Badge variant={statusVariant(demo.status)} className="text-xs shrink-0">
                          {demo.status}
                        </Badge>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/teams" className="block">
                <Button
                  variant="outline"
                  className="w-full justify-start gap-3 h-11 hover:border-neon-green/50 hover:text-neon-green"
                >
                  <Upload size={16} />
                  Upload Demo
                </Button>
              </Link>
              <Link href="/teams" className="block">
                <Button
                  variant="outline"
                  className="w-full justify-start gap-3 h-11 hover:border-neon-green/50 hover:text-neon-green"
                >
                  <Plus size={16} />
                  Create Team
                </Button>
              </Link>
              <Link href="/ai-coach" className="block">
                <Button
                  variant="outline"
                  className="w-full justify-start gap-3 h-11 hover:border-neon-green/50 hover:text-neon-green"
                >
                  <Brain size={16} />
                  Start AI Session
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Teams overview mini */}
          {teams.length > 0 && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Users size={16} className="text-neon-green" />
                  My Teams
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {teams.slice(0, 4).map((team) => (
                  <Link
                    key={team.id}
                    href={`/teams/${team.id}`}
                    className="flex items-center gap-3 rounded-md p-2 hover:bg-accent/50 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded bg-neon-green/10 border border-neon-green/20 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-neon-green">
                        {team.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate group-hover:text-neon-green transition-colors">
                        {team.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {demoCountMap[team.id] ?? 0} demos
                      </p>
                    </div>
                    <ArrowRight size={14} className="text-muted-foreground group-hover:text-neon-green transition-colors shrink-0" />
                  </Link>
                ))}
                {teams.length > 4 && (
                  <Link href="/teams">
                    <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground">
                      +{teams.length - 4} more teams
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Teams overview grid */}
      {teams.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Teams Overview</h2>
            <Link href="/teams">
              <Button variant="ghost" size="sm" className="gap-1 text-sm">
                Manage teams <ArrowRight size={14} />
              </Button>
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {teams.map((team) => (
              <Link key={team.id} href={`/teams/${team.id}`}>
                <Card className="bg-card border-border hover:border-neon-green/30 transition-all duration-200 cursor-pointer group">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-neon-green/10 border border-neon-green/20 flex items-center justify-center">
                        {team.logo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={team.logo_url} alt={team.name} className="w-full h-full object-cover rounded-lg" />
                        ) : (
                          <span className="text-sm font-bold text-neon-green">
                            {team.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground truncate group-hover:text-neon-green transition-colors">
                          {team.name}
                        </p>
                        <Badge variant="secondary" className="text-xs mt-0.5">
                          {team.userRole}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {demoCountMap[team.id] ?? 0} demos
                      </span>
                      <ArrowRight size={14} className="text-muted-foreground group-hover:text-neon-green transition-colors" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
