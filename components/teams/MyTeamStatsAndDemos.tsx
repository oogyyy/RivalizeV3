'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import {
  Trophy, TrendingUp, Crosshair, BarChart3,
  Users, Map as MapIcon, FileVideo, Brain, Zap, ArrowRight,
} from 'lucide-react'
import DemoUploadButton from '@/components/teams/DemoUploadButton'
import MapFolderList, { type MapGroup } from '@/components/teams/MapFolderList'
import PerformanceTrends from '@/components/teams/PerformanceTrends'
import type { DemoRowData } from '@/components/teams/DemoListMultiSelect'

// ── Stats computation (mirrors page.tsx server-side logic) ─────────────────────

function computeStats(demos: DemoRowData[]) {
  const completedDemos = demos.filter(d => d.status === 'completed')
  let totalMatches = 0, totalWins = 0, totalDraws = 0
  let totalKills = 0, totalDeaths = 0, totalAdr = 0, playerCount = 0
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
      const opponentLabel = opponentSide === 'team1' ? (h?.team1 ?? 'T-Side') : (h?.team2 ?? 'CT-Side')
      for (const p of pd.players) {
        if (p.team === opponentLabel) continue
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

  const totalLosses = totalMatches - totalWins - totalDraws
  const winRate     = totalMatches > 0 ? totalWins / totalMatches : 0
  const avgKD       = totalDeaths > 0 ? (totalKills / totalDeaths).toFixed(2) : '—'
  const avgAdr      = playerCount  > 0 ? (totalAdr  / playerCount).toFixed(1)  : '—'

  const topPlayers = Object.entries(myPlayerStats)
    .map(([name, s]) => ({
      name,
      kills: s.kills,
      deaths: s.deaths,
      avgAdr:    s.games > 0 ? s.adr    / s.games : 0,
      avgRating: s.games > 0 ? s.rating / s.games : 0,
      games: s.games,
    }))
    .sort((a, b) => b.avgRating - a.avgRating)

  const topMaps = Object.entries(mapCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)

  return { totalMatches, totalWins, totalLosses, totalDraws, winRate, avgKD, avgAdr, topPlayers, topMaps }
}

const ACTIVE_DUTY_MAPS = [
  'de_ancient', 'de_anubis', 'de_dust2', 'de_inferno',
  'de_mirage', 'de_nuke', 'de_overpass',
]

function buildMapGroups(demos: DemoRowData[]): MapGroup[] {
  const mapGroupMap = new Map<string, { demos: DemoRowData[]; wins: number; losses: number; draws: number; lastActivity: string }>()

  // Pre-seed all active duty maps so they always appear as folders
  for (const map of ACTIVE_DUTY_MAPS) {
    mapGroupMap.set(map, { demos: [], wins: 0, losses: 0, draws: 0, lastActivity: '' })
  }

  for (const demo of demos) {
    const rawMap = (demo.parsed_data?.header?.map ?? demo.map ?? 'unknown').toLowerCase()
    const mapKey = (rawMap === 'processing' || rawMap === '') ? 'unknown' : rawMap

    if (!mapGroupMap.has(mapKey)) {
      mapGroupMap.set(mapKey, { demos: [], wins: 0, losses: 0, draws: 0, lastActivity: demo.created_at })
    }
    const g = mapGroupMap.get(mapKey)!
    g.demos.push(demo)
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

  return [...mapGroupMap.entries()]
    .map(([map, data]) => ({ map, ...data }))
    .sort((a, b) => {
      const aHasDemos = a.demos.length > 0
      const bHasDemos = b.demos.length > 0
      // Folders with demos come first
      if (aHasDemos !== bHasDemos) return aHasDemos ? -1 : 1
      if (aHasDemos) {
        // Both have demos: most recently active first
        return b.lastActivity.localeCompare(a.lastActivity)
      }
      // Both empty: preserve fixed active duty order
      const aIdx = ACTIVE_DUTY_MAPS.indexOf(a.map)
      const bIdx = ACTIVE_DUTY_MAPS.indexOf(b.map)
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx
      if (aIdx !== -1) return -1
      if (bIdx !== -1) return 1
      if (a.map === 'unknown') return 1
      if (b.map === 'unknown') return -1
      return 0
    })
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon, iconBg, highlight, accent,
}: {
  label: string
  value: string | number
  sub: string
  icon: React.ReactNode
  iconBg: string
  highlight?: boolean
  accent?: string
}) {
  return (
    <div className={cn('relative bg-card border border-border rounded-xl p-4 card-hover overflow-hidden', accent)}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] text-muted-foreground/60 uppercase tracking-[0.12em] font-semibold">{label}</p>
        <div className={cn('p-1.5 rounded-lg shrink-0', iconBg)}>{icon}</div>
      </div>
      <p className={cn(
        'text-[26px] font-bold tracking-tight tabular-nums font-mono leading-none',
        highlight ? 'text-[#2DE3CE]' : 'text-foreground'
      )}>{value}</p>
      <p className="text-[11px] text-muted-foreground/50 mt-1">{sub}</p>
    </div>
  )
}

function EmptyState({ icon, text, action }: {
  icon: React.ReactNode
  text: string
  action?: { href: string; label: string }
}) {
  return (
    <div className="flex flex-col items-center py-8 text-center">
      <div className="mb-2">{icon}</div>
      <p className="text-[13px] text-muted-foreground max-w-xs leading-relaxed">{text}</p>
      {action && (
        <Link href={action.href} className="mt-2 text-[12px] text-[#2DE3CE] hover:underline">
          {action.label}
        </Link>
      )}
    </div>
  )
}

const AI_QUICK_ACTIONS = [
  {
    href: `/ai-coach?mode=myteam&focus=weakness`,
    icon: <TrendingUp size={16} className="text-red-400" />,
    iconBg: 'bg-red-500/10 border-red-500/15',
    title: 'Weak Spots',
    description: 'Identify recurring mistakes and areas to improve',
  },
  {
    href: `/ai-coach?mode=myteam&focus=executes`,
    icon: <Zap size={16} className="text-amber-400" />,
    iconBg: 'bg-amber-500/10 border-amber-500/15',
    title: 'Executes',
    description: 'Review execute quality, utility usage, and timings',
  },
  {
    href: `/ai-coach?mode=myteam&focus=rounds`,
    icon: <BarChart3 size={16} className="text-blue-400" />,
    iconBg: 'bg-blue-500/10 border-blue-500/15',
    title: 'Round Review',
    description: 'Analyse clutches, eco plays, and late rounds',
  },
  {
    href: `/ai-coach?mode=myteam&focus=drills`,
    icon: <Crosshair size={16} className="text-violet-400" />,
    iconBg: 'bg-violet-500/10 border-violet-500/15',
    title: 'Practice Drills',
    description: 'Personalised drill recommendations',
  },
  {
    href: `/ai-coach?mode=myteam&focus=strategy`,
    icon: <Brain size={16} className="text-[#2DE3CE]" />,
    iconBg: 'bg-[rgba(45,227,206,0.1)] border-[rgba(45,227,206,0.15)]',
    title: 'Strategy Coach',
    description: 'Build a playbook tailored to your roster',
  },
]

// ── Main component ─────────────────────────────────────────────────────────────

export default function MyTeamStatsAndDemos({
  initialDemos,
  primaryTeamId,
}: {
  initialDemos: DemoRowData[]
  primaryTeamId: string | null
  faceitNickname?: string | null  // kept in props signature for back-compat, no longer used here
}) {
  // Store only the user's manual overrides — resilient to router.refresh() changing initialDemos
  const [sideOverrides, setSideOverrides] = useState<Record<string, 'team1' | 'team2'>>({})

  const effectiveDemos = useMemo(() => {
    if (Object.keys(sideOverrides).length === 0) return initialDemos
    return initialDemos.map(d => {
      const override = sideOverrides[d.id]
      return override
        ? { ...d, parsed_data: d.parsed_data ? { ...d.parsed_data, opponentSide: override } : { opponentSide: override } }
        : d
    })
  }, [initialDemos, sideOverrides])

  function handleSideChange(demoId: string, opponentSide: 'team1' | 'team2') {
    setSideOverrides(prev => ({ ...prev, [demoId]: opponentSide }))
  }

  const { totalMatches, totalWins, totalLosses, totalDraws, winRate, avgKD, avgAdr, topPlayers, topMaps } =
    computeStats(effectiveDemos)
  const mapGroups = buildMapGroups(effectiveDemos)

  return (
    <>
      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 animate-fade-in-up animate-fade-in-up-delay-1">
        <StatCard
          label="Matches"
          value={totalMatches || '—'}
          sub={totalMatches > 0 ? `${totalWins}W ${totalLosses}L ${totalDraws}D` : 'No demos yet'}
          icon={<Trophy size={15} className="text-amber-400" />}
          iconBg="bg-amber-500/10"
          accent="stat-card-amber"
        />
        <StatCard
          label="Win Rate"
          value={totalMatches > 0 ? `${Math.round(winRate * 100)}%` : '—'}
          sub={totalMatches > 0 ? `${totalWins} wins from ${totalMatches}` : 'Upload demos to track'}
          icon={<TrendingUp size={15} className="text-[#2DE3CE]" />}
          iconBg="bg-[rgba(45,227,206,0.1)]"
          accent="stat-card-green"
          highlight={winRate >= 0.5}
        />
        <StatCard
          label="Team K/D"
          value={avgKD}
          sub="Combined team ratio"
          icon={<Crosshair size={15} className="text-blue-400" />}
          iconBg="bg-blue-500/10"
          accent="stat-card-blue"
        />
        <StatCard
          label="Avg ADR"
          value={avgAdr}
          sub="Avg damage per round"
          icon={<BarChart3 size={15} className="text-violet-400" />}
          iconBg="bg-violet-500/10"
          accent="stat-card-purple"
        />
      </div>

      {/* ── Performance + AI Analyst ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 animate-fade-in-up animate-fade-in-up-delay-2">
        {/* Left: Performance Trends + Win rate by map */}
        <div className="lg:col-span-2 space-y-5">
          {effectiveDemos.filter(d => d.status === 'completed').length >= 2 && (
            <PerformanceTrends demos={effectiveDemos} />
          )}

          {/* Win rate by map */}
          {mapGroups.filter(g => g.demos.length > 0).length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-[13px] font-semibold text-foreground mb-4">Win rate by map</h2>
              <div className="space-y-3">
                {mapGroups.filter(g => g.demos.length > 0).map(group => {
                  const total = group.wins + group.losses + group.draws
                  const winRate = total > 0 ? (group.wins / total * 100) : 0
                  return (
                    <div key={group.map}>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[13px] text-foreground">{group.map.replace('de_', '')}</span>
                        <span className="text-[13px] font-mono text-[#2DE3CE]">{Math.round(winRate)}%</span>
                      </div>
                      <div className="h-2 bg-border rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-cyan-400"
                          style={{ width: `${winRate}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right: AI Analyst */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="accent-line-green w-full" />
            <div className="p-5">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-md bg-[rgba(45,227,206,0.1)] flex items-center justify-center">
                  <Brain size={13} className="text-[#2DE3CE]" />
                </div>
                <h2 className="text-[13px] font-semibold text-foreground">AI Analyst</h2>
                <Badge variant="neon" className="ml-auto text-[10px]">Llama 3.3</Badge>
              </div>
              <p className="text-[12px] text-muted-foreground mb-4 leading-relaxed">
                Analyse your demos to identify weaknesses, improve executes, and build your playbook.
              </p>
              <div className="space-y-1.5">
                {AI_QUICK_ACTIONS.map(action => (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border/60 hover:border-border bg-transparent hover:bg-accent/50 transition-all group"
                  >
                    <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border', action.iconBg)}>
                      {action.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-foreground">{action.title}</p>
                      <p className="text-[11px] text-muted-foreground/60 leading-tight mt-0.5">{action.description}</p>
                    </div>
                    <ArrowRight size={13} className="text-muted-foreground/40 group-hover:text-foreground shrink-0 transition-colors" />
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {totalMatches === 0 && primaryTeamId && (
            <div className="rounded-xl border border-dashed border-border bg-card/50 p-5 text-center">
              <FileVideo size={22} className="text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-[13px] font-medium text-foreground mb-1">Upload your demos</p>
              <p className="text-[12px] text-muted-foreground mb-4 leading-relaxed">
                Upload your team&apos;s own match demos to unlock performance analysis.
              </p>
              <DemoUploadButton teamId={primaryTeamId} demoType="self" />
            </div>
          )}
        </div>
      </div>

      {/* ── Roster + Map Performance ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 animate-fade-in-up animate-fade-in-up-delay-3">
        {/* Roster */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="accent-line-green w-full" />
            <div className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-md bg-[rgba(45,227,206,0.1)] flex items-center justify-center">
                  <Users size={13} className="text-[#2DE3CE]" />
                </div>
                <h2 className="text-[13px] font-semibold text-foreground">Roster</h2>
              </div>
              {topPlayers.length === 0 ? (
                <EmptyState
                  icon={<Users size={18} className="text-muted-foreground/40" />}
                  text="No player data yet. Upload and parse demos to see your roster's stats."
                />
              ) : (
                <div>
                  <div className="grid grid-cols-[1fr_56px_48px_48px] gap-2 px-2 pb-2 border-b border-border/50">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">Player</p>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 text-right">Rating</p>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 text-right">ADR</p>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 text-right">K/D</p>
                  </div>
                  <div>
                    {topPlayers.map((p, i) => (
                      <Link
                        key={p.name}
                        href={`/my-team/player/${encodeURIComponent(p.name)}`}
                        className="grid grid-cols-[1fr_56px_48px_48px] gap-2 px-2 py-2.5 border-b border-border/30 last:border-0 items-center hover:bg-accent/40 rounded-lg transition-colors group"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={cn(
                            'text-[10px] w-5 h-5 rounded-md flex items-center justify-center shrink-0 font-bold font-mono',
                            i === 0 ? 'bg-amber-400/15 text-amber-400' :
                            i === 1 ? 'bg-muted/80 text-muted-foreground' :
                                      'text-muted-foreground/50'
                          )}>{i + 1}</span>
                          <div className="min-w-0">
                            <p className="text-[13px] font-medium text-foreground group-hover:text-[#2DE3CE] transition-colors truncate">{p.name}</p>
                            <p className="text-[10px] text-muted-foreground/50">{p.games} {p.games === 1 ? 'game' : 'games'} · view stats →</p>
                          </div>
                        </div>
                        <p className={cn(
                          'font-mono text-[13px] font-bold text-right',
                          p.avgRating >= 1.1 ? 'text-[#2DE3CE]' : p.avgRating >= 0.9 ? 'text-foreground' : 'text-red-400'
                        )}>
                          {p.avgRating.toFixed(2)}
                        </p>
                        <p className="font-mono text-[12px] text-muted-foreground text-right">{p.avgAdr.toFixed(0)}</p>
                        <p className="font-mono text-[12px] text-muted-foreground text-right">
                          {p.deaths > 0 ? (p.kills / p.deaths).toFixed(2) : '—'}
                        </p>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Map Performance */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-md bg-[rgba(45,227,206,0.1)] flex items-center justify-center">
                <BarChart3 size={13} className="text-[#2DE3CE]" />
              </div>
              <h2 className="text-[13px] font-semibold text-foreground">Map Performance</h2>
            </div>
            {mapGroups.filter(g => g.demos.length > 0).length === 0 ? (
              <EmptyState
                icon={<BarChart3 size={18} className="text-muted-foreground/40" />}
                text="No map data yet."
              />
            ) : (
              <div className="space-y-3">
                {mapGroups.filter(g => g.demos.length > 0 && g.map !== 'unknown').slice(0, 6).map(group => {
                  const total = group.wins + group.losses + group.draws
                  const ctRate = total > 0 ? (group.wins / total * 100) : 0
                  const tRate = 100 - ctRate
                  return (
                    <div key={group.map}>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[13px] text-foreground">{group.map.replace('de_', '')}</span>
                        <div className="flex gap-2 text-[11px] font-mono">
                          <span className="text-blue-400">CT {Math.round(ctRate)}%</span>
                          <span className="text-amber-400">T {Math.round(tRate)}%</span>
                        </div>
                      </div>
                      <div className="h-2 bg-border rounded-full overflow-hidden flex">
                        <div
                          className="h-full bg-blue-500"
                          style={{ width: `${ctRate}%` }}
                        />
                        <div
                          className="h-full bg-amber-500"
                          style={{ width: `${tRate}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

      {/* ── Map Pool + Demos ── */}
      <div className="space-y-5 animate-fade-in-up animate-fade-in-up-delay-3">
        {/* Map Pool */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-md bg-[rgba(45,227,206,0.1)] flex items-center justify-center">
              <MapIcon size={13} className="text-[#2DE3CE]" />
            </div>
            <h2 className="text-[13px] font-semibold text-foreground">Map Pool</h2>
          </div>
          {topMaps.length === 0 ? (
            <EmptyState
              icon={<MapIcon size={18} className="text-muted-foreground/40" />}
              text="No map data yet."
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              {topMaps.map(([map, count]) => (
                <div key={map} className="flex items-center gap-2 px-3 py-1.5 bg-accent/50 hover:bg-accent/80 rounded-lg border border-border/60 transition-colors">
                  <span className="text-[13px] font-medium text-foreground">{map.replace('de_', '')}</span>
                  <span className="text-[11px] font-mono text-[#2DE3CE] bg-[rgba(45,227,206,0.1)] px-1.5 py-0.5 rounded">{count}×</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Demo list */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <FileVideo size={15} className="text-[#2DE3CE]" />
            <h2 className="text-[13px] font-semibold text-foreground">My Team&apos;s Demos</h2>
            {effectiveDemos.length > 0 && (
              <span className="text-[10px] text-muted-foreground bg-accent/60 px-1.5 py-0.5 rounded font-mono">
                {effectiveDemos.length} · {mapGroups.filter(g => g.demos.length > 0 && g.map !== 'unknown').length} maps
              </span>
            )}
          </div>
          <MapFolderList mapGroups={mapGroups} onSideChange={handleSideChange} />
        </div>
      </div>
    </>
  )
}
