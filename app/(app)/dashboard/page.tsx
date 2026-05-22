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
  ArrowRight, ChevronRight, Shield,
} from 'lucide-react'
import type { AggregatedStats, ParsedDemoData } from '@/types/database'

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusVariant(status: string) {
  if (status === 'completed') return 'neon' as const
  if (status === 'processing') return 'processing' as const
  return 'destructive' as const
}

function statusLabel(status: string) {
  if (status === 'completed') return 'Analyzed'
  if (status === 'processing') return 'Processing'
  return 'Failed'
}

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

// ── Page ──────────────────────────────────────────────────────────────────────

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

  const teamIds       = (memberships ?? []).map((m) => m.team_id).filter(Boolean)
  const primaryTeamId = teamIds[0] ?? null

  const { data: primaryTeam } = primaryTeamId
    ? await admin.from('teams').select('name').eq('id', primaryTeamId).single()
    : { data: null }
  const myTeamName = (primaryTeam as { name?: string } | null)?.name ?? 'My Team'

  const { data: folders } = teamIds.length
    ? await admin
        .from('team_folders')
        .select('id, opponent_display_name, opponent_slug, aggregated_stats, user_team_id')
        .in('user_team_id', teamIds)
        .order('updated_at', { ascending: false })
        .limit(6)
    : { data: [] }

  type FolderRow = {
    id: string; opponent_display_name: string; opponent_slug: string
    aggregated_stats: AggregatedStats | null; user_team_id: string
  }
  const folderByKey: Record<string, string> = {}
  for (const f of (folders ?? []) as FolderRow[]) {
    folderByKey[`${f.user_team_id}:${f.opponent_slug}`] = f.id
  }

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

  type DemoRow = {
    id: string; team_id: string; opponent_name: string
    opponent_slug: string | null; map: string
    match_date: string | null; status: string; created_at: string
    parsed_data?: unknown
  }

  const { data: recentOpponentDemos } = teamIds.length
    ? await admin
        .from('demos')
        .select('id, team_id, opponent_name, opponent_slug, map, match_date, status, created_at, demo_type')
        .in('team_id', teamIds)
        .eq('demo_type', 'opponent')
        .order('created_at', { ascending: false })
        .limit(3)
    : { data: [] }

  const { data: recentSelfDemos } = teamIds.length
    ? await admin
        .from('demos')
        .select('id, team_id, opponent_name, opponent_slug, map, match_date, status, created_at, parsed_data')
        .in('team_id', teamIds)
        .eq('demo_type', 'self')
        .order('created_at', { ascending: false })
        .limit(3)
    : { data: [] }

  const { data: allDemosMeta } = teamIds.length
    ? await admin
        .from('demos')
        .select('status')
        .in('team_id', teamIds)
    : { data: [] }

  const totalDemos     = (allDemosMeta ?? []).length
  const analyzedDemos  = (allDemosMeta ?? []).filter((d) => d.status === 'completed').length
  const totalOpponents = (allFolders ?? []).length

  const displayName   = profile?.display_name || profile?.username || 'Player'
  const opponentDemos = (recentOpponentDemos ?? []) as DemoRow[]
  const selfDemos     = (recentSelfDemos     ?? []) as DemoRow[]

  return (
    <div className="p-4 md:p-6 space-y-6 md:space-y-8 max-w-7xl mx-auto">

      {/* ── Hero welcome ── */}
      <div className="relative rounded-2xl overflow-hidden border border-border bg-card animate-fade-in-up">
        {/* Top accent line */}
        <div className="h-px w-full bg-gradient-to-r from-neon-green/60 via-neon-green/20 to-transparent" />
        {/* Atmospheric layers */}
        <div className="absolute inset-0 bg-gradient-to-br from-neon-green/[0.06] via-transparent to-transparent pointer-events-none" />
        <div className="absolute -top-10 -left-10 w-80 h-56 bg-neon-green/[0.04] blur-3xl rounded-full pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.01] to-transparent pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 md:p-7">
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-[0.15em] mb-1.5">
              Dashboard
            </p>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
              Welcome back,{' '}
              <span className="text-neon-green neon-text">{displayName}</span>
            </h1>
            <p className="mt-1.5 text-muted-foreground text-sm leading-relaxed">
              Your match-prep hub — study opponents, generate anti-strats, win.
            </p>
          </div>
          <Link href="/ai-coach" className="shrink-0">
            <Button variant="neon" className="gap-2">
              <Brain size={16} />
              AI Scout
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Quick stats ── */}
      <div className="grid grid-cols-3 gap-3 md:gap-4 animate-fade-in-up animate-fade-in-up-delay-1">
        <StatCard
          label="Opponents"
          value={totalOpponents}
          icon={<Target size={18} className="text-red-400" />}
          accent="stat-card-red"
        />
        <StatCard
          label="Demos Uploaded"
          value={totalDemos}
          icon={<BarChart3 size={18} className="text-blue-400" />}
          accent="stat-card-blue"
        />
        <StatCard
          label="Analyzed"
          value={analyzedDemos}
          icon={<TrendingUp size={18} className="text-neon-green" />}
          accent="stat-card-green"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 animate-fade-in-up animate-fade-in-up-delay-2">
        {/* Left col: two demo sections */}
        <div className="lg:col-span-2 space-y-5">

          {/* ── Recent Opponent Demos ── */}
          <Card className="bg-card border-border overflow-hidden">
            <div className="h-[2px] w-full bg-gradient-to-r from-red-500/60 via-red-500/20 to-transparent" />
            <CardHeader className="flex flex-row items-center justify-between pb-3 pt-4">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-red-500/15 flex items-center justify-center">
                    <Target size={13} className="text-red-400" />
                  </div>
                  Recent Opponent Demos
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5 ml-8">
                  Demos from teams you&apos;re preparing to face
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
                  <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-3">
                    <Target size={20} className="text-red-400" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">No opponent demos yet</p>
                  <p className="text-xs text-muted-foreground mt-1 mb-4 max-w-xs">
                    Upload demos to start building your scouting library.
                  </p>
                  <Link href="/opponents">
                    <Button size="sm" className="gap-2 bg-red-500/15 border border-red-500/30 text-red-300 hover:bg-red-500/25 hover:text-red-200">
                      <Target size={13} />
                      Scout First Opponent
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {opponentDemos.map((d) => {
                    const folderId = d.opponent_slug
                      ? folderByKey[`${d.team_id}:${d.opponent_slug}`]
                      : undefined
                    const href = d.status === 'completed' && folderId
                      ? `/demos/${d.id}?folder=${folderId}`
                      : folderId ? `/opponents/${folderId}` : '/opponents'
                    return (
                      <Link
                        key={d.id}
                        href={href}
                        className="flex items-center gap-3 px-5 py-3.5 hover:bg-red-500/[0.04] transition-colors group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-red-400">
                            {d.opponent_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate group-hover:text-red-300 transition-colors">
                            {d.opponent_name}
                            {d.map && d.map !== 'unknown' && (
                              <span className="font-normal text-muted-foreground ml-1.5 text-xs">[{d.map}]</span>
                            )}
                          </p>
                          <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                            {d.match_date ? formatDate(d.match_date) : formatDate(d.created_at)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant={statusVariant(d.status)} className="text-[10px] px-1.5">
                            {statusLabel(d.status)}
                          </Badge>
                          <ChevronRight size={13} className="text-muted-foreground/30 group-hover:text-red-400 transition-colors" />
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── VS divider ── */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border/50" />
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground/40 font-medium px-1">vs</span>
            <div className="h-px flex-1 bg-border/50" />
          </div>

          {/* ── Recent My Team Demos ── */}
          <Card className="bg-card border-border overflow-hidden">
            <div className="h-[2px] w-full bg-gradient-to-r from-neon-green/60 via-neon-green/20 to-transparent" />
            <CardHeader className="flex flex-row items-center justify-between pb-3 pt-4">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-neon-green/15 flex items-center justify-center">
                    <Shield size={13} className="text-neon-green" />
                  </div>
                  Recent My Team Demos
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5 ml-8">
                  Your team&apos;s own match recordings
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
                  <div className="w-12 h-12 rounded-2xl bg-neon-green/10 border border-neon-green/20 flex items-center justify-center mb-3">
                    <Shield size={20} className="text-neon-green" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">No team demos yet</p>
                  <p className="text-xs text-muted-foreground mt-1 mb-4 max-w-xs">
                    Upload your own match recordings to review performance.
                  </p>
                  <Link href="/my-team">
                    <Button variant="neon" size="sm" className="gap-2 shadow-lg shadow-neon-green/10">
                      <Upload size={13} />
                      Upload Team Demo
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {selfDemos.map((d) => {
                    const href   = d.status === 'completed' ? `/my-team/demos/${d.id}` : '/my-team'
                    const result = d.status === 'completed' ? getSelfDemoResult(d.parsed_data) : null
                    return (
                      <Link
                        key={d.id}
                        href={href}
                        className="flex items-center gap-3 px-5 py-3.5 hover:bg-neon-green/[0.04] transition-colors group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-neon-green/10 border border-neon-green/20 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-neon-green">
                            {myTeamName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-foreground truncate group-hover:text-neon-green transition-colors">
                              {myTeamName}
                            </p>
                            {result && (
                              <span className={cn(
                                'text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 tracking-wide',
                                result === 'Win'  && 'text-neon-green bg-neon-green/10',
                                result === 'Loss' && 'text-red-400    bg-red-400/10',
                                result === 'Draw' && 'text-yellow-400 bg-yellow-400/10',
                              )}>
                                {result.toUpperCase()}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                            {d.map && d.map !== 'unknown' ? `${d.map} · ` : ''}
                            {d.match_date ? formatDate(d.match_date) : formatDate(d.created_at)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant={statusVariant(d.status)} className="text-[10px] px-1.5">
                            {statusLabel(d.status)}
                          </Badge>
                          <ChevronRight size={13} className="text-muted-foreground/30 group-hover:text-neon-green transition-colors" />
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Right sidebar ── */}
        <div className="space-y-4">
          {/* Quick Actions */}
          <Card className="bg-card border-border overflow-hidden">
            <div className="h-px w-full bg-gradient-to-r from-neon-green/40 via-neon-green/10 to-transparent" />
            <CardHeader className="pb-3 pt-4">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.12em]">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              <Link href="/opponents" className="block">
                <Button variant="outline" className="w-full justify-start gap-3 h-10 text-sm hover:border-red-500/40 hover:text-red-300 hover:bg-red-500/[0.07]">
                  <Target size={14} className="text-red-400" />
                  Upload Opponent Demo
                </Button>
              </Link>
              <Link href="/my-team" className="block">
                <Button variant="outline" className="w-full justify-start gap-3 h-10 text-sm hover:border-neon-green/40 hover:text-neon-green hover:bg-neon-green/[0.06]">
                  <Shield size={14} className="text-neon-green" />
                  Upload Team Demo
                </Button>
              </Link>
              <Link href="/opponents" className="block">
                <Button variant="outline" className="w-full justify-start gap-3 h-10 text-sm hover:border-border/80 hover:bg-white/[0.03]">
                  <BarChart3 size={14} className="text-muted-foreground" />
                  View All Opponents
                </Button>
              </Link>
              <Link href="/ai-coach" className="block">
                <Button variant="outline" className="w-full justify-start gap-3 h-10 text-sm hover:border-neon-green/40 hover:text-neon-green hover:bg-neon-green/[0.06]">
                  <Brain size={14} className="text-neon-green" />
                  Generate Anti-Strat
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Opponent mini-list */}
          {(folders ?? []).length > 0 && (
            <Card className="bg-card border-border overflow-hidden">
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm font-semibold flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Target size={13} className="text-red-400" />
                    Opponents
                  </span>
                  <span className="text-xs text-muted-foreground font-normal">{totalOpponents}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2 pt-0">
                {(folders ?? []).slice(0, 5).map((folder) => {
                  const f = folder as FolderRow
                  const stats   = f.aggregated_stats as AggregatedStats | null
                  const wins    = stats?.wins   ?? 0
                  const losses  = stats?.losses ?? 0
                  const total   = wins + losses + (stats?.draws ?? 0)
                  const winRate = total > 0 ? Math.round((wins / total) * 100) : null
                  return (
                    <Link
                      key={f.id}
                      href={`/opponents/${f.id}`}
                      className="flex items-center gap-2.5 rounded-lg p-2 hover:bg-accent/60 transition-colors group"
                    >
                      <div className="w-6 h-6 rounded-md bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-red-400">
                          {f.opponent_display_name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate group-hover:text-red-300 transition-colors">
                          {f.opponent_display_name}
                        </p>
                        {total > 0 && (
                          <p className={cn(
                            'text-[10px] font-mono',
                            wins > losses ? 'text-neon-green' : losses > wins ? 'text-red-400' : 'text-muted-foreground'
                          )}>
                            {wins}W–{losses}L
                            {winRate !== null && <span className="text-muted-foreground/60 ml-1">{winRate}%</span>}
                          </p>
                        )}
                      </div>
                      <ChevronRight size={11} className="text-muted-foreground/30 group-hover:text-red-400 shrink-0 transition-colors" />
                    </Link>
                  )
                })}
                {totalOpponents > 5 && (
                  <Link href="/opponents" className="block mt-1">
                    <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground hover:text-foreground">
                      +{totalOpponents - 5} more
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          )}

          {/* AI CTA */}
          {totalDemos > 0 && (
            <div className="relative rounded-xl border border-neon-green/25 bg-card overflow-hidden">
              <div className="h-px w-full bg-gradient-to-r from-neon-green/60 via-neon-green/20 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-br from-neon-green/[0.08] to-transparent pointer-events-none" />
              <div className="absolute -top-6 -right-6 w-24 h-24 bg-neon-green/[0.06] blur-2xl rounded-full pointer-events-none" />
              <div className="relative p-5 text-center">
                <div className="w-11 h-11 rounded-xl bg-neon-green/15 border border-neon-green/30 flex items-center justify-center mx-auto mb-3 shadow-[0_0_12px_rgba(0,255,135,0.15)]">
                  <Brain size={19} className="text-neon-green" />
                </div>
                <p className="text-sm font-bold text-foreground mb-1">Ready to prep?</p>
                <p className="text-xs text-muted-foreground mb-4">
                  {analyzedDemos} demo{analyzedDemos !== 1 ? 's' : ''} analyzed
                </p>
                <Link href="/ai-coach">
                  <Button variant="neon" size="sm" className="w-full gap-2">
                    <Brain size={14} />
                    Open AI Scout
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, icon, accent }: {
  label: string
  value: number
  icon: React.ReactNode
  accent: string
}) {
  return (
    <div className={cn('relative bg-card border border-border rounded-xl p-4 md:p-5 card-hover overflow-hidden', accent)}>
      {/* Inner top gradient */}
      <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-white/[0.025] to-transparent pointer-events-none" />
      <div className="relative flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-[0.12em]">{label}</p>
          <p className="text-2xl md:text-3xl font-bold text-foreground mt-1.5 tabular-nums">{value}</p>
        </div>
        <div className="p-2.5 rounded-xl bg-accent/80 border border-border/60 mt-0.5 shrink-0">
          {icon}
        </div>
      </div>
    </div>
  )
}
