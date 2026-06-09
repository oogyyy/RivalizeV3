'use client'

import { useState, useEffect, useCallback, type ChangeEvent } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  ArrowLeft, Trophy, Search, Download, ChevronLeft, ChevronRight,
  ExternalLink, Loader2, Star, Filter, Database,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
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
  { value: '',           label: 'All Maps' },
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

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-4 md:py-5">
          <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <Link href="/opponents" className="hover:text-foreground transition-colors">Opponents</Link>
            <span>/</span>
            <span className="text-foreground font-medium">Pro Match Library</span>
          </nav>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <Link href="/opponents" className="text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft size={18} />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                  <Trophy size={18} className="text-yellow-400" />
                  Pro Match Library
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
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
                className="text-sm bg-card border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-neon-green/50"
              >
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-5">
        {fallback && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-400/10 border border-blue-400/20 text-xs text-blue-300">
            <Database size={14} className="shrink-0 mt-0.5" />
            <p>
              {fallbackReason === 'missing-key'
                ? <>Showing curated matches. Live recent results need a PandaScore API key — add <code className="font-mono">PANDASCORE_API_KEY</code> to the server environment (free tier at <a href="https://www.pandascore.co" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-200">pandascore.co</a>).</>
                : 'Showing curated matches — live match data is temporarily unavailable.'}
            </p>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Map filter */}
          <div className="flex items-center gap-2">
            <Filter size={13} className="text-muted-foreground" />
            <div className="flex items-center rounded-lg border border-border overflow-hidden text-xs">
              {CS2_MAPS.map(m => (
                <button
                  key={m.value}
                  onClick={() => setMapFilter(m.value)}
                  className={cn(
                    'px-3 py-1.5 font-medium transition-colors whitespace-nowrap',
                    mapFilter === m.value
                      ? 'bg-neon-green/20 text-neon-green'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/30'
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Team search */}
          <div className="relative ml-auto">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={teamSearch}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setTeamSearch(e.target.value)}
              placeholder="Search teams…"
              className="pl-8 pr-3 py-1.5 text-xs bg-card border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-neon-green/50 w-40"
            />
          </div>
        </div>

        {/* Match list */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="text-neon-green animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            No matches found.
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
            {/* Table header */}
            <div className="grid px-4 py-2.5 bg-muted/30 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider"
              style={{ gridTemplateColumns: '1fr 110px 70px 160px auto' }}>
              <div>Match</div>
              <div>Maps</div>
              <div>Score</div>
              <div>Event</div>
              <div className="text-right">Action</div>
            </div>

            {filtered.map(match => {
              const demoId = imported[match.id]
              const mapsLabel = match.maps.length > 0
                ? match.maps.map(m => m.replace(/^(de|cs)_/, '')).join(', ')
                : match.best_of ? `BO${match.best_of}` : '—'

              return (
                <div
                  key={match.id}
                  className="grid items-center gap-3 px-4 py-3 hover:bg-accent/20 transition-colors"
                  style={{ gridTemplateColumns: '1fr 110px 70px 160px auto' }}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      <span className="text-neon-green">{match.team1}</span>
                      <span className="text-muted-foreground mx-1.5">vs</span>
                      <span className="text-red-400">{match.team2}</span>
                    </p>
                    {match.date && (
                      <p className="text-[10px] text-muted-foreground/60">
                        {new Date(match.date).toLocaleDateString()}
                      </p>
                    )}
                  </div>

                  <div className="min-w-0">
                    <span className="text-xs font-mono text-foreground capitalize truncate block" title={mapsLabel}>
                      {mapsLabel}
                    </span>
                  </div>

                  <div>
                    {match.score ? (
                      <span className="text-xs font-mono text-foreground">{match.score}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground/40">—</span>
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground truncate">{match.event}</p>
                  </div>

                  <div className="flex items-center gap-1.5 justify-end">
                    {demoId ? (
                      <Link href={`/demos/${demoId}`}>
                        <Button size="sm" variant="neon" className="h-7 text-xs gap-1">
                          <Star size={10} />
                          View
                        </Button>
                      </Link>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7 text-xs gap-1"
                        onClick={() => setActiveMatch(match)}
                        disabled={!selectedTeamId}
                        title={!selectedTeamId ? 'Select a team first' : undefined}
                      >
                        <Download size={10} />
                        Import
                      </Button>
                    )}
                    <a
                      href={hltvSearchUrl(match)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Find on HLTV"
                      className="inline-flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/[0.05] transition-colors"
                    >
                      <ExternalLink size={11} />
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Pagination */}
        {!fallback && (page > 1 || hasMore) && (
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => goToPage(page - 1)}
              className="gap-1.5"
            >
              <ChevronLeft size={14} />
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {page}{total ? ` · ${total.toLocaleString()} matches` : ''}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={!hasMore || loading}
              onClick={() => goToPage(page + 1)}
              className="gap-1.5"
            >
              Next
              <ChevronRight size={14} />
            </Button>
          </div>
        )}

        {/* Info card */}
        <div className="rounded-xl border border-border bg-card/50 p-4 flex items-start gap-3">
          <Database size={16} className="text-muted-foreground shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground">About this library</p>
            <p>
              Recent professional CS2 results provided by{' '}
              <a href="https://www.pandascore.co" target="_blank" rel="noopener noreferrer" className="text-neon-green hover:underline">
                PandaScore
              </a>.
              Demo files aren&apos;t distributed by any public API — click <span className="text-foreground font-medium">Import</span> on a match
              to grab the .dem from HLTV and drop it straight into your scouting library, or paste a direct demo URL.
            </p>
          </div>
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
