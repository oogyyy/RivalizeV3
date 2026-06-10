'use client'

import { useState, useEffect, useCallback, useMemo, type ChangeEvent } from 'react'
import Link from 'next/link'
import {
  Trophy, Search, Download, ChevronLeft, ChevronRight,
  ExternalLink, Loader2, Star, Filter, Database, Radio, CalendarClock,
} from 'lucide-react'
import ImportProMatchModal from './ImportProMatchModal'

interface Team { id: string; name: string }

interface LiveMatch {
  id: string
  team1: string
  team2: string
  team1_logo: string | null
  team2_logo: string | null
  team1_score: number
  team2_score: number
  current_map: string | null
  maps_finished: number
  best_of: number | null
  begin_at: string | null
  event: string
  status: string
  stream_url: string | null
}

export interface ProMatch {
  id: string
  team1: string
  team2: string
  team1_logo: string | null
  team2_logo: string | null
  team1_score?: number | null
  team2_score?: number | null
  winner?: 1 | 2 | null
  map: string | null
  maps: string[]
  best_of: number | null
  date: string | null
  event: string
  league_logo?: string | null
  prizepool?: string | null
  score: string | null
}

const CS2_MAPS = [
  { value: '',           label: 'All' },
  { value: 'de_dust2',   label: 'Dust2' },
  { value: 'de_mirage',  label: 'Mirage' },
  { value: 'de_inferno', label: 'Inferno' },
  { value: 'de_nuke',    label: 'Nuke' },
  { value: 'de_ancient', label: 'Ancient' },
  { value: 'de_anubis',  label: 'Anubis' },
  { value: 'de_overpass',label: 'Overpass' },
  { value: 'de_train',   label: 'Train' },
]

function hltvSearchUrl(match: ProMatch) {
  return `https://www.google.com/search?q=${encodeURIComponent(
    `site:hltv.org ${match.team1} vs ${match.team2} ${match.event}`
  )}`
}

function startsIn(beginAt: string | null): string {
  if (!beginAt) return 'TBD'
  const diff = new Date(beginAt).getTime() - Date.now()
  if (diff <= 0) return 'starting'
  const mins = Math.round(diff / 60000)
  if (mins < 60) return `in ${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `in ${hours}h ${mins % 60}m`
  return new Date(beginAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
    ' ' + new Date(beginAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

/** Last 7 days as day-selector tabs, most recent last (like bo3.gg). */
function buildDayTabs() {
  const tabs: { value: string; label: string }[] = [{ value: '', label: 'All' }]
  const days: { value: string; label: string }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const value = d.toISOString().slice(0, 10)
    const label = i === 0
      ? 'Today'
      : i === 1
        ? 'Yesterday'
        : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
    days.push({ value, label })
  }
  return [...tabs, ...days]
}

export default function ProDemosClient({
  teams,
  defaultTeamId,
}: {
  teams: Team[]
  defaultTeamId: string | null
}) {
  const [selectedTeamId, setSelectedTeamId] = useState(defaultTeamId ?? '')
  const [matches, setMatches] = useState<ProMatch[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [mapFilter, setMapFilter] = useState('')
  const [dayFilter, setDayFilter] = useState('')
  const [teamSearch, setTeamSearch] = useState('')
  const [query, setQuery] = useState('') // debounced server-side search
  const [loading, setLoading] = useState(false)
  const [fallback, setFallback] = useState(false)
  const [fallbackReason, setFallbackReason] = useState<string | null>(null)
  const [activeMatch, setActiveMatch] = useState<ProMatch | null>(null)
  const [hoveredRow, setHoveredRow] = useState<string | null>(null)
  const [imported, setImported] = useState<Record<string, string>>({})
  const [liveMatches, setLiveMatches] = useState<LiveMatch[]>([])
  const [upcomingMatches, setUpcomingMatches] = useState<LiveMatch[]>([])
  const PAGE_SIZE = 20

  const dayTabs = useMemo(buildDayTabs, [])

  // Poll live/upcoming matches every 60s
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch('/api/pro-demos/live')
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        setLiveMatches(data.live ?? [])
        setUpcomingMatches(data.upcoming ?? [])
      } catch { /* keep last known state */ }
    }
    load()
    const t = setInterval(load, 60_000)
    return () => { cancelled = true; clearInterval(t) }
  }, [])

  const fetchMatches = useCallback(async (pg: number, map: string, q: string, day: string) => {
    setLoading(true)
    try {
      const p = new URLSearchParams({ page: pg.toString(), limit: PAGE_SIZE.toString() })
      if (map) p.set('map', map)
      if (q) p.set('q', q)
      if (day) p.set('date', day)
      const res = await fetch(`/api/pro-demos?${p}`)
      const data = await res.json()
      setMatches(data.matches ?? [])
      setTotal(data.total ?? null)
      setHasMore(data.hasMore ?? false)
      setFallback(data.fallback ?? false)
      setFallbackReason(data.reason ?? null)
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounce the team search before hitting the API
  useEffect(() => {
    const t = setTimeout(() => setQuery(teamSearch.trim()), 400)
    return () => clearTimeout(t)
  }, [teamSearch])

  useEffect(() => {
    setPage(1)
    fetchMatches(1, mapFilter, query, dayFilter)
  }, [fetchMatches, mapFilter, query, dayFilter])

  const goToPage = (pg: number) => {
    setPage(pg)
    fetchMatches(pg, mapFilter, query, dayFilter)
  }

  // Fallback (curated) data isn't searchable server-side — filter locally
  const filtered = fallback && teamSearch
    ? matches.filter(m =>
        m.team1.toLowerCase().includes(teamSearch.toLowerCase()) ||
        m.team2.toLowerCase().includes(teamSearch.toLowerCase())
      )
    : matches

  // Group consecutive matches by event/tournament (results arrive date-sorted)
  const grouped = useMemo(() => {
    const groups: { event: string; league_logo: string | null; prizepool: string | null; matches: ProMatch[] }[] = []
    for (const m of filtered) {
      const last = groups[groups.length - 1]
      if (last && last.event === m.event) {
        last.matches.push(m)
        if (!last.league_logo && m.league_logo) last.league_logo = m.league_logo
        if (!last.prizepool && m.prizepool) last.prizepool = m.prizepool
      } else {
        groups.push({
          event: m.event,
          league_logo: m.league_logo ?? null,
          prizepool: m.prizepool ?? null,
          matches: [m],
        })
      }
    }
    return groups
  }, [filtered])

  const pageButtonStyle = (disabled: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px',
    borderRadius: 8, border: '1px solid var(--border)', background: 'transparent',
    color: disabled ? 'var(--faint)' : 'var(--text)', fontSize: 12, fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer', transition: 'border-color 0.14s',
  })

  const teamLine = (
    name: string, logo: string | null, score: number | null | undefined, isWinner: boolean, finished: boolean
  ) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
      <div style={{ width: 16, height: 16, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {logo
          ? <img src={logo} alt="" style={{ maxWidth: 16, maxHeight: 16, objectFit: 'contain' }} />
          : <div style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--elevated)', border: '1px solid var(--hairline)' }} />}
      </div>
      <span style={{
        fontSize: 12.5, fontWeight: isWinner ? 650 : 500,
        color: finished ? (isWinner ? 'var(--text)' : 'var(--muted)') : 'var(--text)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
      }}>
        {name}
      </span>
      <span style={{
        fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font-mono)', flexShrink: 0,
        color: score == null ? 'var(--faint)' : isWinner ? 'var(--win)' : 'var(--muted)',
        minWidth: 14, textAlign: 'right',
      }}>
        {score ?? '–'}
      </span>
    </div>
  )

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '28px 28px' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(250,204,21,0.1)', border: '1px solid rgba(250,204,21,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Trophy size={18} style={{ color: '#facc15' }} />
          </div>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', lineHeight: 1.1, marginBottom: 3 }}>
              Pro Match Library
            </h1>
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>
              {fallback
                ? 'Curated pro matches — import to your scouting library'
                : `Recent pro matches${total ? ` · ${total.toLocaleString()} tracked` : ''} — import to your scouting library`
              }
            </p>
          </div>
        </div>
        {teams.length > 0 && (
          <select
            value={selectedTeamId}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedTeamId(e.target.value)}
            style={{
              fontSize: 13, background: 'var(--card)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '8px 12px', color: 'var(--text)', outline: 'none', cursor: 'pointer',
            }}
          >
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
      </div>

      {/* ── Fallback banner ── */}
      {fallback && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px',
          borderRadius: 10, marginBottom: 18,
          background: 'color-mix(in srgb, var(--signal) 8%, transparent)',
          border: '1px solid color-mix(in srgb, var(--signal) 20%, transparent)',
        }}>
          <Database size={14} style={{ color: 'var(--signal)', flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12, color: 'var(--signal)', margin: 0, lineHeight: 1.5 }}>
            {fallbackReason === 'missing-key'
              ? <>Showing curated matches. Live recent results need a PandaScore API key — add <code style={{ fontFamily: 'var(--font-mono)' }}>PANDASCORE_API_KEY</code> to the server environment (free tier at <a href="https://www.pandascore.co" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>pandascore.co</a>).</>
              : 'Showing curated matches — live match data is temporarily unavailable.'}
          </p>
        </div>
      )}

      {/* ── Live now ── */}
      {liveMatches.length > 0 && (
        <div style={{ marginBottom: 22 }}>
          <style>{`@keyframes rvLivePulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.35 } }`}</style>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Radio size={13} style={{ color: 'var(--loss)' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Live Now
            </span>
            <span style={{ fontSize: 10, color: 'var(--faint)' }}>· updates every 60s</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 10 }}>
            {liveMatches.map(lm => (
              <div key={lm.id} style={{
                borderRadius: 12, border: '1px solid color-mix(in srgb, var(--loss) 25%, var(--border))',
                background: 'var(--card)', padding: '12px 14px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    fontSize: 9, fontWeight: 700, color: 'var(--loss)',
                    textTransform: 'uppercase', letterSpacing: '0.1em',
                  }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%', background: 'var(--loss)',
                      animation: 'rvLivePulse 1.6s ease-in-out infinite',
                    }} />
                    Live
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>
                    {lm.event}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                    {lm.team1_logo && <img src={lm.team1_logo} alt="" style={{ width: 18, height: 18, objectFit: 'contain', flexShrink: 0 }} />}
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lm.team1}</span>
                  </div>
                  <span style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text)', flexShrink: 0 }}>
                    {lm.team1_score}<span style={{ color: 'var(--faint)', margin: '0 5px' }}>:</span>{lm.team2_score}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1, justifyContent: 'flex-end' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lm.team2}</span>
                    {lm.team2_logo && <img src={lm.team2_logo} alt="" style={{ width: 18, height: 18, objectFit: 'contain', flexShrink: 0 }} />}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                  <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--muted)', textTransform: 'capitalize' }}>
                    {lm.current_map ? lm.current_map.replace(/^(de|cs)_/, '') : '—'}
                    {lm.best_of ? ` · map ${Math.min(lm.maps_finished + 1, lm.best_of)} of BO${lm.best_of}` : ''}
                  </span>
                  {lm.stream_url && (
                    <a
                      href={lm.stream_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        fontSize: 10, fontWeight: 600, color: 'var(--loss)',
                        textDecoration: 'none', padding: '2px 8px', borderRadius: 6,
                        background: 'color-mix(in srgb, var(--loss) 10%, transparent)',
                        border: '1px solid color-mix(in srgb, var(--loss) 22%, transparent)',
                      }}
                    >
                      <ExternalLink size={9} /> Watch
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Upcoming ── */}
      {upcomingMatches.length > 0 && (
        <div style={{ marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <CalendarClock size={13} style={{ color: 'var(--muted)' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Upcoming
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {upcomingMatches.map(um => (
              <div key={um.id} style={{
                flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10,
                borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)',
                padding: '8px 12px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {um.team1_logo && <img src={um.team1_logo} alt="" style={{ width: 14, height: 14, objectFit: 'contain' }} />}
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>{um.team1}</span>
                  <span style={{ fontSize: 10, color: 'var(--faint)' }}>vs</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>{um.team2}</span>
                  {um.team2_logo && <img src={um.team2_logo} alt="" style={{ width: 14, height: 14, objectFit: 'contain' }} />}
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 600, fontFamily: 'var(--font-mono)',
                  color: 'var(--accent)', whiteSpace: 'nowrap',
                  padding: '2px 7px', borderRadius: 6,
                  background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
                }}>
                  {startsIn(um.begin_at)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Day selector ── */}
      {!fallback && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 14, overflowX: 'auto', paddingBottom: 2 }}>
          {dayTabs.map(d => {
            const active = dayFilter === d.value
            return (
              <button
                key={d.value || 'all'}
                onClick={() => setDayFilter(d.value)}
                style={{
                  padding: '7px 13px', fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap',
                  borderRadius: 8, border: '1px solid', cursor: 'pointer',
                  borderColor: active ? 'color-mix(in srgb, var(--accent) 45%, transparent)' : 'var(--border)',
                  background: active ? 'var(--accent-soft)' : 'var(--card)',
                  color: active ? 'var(--text)' : 'var(--muted)',
                  transition: 'background 0.12s, color 0.12s, border-color 0.12s',
                  flexShrink: 0,
                }}
              >
                {d.label}
              </button>
            )
          })}
        </div>
      )}

      {/* ── Search bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px', borderRadius: 10,
        border: '1px solid var(--border)', background: 'var(--card)',
        marginBottom: 16, transition: 'border-color 0.14s',
      }}>
        <Search size={14} style={{ color: 'var(--faint)', flexShrink: 0 }} />
        <input
          type="text"
          placeholder="Search teams…"
          value={teamSearch}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setTeamSearch(e.target.value)}
          onFocus={e => ((e.currentTarget.parentElement as HTMLDivElement).style.borderColor = 'var(--accent)')}
          onBlur={e => ((e.currentTarget.parentElement as HTMLDivElement).style.borderColor = 'var(--border)')}
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: 'var(--text)' }}
        />
      </div>

      {/* ── Map filter ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22, flexWrap: 'wrap' }}>
        <Filter size={13} style={{ color: 'var(--faint)', flexShrink: 0 }} />
        <div style={{ display: 'flex', borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden', flexShrink: 0 }}>
          {CS2_MAPS.map((m, i) => (
            <button
              key={m.value}
              onClick={() => setMapFilter(m.value)}
              style={{
                padding: '6px 12px', fontSize: 11, fontWeight: 600,
                background: mapFilter === m.value ? 'var(--accent-soft)' : 'transparent',
                color: mapFilter === m.value ? 'var(--text)' : 'var(--muted)',
                border: 'none', borderLeft: i > 0 ? '1px solid var(--border)' : 'none',
                cursor: 'pointer', transition: 'background 0.12s, color 0.12s', whiteSpace: 'nowrap',
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Match list grouped by tournament ── */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 24px' }}>
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent)' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', textAlign: 'center', borderRadius: 14, border: '1px dashed var(--border)' }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: 'color-mix(in srgb, var(--accent) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Search size={22} style={{ color: 'var(--accent)' }} />
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>No matches found</p>
          <p style={{ fontSize: 12, color: 'var(--muted)', maxWidth: 280 }}>
            Try a different search term, day, or map filter
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {grouped.map((group, gi) => (
            <div key={`${group.event}-${gi}`} style={{ borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)', overflow: 'hidden' }}>

              {/* Tournament header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px',
                background: 'var(--elevated)', borderBottom: '1px solid var(--border)',
              }}>
                <div style={{ width: 20, height: 20, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {group.league_logo
                    ? <img src={group.league_logo} alt="" style={{ maxWidth: 20, maxHeight: 20, objectFit: 'contain' }} />
                    : <Trophy size={13} style={{ color: 'var(--faint)' }} />}
                </div>
                <span style={{ fontSize: 12, fontWeight: 650, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {group.event}
                </span>
                {group.prizepool && (
                  <span style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--faint)', flexShrink: 0 }}>
                    {group.prizepool}
                  </span>
                )}
              </div>

              {/* Match rows */}
              {group.matches.map((match, idx) => {
                const demoId = imported[match.id]
                const finished = match.score != null
                const mapsLabel = match.maps.length > 0
                  ? match.maps.map(m => m.replace(/^(de|cs)_/, '')).join(' · ')
                  : match.best_of ? `BO${match.best_of}` : '—'

                return (
                  <div
                    key={match.id}
                    onMouseEnter={() => setHoveredRow(match.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '64px minmax(0,1fr) 150px 150px',
                      gap: 14, alignItems: 'center', padding: '10px 14px',
                      borderBottom: idx < group.matches.length - 1 ? '1px solid var(--hairline)' : 'none',
                      background: hoveredRow === match.id ? 'color-mix(in srgb, var(--accent) 4%, transparent)' : 'transparent',
                      transition: 'background 0.12s',
                    }}
                  >
                    {/* Status + time */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <span style={{
                        fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
                        color: finished ? 'var(--faint)' : 'var(--signal)',
                        padding: '2px 6px', borderRadius: 5, textAlign: 'center',
                        background: 'var(--elevated)', border: '1px solid var(--hairline)',
                      }}>
                        {finished ? 'Ended' : 'TBD'}
                      </span>
                      {match.date && (
                        <span style={{ fontSize: 9.5, color: 'var(--faint)', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                          {new Date(match.date).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>

                    {/* Stacked teams */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0, maxWidth: 280 }}>
                      {teamLine(match.team1, match.team1_logo, match.team1_score, match.winner === 1, finished)}
                      {teamLine(match.team2, match.team2_logo, match.team2_score, match.winner === 2, finished)}
                    </div>

                    {/* Maps */}
                    <div style={{ minWidth: 0 }}>
                      <span title={mapsLabel} style={{
                        fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--muted)',
                        textTransform: 'capitalize', display: 'block',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {mapsLabel}
                      </span>
                      {match.best_of && match.maps.length > 0 && (
                        <span style={{ fontSize: 9.5, color: 'var(--faint)' }}>BO{match.best_of}</span>
                      )}
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                      {demoId ? (
                        <Link
                          href={`/demos/${demoId}`}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px',
                            borderRadius: 7, background: 'color-mix(in srgb, var(--win) 14%, transparent)',
                            border: '1px solid color-mix(in srgb, var(--win) 30%, transparent)',
                            color: 'var(--win)', fontSize: 11, fontWeight: 600, textDecoration: 'none',
                          }}
                        >
                          <Star size={10} /> View
                        </Link>
                      ) : (
                        <button
                          onClick={() => setActiveMatch(match)}
                          disabled={!selectedTeamId}
                          title={!selectedTeamId ? 'Select a team first' : undefined}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px',
                            borderRadius: 7, border: 'none',
                            background: 'var(--accent)', color: '#fff',
                            fontSize: 11, fontWeight: 600,
                            cursor: selectedTeamId ? 'pointer' : 'not-allowed',
                            opacity: selectedTeamId ? 1 : 0.5,
                          }}
                        >
                          <Download size={10} /> Import
                        </button>
                      )}
                      <a
                        href={hltvSearchUrl(match)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Find on HLTV"
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: 26, height: 26, borderRadius: 7,
                          border: '1px solid var(--border)', color: 'var(--muted)',
                          transition: 'color 0.12s, border-color 0.12s',
                        }}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text)'
                          ;(e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--border-2)'
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLAnchorElement).style.color = 'var(--muted)'
                          ;(e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--border)'
                        }}
                      >
                        <ExternalLink size={11} />
                      </a>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {/* ── Pagination ── */}
      {!fallback && (page > 1 || hasMore) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
          <button
            disabled={page <= 1 || loading}
            onClick={() => goToPage(page - 1)}
            style={pageButtonStyle(page <= 1 || loading)}
          >
            <ChevronLeft size={13} /> Previous
          </button>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            Page {page}{total ? ` · ${total.toLocaleString()} matches` : ''}
          </span>
          <button
            disabled={!hasMore || loading}
            onClick={() => goToPage(page + 1)}
            style={pageButtonStyle(!hasMore || loading)}
          >
            Next <ChevronRight size={13} />
          </button>
        </div>
      )}

      {/* ── Info card ── */}
      <div style={{
        marginTop: 20, borderRadius: 12, border: '1px solid var(--border)',
        background: 'var(--card)', padding: 16,
        display: 'flex', alignItems: 'flex-start', gap: 12,
      }}>
        <Database size={15} style={{ color: 'var(--muted)', flexShrink: 0, marginTop: 2 }} />
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', margin: '0 0 4px' }}>About this library</p>
          <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0, lineHeight: 1.6 }}>
            Recent professional CS2 results provided by{' '}
            <a href="https://www.pandascore.co" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
              PandaScore
            </a>.
            Demo files aren&apos;t distributed by any public API — click <span style={{ color: 'var(--text)', fontWeight: 600 }}>Import</span> on a match
            to grab the .dem from HLTV and drop it straight into your scouting library, or paste a direct demo URL.
          </p>
        </div>
      </div>

      {activeMatch && selectedTeamId && (
        <ImportProMatchModal
          match={activeMatch}
          teamId={selectedTeamId}
          onClose={() => setActiveMatch(null)}
          onImported={(demoId) => setImported(prev => ({ ...prev, [activeMatch.id]: demoId }))}
        />
      )}
    </div>
  )
}
