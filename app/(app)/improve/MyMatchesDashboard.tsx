'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  Film, TrendingUp, Zap, ExternalLink, Loader2, Info,
} from 'lucide-react'
import { MAP_THUMBS } from '@/lib/map-config'
import type { DemoRowData } from '@/components/teams/DemoListMultiSelect'
import MapFolderList, { type MapGroup } from '@/components/teams/MapFolderList'
import DemoUploadButton from '@/components/teams/DemoUploadButton'
import CS2MatchPanel from '@/app/(app)/improve/CS2MatchPanel'

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

function computeStats(demos: DemoRowData[], steamId: string | null) {
  const completed = demos.filter(d => d.status === 'completed')
  let totalMatches = 0, wins = 0, draws = 0
  let myKills = 0, myDeaths = 0, myAdr = 0, myGames = 0

  for (const demo of completed) {
    const pd = demo.parsed_data
    const h = pd?.header
    const os = pd?.opponentSide ?? 'team2'
    totalMatches++

    if (h) {
      const ours = os === 'team1' ? (h.score_team2 ?? 0) : (h.score_team1 ?? 0)
      const theirs = os === 'team1' ? (h.score_team1 ?? 0) : (h.score_team2 ?? 0)
      if (ours > theirs) wins++
      else if (ours === theirs) draws++
    }

    if (pd?.players) {
      const opponentLabel = os === 'team1' ? (h?.team1 ?? '') : (h?.team2 ?? '')
      const myPlayers = steamId
        ? pd.players.filter(p => (p as { steam_id?: string }).steam_id === steamId)
        : pd.players.filter(p => p.team !== opponentLabel)

      for (const p of myPlayers) {
        myKills += p.kills
        myDeaths += p.deaths
        myAdr += p.adr
        myGames++
      }
    }
  }

  return {
    totalMatches,
    wins,
    losses: totalMatches - wins - draws,
    draws,
    winRate: totalMatches > 0 ? wins / totalMatches : 0,
    kd: myDeaths > 0 ? myKills / myDeaths : null,
    adr: myGames > 0 ? myAdr / myGames : null,
  }
}

interface FaceitRecentMatch {
  match_id: string
  competition_name: string
  started_at: number
  score: { faction1: number; faction2: number } | null
  winner: string | null
  my_faction: 'faction1' | 'faction2'
  match_url: string
  map: string | null
}

const MAP_LABELS: Record<string, string> = {
  de_ancient: 'Ancient', de_anubis: 'Anubis', de_dust2: 'Dust2',
  de_inferno: 'Inferno', de_mirage: 'Mirage', de_nuke: 'Nuke',
  de_overpass: 'Overpass', de_vertigo: 'Vertigo',
}

function mapLabel(raw: string | null | undefined): string {
  if (!raw) return '—'
  const lower = raw.toLowerCase()
  return MAP_LABELS[lower] ?? raw.replace(/^de_/, '').replace(/\b\w/g, c => c.toUpperCase())
}

function fmtDate(ts: number | string): string {
  const d = typeof ts === 'number' ? new Date(ts * 1000) : new Date(ts)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function FaceitMatchRow({ match }: { match: FaceitRecentMatch }) {
  const myScore = match.score?.[match.my_faction] ?? null
  const oppFac = match.my_faction === 'faction1' ? 'faction2' : 'faction1'
  const oppScore = match.score?.[oppFac] ?? null

  let result: 'W' | 'L' | 'D' | null = null
  let scoreStr = ''
  if (match.winner) {
    result = match.winner === match.my_faction ? 'W' : (myScore === oppScore ? 'D' : 'L')
  }
  if (myScore !== null && oppScore !== null) scoreStr = `${myScore}–${oppScore}`

  const thumbUrl = match.map ? MAP_THUMBS[match.map.toLowerCase()] : undefined
  const badgeBg = result === 'W' ? 'rgba(0,255,200,0.75)' : result === 'L' ? 'rgba(239,68,68,0.75)' : result === 'D' ? 'rgba(245,158,11,0.75)' : 'rgba(0,0,0,0.5)'
  const badgeColor = result === 'L' ? 'white' : result === null ? 'var(--muted)' : 'black'
  const scoreColor = result === 'W' ? 'var(--signal)' : result === 'L' ? 'var(--loss)' : 'var(--tside)'

  return (
    <a
      href={match.match_url}
      target="_blank"
      rel="noopener noreferrer"
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)', textDecoration: 'none', transition: 'background 0.12s' }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
    >
      <div style={{ position: 'relative', width: 52, height: 34, borderRadius: 6, overflow: 'hidden', background: 'var(--border)', flexShrink: 0 }}>
        {thumbUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbUrl} alt={mapLabel(match.map)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, padding: '2px 0', background: badgeBg, color: badgeColor }}>
          {result ?? '?'}
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
            {mapLabel(match.map)}
          </p>
          {scoreStr && (
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, flexShrink: 0, color: scoreColor }}>
              {scoreStr}
            </span>
          )}
        </div>
        <p style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: '2px 0 0' }}>
          {match.competition_name} · {fmtDate(match.started_at)}
        </p>
      </div>
      <ExternalLink size={12} style={{ color: 'var(--faint)', flexShrink: 0 }} />
    </a>
  )
}

export default function MyMatchesDashboard({
  initialDemos,
  personalTeamId,
  steamId,
  faceitPlayerId,
}: {
  initialDemos: DemoRowData[]
  personalTeamId: string
  steamId: string | null
  faceitPlayerId: string | null
}) {
  const [demos] = useState(initialDemos)
  const [faceit, setFaceit] = useState<{ matches: FaceitRecentMatch[]; loading: boolean; linked: boolean }>({
    matches: [],
    loading: !!faceitPlayerId,
    linked: !!faceitPlayerId,
  })

  useEffect(() => {
    if (!faceitPlayerId) return
    let cancelled = false
    fetch('/api/matches/recent-faceit')
      .then(r => r.json())
      .then((data: { matches?: FaceitRecentMatch[]; linked?: boolean }) => {
        if (cancelled) return
        setFaceit({ matches: data.matches ?? [], loading: false, linked: data.linked !== false })
      })
      .catch(() => { if (!cancelled) setFaceit(prev => ({ ...prev, loading: false })) })
    return () => { cancelled = true }
  }, [faceitPlayerId])

  const stats = useMemo(() => computeStats(demos, steamId), [demos, steamId])
  const mapGroups = useMemo(() => buildMapGroups(demos), [demos])

  const perfTrends = useMemo(() => {
    const completed = [...demos.filter(d => d.status === 'completed')]
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
    return { results, runningRates }
  }, [demos])

  const STAT_CARDS = [
    {
      label: 'MATCHES',
      stat: stats.totalMatches || '—',
      sub: stats.totalMatches > 0 ? `${stats.wins}W ${stats.losses}L ${stats.draws}D` : 'No demos yet',
      color: 'var(--tside)',
    },
    {
      label: 'WIN RATE',
      stat: stats.totalMatches > 0 ? `${Math.round(stats.winRate * 100)}%` : '—',
      sub: stats.totalMatches > 0 ? `${stats.wins} wins from ${stats.totalMatches}` : 'Upload demos to track',
      color: 'var(--signal)',
    },
    {
      label: steamId ? 'MY K/D' : 'AVG K/D',
      stat: stats.kd !== null ? stats.kd.toFixed(2) : '—',
      sub: steamId ? 'Your kill/death ratio' : 'Team average',
      color: 'var(--accent)',
    },
    {
      label: steamId ? 'MY ADR' : 'AVG ADR',
      stat: stats.adr !== null ? stats.adr.toFixed(1) : '—',
      sub: steamId ? 'Your avg damage/round' : 'Team average',
      color: 'var(--ct)',
    },
  ]

  const hasDemos = demos.length > 0

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: 'var(--text)', lineHeight: 1.1, marginBottom: 4 }}>
            My Matches
          </h1>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>
            Track your personal performance across pugs, matchmaking, and scrims
          </p>
        </div>
        <DemoUploadButton teamId={personalTeamId} demoType="self" />
      </div>

      {/* Steam link nudge */}
      {!steamId && demos.filter(d => d.status === 'completed').length > 0 && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'rgba(0,255,200,0.04)', border: '1px solid rgba(0,255,200,0.12)', borderRadius: 12, padding: '10px 14px' }}>
          <Info size={14} style={{ color: 'var(--signal)', marginTop: 1, flexShrink: 0 }} />
          <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5, margin: 0 }}>
            <span style={{ color: 'var(--text)', fontWeight: 500 }}>Link your Steam account</span> in Settings to see your own per-match stats (K/D, ADR) rather than team averages.
          </p>
        </div>
      )}

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {STAT_CARDS.map((s, i) => (
          <div key={i} style={{ padding: 16, position: 'relative', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: s.color }} />
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--faint)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>{s.label}</p>
            <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', lineHeight: 1.1, marginBottom: 4 }}>{s.stat}</p>
            <p style={{ fontSize: 11, color: 'var(--muted)' }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Match History: CS2 + FACEIT columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

        {/* CS2 Premier / Competitive */}
        <div style={{ borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'rgba(59,130,246,0.06)', flexShrink: 0 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#60a5fa' }}>
              <circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>
            </svg>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>CS2 Premier / Competitive</span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', maxHeight: 440 }}>
            <CS2MatchPanel personalTeamId={personalTeamId} />
          </div>
        </div>

        {/* FACEIT */}
        <div style={{ borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'rgba(251,146,60,0.06)', flexShrink: 0 }}>
            <Zap size={13} style={{ color: '#fb923c' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>FACEIT</span>
          </div>
          <div style={{ flex: 1, padding: 12, display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto', maxHeight: 440 }}>
            {faceit.loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: 8 }}>
                <Loader2 size={16} style={{ color: 'var(--muted)', animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>Loading matches…</span>
              </div>
            ) : !faceit.linked ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 16px', textAlign: 'center', gap: 6 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', margin: 0 }}>FACEIT not linked</p>
                <p style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.4, maxWidth: 200, margin: 0 }}>
                  Run an ELO check in the AI Scout section to link your FACEIT account.
                </p>
              </div>
            ) : faceit.matches.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 16px', textAlign: 'center', gap: 6 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', margin: 0 }}>No FACEIT matches found</p>
                <p style={{ fontSize: 11, color: 'var(--muted)', margin: 0 }}>No recent CS2 match history available.</p>
              </div>
            ) : (
              faceit.matches.map(m => <FaceitMatchRow key={m.match_id} match={m} />)
            )}
          </div>
        </div>
      </div>

      {/* Performance Trends */}
      {perfTrends && (
        <div style={{ padding: 16, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)' }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={16} style={{ color: 'var(--accent)' }} /> Performance Trends
          </p>
          <div style={{ height: 120, display: 'flex', alignItems: 'flex-end', gap: 3, paddingBottom: 8 }}>
            {perfTrends.runningRates.map((rate, i) => (
              <div
                key={i}
                style={{ flex: 1, height: `${(rate / 100) * 100}px`, background: 'linear-gradient(180deg,var(--signal),var(--accent))', borderRadius: '2px 2px 0 0', opacity: 0.8, minWidth: 4 }}
                title={`Match ${i + 1}: ${rate}% win rate`}
              />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4, paddingTop: 8, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
            {perfTrends.results.map((r, i) => (
              <span
                key={i}
                style={{ width: 10, height: 10, borderRadius: '50%', background: r === 'w' ? 'var(--win)' : r === 'l' ? 'var(--loss)' : 'var(--muted)', flexShrink: 0 }}
                title={r === 'w' ? 'Win' : r === 'l' ? 'Loss' : 'Draw'}
              />
            ))}
          </div>
        </div>
      )}

      {/* Demo Browser */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Film size={16} style={{ color: 'var(--signal)' }} />
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Demo Browser</p>
          {hasDemos && (
            <span style={{ fontSize: 10, color: 'var(--muted)', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: 4, fontFamily: 'var(--font-mono)' }}>
              {demos.length} · {mapGroups.filter(g => g.demos.length > 0 && g.map !== 'unknown').length} maps
            </span>
          )}
        </div>
        {!hasDemos ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)' }}>
            <Film size={28} style={{ color: 'var(--faint)', margin: '0 auto 12px' }} />
            <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>No demos uploaded yet</p>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>
              Upload a .dem file to start tracking your performance
            </p>
            <DemoUploadButton teamId={personalTeamId} demoType="self" />
          </div>
        ) : (
          <MapFolderList mapGroups={mapGroups} />
        )}
      </div>

    </div>
  )
}
