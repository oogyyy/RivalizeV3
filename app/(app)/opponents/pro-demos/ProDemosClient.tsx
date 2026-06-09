'use client'

import { useState, useEffect, useCallback, type ChangeEvent } from 'react'
import Link from 'next/link'
import {
  Trophy, Search, Download, ChevronLeft, ChevronRight,
  ExternalLink, Loader2, Star, Filter, Database,
} from 'lucide-react'
import ImportProMatchModal from './ImportProMatchModal'

interface Team { id: string; name: string }

export interface ProMatch {
  id: string
  team1: string
  team2: string
  team1_logo: string | null
  team2_logo: string | null
  map: string | null
  maps: string[]
  best_of: number | null
  date: string | null
  event: string
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

const GRID_COLUMNS = 'minmax(0,1fr) 120px 70px 170px 130px'

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
  const [teamSearch, setTeamSearch] = useState('')
  const [query, setQuery] = useState('') // debounced server-side search
  const [loading, setLoading] = useState(false)
  const [fallback, setFallback] = useState(false)
  const [fallbackReason, setFallbackReason] = useState<string | null>(null)
  const [activeMatch, setActiveMatch] = useState<ProMatch | null>(null)
  const [hoveredRow, setHoveredRow] = useState<string | null>(null)
  const [imported, setImported] = useState<Record<string, string>>({})
  const PAGE_SIZE = 20

  const fetchMatches = useCallback(async (pg: number, map: string, q: string) => {
    setLoading(true)
    try {
      const p = new URLSearchParams({ page: pg.toString(), limit: PAGE_SIZE.toString() })
      if (map) p.set('map', map)
      if (q) p.set('q', q)
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
    fetchMatches(1, mapFilter, query)
  }, [fetchMatches, mapFilter, query])

  const goToPage = (pg: number) => {
    setPage(pg)
    fetchMatches(pg, mapFilter, query)
  }

  // Fallback (curated) data isn't searchable server-side — filter locally
  const filtered = fallback && teamSearch
    ? matches.filter(m =>
        m.team1.toLowerCase().includes(teamSearch.toLowerCase()) ||
        m.team2.toLowerCase().includes(teamSearch.toLowerCase())
      )
    : matches

  const pageButtonStyle = (disabled: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px',
    borderRadius: 8, border: '1px solid var(--border)', background: 'transparent',
    color: disabled ? 'var(--faint)' : 'var(--text)', fontSize: 12, fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer', transition: 'border-color 0.14s',
  })

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

      {/* ── Match list ── */}
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
            Try a different search term or map filter
          </p>
        </div>
      ) : (
        <div style={{ borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)', overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{
            display: 'grid', gridTemplateColumns: GRID_COLUMNS, gap: 12,
            padding: '10px 16px', background: 'var(--elevated)',
            fontSize: 10, fontWeight: 600, color: 'var(--muted)',
            textTransform: 'uppercase', letterSpacing: '0.06em',
            borderBottom: '1px solid var(--border)',
          }}>
            <div>Match</div>
            <div>Maps</div>
            <div>Score</div>
            <div>Event</div>
            <div style={{ textAlign: 'right' }}>Action</div>
          </div>

          {filtered.map((match, idx) => {
            const demoId = imported[match.id]
            const mapsLabel = match.maps.length > 0
              ? match.maps.map(m => m.replace(/^(de|cs)_/, '')).join(', ')
              : match.best_of ? `BO${match.best_of}` : '—'

            return (
              <div
                key={match.id}
                onMouseEnter={() => setHoveredRow(match.id)}
                onMouseLeave={() => setHoveredRow(null)}
                style={{
                  display: 'grid', gridTemplateColumns: GRID_COLUMNS, gap: 12,
                  alignItems: 'center', padding: '12px 16px',
                  borderBottom: idx < filtered.length - 1 ? '1px solid var(--hairline)' : 'none',
                  background: hoveredRow === match.id ? 'color-mix(in srgb, var(--accent) 4%, transparent)' : 'transparent',
                  transition: 'background 0.12s',
                }}
              >
                {/* Match */}
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ color: 'var(--accent)' }}>{match.team1}</span>
                    <span style={{ color: 'var(--faint)', margin: '0 6px', fontWeight: 500 }}>vs</span>
                    <span style={{ color: 'var(--loss)' }}>{match.team2}</span>
                  </p>
                  {match.date && (
                    <p style={{ fontSize: 10, color: 'var(--faint)', margin: '2px 0 0' }}>
                      {new Date(match.date).toLocaleDateString()}
                    </p>
                  )}
                </div>

                {/* Maps */}
                <div style={{ minWidth: 0 }}>
                  <span title={mapsLabel} style={{
                    fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text)',
                    textTransform: 'capitalize', display: 'block',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {mapsLabel}
                  </span>
                </div>

                {/* Score */}
                <div>
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: match.score ? 'var(--text)' : 'var(--faint)' }}>
                    {match.score ?? '—'}
                  </span>
                </div>

                {/* Event */}
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 11, color: 'var(--muted)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {match.event}
                  </p>
                </div>

                {/* Action */}
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
