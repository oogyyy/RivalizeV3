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

// ── Stats computation (unchanged) ─────────────────────────────────────────────

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
      const ourScore   = opponentSide === 'team1' ? (h.score_team2 ?? 0) : (h.score_team1 ?? 0)
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
      kills:     s.kills,
      deaths:    s.deaths,
      assists:   s.assists,
      avgAdr:    s.games > 0 ? s.adr    / s.games : 0,
      avgRating: s.games > 0 ? s.rating / s.games : 0,
      games:     s.games,
    }))
    .sort((a, b) => b.avgRating - a.avgRating)

  const topMaps = Object.entries(mapCounts).sort((a, b) => b[1] - a[1]).slice(0, 3)

  return { totalMatches, totalWins, totalLosses, totalDraws, winRate, avgKD, avgAdr, topPlayers, topMaps }
}

const ACTIVE_DUTY_MAPS = [
  'de_ancient', 'de_anubis', 'de_dust2', 'de_inferno',
  'de_mirage', 'de_nuke', 'de_overpass',
]

function buildMapGroups(demos: DemoRowData[]): MapGroup[] {
  const mapGroupMap = new Map<string, { demos: DemoRowData[]; wins: number; losses: number; draws: number; lastActivity: string }>()

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
      if (aHasDemos !== bHasDemos) return aHasDemos ? -1 : 1
      if (aHasDemos) return b.lastActivity.localeCompare(a.lastActivity)
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

// ── Visual helpers ─────────────────────────────────────────────────────────────

const AVATAR_PALETTE = [
  { bg: 'rgba(112,71,235,0.18)', border: 'rgba(112,71,235,0.35)', text: '#7047eb' },
  { bg: 'rgba(20,184,166,0.18)', border: 'rgba(20,184,166,0.35)', text: '#14b8a6' },
  { bg: 'rgba(244,63,94,0.18)',  border: 'rgba(244,63,94,0.35)',  text: '#f43f5e' },
  { bg: 'rgba(245,158,11,0.18)', border: 'rgba(245,158,11,0.35)', text: '#f59e0b' },
  { bg: 'rgba(59,130,246,0.18)', border: 'rgba(59,130,246,0.35)', text: '#3b82f6' },
]

function hashColor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length]
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/)
  return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase()
}

// Heuristic: sort by rating → assign roles in order
const ROLE_ORDER = ['IGL', 'AWP', 'RIFLER', 'SUPPORT', 'RIFLER'] as const
const ROLE_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  IGL:     { bg: 'rgba(112,71,235,0.15)', color: '#7047eb', border: 'rgba(112,71,235,0.3)' },
  AWP:     { bg: 'rgba(20,184,166,0.12)', color: '#14b8a6', border: 'rgba(20,184,166,0.3)' },
  RIFLER:  { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: 'rgba(245,158,11,0.3)' },
  SUPPORT: { bg: 'rgba(244,63,94,0.12)',  color: '#f43f5e', border: 'rgba(244,63,94,0.3)'  },
}

const TOP_PERFORMER_LABELS = ['RATING LEADER', 'FRAG CARRIER', 'SUPPORT KING']

const AI_QUICK_ACTIONS = [
  {
    href: `/ai-coach?mode=myteam&focus=weakness`,
    icon: <TrendingUp size={15} className="text-red-400" />,
    iconBg: 'bg-red-500/10 border-red-500/15',
    title: 'Weak Spots',
    description: 'Identify recurring mistakes and areas to improve',
  },
  {
    href: `/ai-coach?mode=myteam&focus=executes`,
    icon: <Zap size={15} className="text-amber-400" />,
    iconBg: 'bg-amber-500/10 border-amber-500/15',
    title: 'Executes',
    description: 'Review execute quality, utility usage, and timings',
  },
  {
    href: `/ai-coach?mode=myteam&focus=rounds`,
    icon: <BarChart3 size={15} className="text-blue-400" />,
    iconBg: 'bg-blue-500/10 border-blue-500/15',
    title: 'Round Review',
    description: 'Analyse clutches, eco plays, and late rounds',
  },
  {
    href: `/ai-coach?mode=myteam&focus=drills`,
    icon: <Crosshair size={15} className="text-violet-400" />,
    iconBg: 'bg-violet-500/10 border-violet-500/15',
    title: 'Practice Drills',
    description: 'Personalised drill recommendations',
  },
  {
    href: `/ai-coach?mode=myteam&focus=strategy`,
    icon: <Brain size={15} className="text-[#00ffc8]" />,
    iconBg: 'bg-[rgba(0,255,200,0.1)] border-[rgba(0,255,200,0.15)]',
    title: 'Strategy Coach',
    description: 'Build a playbook tailored to your roster',
  },
]

// ── Main component ─────────────────────────────────────────────────────────────

export default function MyTeamStatsAndDemos({
  initialDemos,
  primaryTeamId,
  teamName = 'My Team',
  memberCount = 0,
}: {
  initialDemos: DemoRowData[]
  primaryTeamId: string | null
  faceitNickname?: string | null  // kept for back-compat
  teamName?: string
  memberCount?: number
}) {
  const [sideOverrides, setSideOverrides] = useState<Record<string, 'team1' | 'team2'>>({})
  const [selectedPlayerName, setSelectedPlayerName] = useState<string | null>(null)

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

  // Team-level form for the last 5 completed demos (shared across all players)
  const teamForm = useMemo(() =>
    effectiveDemos
      .filter(d => d.status === 'completed')
      .slice(0, 5)
      .map(d => {
        const h = d.parsed_data?.header
        const os = d.parsed_data?.opponentSide ?? 'team2'
        const ours   = os === 'team1' ? (h?.score_team2 ?? 0) : (h?.score_team1 ?? 0)
        const theirs = os === 'team1' ? (h?.score_team1 ?? 0) : (h?.score_team2 ?? 0)
        return ours > theirs ? 'W' : ours < theirs ? 'L' : 'D'
      })
      .reverse(),
  [effectiveDemos])

  // Recent results for history table
  const recentResults = useMemo(() =>
    effectiveDemos
      .filter(d => d.status === 'completed')
      .slice(0, 8)
      .map(d => {
        const h  = d.parsed_data?.header
        const os = d.parsed_data?.opponentSide ?? 'team2'
        const ours   = os === 'team1' ? (h?.score_team2 ?? 0) : (h?.score_team1 ?? 0)
        const theirs = os === 'team1' ? (h?.score_team1 ?? 0) : (h?.score_team2 ?? 0)
        const outcome = ours > theirs ? 'W' : ours < theirs ? 'L' : 'D'
        const rawMap = (h?.map ?? d.map ?? '').replace('de_', '')
        const mapName = rawMap ? rawMap.charAt(0).toUpperCase() + rawMap.slice(1) : 'Unknown'
        const opp = d.opponent_slug
          ? d.opponent_slug.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
          : 'Unknown'
        const dateStr = new Date(d.match_date ?? d.created_at)
          .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        return { opponent: opp, map: mapName, outcome, score: h ? `${ours}-${theirs}` : '—', date: dateStr }
      }),
  [effectiveDemos])

  // Banner stats
  const avgRatingBanner = topPlayers.length > 0
    ? (topPlayers.reduce((s, p) => s + p.avgRating, 0) / topPlayers.length).toFixed(2)
    : '—'
  const totalMapsPlayed = topPlayers.reduce((s, p) => s + p.games, 0) || totalMatches

  const selectedPlayerData = topPlayers.find(p => p.name === selectedPlayerName) ?? null
  const selectedPlayerIdx  = topPlayers.findIndex(p => p.name === selectedPlayerName)

  return (
    <div className="space-y-5">

      {/* ── TEAM BANNER ── */}
      <div
        className="rounded-2xl overflow-hidden animate-fade-in-up"
        style={{ background: '#0f111e', border: '1px solid rgba(112,71,235,0.3)' }}
      >
        <div
          className="px-6 py-5 flex items-center justify-between gap-4 flex-wrap"
          style={{ background: 'linear-gradient(135deg, rgba(112,71,235,0.1), transparent)' }}
        >
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: '#7047eb' }}>
              ROSTER PARAMETERS
            </p>
            <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
              {teamName}
            </h2>
          </div>
          <div className="flex items-center gap-8">
            {[
              { label: 'PLAYERS',    value: topPlayers.length > 0 ? topPlayers.length : memberCount || '—', color: '#fff' },
              { label: 'AVG RATING', value: avgRatingBanner, color: '#14b8a6' },
              { label: 'TOTAL MAPS', value: totalMapsPlayed || '—', color: '#f43f5e' },
            ].map(({ label, value, color }) => (
              <div key={label} className="text-right">
                <p className="text-2xl font-bold font-mono" style={{ color }}>{value}</p>
                <p className="text-[9px] font-mono uppercase tracking-widest mt-0.5" style={{ color: '#4b5563' }}>{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── PERFORMANCE TRENDS (when enough data) ── */}
      {effectiveDemos.filter(d => d.status === 'completed').length >= 2 && (
        <div className="animate-fade-in-up">
          <PerformanceTrends demos={effectiveDemos} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 animate-fade-in-up">

        {/* ── LEFT: roster + results + demo archive ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* ACTIVE TEAM ROSTER */}
          <div className="rounded-2xl overflow-hidden" style={{ background: '#0f111e', border: '1px solid #1e2238' }}>
            <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: '1px solid #1e2238' }}>
              <Users size={14} style={{ color: '#7047eb' }} />
              <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#4b5563' }}>
                Active Team Roster
              </span>
              {topPlayers.length > 0 && (
                <span className="ml-auto text-[9px] font-mono" style={{ color: '#374151' }}>
                  Click a row to inspect
                </span>
              )}
            </div>

            {topPlayers.length === 0 ? (
              <div className="px-5 py-10 flex flex-col items-center text-center">
                <Users size={24} className="mb-2" style={{ color: '#374151' }} />
                <p className="text-sm" style={{ color: '#6b7280' }}>
                  No player data yet. Upload and parse demos to see your roster's stats.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: '1px solid #1e2238' }}>
                      {['PLAYER', 'ROLE', 'RATING', 'K/D', 'MAPS', 'RECENT FORM', 'ACTION'].map(col => (
                        <th
                          key={col}
                          className="text-left px-4 py-3 text-[9px] font-mono uppercase tracking-widest whitespace-nowrap"
                          style={{ color: '#4b5563' }}
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {topPlayers.map((p, idx) => {
                      const color     = hashColor(p.name)
                      const inits     = getInitials(p.name)
                      const role      = ROLE_ORDER[Math.min(idx, ROLE_ORDER.length - 1)]
                      const roleStyle = ROLE_STYLE[role]
                      const kd        = p.deaths > 0 ? (p.kills / p.deaths).toFixed(2) : '—'
                      const isSelected = selectedPlayerName === p.name

                      return (
                        <tr
                          key={p.name}
                          onClick={() => setSelectedPlayerName(isSelected ? null : p.name)}
                          className="cursor-pointer transition-colors"
                          style={{
                            borderBottom: '1px solid rgba(30,34,56,0.5)',
                            background: isSelected ? 'rgba(112,71,235,0.08)' : 'transparent',
                          }}
                          onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,0.02)' }}
                          onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLTableRowElement).style.background = 'transparent' }}
                        >
                          {/* Player avatar + name */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-2.5">
                              <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold border shrink-0"
                                style={{ background: color.bg, borderColor: color.border, color: color.text }}
                              >
                                {inits}
                              </div>
                              <span className="text-sm font-semibold text-white">{p.name}</span>
                            </div>
                          </td>

                          {/* Role */}
                          <td className="px-4 py-3">
                            <span
                              className="text-[9px] font-mono uppercase px-2 py-0.5 rounded border whitespace-nowrap"
                              style={{ background: roleStyle.bg, color: roleStyle.color, borderColor: roleStyle.border }}
                            >
                              {role}
                            </span>
                          </td>

                          {/* Rating */}
                          <td className="px-4 py-3">
                            <span
                              className="text-sm font-mono font-bold"
                              style={{ color: p.avgRating >= 1.1 ? '#14b8a6' : p.avgRating >= 0.9 ? '#d1d5db' : '#f43f5e' }}
                            >
                              {p.avgRating.toFixed(2)}
                            </span>
                          </td>

                          {/* K/D */}
                          <td className="px-4 py-3">
                            <span className="text-sm font-mono" style={{ color: '#9ca3af' }}>{kd}</span>
                          </td>

                          {/* Maps */}
                          <td className="px-4 py-3">
                            <span className="text-sm font-mono" style={{ color: '#9ca3af' }}>{p.games}</span>
                          </td>

                          {/* Recent form dots */}
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              {(teamForm.length > 0 ? teamForm : Array(5).fill('W')).slice(0, 5).map((f, i) => (
                                <span
                                  key={i}
                                  className="w-3.5 h-3.5 rounded-full shrink-0"
                                  style={{
                                    background: f === 'W' ? '#10b981' : f === 'L' ? '#f43f5e' : '#f59e0b',
                                  }}
                                />
                              ))}
                            </div>
                          </td>

                          {/* Action — navigate to player page */}
                          <td className="px-4 py-3">
                            <Link
                              href={`/my-team/player/${encodeURIComponent(p.name)}`}
                              onClick={e => e.stopPropagation()}
                              className="p-1.5 rounded-lg transition-colors inline-flex"
                              style={{ color: '#f43f5e', background: 'rgba(244,63,94,0.1)' }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(244,63,94,0.2)')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(244,63,94,0.1)')}
                            >
                              <ArrowRight size={12} />
                            </Link>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* RECENT RESULTS HISTORY */}
          {recentResults.length > 0 && (
            <div className="rounded-2xl overflow-hidden" style={{ background: '#0f111e', border: '1px solid #1e2238' }}>
              <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: '1px solid #1e2238' }}>
                <Trophy size={14} style={{ color: '#14b8a6' }} />
                <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#4b5563' }}>
                  Recent Results History
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: '1px solid #1e2238' }}>
                      {['OPPONENT', 'MAP', 'OUTCOME', 'SCORE', 'DATE'].map(col => (
                        <th
                          key={col}
                          className="text-left px-5 py-2.5 text-[9px] font-mono uppercase tracking-widest"
                          style={{ color: '#4b5563' }}
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recentResults.map((r, idx) => (
                      <tr
                        key={idx}
                        style={{ borderBottom: idx < recentResults.length - 1 ? '1px solid rgba(30,34,56,0.5)' : 'none' }}
                      >
                        <td className="px-5 py-3 text-sm font-semibold text-white whitespace-nowrap">{r.opponent}</td>
                        <td className="px-5 py-3 text-sm" style={{ color: '#9ca3af' }}>{r.map}</td>
                        <td className="px-5 py-3">
                          <span
                            className="text-[10px] font-mono font-bold px-2 py-0.5 rounded"
                            style={{
                              background: r.outcome === 'W' ? 'rgba(16,185,129,0.15)' : r.outcome === 'L' ? 'rgba(244,63,94,0.15)' : 'rgba(245,158,11,0.15)',
                              color:      r.outcome === 'W' ? '#10b981' : r.outcome === 'L' ? '#f43f5e' : '#f59e0b',
                            }}
                          >
                            {r.outcome}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-sm font-mono" style={{ color: '#9ca3af' }}>{r.score}</td>
                        <td className="px-5 py-3 text-sm font-mono whitespace-nowrap" style={{ color: '#6b7280' }}>{r.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* DEMO ARCHIVE (MapFolderList) */}
          <div className="rounded-2xl overflow-hidden" style={{ background: '#0f111e', border: '1px solid #1e2238' }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #1e2238' }}>
              <div className="flex items-center gap-2">
                <FileVideo size={14} style={{ color: '#14b8a6' }} />
                <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#4b5563' }}>
                  Demo Archive
                </span>
                {effectiveDemos.length > 0 && (
                  <span
                    className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                    style={{ background: '#1e2238', color: '#6b7280' }}
                  >
                    {effectiveDemos.length} demos · {mapGroups.filter(g => g.demos.length > 0 && g.map !== 'unknown').length} maps
                  </span>
                )}
              </div>
              {primaryTeamId && <DemoUploadButton teamId={primaryTeamId} demoType="self" />}
            </div>
            <div className="p-4">
              <MapFolderList mapGroups={mapGroups} onSideChange={handleSideChange} />
            </div>
          </div>
        </div>

        {/* ── RIGHT: player board + top performers + AI actions ── */}
        <div className="space-y-5">

          {/* PLAYER CONTROL BOARD */}
          <div className="rounded-2xl overflow-hidden" style={{ background: '#0f111e', border: '1px solid #1e2238' }}>
            <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: '1px solid #1e2238' }}>
              <Crosshair size={14} style={{ color: '#7047eb' }} />
              <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#4b5563' }}>
                Player Control Board
              </span>
            </div>

            {selectedPlayerData ? (
              <div className="p-5">
                {/* Avatar + name */}
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-[15px] font-bold border shrink-0"
                    style={{
                      background:   hashColor(selectedPlayerData.name).bg,
                      borderColor:  hashColor(selectedPlayerData.name).border,
                      color:        hashColor(selectedPlayerData.name).text,
                    }}
                  >
                    {getInitials(selectedPlayerData.name)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{selectedPlayerData.name}</p>
                    <p
                      className="text-[10px] font-mono uppercase tracking-wider mt-0.5"
                      style={{ color: ROLE_STYLE[ROLE_ORDER[Math.min(selectedPlayerIdx, ROLE_ORDER.length - 1)]].color }}
                    >
                      {ROLE_ORDER[Math.min(selectedPlayerIdx, ROLE_ORDER.length - 1)]}
                    </p>
                  </div>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[
                    { label: 'RATING', value: selectedPlayerData.avgRating.toFixed(2), color: '#14b8a6' },
                    { label: 'K/D',    value: selectedPlayerData.deaths > 0 ? (selectedPlayerData.kills / selectedPlayerData.deaths).toFixed(2) : '—', color: '#d1d5db' },
                    { label: 'MAPS',   value: String(selectedPlayerData.games), color: '#f43f5e' },
                  ].map(({ label, value, color }) => (
                    <div
                      key={label}
                      className="rounded-xl p-3 text-center"
                      style={{ background: 'var(--bg, #07080e)', border: '1px solid #1e2238' }}
                    >
                      <p className="text-sm font-mono font-bold" style={{ color }}>{value}</p>
                      <p className="text-[9px] font-mono uppercase tracking-wider mt-0.5" style={{ color: '#4b5563' }}>{label}</p>
                    </div>
                  ))}
                </div>

                {/* ADR */}
                <div
                  className="rounded-xl p-3 mb-4 flex justify-between items-center"
                  style={{ background: 'var(--bg, #07080e)', border: '1px solid #1e2238' }}
                >
                  <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: '#4b5563' }}>AVG ADR</span>
                  <span className="text-sm font-mono font-bold text-white">{selectedPlayerData.avgAdr.toFixed(1)}</span>
                </div>

                {/* Modify attributes link */}
                <Link
                  href={`/my-team/player/${encodeURIComponent(selectedPlayerData.name)}`}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-colors"
                  style={{ background: '#1e2238', border: '1px solid #374151', color: '#d1d5db' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(112,71,235,0.5)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = '#374151')}
                >
                  Modify Player Attributes
                  <ArrowRight size={12} />
                </Link>
              </div>
            ) : (
              <div className="px-5 py-10 flex flex-col items-center text-center">
                <Crosshair size={24} className="mb-2" style={{ color: '#374151' }} />
                <p className="text-sm" style={{ color: '#4b5563' }}>
                  Click a roster row to inspect a player
                </p>
              </div>
            )}
          </div>

          {/* TOP PERFORMERS THIS WEEK */}
          {topPlayers.length > 0 && (
            <div className="rounded-2xl overflow-hidden" style={{ background: '#0f111e', border: '1px solid #1e2238' }}>
              <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: '1px solid #1e2238' }}>
                <TrendingUp size={14} style={{ color: '#14b8a6' }} />
                <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#4b5563' }}>
                  Top Performers This Week
                </span>
              </div>
              <div>
                {topPlayers.slice(0, 3).map((p, idx) => {
                  const color = hashColor(p.name)
                  return (
                    <Link
                      key={p.name}
                      href={`/my-team/player/${encodeURIComponent(p.name)}`}
                      className="flex items-center gap-3 px-4 py-3 transition-colors"
                      style={{ borderBottom: idx < 2 ? '1px solid rgba(30,34,56,0.5)' : 'none' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold border shrink-0"
                        style={{ background: color.bg, borderColor: color.border, color: color.text }}
                      >
                        {getInitials(p.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{p.name}</p>
                        <p className="text-[9px] font-mono uppercase tracking-wider mt-0.5" style={{ color: '#4b5563' }}>
                          {TOP_PERFORMER_LABELS[idx] ?? 'PLAYER'}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-mono font-bold" style={{ color: '#14b8a6' }}>
                          {p.avgRating.toFixed(2)}
                        </p>
                        <p className="text-[9px] font-mono" style={{ color: '#4b5563' }}>
                          ADR: {p.avgAdr.toFixed(1)}
                        </p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {/* AI QUICK ACTIONS */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: '#0f111e', border: '1px solid rgba(20,184,166,0.2)' }}
          >
            <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: '1px solid #1e2238' }}>
              <Brain size={14} style={{ color: '#14b8a6' }} />
              <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#4b5563' }}>
                AI Analyst
              </span>
              <Badge variant="neon" className="ml-auto text-[10px]">Llama 3.3</Badge>
            </div>
            <div className="p-4 space-y-1.5">
              <p className="text-[11px] mb-3" style={{ color: '#6b7280' }}>
                Analyse your demos to identify weaknesses, improve executes, and build your playbook.
              </p>
              {AI_QUICK_ACTIONS.map(action => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex items-center gap-3 p-2.5 rounded-xl border transition-all group"
                  style={{ borderColor: '#1e2238' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(20,184,166,0.35)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = '#1e2238')}
                >
                  <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border', action.iconBg)}>
                    {action.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white">{action.title}</p>
                    <p className="text-[10px] leading-tight mt-0.5" style={{ color: '#4b5563' }}>{action.description}</p>
                  </div>
                  <ArrowRight size={12} style={{ color: '#374151' }} className="group-hover:text-gray-400 shrink-0 transition-colors" />
                </Link>
              ))}
            </div>
          </div>

          {/* Upload CTA (when no demos yet) */}
          {totalMatches === 0 && primaryTeamId && (
            <div
              className="rounded-2xl p-5 text-center"
              style={{ border: '1px dashed #1e2238', background: '#0f111e' }}
            >
              <FileVideo size={22} className="mx-auto mb-3" style={{ color: '#374151' }} />
              <p className="text-sm font-medium text-white mb-1">Upload your demos</p>
              <p className="text-xs mb-4 leading-relaxed" style={{ color: '#6b7280' }}>
                Upload your team's match demos to unlock full performance analysis.
              </p>
              <DemoUploadButton teamId={primaryTeamId} demoType="self" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
