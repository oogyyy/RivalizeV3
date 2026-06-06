export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth/get-user'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { cn, formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Target, Brain, BarChart3, TrendingUp,
  ArrowRight, ChevronRight, Shield, Layers,
  Activity, Crosshair,
} from 'lucide-react'
import type { AggregatedStats, ParsedDemoData } from '@/types/database'
import { PageHeader } from '@/components/layout/PageHeader'

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
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const supabase = await createClient()
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

  type FolderRow = {
    id: string; opponent_display_name: string; opponent_slug: string
    aggregated_stats: AggregatedStats | null; user_team_id: string
  }

  // Single query for all folders — used both for display (top 6) and demo href lookup
  const { data: allFolders } = teamIds.length
    ? await admin
        .from('team_folders')
        .select('id, opponent_display_name, opponent_slug, aggregated_stats, user_team_id')
        .in('user_team_id', teamIds)
        .order('updated_at', { ascending: false })
    : { data: [] }

  const typedFolders = (allFolders ?? []) as FolderRow[]
  const folders = typedFolders.slice(0, 6)

  const folderByKey: Record<string, string> = {}
  for (const f of typedFolders) {
    folderByKey[`${f.user_team_id}:${f.opponent_slug}`] = f.id
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
        .limit(4)
    : { data: [] }

  const { data: recentSelfDemos } = teamIds.length
    ? await admin
        .from('demos')
        .select('id, team_id, opponent_name, opponent_slug, map, match_date, status, created_at, parsed_data')
        .in('team_id', teamIds)
        .eq('demo_type', 'self')
        .order('created_at', { ascending: false })
        .limit(4)
    : { data: [] }

  const { data: allDemosMeta } = teamIds.length
    ? await admin
        .from('demos')
        .select('status')
        .in('team_id', teamIds)
    : { data: [] }

  // Optimization: Only fetch recent 50 completed demos for stats (not ALL)
  // This reduces bandwidth from 100+ MB to ~5-10 MB for typical usage
  const { data: allSelfDemosData } = teamIds.length
    ? await admin
        .from('demos')
        .select('parsed_data')
        .in('team_id', teamIds)
        .eq('demo_type', 'self')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(50)
    : { data: [] }

  type SelfDemoMeta = { parsed_data: unknown }
  const selfCompleted = (allSelfDemosData ?? []) as SelfDemoMeta[]

  let selfWins = 0, selfTotal = 0, selfKills = 0, selfDeaths = 0, selfPlayerCount = 0
  for (const d of selfCompleted) {
    const result = getSelfDemoResult(d.parsed_data)
    if (result !== null) {
      selfTotal++
      if (result === 'Win') selfWins++
    }
    const pd = d.parsed_data as Record<string, unknown> | null
    const players = (pd?.players ?? []) as Array<{ team: string; kills: number; deaths: number }>
    const opSide = (pd?.opponentSide as string | undefined) ?? 'team2'
    const header = (pd?.header ?? {}) as Record<string, unknown>
    const opLabel = opSide === 'team1' ? (header.team1 as string ?? '') : (header.team2 as string ?? '')
    for (const p of players) {
      if (p.team === opLabel) continue
      selfKills  += p.kills
      selfDeaths += p.deaths
      selfPlayerCount++
    }
  }

  const winRateDisplay = selfTotal > 0 ? `${Math.round((selfWins / selfTotal) * 100)}%` : '—'
  const avgKDDisplay   = selfDeaths > 0 && selfPlayerCount > 0
    ? (selfKills / selfDeaths).toFixed(2)
    : '—'

  const totalDemos     = (allDemosMeta ?? []).length
  const analyzedDemos  = (allDemosMeta ?? []).filter((d) => d.status === 'completed').length
  const totalOpponents = typedFolders.length

  const displayName   = profile?.display_name || profile?.username || 'Player'
  const opponentDemos = (recentOpponentDemos ?? []) as DemoRow[]
  const selfDemos     = (recentSelfDemos     ?? []) as DemoRow[]

  return (
    <div className="p-5 md:p-7 space-y-6 max-w-7xl mx-auto">

      {/* ── Page header ── */}
      <div className="animate-fade-in-up">
        <PageHeader
          label="Dashboard"
          title={<>Welcome back, <span className="text-[#00ffc8]">{displayName}</span></>}
          description="Your match-prep hub — study opponents, generate anti-strats, win."
          actions={
            <Link href="/ai-coach">
              <Button variant="neon" className="gap-2 shadow-[0_0_16px_rgba(0,255,200,0.2)]">
                <Brain size={15} />
                AI Scout
              </Button>
            </Link>
          }
        />
      </div>

      {/* ── Quick stats row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 animate-fade-in-up animate-fade-in-up-delay-1">
        <StatCard label="Win Rate"       value={winRateDisplay}  sub={selfTotal > 0 ? `Last 30 days · ${selfWins}W / ${selfTotal - selfWins}L` : 'No games yet'} accentColor="var(--pink)"   borderClass="s-pink" />
        <StatCard label="Maps Played"    value={totalDemos}       sub="Across all modes"  accentColor="var(--signal)" borderClass="s-signal" />
        <StatCard label="Demos Analyzed" value={analyzedDemos}    sub="This week"         accentColor="var(--loss)"   borderClass="s-red" />
        <StatCard label="Avg Rating"     value={avgKDDisplay}     sub="Team average"      accentColor="var(--tside)"  borderClass="s-amber" />
      </div>

      {/* Next Match Hero */}
      <div className="afu rv-panel animate-fade-in-up animate-fade-in-up-delay-2" style={{ position: 'relative', padding: '20px 24px 22px', background: 'radial-gradient(820px 380px at 92% -40%, color-mix(in srgb, var(--accent) 14%, transparent), transparent 62%), radial-gradient(620px 300px at 4% -30%, color-mix(in srgb, var(--loss) 5%, transparent), transparent 60%), linear-gradient(180deg, color-mix(in srgb, var(--accent) 3%, var(--card)), var(--card))', borderColor: 'color-mix(in srgb, var(--accent) 18%, var(--border))' }}>
        <span className="rv-tick rv-tick-tl" /><span className="rv-tick rv-tick-br" />
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 18, flexWrap: 'wrap', rowGap: 12 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 6 }}>Next Match</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1.05 }}>
              {folders[0] ? (folders[0] as FolderRow).opponent_display_name : 'No upcoming match'}
            </h2>
          </div>
          <Link href="/prep">
            <button className="rv-btn" style={{ background: 'linear-gradient(180deg, var(--accent), var(--accent-deep))', color: '#fff', border: 'none', height: 36, padding: '0 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              View Full Prep <ArrowRight size={14} />
            </button>
          </Link>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 12 }}>Map Pool Win Rates</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 18 }}>
          {[
            { name: 'Mirage', win: 60 }, { name: 'Inferno', win: 45 }, { name: 'Nuke', win: 70 },
            { name: 'Overpass', win: 55 }, { name: 'Ancient', win: 50 },
          ].map(({ name, win }) => (
            <div key={name} style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{name}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--win)', width: 24 }}>{win}%</span>
                <div style={{ flex: 1, height: 5, borderRadius: 5, overflow: 'hidden', display: 'flex', background: 'var(--track)' }}>
                  <div style={{ width: `${win}%`, background: 'linear-gradient(90deg, var(--win), #2bb98a)' }} />
                  <div style={{ flex: 1, background: 'color-mix(in srgb, var(--loss) 55%, transparent)' }} />
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--loss)', width: 24, textAlign: 'right' }}>{100-win}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 animate-fade-in-up animate-fade-in-up-delay-2">

        {/* Left: demo lists */}
        <div className="lg:col-span-2 space-y-5">

          {/* Opponent demos */}
          <DemoCard
            title="Opponent Demos"
            subtitle="Teams you're preparing to face"
            icon={<Target size={14} className="text-red-400" />}
            iconBg="bg-red-500/10"
            accentClass="accent-line-red"
            viewAllHref="/opponents"
            emptyIcon={<Target size={22} className="text-red-400/60" />}
            emptyTitle="No opponent demos yet"
            emptyBody="Upload demos to build your scouting library."
            emptyCtaHref="/opponents"
            emptyCtaLabel="Scout First Opponent"
          >
            {opponentDemos.length > 0 && (
              <div className="divide-y divide-border/40">
                {opponentDemos.map((d) => {
                  const folderId = d.opponent_slug
                    ? folderByKey[`${d.team_id}:${d.opponent_slug}`]
                    : undefined
                  const href = d.status === 'completed' && folderId
                    ? `/demos/${d.id}?folder=${folderId}`
                    : folderId ? `/opponents/${folderId}` : '/opponents'
                  return (
                    <DemoRow
                      key={d.id}
                      href={href}
                      initial={d.opponent_name.charAt(0).toUpperCase()}
                      initialBg="bg-red-500/10 border border-red-500/15"
                      initialColor="text-red-400"
                      name={d.opponent_name}
                      meta={`${d.map && d.map !== 'unknown' ? d.map + ' · ' : ''}${d.match_date ? formatDate(d.match_date) : formatDate(d.created_at)}`}
                      hoverColor="group-hover:text-red-300"
                      chevronHover="group-hover:text-red-400"
                      badge={<Badge variant={statusVariant(d.status)} className="text-[10px] px-1.5">{statusLabel(d.status)}</Badge>}
                    />
                  )
                })}
              </div>
            )}
          </DemoCard>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border/40" />
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground/30 font-medium px-1">vs</span>
            <div className="h-px flex-1 bg-border/40" />
          </div>

          {/* My team demos */}
          <DemoCard
            title="My Team Demos"
            subtitle="Your team's own match recordings"
            icon={<Shield size={14} className="text-[#00ffc8]" />}
            iconBg="bg-[rgba(0,255,200,0.1)]"
            accentClass="accent-line-green"
            viewAllHref="/my-team"
            emptyIcon={<Shield size={22} className="text-[#00ffc8]/60" />}
            emptyTitle="No team demos yet"
            emptyBody="Upload your own match recordings to review performance."
            emptyCtaHref="/my-team"
            emptyCtaLabel="Upload Team Demo"
            emptyCtaVariant="neon"
          >
            {selfDemos.length > 0 && (
              <div className="divide-y divide-border/40">
                {selfDemos.map((d) => {
                  const href   = d.status === 'completed' ? `/my-team/demos/${d.id}` : '/my-team'
                  const result = d.status === 'completed' ? getSelfDemoResult(d.parsed_data) : null
                  return (
                    <DemoRow
                      key={d.id}
                      href={href}
                      initial={myTeamName.charAt(0).toUpperCase()}
                      initialBg="bg-[rgba(0,255,200,0.1)] border border-[rgba(0,255,200,0.2)]"
                      initialColor="text-[#00ffc8]"
                      name={myTeamName}
                      meta={`${d.map && d.map !== 'unknown' ? d.map + ' · ' : ''}${d.match_date ? formatDate(d.match_date) : formatDate(d.created_at)}`}
                      hoverColor="group-hover:text-[#00ffc8]"
                      chevronHover="group-hover:text-[#00ffc8]"
                      badge={
                        <div className="flex items-center gap-1.5">
                          {result && (
                            <span className={cn(
                              'text-[10px] font-bold px-1.5 py-0.5 rounded-md tracking-wide',
                              result === 'Win'  && 'text-[#00ffc8] bg-[rgba(0,255,200,0.12)]',
                              result === 'Loss' && 'text-red-400 bg-red-400/10',
                              result === 'Draw' && 'text-amber-400 bg-amber-400/10',
                            )}>
                              {result.toUpperCase()}
                            </span>
                          )}
                          <Badge variant={statusVariant(d.status)} className="text-[10px] px-1.5">{statusLabel(d.status)}</Badge>
                        </div>
                      }
                    />
                  )
                })}
              </div>
            )}
          </DemoCard>
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">

          {/* Quick actions */}
          <div className="rv-panel overflow-hidden">
            <div className="px-5 pt-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--faint)' }}>
                Quick Actions
              </p>
            </div>
            <div className="p-3 space-y-1">
              <QuickAction href="/opponents" icon={<Target size={14} className="text-red-400" />} label="Upload Opponent Demo" hoverClass="hover:border-red-500/30 hover:text-red-300 hover:bg-red-500/[0.05]" />
              <QuickAction href="/my-team"   icon={<Shield size={14} className="text-[#00ffc8]" />} label="Upload Team Demo"    hoverClass="hover:border-[rgba(0,255,200,0.3)] hover:text-[#00ffc8] hover:bg-[rgba(0,255,200,0.05)]" />
              <QuickAction href="/opponents" icon={<BarChart3 size={14} className="text-muted-foreground" />} label="View All Opponents" hoverClass="hover:text-foreground hover:bg-accent/60" />
              <QuickAction href="/ai-coach"  icon={<Brain size={14} className="text-[#00ffc8]" />} label="Generate Anti-Strat" hoverClass="hover:border-[rgba(0,255,200,0.3)] hover:text-[#00ffc8] hover:bg-[rgba(0,255,200,0.05)]" />
            </div>
          </div>

          {/* Opponent mini-list */}
          {folders.length > 0 && (
            <div className="rv-panel overflow-hidden">
              <div className="flex items-center justify-between px-5 pt-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2">
                  <Target size={13} className="text-red-400" />
                  <p className="text-[13px] font-semibold text-foreground">Opponents</p>
                </div>
                <span className="text-[11px] font-mono text-muted-foreground">{totalOpponents}</span>
              </div>
              <div className="p-2">
                {folders.slice(0, 5).map((folder) => {
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
                      className="flex items-center gap-2.5 rounded-lg p-2 hover:bg-accent/70 transition-colors group"
                    >
                      <div className="w-6 h-6 rounded-md bg-red-500/10 border border-red-500/15 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-red-400">
                          {f.opponent_display_name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-foreground truncate group-hover:text-red-300 transition-colors">
                          {f.opponent_display_name}
                        </p>
                        {total > 0 && (
                          <p className={cn(
                            'text-[10px] font-mono',
                            wins > losses ? 'text-[#00ffc8]' : losses > wins ? 'text-red-400' : 'text-muted-foreground'
                          )}>
                            {wins}W–{losses}L
                            {winRate !== null && <span className="text-muted-foreground/50 ml-1">{winRate}%</span>}
                          </p>
                        )}
                      </div>
                      <ChevronRight size={11} className="text-muted-foreground/25 group-hover:text-red-400 shrink-0 transition-colors" />
                    </Link>
                  )
                })}
                {totalOpponents > 5 && (
                  <Link href="/opponents" className="block mt-1">
                    <Button variant="ghost" size="sm" className="w-full text-[11px] text-muted-foreground hover:text-foreground h-8">
                      +{totalOpponents - 5} more <ArrowRight size={11} />
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* AI CTA card */}
          {totalDemos > 0 && (
            <div className="rv-panel rv-insight overflow-hidden" style={{ position: 'relative' }}>
              <span className="rv-tick rv-tick-tl" />
              <span className="rv-tick rv-tick-br" style={{ borderColor: 'color-mix(in srgb, var(--signal) 48%, transparent)' }} />
              <div className="relative p-5">
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 8px', borderRadius: 5, background: 'rgba(45,227,206,0.1)', border: '1px solid rgba(45,227,206,0.28)', color: 'var(--signal)', fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600, letterSpacing: '0.08em', marginBottom: 14 }}>
                  ✦ AI INSIGHT
                </div>
                <p className="font-semibold mb-1" style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--text)' }}>Pre-match brief ready</p>
                <p className="mb-4" style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
                  {analyzedDemos} demo{analyzedDemos !== 1 ? 's' : ''} analyzed and ready for AI scouting.
                </p>
                <Link href="/ai-coach">
                  <button className="rv-btn rv-btn-signal w-full gap-2" style={{ width: '100%', justifyContent: 'center' }}>
                    <Brain size={14} />
                    Open AI Scout →
                  </button>
                </Link>
              </div>
            </div>
          )}

          {/* First-time empty CTA */}
          {totalDemos === 0 && (
            <div className="rv-panel p-5 text-center" style={{ borderStyle: 'dashed' }}>
              <TrendingUp size={24} className="text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-[13px] font-medium text-foreground mb-1">Upload your first demo</p>
              <p className="text-[12px] text-muted-foreground mb-4 leading-relaxed">
                Scout opponents or review your own team's performance.
              </p>
              <Link href="/opponents">
                <Button variant="secondary" size="sm" className="w-full gap-2">
                  <Target size={13} />
                  Get Started
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* AI Brief */}
      {totalDemos > 0 && (
        <div className="animate-fade-in-up" style={{ position: 'relative', padding: '18px 22px', overflow: 'hidden', borderRadius: 'var(--radius)', border: '1px solid color-mix(in srgb, var(--signal) 24%, transparent)', background: 'radial-gradient(480px 250px at 8% -24%, color-mix(in srgb, var(--signal) 11%, transparent), transparent 60%), linear-gradient(180deg, color-mix(in srgb, var(--signal) 2.5%, var(--card)), var(--card))' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 280 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>AI Brief</p>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 5, background: 'rgba(34,211,238,.1)', border: '1px solid rgba(34,211,238,.3)', fontFamily: 'var(--font-mono)', fontSize: 9.5, fontWeight: 700, color: 'var(--signal)', letterSpacing: '0.06em' }}>✦ AI INSIGHT</span>
              </div>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Pre-match brief ready</p>
              <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.65, maxWidth: 760 }}>
                {analyzedDemos} demo{analyzedDemos !== 1 ? 's' : ''} analyzed. Your opponent shows patterns on multiple maps — upload more demos for a comprehensive anti-strat.
              </p>
            </div>
            <Link href="/ai-coach">
              <button style={{ height: 36, padding: '0 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, background: 'color-mix(in srgb, var(--signal) 13%, transparent)', color: 'var(--signal)', border: '1px solid color-mix(in srgb, var(--signal) 32%, transparent)', flexShrink: 0 }}>
                Open AI Coach <ArrowRight size={14} />
              </button>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accentColor, borderClass }: {
  label: string
  value: number | string
  sub?: string
  accentColor: string
  borderClass: string
}) {
  return (
    <div className={`rv-panel lift p-4 md:p-5 cursor-default overflow-hidden ${borderClass}`} style={{ position: 'relative' }}>
      <p style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '0.04em', color: 'var(--muted)', marginBottom: 8 }}>
        {label}
      </p>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 38, fontWeight: 600, color: accentColor, lineHeight: 1, letterSpacing: '-0.03em', marginBottom: 9, textShadow: `0 0 22px color-mix(in srgb, ${accentColor} 35%, transparent)` }}>
        {value}
      </p>
      {sub && (
        <p style={{ fontSize: 11.5, color: 'var(--faint)' }}>{sub}</p>
      )}
    </div>
  )
}

function DemoCard({
  title, subtitle, icon, iconBg, accentClass, viewAllHref,
  emptyIcon, emptyTitle, emptyBody, emptyCtaHref, emptyCtaLabel,
  emptyCtaVariant = 'secondary', children,
}: {
  title: string
  subtitle: string
  icon: React.ReactNode
  iconBg: string
  accentClass: string
  viewAllHref: string
  emptyIcon: React.ReactNode
  emptyTitle: string
  emptyBody: string
  emptyCtaHref: string
  emptyCtaLabel: string
  emptyCtaVariant?: 'neon' | 'secondary'
  children?: React.ReactNode
}) {
  const hasContent = children !== undefined && children !== false && children !== null
  return (
    <div className="rv-panel overflow-hidden">
      <div className={cn(accentClass, 'w-full')} />
      <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          <div className={cn('w-6 h-6 rounded-md flex items-center justify-center', iconBg)}>
            {icon}
          </div>
          <div>
            <p className="text-[13px] font-semibold text-foreground leading-tight">{title}</p>
            <p className="text-[11px] text-muted-foreground/60 leading-tight">{subtitle}</p>
          </div>
        </div>
        {hasContent && (
          <Link href={viewAllHref}>
            <Button variant="ghost" size="sm" className="gap-1 text-[11px] text-muted-foreground hover:text-foreground h-7 px-2">
              View all <ArrowRight size={11} />
            </Button>
          </Link>
        )}
      </div>

      {hasContent ? (
        children
      ) : (
        <div className="flex flex-col items-center justify-center py-10 text-center px-6">
          <div className="w-11 h-11 rounded-xl bg-accent/60 flex items-center justify-center mb-3">
            {emptyIcon}
          </div>
          <p className="text-[13px] font-semibold text-foreground">{emptyTitle}</p>
          <p className="text-[12px] text-muted-foreground mt-1 mb-4 max-w-xs leading-relaxed">{emptyBody}</p>
          <Link href={emptyCtaHref}>
            <Button variant={emptyCtaVariant} size="sm" className="gap-2">
              {emptyCtaLabel}
            </Button>
          </Link>
        </div>
      )}
    </div>
  )
}

function DemoRow({
  href, initial, initialBg, initialColor, name, meta,
  hoverColor, chevronHover, badge,
}: {
  href: string
  initial: string
  initialBg: string
  initialColor: string
  name: string
  meta: string
  hoverColor: string
  chevronHover: string
  badge: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="rv-row flex items-center gap-3 px-5 py-3 group"
    >
      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', initialBg)}>
        <span className={cn('text-[11px] font-bold', initialColor)}>{initial}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('text-[13px] font-medium text-foreground truncate transition-colors', hoverColor)}>
          {name}
        </p>
        <p className="text-[11px] text-muted-foreground/50 mt-0.5">{meta}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {badge}
        <ChevronRight size={13} className={cn('text-muted-foreground/25 transition-colors', chevronHover)} />
      </div>
    </Link>
  )
}

function QuickAction({ href, icon, label, hoverClass }: {
  href: string
  icon: React.ReactNode
  label: string
  hoverClass: string
}) {
  return (
    <Link href={href} className="block">
      <button
        className={cn(
          'flex items-center gap-3 w-full rounded-lg px-3 h-9 text-[13px] font-medium text-muted-foreground',
          'border border-transparent transition-all duration-120',
          hoverClass
        )}
      >
        {icon}
        {label}
      </button>
    </Link>
  )
}
