'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Shield, ChevronUp, ChevronDown, Check, Sliders, Send, Download, Upload, Plus, Trash2,
  TrendingUp, Brain, AlertCircle, Zap, BarChart3, Target, BookOpen, Layers, Film, ChevronRight
} from 'lucide-react'
import type { DemoRowData } from './DemoListMultiSelect'
import MapFolderList, { type MapGroup } from './MapFolderList'

interface TeamOption {
  id: string
  name: string
  role: 'owner' | 'admin' | 'member'
}

interface MyTeamDashboardProps {
  selectedTeamId: string
  allTeams: TeamOption[]
  demos: DemoRowData[]
  teamName: string
  canEdit: boolean
  canInvite: boolean
  canDelete: boolean
  myFaceitId: string | null
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
      const h = demo.parsed_data?.header
      const os = demo.parsed_data?.opponentSide ?? 'team2'
      if (h) {
        const ours = os === 'team1' ? (h.score_team2 ?? 0) : (h.score_team1 ?? 0)
        const theirs = os === 'team1' ? (h.score_team1 ?? 0) : (h.score_team2 ?? 0)
        if (ours > theirs) g.wins++
        else if (ours === theirs) g.draws++
        else g.losses++
      }
    }
  }
  return [...mapGroupMap.entries()]
    .map(([map, data]) => ({ map, ...data }))
    .sort((a, b) => {
      const aHas = a.demos.length > 0, bHas = b.demos.length > 0
      if (aHas !== bHas) return aHas ? -1 : 1
      if (aHas) return b.lastActivity.localeCompare(a.lastActivity)
      const aIdx = ACTIVE_DUTY_MAPS.indexOf(a.map), bIdx = ACTIVE_DUTY_MAPS.indexOf(b.map)
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx
      if (aIdx !== -1) return -1
      if (bIdx !== -1) return 1
      return 0
    })
}

function computeStats(demos: DemoRowData[]) {
  const completedDemos = demos.filter(d => d.status === 'completed')
  let totalMatches = 0, totalWins = 0, totalDraws = 0
  let totalKills = 0, totalDeaths = 0, totalAdr = 0, playerCount = 0
  const mapCounts: Record<string, number> = {}
  // Per-map T/CT round win tracking for own team
  const mapSideWins: Record<string, { tWins: number; ctWins: number; tTotal: number; ctTotal: number }> = {}
  type PlayerAccum = { kills: number; deaths: number; assists: number; adr: number; rating: number; games: number; entryKills: number; clutchWins: number; clutchAttempts: number }
  const myPlayerStats: Record<string, PlayerAccum> = {}

  for (const demo of completedDemos) {
    const pd = demo.parsed_data
    const h = pd?.header
    const opponentSide = pd?.opponentSide ?? 'team2'
    totalMatches++

    if (h) {
      const ourScore = opponentSide === 'team1' ? (h.score_team2 ?? 0) : (h.score_team1 ?? 0)
      const theirScore = opponentSide === 'team1' ? (h.score_team1 ?? 0) : (h.score_team2 ?? 0)
      if (ourScore > theirScore) totalWins++
      else if (ourScore === theirScore) totalDraws++
      if (h.map && h.map !== 'unknown') mapCounts[h.map] = (mapCounts[h.map] ?? 0) + 1

      // Compute per-map T/CT win split for our team.
      // The parsed round.winner is the team label (matches header.team1 or header.team2).
      // Our team label is the opposite of the opponentSide label.
      const ourLabel = opponentSide === 'team1' ? (h.team2 ?? 'CT-Side') : (h.team1 ?? 'T-Side')
      const mapKey = h.map ?? 'unknown'
      if (!mapSideWins[mapKey]) mapSideWins[mapKey] = { tWins: 0, ctWins: 0, tTotal: 0, ctTotal: 0 }
      const sw = mapSideWins[mapKey]
      const totalRounds = (h.score_team1 ?? 0) + (h.score_team2 ?? 0)
      // CS2 standard: first 12 rounds team keeps their starting side.
      // Determine our starting side: if opponentSide='team2', opponent is team2,
      // we are team1. team1 label is usually the T-starting team (not guaranteed,
      // but we use win_reason to discriminate instead).
      for (const round of (pd?.rounds ?? [])) {
        if (!round.winner) continue
        const ourWon = round.winner === ourLabel
        // Classify round side from win_reason:
        //   T wins: TargetBombed, Elimination (when T side wins)
        //   CT wins: BombDefused, TargetSaved, Elimination (when CT side wins)
        // Simpler: use round number — rounds 1-12 team1 is T (CS2 default).
        // round ≤12 → team1=T, team2=CT; round 13-24 → sides flip.
        const isFirstHalf = round.number <= 12
        // If opponentSide='team2', our team is team1 → T in first half
        const ourSideIsT = opponentSide === 'team2' ? isFirstHalf : !isFirstHalf
        if (ourSideIsT) { sw.tTotal++; if (ourWon) sw.tWins++ }
        else             { sw.ctTotal++; if (ourWon) sw.ctWins++ }
      }
      // Fallback if no round data but we know total rounds
      if ((pd?.rounds ?? []).length === 0 && totalRounds > 0) {
        sw.tTotal  += Math.floor(totalRounds / 2)
        sw.ctTotal += Math.ceil(totalRounds / 2)
      }
    }

    if (pd?.players) {
      const opponentLabel = opponentSide === 'team1' ? (h?.team1 ?? 'T-Side') : (h?.team2 ?? 'CT-Side')
      for (const p of pd.players) {
        if (p.team === opponentLabel) continue
        totalKills += p.kills
        totalDeaths += p.deaths
        totalAdr += p.adr
        playerCount++
        if (!myPlayerStats[p.name]) myPlayerStats[p.name] = { kills: 0, deaths: 0, assists: 0, adr: 0, rating: 0, games: 0, entryKills: 0, clutchWins: 0, clutchAttempts: 0 }
        myPlayerStats[p.name].kills += p.kills
        myPlayerStats[p.name].deaths += p.deaths
        myPlayerStats[p.name].assists += p.assists
        myPlayerStats[p.name].adr += p.adr
        myPlayerStats[p.name].rating += p.rating
        myPlayerStats[p.name].games += 1
        myPlayerStats[p.name].entryKills    += p.entry_kills    ?? 0
        myPlayerStats[p.name].clutchWins    += p.clutch_wins    ?? 0
        myPlayerStats[p.name].clutchAttempts += p.clutch_attempts ?? 0
      }
    }
  }

  const totalLosses = totalMatches - totalWins - totalDraws
  const winRate = totalMatches > 0 ? totalWins / totalMatches : 0
  const avgKD = totalDeaths > 0 ? (totalKills / totalDeaths).toFixed(2) : '—'
  const avgAdr = playerCount > 0 ? (totalAdr / playerCount).toFixed(1) : '—'

  const topMaps = Object.entries(mapCounts).sort((a, b) => b[1] - a[1]).slice(0, 3)

  const topPlayers = Object.entries(myPlayerStats)
    .map(([name, s]) => ({
      name,
      kills: s.kills,
      deaths: s.deaths,
      avgAdr: s.games > 0 ? s.adr / s.games : 0,
      avgRating: s.games > 0 ? s.rating / s.games : 0,
      games: s.games,
      entryKills: s.entryKills,
      clutchRate: s.clutchAttempts > 0 ? s.clutchWins / s.clutchAttempts : null,
      clutchWins: s.clutchWins,
      clutchAttempts: s.clutchAttempts,
    }))
    .sort((a, b) => b.avgRating - a.avgRating)

  return { totalMatches, totalWins, totalLosses, totalDraws, winRate, avgKD, avgAdr, topMaps, topPlayers, mapSideWins }
}

const AI_COACH_ITEMS = [
  { title: 'Weak Spots',      desc: 'Identify recurring mistakes and areas to improve', icon: AlertCircle, color: 'var(--loss)',   focus: 'weakness' },
  { title: 'Executes',        desc: 'Review execute quality, utility usage, and timings', icon: Zap,       color: 'var(--accent)', focus: 'executes' },
  { title: 'Round Review',    desc: 'Analyze clutches, eco plays, and late rounds',       icon: BarChart3,  color: 'var(--ct)',     focus: 'rounds'   },
  { title: 'Practice Drills', desc: 'Personalized drill recommendations',                 icon: Target,     color: 'var(--signal)', focus: 'drills'   },
  { title: 'Strategy Coach',  desc: 'Build a playbook tailored to your roster',           icon: BookOpen,   color: 'var(--win)',    focus: 'strategy' },
]

export default function MyTeamDashboard({
  selectedTeamId,
  allTeams,
  demos,
  teamName,
  canEdit,
  canInvite,
  canDelete,
  myFaceitId,
}: MyTeamDashboardProps) {
  const [showTeamDropdown, setShowTeamDropdown] = useState(false)
  const [sideOverrides, setSideOverrides] = useState<Record<string, 'team1' | 'team2'>>({})

  const effectiveDemos = useMemo(() => {
    if (Object.keys(sideOverrides).length === 0) return demos
    return demos.map(d => {
      const override = sideOverrides[d.id]
      return override
        ? { ...d, parsed_data: d.parsed_data ? { ...d.parsed_data, opponentSide: override } : { opponentSide: override } }
        : d
    })
  }, [demos, sideOverrides])

  const handleSideChange = (demoId: string, opponentSide: 'team1' | 'team2') => {
    setSideOverrides(prev => ({ ...prev, [demoId]: opponentSide }))
  }

  const stats = useMemo(() => computeStats(effectiveDemos), [effectiveDemos])
  const mapGroups = useMemo(() => buildMapGroups(effectiveDemos), [effectiveDemos])

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 300 }}>
          {/* Team Selector */}
          <div style={{ marginBottom: 12, position: 'relative' }}>
            <button
              onClick={() => setShowTeamDropdown(!showTeamDropdown)}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: 12,
                border: '2px solid var(--border)',
                background: 'var(--card)',
                color: 'var(--text)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                transition: 'all 0.14s ease',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Shield size={16} style={{ color: 'var(--accent)' }} />
                {teamName}
              </div>
              {showTeamDropdown ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showTeamDropdown && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                right: 0,
                background: 'var(--elevated)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                overflow: 'hidden',
                zIndex: 10,
                boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
              }}>
                {allTeams.map((team, i) => (
                  <button
                    key={team.id}
                    onClick={() => {
                      setShowTeamDropdown(false)
                      window.location.href = `/my-team?team=${team.id}`
                    }}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                      background: selectedTeamId === team.id ? 'var(--accent-soft)' : 'transparent',
                      color: 'var(--text)',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'background 0.14s ease',
                      textAlign: 'left',
                      fontSize: 13,
                      fontWeight: selectedTeamId === team.id ? 600 : 500,
                    }}
                  >
                    <div>
                      <p style={{ fontWeight: 600, color: 'var(--text)' }}>{team.name}</p>
                    </div>
                    {selectedTeamId === team.id && <Check size={16} style={{ color: 'var(--accent)' }} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Title */}
          <h1 style={{ fontSize: 32, fontWeight: 700, color: 'var(--text)', lineHeight: 1.1, marginBottom: 4 }}>{teamName}</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Your team's performance overview</p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {canEdit && (
            <Link href={`/my-team?edit=name&team=${selectedTeamId}`}>
              <button style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                <Sliders size={14} /> Edit Name
              </button>
            </Link>
          )}
          {canInvite && (
            <Link href={`/my-team?invite=true&team=${selectedTeamId}`}>
              <button style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                <Send size={14} /> Invite Friends
              </button>
            </Link>
          )}
          {myFaceitId && (
            <Link href={`/my-team?faceit=true&team=${selectedTeamId}`}>
              <button style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                <Download size={14} /> Import from FACEIT
              </button>
            </Link>
          )}
          <Link href={`/my-team?upload=demo&team=${selectedTeamId}`}>
            <button style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              <Upload size={14} /> Upload Demo
            </button>
          </Link>
          <Link href="/teams">
            <button style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: 'var(--accent)', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600, border: 'none' }}>
              <Plus size={14} /> Create Team
            </button>
          </Link>
          {canDelete && (
            <Link href={`/my-team?delete=true&team=${selectedTeamId}`}>
              <button style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: 'var(--loss)', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600, border: 'none' }}>
                <Trash2 size={14} /> Delete Team
              </button>
            </Link>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'MATCHES', stat: stats.totalMatches || '—', sub: `${stats.totalWins}W ${stats.totalLosses}L ${stats.totalDraws}D` },
          { label: 'WIN RATE', stat: stats.totalMatches > 0 ? `${Math.round(stats.winRate * 100)}%` : '—', sub: `${stats.totalWins} wins from ${stats.totalMatches}` },
          { label: 'TEAM K/D', stat: stats.avgKD, sub: 'Combined team ratio' },
          { label: 'AVG ADR', stat: stats.avgAdr, sub: 'Avg damage per round' },
        ].map((s, i) => (
          <div key={i} style={{ padding: 16, position: 'relative', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', overflow: 'hidden', cursor: 'default' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: ['var(--tside)', 'var(--signal)', 'var(--accent)', 'var(--ct)'][i] }} />
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--faint)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>{s.label}</p>
            <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', lineHeight: 1.1, marginBottom: 4 }}>{s.stat}</p>
            <p style={{ fontSize: 11, color: 'var(--muted)' }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Main Content: Trends + AI */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {/* Left: Trends */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Performance Trends — real data from completed demos sorted oldest→newest */}
          {(() => {
            const completed = [...effectiveDemos.filter(d => d.status === 'completed')]
              .sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))
            if (completed.length < 2) return null
            const results = completed.map(d => {
              const h = d.parsed_data?.header
              if (!h) return null
              const os = d.parsed_data?.opponentSide ?? 'team2'
              const ours = os === 'team1' ? (h.score_team2 ?? 0) : (h.score_team1 ?? 0)
              const theirs = os === 'team1' ? (h.score_team1 ?? 0) : (h.score_team2 ?? 0)
              return ours > theirs ? 'w' : ours < theirs ? 'l' : 'd'
            }).filter(Boolean) as ('w' | 'l' | 'd')[]
            const runningRates = results.map((_, idx) => {
              const slice = results.slice(0, idx + 1)
              return Math.round(slice.filter(r => r === 'w').length / slice.length * 100)
            })
            return (
              <div style={{ padding: 16, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)' }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <TrendingUp size={16} style={{ color: 'var(--accent)' }} /> Performance Trends
                </p>
                <div style={{ height: 140, display: 'flex', alignItems: 'flex-end', gap: 3, paddingBottom: 8 }}>
                  {runningRates.map((rate, i) => (
                    <div key={i} style={{ flex: 1, height: `${(rate / 100) * 120}px`, background: 'linear-gradient(180deg,var(--signal),var(--accent))', borderRadius: '2px 2px 0 0', opacity: 0.8 }} title={`Match ${i + 1}: ${rate}%`} />
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 4, paddingTop: 8, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
                  {results.map((r, i) => (
                    <span key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: r === 'w' ? 'var(--win)' : r === 'l' ? 'var(--loss)' : 'var(--muted)', flexShrink: 0 }} />
                  ))}
                </div>
              </div>
            )
          })()}

          {/* Win Rate by Map */}
          {mapGroups.filter(g => g.demos.length > 0).length > 0 && (
            <div style={{ padding: 16, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)' }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Win rate by map</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {mapGroups.filter(g => g.demos.length > 0).map((g) => {
                  const total = g.wins + g.losses + g.draws
                  const wr = total > 0 ? Math.round(g.wins / total * 100) : 0
                  const name = g.map.replace(/^(de_|cs_|ar_)/, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                  return (
                    <div key={g.map} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 12, color: 'var(--text)', width: 80, fontWeight: 500 }}>{name}</span>
                      <div style={{ flex: 1, height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${wr}%`, height: '100%', background: 'linear-gradient(90deg,var(--signal),var(--accent))' }} />
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text)', width: 30, textAlign: 'right', fontWeight: 600 }}>{wr}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right: AI Analyst */}
        <div style={{ padding: 16, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--win)' }} />
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Brain size={16} style={{ color: 'var(--signal)' }} /> AI Analyst
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {AI_COACH_ITEMS.map((item, i) => (
              <Link key={i} href={`/ai-coach?mode=myteam&focus=${item.focus}`} style={{ textDecoration: 'none' }}>
                <div style={{ padding: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-2)', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <item.icon size={16} style={{ color: item.color, marginTop: 2, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{item.title}</p>
                    <p style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.3 }}>{item.desc}</p>
                  </div>
                  <ChevronRight size={14} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Roster + Map Performance */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 14 }}>
        {/* Roster */}
        <div style={{ borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)', overflow: 'hidden', position: 'relative' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--accent)' }} />
          <div style={{ padding: '15px 18px 8px' }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Roster</p>
          </div>
          {stats.topPlayers.length === 0 ? (
            <div style={{ padding: '12px 18px 20px', textAlign: 'center', fontSize: 11, color: 'var(--muted)' }}>
              No roster data yet. Upload demos to see player stats.
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 56px 48px 56px', padding: '2px 18px 8px', gap: 0, fontSize: 9.5, fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {['Player', 'Rating', 'ADR', 'K/D'].map((h, i) => (
                  <span key={h} style={{ textAlign: i > 0 ? 'right' : 'left' }}>{h}</span>
                ))}
              </div>
              <div style={{ paddingBottom: 8 }}>
                {stats.topPlayers.map((p, i) => (
                  <Link key={p.name} href={`/my-team/player/${encodeURIComponent(p.name)}`}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 56px 48px 56px', padding: '8px 18px', alignItems: 'center', borderBottom: i < stats.topPlayers.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <span style={{ fontSize: 10, width: 20, height: 20, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, background: i === 0 ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.05)', color: i === 0 ? '#fbbf24' : 'var(--faint)' }}>{i + 1}</span>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 10, color: 'var(--muted)' }}>{p.games} {p.games === 1 ? 'game' : 'games'}</span>
                            {p.entryKills > 0 && (
                              <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 3, background: 'color-mix(in srgb, #f97316 12%, transparent)', color: '#f97316' }}>
                                {p.entryKills}E
                              </span>
                            )}
                            {p.clutchRate !== null && (
                              <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 3, background: 'color-mix(in srgb, #a855f7 12%, transparent)', color: '#a855f7' }}>
                                {Math.round(p.clutchRate * 100)}%C
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, textAlign: 'right', margin: 0, color: p.avgRating >= 1.1 ? 'var(--signal)' : p.avgRating >= 0.9 ? 'var(--text)' : 'var(--loss)' }}>{p.avgRating.toFixed(2)}</p>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, textAlign: 'right', margin: 0, color: 'var(--muted)' }}>{p.avgAdr.toFixed(0)}</p>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, textAlign: 'right', margin: 0, color: 'var(--muted)' }}>{p.deaths > 0 ? (p.kills / p.deaths).toFixed(2) : '—'}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Map Performance */}
        <div style={{ borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)', overflow: 'hidden', position: 'relative' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--ct)' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 18px 8px' }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Map Performance</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--muted)' }}><span style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--ct)' }} />CT</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--muted)' }}><span style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--tside)' }} />T</span>
            </div>
          </div>
          <div style={{ padding: '4px 18px 14px' }}>
            {mapGroups.filter(g => g.demos.length > 0 && g.map !== 'unknown').slice(0, 6).length === 0 ? (
              <p style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', padding: '12px 0' }}>No map data yet.</p>
            ) : mapGroups.filter(g => g.demos.length > 0 && g.map !== 'unknown').slice(0, 6).map(g => {
              const sw = stats.mapSideWins[g.map]
              const tWr  = sw && sw.tTotal  > 0 ? Math.round(sw.tWins  / sw.tTotal  * 100) : null
              const ctWr = sw && sw.ctTotal > 0 ? Math.round(sw.ctWins / sw.ctTotal * 100) : null
              const name = g.map.replace(/^(de_|cs_|ar_)/, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
              // Bar: left = T win rate, right = CT win rate (proportional to rounds played)
              const tBarPct  = sw ? Math.round(sw.tTotal  / (sw.tTotal + sw.ctTotal) * 100) : 50
              return (
                <div key={g.map} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 0' }}>
                  <span style={{ fontSize: 13, color: 'var(--text)', width: 72 }}>{name}</span>
                  <div style={{ flex: 1, height: 11, borderRadius: 4, overflow: 'hidden', display: 'flex', border: '1px solid var(--border)' }}>
                    <div style={{ width: `${tBarPct}%`, background: tWr !== null && tWr >= 55 ? 'linear-gradient(90deg,#e09a2e,var(--tside))' : tWr !== null && tWr < 40 ? 'linear-gradient(90deg,var(--loss),#c0392b)' : 'linear-gradient(90deg,var(--tside),#e09a2e)' }} />
                    <div style={{ flex: 1, background: ctWr !== null && ctWr >= 55 ? 'linear-gradient(90deg,#4d83e6,var(--ct))' : ctWr !== null && ctWr < 40 ? 'linear-gradient(90deg,var(--loss),#c0392b)' : 'linear-gradient(90deg,#4d83e6,var(--ct))' }} />
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--tside)', width: 48, textAlign: 'right' }}>T {tWr !== null ? `${tWr}%` : '—'}</span>
                  <span style={{ fontSize: 11, color: 'var(--ct)', width: 50, textAlign: 'right' }}>CT {ctWr !== null ? `${ctWr}%` : '—'}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Map Pool */}
      <div style={{ padding: 16, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)' }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Layers size={16} style={{ color: 'var(--signal)' }} /> Map Pool
        </p>
        {stats.topMaps.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--muted)' }}>No map data yet.</p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {stats.topMaps.map(([map, count]) => {
              const name = map.replace(/^(de_|cs_|ar_)/, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
              return (
                <span key={map} style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {name}
                  <span style={{ fontSize: 10, color: 'var(--signal)', fontWeight: 700 }}>{count}×</span>
                </span>
              )
            })}
          </div>
        )}
      </div>

      {/* Demos */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Film size={16} style={{ color: 'var(--signal)' }} />
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0 }}>My Team&apos;s Demos</p>
          {effectiveDemos.length > 0 && (
            <span style={{ fontSize: 10, color: 'var(--muted)', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: 4, fontFamily: 'var(--font-mono)' }}>
              {effectiveDemos.length} · {mapGroups.filter(g => g.demos.length > 0 && g.map !== 'unknown').length} maps
            </span>
          )}
        </div>
        <MapFolderList mapGroups={mapGroups} onSideChange={handleSideChange} />
      </div>
    </div>
  )
}
