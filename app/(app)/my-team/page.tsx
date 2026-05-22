export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import {
  Shield, Brain, BarChart3, Trophy, Crosshair,
  TrendingUp, Zap, Map as MapIcon, Users, ArrowRight,
  FileVideo,
} from 'lucide-react'
import DemoUploadButton from '@/components/teams/DemoUploadButton'
import MapFolderList, { type MapGroup } from '@/components/teams/MapFolderList'
import type { DemoRowData } from '@/components/teams/DemoListMultiSelect'

export default async function MyTeamPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: memberships } = await admin
    .from('team_members')
    .select('role, team_id')
    .eq('user_id', user.id)

  const teamIds = (memberships ?? []).map((m) => m.team_id).filter(Boolean)
  const primaryTeamId = teamIds[0] ?? null

  let teamName = 'My Team'
  if (primaryTeamId) {
    const { data: team } = await admin
      .from('teams')
      .select('name')
      .eq('id', primaryTeamId)
      .single()
    if (team?.name) teamName = team.name
  }

  // Fetch ONLY self-demos (demo_type = 'self') for the My Team page.
  // Opponent demos (demo_type = 'opponent') are completely excluded here —
  // they belong exclusively in the Opponents / scouting section.
  type DemoRow = {
    id: string
    status: string
    map: string | null
    match_date: string | null
    created_at: string
    opponent_slug: string | null
    parsed_data: {
      header?: {
        map?: string
        score_team1?: number
        score_team2?: number
        total_rounds?: number
        team1?: string
        team2?: string
      }
      opponentSide?: string
      players?: Array<{
        name: string
        kills: number
        deaths: number
        assists: number
        rating: number
        adr: number
        team: string
      }>
    } | null
  }

  const { data: recentDemos } = primaryTeamId
    ? await admin
        .from('demos')
        .select('id, status, map, match_date, created_at, opponent_slug, parsed_data, error_message')
        .eq('team_id', primaryTeamId)
        .eq('demo_type', 'self')   // STRICT: only own-team demos shown here
        .order('created_at', { ascending: false })
        .limit(50)
    : { data: [] }

  const demos = (recentDemos ?? []) as DemoRow[]
  const completedDemos = demos.filter(d => d.status === 'completed')

  // Aggregate my-team stats across all completed demos
  let totalMatches = 0
  let totalWins = 0
  let totalDraws = 0
  let totalKills = 0
  let totalDeaths = 0
  let totalAdr = 0
  let playerCount = 0
  const mapCounts: Record<string, number> = {}
  const myPlayerStats: Record<string, { kills: number; deaths: number; assists: number; adr: number; rating: number; games: number }> = {}

  for (const demo of completedDemos) {
    const pd = demo.parsed_data
    const h = pd?.header
    const opponentSide = pd?.opponentSide ?? 'team2'
    totalMatches++

    if (h) {
      const ourScore  = opponentSide === 'team1' ? (h.score_team2 ?? 0) : (h.score_team1 ?? 0)
      const theirScore = opponentSide === 'team1' ? (h.score_team1 ?? 0) : (h.score_team2 ?? 0)
      if (ourScore > theirScore) totalWins++
      else if (ourScore === theirScore) totalDraws++
      if (h.map && h.map !== 'unknown') mapCounts[h.map] = (mapCounts[h.map] ?? 0) + 1
    }

    if (pd?.players) {
      const opponentLabel = opponentSide === 'team1'
        ? (h?.team1 ?? 'T-Side')
        : (h?.team2 ?? 'CT-Side')
      for (const p of pd.players) {
        if (p.team === opponentLabel) continue  // skip opponent
        totalKills += p.kills
        totalDeaths += p.deaths
        totalAdr += p.adr
        playerCount++
        if (!myPlayerStats[p.name]) myPlayerStats[p.name] = { kills: 0, deaths: 0, assists: 0, adr: 0, rating: 0, games: 0 }
        myPlayerStats[p.name].kills   += p.kills
        myPlayerStats[p.name].deaths  += p.deaths
        myPlayerStats[p.name].assists += p.assists
        myPlayerStats[p.name].adr     += p.adr
        myPlayerStats[p.name].rating  += p.rating
        myPlayerStats[p.name].games   += 1
      }
    }
  }

  const winRate = totalMatches > 0 ? totalWins / totalMatches : 0
  const totalLosses = totalMatches - totalWins - totalDraws
  const avgKD = totalDeaths > 0 ? (totalKills / totalDeaths).toFixed(2) : '—'
  const avgAdr = playerCount > 0 ? (totalAdr / playerCount).toFixed(1) : '—'

  const topPlayers = Object.entries(myPlayerStats)
    .map(([name, s]) => ({
      name,
      kills: s.kills,
      deaths: s.deaths,
      assists: s.assists,
      avgAdr: s.games > 0 ? s.adr / s.games : 0,
      avgRating: s.games > 0 ? s.rating / s.games : 0,
      games: s.games,
    }))
    .sort((a, b) => b.avgRating - a.avgRating)
    .slice(0, 5)

  const topMaps = Object.entries(mapCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)

  // ── Map-based grouping for the demo list ─────────────────────────────────────
  // Key = canonical map name; 'processing'/'unknown'/null all collapse to 'unknown'
  const mapGroupMap = new Map<string, { demos: DemoRowData[]; wins: number; losses: number; draws: number; lastActivity: string }>()

  for (const demo of demos) {
    const rawMap = (demo.parsed_data?.header?.map ?? demo.map ?? 'unknown').toLowerCase()
    const mapKey = (rawMap === 'processing' || rawMap === '') ? 'unknown' : rawMap

    if (!mapGroupMap.has(mapKey)) {
      mapGroupMap.set(mapKey, { demos: [], wins: 0, losses: 0, draws: 0, lastActivity: demo.created_at })
    }
    const g = mapGroupMap.get(mapKey)!
    g.demos.push(demo as unknown as DemoRowData)
    if (demo.created_at > g.lastActivity) g.lastActivity = demo.created_at

    if (demo.status === 'completed') {
      const h  = demo.parsed_data?.header
      const os = demo.parsed_data?.opponentSide ?? 'team2'
      if (h) {
        const ours   = os === 'team1' ? (h.score_team2 ?? 0) : (h.score_team1 ?? 0)
        const theirs = os === 'team1' ? (h.score_team1 ?? 0) : (h.score_team2 ?? 0)
        if (ours > theirs)        g.wins++
        else if (ours === theirs) g.draws++
        else                      g.losses++
      }
    }
  }

  // Sort: known maps by most-recent first; 'unknown' always last
  const mapGroups: MapGroup[] = [...mapGroupMap.entries()]
    .map(([map, data]) => ({ map, ...data }))
    .sort((a, b) => {
      if (a.map === 'unknown' && b.map !== 'unknown') return 1
      if (b.map === 'unknown' && a.map !== 'unknown') return -1
      return b.lastActivity.localeCompare(a.lastActivity)
    })

  const AI_QUICK_ACTIONS = [
    {
      href: `/ai-coach?mode=myteam&focus=weakness`,
      icon: <TrendingUp size={20} className="text-red-400" />,
      bg: 'bg-red-500/10 border-red-500/20',
      title: 'Weak Spots',
      description: 'Identify recurring mistakes and areas to improve',
    },
    {
      href: `/ai-coach?mode=myteam&focus=executes`,
      icon: <Zap size={20} className="text-yellow-400" />,
      bg: 'bg-yellow-500/10 border-yellow-500/20',
      title: 'Executes on Map',
      description: 'Review execute quality, utility usage, and timings',
    },
    {
      href: `/ai-coach?mode=myteam&focus=rounds`,
      icon: <BarChart3 size={20} className="text-blue-400" />,
      bg: 'bg-blue-500/10 border-blue-500/20',
      title: 'Round-by-Round',
      description: 'Analyse key rounds — clutches, eco plays, and late rounds',
    },
    {
      href: `/ai-coach?mode=myteam&focus=drills`,
      icon: <Crosshair size={20} className="text-purple-400" />,
      bg: 'bg-purple-500/10 border-purple-500/20',
      title: 'Practice Drills',
      description: 'Personalised drill recommendations based on your data',
    },
    {
      href: `/ai-coach?mode=myteam&focus=strategy`,
      icon: <Brain size={20} className="text-neon-green" />,
      bg: 'bg-neon-green/10 border-neon-green/20',
      title: 'Strategy Coach',
      description: 'Build a T-side and CT-side playbook tailored to your roster',
    },
  ]

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-in-up">
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-[0.15em] mb-1.5">My Team</p>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">{teamName}</h1>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">Your team&apos;s performance overview</p>
        </div>
        {/* Self-demo upload — marked demo_type='self' so it never leaks into Opponent folders */}
        {primaryTeamId && (
          <DemoUploadButton teamId={primaryTeamId} demoType="self" />
        )}
      </div>

      {/* Team Overview Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 animate-fade-in-up animate-fade-in-up-delay-1">
        <StatCard
          label="Matches"
          value={totalMatches || '—'}
          sub={totalMatches > 0 ? `${totalWins}W ${totalLosses}L ${totalDraws}D` : 'No demos yet'}
          icon={<Trophy size={16} className="text-yellow-400" />}
          accent="stat-card-amber"
        />
        <StatCard
          label="Win Rate"
          value={totalMatches > 0 ? `${Math.round(winRate * 100)}%` : '—'}
          sub={totalMatches > 0 ? `${totalWins} wins from ${totalMatches}` : 'Upload demos to track'}
          icon={<TrendingUp size={16} className="text-neon-green" />}
          highlight={winRate >= 0.5}
          accent="stat-card-green"
        />
        <StatCard
          label="Team K/D"
          value={avgKD}
          sub="Combined team ratio"
          icon={<Crosshair size={16} className="text-blue-400" />}
          accent="stat-card-blue"
        />
        <StatCard
          label="Avg ADR"
          value={avgAdr}
          sub="Avg damage per round"
          icon={<BarChart3 size={16} className="text-purple-400" />}
          accent="stat-card-purple"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in-up animate-fade-in-up-delay-2">
        {/* Left: Player stats + Map pool */}
        <div className="lg:col-span-2 space-y-5">
          {/* Top Players */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="h-[2px] w-full bg-gradient-to-r from-neon-green/50 via-neon-green/15 to-transparent" />
            <div className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-md bg-neon-green/15 flex items-center justify-center">
                  <Users size={13} className="text-neon-green" />
                </div>
                <h2 className="text-sm font-semibold text-foreground">Top Players</h2>
              </div>
              {topPlayers.length === 0 ? (
                <EmptyState
                  icon={<Users size={20} className="text-muted-foreground" />}
                  text="No player data yet. Upload and parse demos to see your roster's stats."
                />
              ) : (
                <div className="space-y-1">
                  {topPlayers.map((p, i) => (
                    <div key={p.name} className="flex items-center gap-3 py-2.5 border-b border-border/60 last:border-0">
                      <span className={cn(
                        'text-xs w-5 h-5 rounded-md flex items-center justify-center shrink-0 font-bold font-mono',
                        i === 0 ? 'bg-yellow-400/15 text-yellow-400' :
                        i === 1 ? 'bg-muted/80 text-muted-foreground' :
                                  'bg-transparent text-muted-foreground/60'
                      )}>{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.games} {p.games === 1 ? 'game' : 'games'}</p>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-right shrink-0">
                        <div>
                          <p className="text-muted-foreground text-[10px] uppercase tracking-wide">Rating</p>
                          <p className={cn('font-mono font-bold', p.avgRating >= 1.1 ? 'text-neon-green' : p.avgRating >= 0.9 ? 'text-foreground' : 'text-red-400')}>
                            {p.avgRating.toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-[10px] uppercase tracking-wide">ADR</p>
                          <p className="font-mono text-foreground font-medium">{p.avgAdr.toFixed(0)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-[10px] uppercase tracking-wide">K/D</p>
                          <p className="font-mono text-foreground font-medium">
                            {p.deaths > 0 ? (p.kills / p.deaths).toFixed(2) : '—'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Map Pool */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-md bg-neon-green/15 flex items-center justify-center">
                <MapIcon size={13} className="text-neon-green" />
              </div>
              <h2 className="text-sm font-semibold text-foreground">Map Pool</h2>
            </div>
            {topMaps.length === 0 ? (
              <EmptyState
                icon={<MapIcon size={20} className="text-muted-foreground" />}
                text="No map data yet."
              />
            ) : (
              <div className="flex flex-wrap gap-2">
                {topMaps.map(([map, count]) => (
                  <div key={map} className="flex items-center gap-2 px-3 py-1.5 bg-muted/40 hover:bg-muted/60 rounded-lg border border-border transition-colors">
                    <span className="text-sm font-medium text-foreground">{map.replace('de_', '')}</span>
                    <span className="text-xs font-mono text-neon-green bg-neon-green/10 px-1.5 py-0.5 rounded">{count}×</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* My Team's Demos — grouped by map */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <FileVideo size={16} className="text-neon-green" />
              <h2 className="text-sm font-semibold text-foreground">My Team&apos;s Demos</h2>
              {demos.length > 0 && (
                <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded font-mono">
                  {demos.length} · {mapGroups.filter(g => g.map !== 'unknown').length} maps
                </span>
              )}
            </div>
            {demos.length === 0 ? (
              <div className="bg-card border border-border rounded-xl">
                <EmptyState
                  icon={<FileVideo size={20} className="text-muted-foreground" />}
                  text="No team demos uploaded yet. Use the Upload button above to add your team's own demos."
                />
              </div>
            ) : (
              <MapFolderList mapGroups={mapGroups} />
            )}
          </div>
        </div>

        {/* Right: AI Quick Actions */}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="h-[2px] w-full bg-gradient-to-r from-neon-green/50 via-neon-green/15 to-transparent" />
            <div className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-md bg-neon-green/15 flex items-center justify-center">
                <Brain size={13} className="text-neon-green" />
              </div>
              <h2 className="text-sm font-semibold text-foreground">AI Analyst</h2>
              <Badge variant="neon" className="text-xs ml-auto">Llama 3.3</Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
              Analyse your team&apos;s demos to identify weaknesses, improve executes, and build your playbook.
            </p>
            <div className="space-y-2">
              {AI_QUICK_ACTIONS.map(action => (
                <Link
                  key={action.href}
                  href={action.href}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg border transition-all group',
                    action.bg,
                    'hover:brightness-110'
                  )}
                >
                  <div className="shrink-0">{action.icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{action.title}</p>
                    <p className="text-xs text-muted-foreground leading-tight mt-0.5">{action.description}</p>
                  </div>
                  <ArrowRight size={14} className="text-muted-foreground group-hover:text-foreground shrink-0 transition-colors" />
                </Link>
              ))}
            </div>
            </div>{/* /p-5 */}
          </div>{/* /card */}

          {totalMatches === 0 && primaryTeamId && (
            <div className="bg-card border border-border rounded-xl p-5 text-center">
              <FileVideo size={24} className="text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground mb-1">Upload your demos</p>
              <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                Upload your team's own match demos to unlock performance analysis.
              </p>
              <DemoUploadButton teamId={primaryTeamId} demoType="self" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label, value, sub, icon, highlight, accent,
}: {
  label: string
  value: string | number
  sub: string
  icon: React.ReactNode
  highlight?: boolean
  accent?: string
}) {
  return (
    <div className={cn('relative bg-card border border-border rounded-xl p-4 card-hover overflow-hidden', accent)}>
      <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
      <div className="relative flex items-center justify-between mb-2">
        <p className="text-[11px] text-muted-foreground uppercase tracking-[0.12em] font-semibold">{label}</p>
        {icon}
      </div>
      <p className={cn('text-2xl font-bold tracking-tight tabular-nums', highlight ? 'text-neon-green' : 'text-foreground')}>{value}</p>
      <p className="text-xs text-muted-foreground/70 mt-0.5">{sub}</p>
    </div>
  )
}

function EmptyState({
  icon, text, action,
}: {
  icon: React.ReactNode
  text: string
  action?: { href: string; label: string }
}) {
  return (
    <div className="flex flex-col items-center py-6 text-center">
      <div className="mb-2 opacity-50">{icon}</div>
      <p className="text-sm text-muted-foreground">{text}</p>
      {action && (
        <Link href={action.href} className="mt-2 text-xs text-neon-green hover:underline">
          {action.label}
        </Link>
      )}
    </div>
  )
}
