'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  Shield, ChevronUp, ChevronDown, Check, Sliders, Send, Download, Upload, Plus, Trash2,
  TrendingUp, Brain, AlertCircle, Zap, BarChart3, Target, BookOpen, Layers, Film, ChevronRight
} from 'lucide-react'
import type { DemoRowData } from './DemoListMultiSelect'

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
      const ourScore = opponentSide === 'team1' ? (h.score_team2 ?? 0) : (h.score_team1 ?? 0)
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
        myPlayerStats[p.name].kills += p.kills
        myPlayerStats[p.name].deaths += p.deaths
        myPlayerStats[p.name].assists += p.assists
        myPlayerStats[p.name].adr += p.adr
        myPlayerStats[p.name].rating += p.rating
        myPlayerStats[p.name].games += 1
      }
    }
  }

  const totalLosses = totalMatches - totalWins - totalDraws
  const winRate = totalMatches > 0 ? totalWins / totalMatches : 0
  const avgKD = totalDeaths > 0 ? (totalKills / totalDeaths).toFixed(2) : '—'
  const avgAdr = playerCount > 0 ? (totalAdr / playerCount).toFixed(1) : '—'

  const topMaps = Object.entries(mapCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)

  return { totalMatches, totalWins, totalLosses, totalDraws, winRate, avgKD, avgAdr, topMaps }
}

const PERF_TREND = [
  { match: 1, rate: 62 }, { match: 2, rate: 58 }, { match: 3, rate: 65 }, { match: 4, rate: 61 },
  { match: 5, rate: 59 }, { match: 6, rate: 64 }, { match: 7, rate: 62 }, { match: 8, rate: 66 },
  { match: 9, rate: 68 }, { match: 10, rate: 70 }, { match: 11, rate: 72 }, { match: 12, rate: 74 },
  { match: 13, rate: 75 }, { match: 14, rate: 76 }, { match: 15, rate: 78 }, { match: 16, rate: 80 }
]

const PERF_RESULTS = ['w', 'l', 'w', 'w', 'l', 'w', 'w', 'l', 'w', 'w', 'w', 'w', 'w', 'l', 'w', 'w']

const WIN_RATE_CHART = [
  { map: 'Overpass', ct: 100 }, { map: 'Dust2', ct: 92 }, { map: 'Anubis', ct: 88 },
  { map: 'Inferno', ct: 84 }, { map: 'Mirage', ct: 76 }, { map: 'Nuke', ct: 65 }
]

const MAP_PERF = [
  { map: 'Mirage', ct: 58, t: 42 }, { map: 'Inferno', ct: 62, t: 38 }, { map: 'Nuke', ct: 58, t: 42 },
  { map: 'Overpass', ct: 53, t: 47 }, { map: 'Ancient', ct: 50, t: 50 }, { map: 'Vertigo', ct: 62, t: 38 },
]

const AI_COACH_ITEMS = [
  { title: 'Weak Spots', desc: 'Identify recurring mistakes and areas to improve', icon: AlertCircle, color: 'var(--loss)' },
  { title: 'Executes', desc: 'Review execute quality, utility usage, and timings', icon: Zap, color: 'var(--accent)' },
  { title: 'Round Review', desc: 'Analyze clutches, eco plays, and late rounds', icon: BarChart3, color: 'var(--ct)' },
  { title: 'Practice Drills', desc: 'Personalized drill recommendations', icon: Target, color: 'var(--signal)' },
  { title: 'Strategy Coach', desc: 'Build a playbook tailored to your roster', icon: BookOpen, color: 'var(--win)' },
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
  const [expandedMaps, setExpandedMaps] = useState<Set<string>>(new Set())
  const stats = useMemo(() => computeStats(demos), [demos])

  const toggleMapExpanded = (map: string) => {
    const newSet = new Set(expandedMaps)
    if (newSet.has(map)) newSet.delete(map)
    else newSet.add(map)
    setExpandedMaps(newSet)
  }

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
          {/* Performance Trends */}
          <div style={{ padding: 16, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)' }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingUp size={16} style={{ color: 'var(--accent)' }} /> Performance Trends
            </p>
            <div style={{ height: 140, display: 'flex', alignItems: 'flex-end', gap: 3, paddingBottom: 8 }}>
              {PERF_TREND.map((p, i) => (
                <div key={i} style={{ flex: 1, height: `${(p.rate / 100) * 120}px`, background: 'linear-gradient(180deg,var(--signal),var(--accent))', borderRadius: '2px 2px 0 0', opacity: 0.8, transition: 'opacity 0.2s', cursor: 'pointer' }} title={`Match ${p.match}: ${p.rate}%`} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 4, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
              {PERF_RESULTS.map((r, i) => (
                <span key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: r === 'w' ? 'var(--win)' : 'var(--loss)', flexShrink: 0 }} />
              ))}
            </div>
          </div>

          {/* Win Rate by Map */}
          <div style={{ padding: 16, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)' }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Win rate by map</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {WIN_RATE_CHART.map((m, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, color: 'var(--text)', width: 80, fontWeight: 500 }}>{m.map}</span>
                  <div style={{ flex: 1, height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${m.ct}%`, height: '100%', background: 'linear-gradient(90deg,var(--signal),var(--accent))' }} />
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text)', width: 30, textAlign: 'right', fontWeight: 600 }}>{m.ct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: AI Analyst */}
        <div style={{ padding: 16, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--win)' }} />
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Brain size={16} style={{ color: 'var(--signal)' }} /> AI Analyst
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {AI_COACH_ITEMS.map((item, i) => (
              <div key={i} style={{ padding: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-2)', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <item.icon size={16} style={{ color: 'inherit', marginTop: 2, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{item.title}</p>
                  <p style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.3 }}>{item.desc}</p>
                </div>
                <ChevronRight size={14} style={{ color: 'var(--muted)', flexShrink: 0 }} />
              </div>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 58px 50px 42px 40px 56px', padding: '2px 18px 8px', gap: 0, fontSize: 9.5, fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {['Player', 'Role', 'Rating', 'K/D', 'Maps', 'Form'].map((h, i) => (
              <span key={h} style={{ textAlign: i >= 2 && i < 5 ? 'right' : 'left' }}>{h}</span>
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
            <p style={{ padding: '9px 18px', textAlign: 'center' }}>No roster data yet. Upload demos to see player stats.</p>
          </div>
          <div style={{ height: 8 }} />
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
            {MAP_PERF.map(m => (
              <div key={m.map} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 0' }}>
                <span style={{ fontSize: 13, color: 'var(--text)', width: 72 }}>{m.map}</span>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, height: 11, borderRadius: 4, overflow: 'hidden', display: 'flex', border: '1px solid var(--border)' }}>
                    <div style={{ width: `${m.ct}%`, background: 'linear-gradient(90deg,#4d83e6,var(--ct))' }} />
                    <div style={{ flex: 1, background: 'linear-gradient(90deg,var(--tside),#e09a2e)' }} />
                  </div>
                </div>
                <span style={{ fontSize: 11, color: 'var(--ct)', width: 58, textAlign: 'right' }}>CT {m.ct}%</span>
                <span style={{ fontSize: 11, color: 'var(--tside)', width: 50, textAlign: 'right' }}>T {100 - m.ct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Map Pool */}
      <div style={{ padding: 16, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)' }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Layers size={16} style={{ color: 'var(--signal)' }} /> Map Pool
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { map: 'Inferno', count: 7 },
            { map: 'Dust2', count: 3 },
            { map: 'Mirage', count: 2 }
          ].map((m, i) => (
            <span key={i} style={{ padding: '6px 12px', borderRadius: 8, background: 'var(--card-2)', border: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
              {m.map}
              <span style={{ fontSize: 10, color: 'var(--signal)', fontWeight: 700 }}>{m.count}x</span>
            </span>
          ))}
        </div>
      </div>

      {/* Demos */}
      <div>
        {demos.length > 0 ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Film size={16} style={{ color: 'var(--signal)' }} />
              <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>My Team's Demos</p>
              <span style={{ fontSize: 10, color: 'var(--muted)' }}>{demos.length} • {new Set(demos.map(d => d.map)).size} maps</span>
            </div>
            <div style={{ borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)', overflow: 'hidden' }}>
              {(() => {
                const demosByMap = demos.reduce((acc, demo) => {
                  const map = demo.map || 'Unknown'
                  if (!acc[map]) acc[map] = []
                  acc[map].push(demo)
                  return acc
                }, {} as Record<string, DemoRowData[]>)

                return Object.entries(demosByMap)
                  .sort((a, b) => b[1].length - a[1].length)
                  .map(([map, mapDemos], i) => {
                    const completedDemos = mapDemos.filter(d => d.status === 'completed')
                    let wins = 0, losses = 0
                    for (const demo of completedDemos) {
                      const h = demo.parsed_data?.header
                      if (h) {
                        const opponentSide = demo.parsed_data?.opponentSide ?? 'team2'
                        const ourScore = opponentSide === 'team1' ? (h.score_team2 ?? 0) : (h.score_team1 ?? 0)
                        const theirScore = opponentSide === 'team1' ? (h.score_team1 ?? 0) : (h.score_team2 ?? 0)
                        if (ourScore > theirScore) wins++
                        else if (ourScore < theirScore) losses++
                      }
                    }
                    const winRate = completedDemos.length > 0 ? (wins / completedDemos.length * 100).toFixed(0) : '0'
                    const lastPlayed = mapDemos.sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())[0]?.created_at
                    const isExpanded = expandedMaps.has(map)

                    return (
                      <div key={map}>
                        <button onClick={() => toggleMapExpanded(map)} style={{ width: '100%', padding: 16, borderBottom: i < Object.keys(demosByMap).length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', transition: 'background 0.2s', background: 'transparent', border: 'none', color: 'inherit', font: 'inherit' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, textAlign: 'left' }}>
                            <div style={{ width: 40, height: 40, borderRadius: 8, background: 'rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>{map.substring(0, 2).toUpperCase()}</div>
                            <div style={{ flex: 1 }}>
                              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{map}</p>
                              <p style={{ fontSize: 11, color: 'var(--muted)', margin: 0 }}>Last played {lastPlayed ? new Date(lastPlayed).toLocaleDateString() : 'N/A'}</p>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                            <div style={{ textAlign: 'right', minWidth: 80 }}>
                              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{wins}W - {losses}L ({winRate}%)</p>
                            </div>
                            <div style={{ display: 'flex', gap: 4 }}>
                              {Array.from({ length: Math.min(mapDemos.length, 5) }).map((_, idx) => (
                                <div key={idx} style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--signal)' }} />
                              ))}
                              {mapDemos.length > 5 && <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 4 }}>+{mapDemos.length - 5}</span>}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 80 }}>
                              <p style={{ fontSize: 12, color: 'var(--signal)', fontWeight: 600, margin: 0 }}>{mapDemos.length} demos</p>
                              <ChevronRight size={16} style={{ transition: 'transform 0.2s', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }} />
                            </div>
                          </div>
                        </button>
                        {isExpanded && (
                          <div style={{ padding: '12px 16px', background: 'rgba(255, 255, 255, 0.02)', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {mapDemos.map((demo, demoIdx) => (
                              <Link key={demoIdx} href={`/teams/${selectedTeamId}/demos/${demo.id}`}>
                                <div style={{ padding: 8, borderRadius: 6, background: 'rgba(255, 255, 255, 0.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, cursor: 'pointer', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'}>
                                  <span style={{ color: 'var(--text)' }}>{demo.opponent_slug || 'Unknown opponent'}</span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ color: 'var(--muted)' }}>Uploaded {new Date(demo.created_at ?? 0).toLocaleDateString()}</span>
                                    <span style={{ padding: '2px 6px', borderRadius: 3, background: demo.status === 'completed' ? 'rgba(34, 197, 94, 0.1)' : demo.status === 'processing' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: demo.status === 'completed' ? 'var(--win)' : demo.status === 'processing' ? 'var(--signal)' : 'var(--loss)', textTransform: 'capitalize' }}>{demo.status}</span>
                                  </div>
                                </div>
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })
              })()}
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Film size={16} style={{ color: 'var(--signal)' }} />
              <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>My Team's Demos</p>
            </div>
            <div style={{ padding: 20, textAlign: 'center', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--muted)' }}>
              <Film size={32} style={{ margin: '0 auto 12px', color: 'var(--faint)' }} />
              <p style={{ fontSize: 13 }}>No demos yet. Upload your team's demos to see them here.</p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
