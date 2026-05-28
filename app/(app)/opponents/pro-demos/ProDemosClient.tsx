'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  ArrowLeft, Trophy, Search, Download, ChevronLeft, ChevronRight,
  ExternalLink, Loader2, Star, Filter, Database,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Team { id: string; name: string }

interface ProMatch {
  id: string
  team1: string
  team2: string
  map: string
  date: string | null
  event: string
  score: string | null
  demo_url: string | null
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
  { value: 'de_vertigo', label: 'Vertigo' },
]

export default function ProDemosClient({
  teams,
  defaultTeamId,
}: {
  teams: Team[]
  defaultTeamId: string | null
}) {
  const router = useRouter()
  const [selectedTeamId, setSelectedTeamId] = useState(defaultTeamId ?? '')
  const [matches, setMatches] = useState<ProMatch[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [mapFilter, setMapFilter] = useState('')
  const [teamSearch, setTeamSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [fallback, setFallback] = useState(false)
  const [importing, setImporting] = useState<Record<string, boolean>>({})
  const [imported, setImported] = useState<Record<string, string>>({})
  const PAGE_SIZE = 20

  const fetchMatches = useCallback(async (off: number, map: string) => {
    setLoading(true)
    try {
      const p = new URLSearchParams({ offset: off.toString(), limit: PAGE_SIZE.toString() })
      if (map) p.set('map', map)
      const res = await fetch(`/api/pro-demos?${p}`)
      const data = await res.json()
      setMatches(data.matches ?? [])
      setTotal(data.total ?? 0)
      setFallback(data.fallback ?? false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMatches(0, mapFilter)
  }, [fetchMatches, mapFilter])

  async function handleImport(match: ProMatch) {
    if (!selectedTeamId) return
    setImporting((p: Record<string, boolean>) => ({ ...p, [match.id]: true }))
    try {
      // Build the opponent name from team names
      const opponentName = match.team2

      if (match.demo_url) {
        // Try FaceIt-style streaming import
        const res = await fetch('/api/demos/faceit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'import',
            teamId: selectedTeamId,
            matchId: `pro-${match.id}`,
            opponentName,
            playerFaction: 'faction1',
          }),
        })
        if (res.ok) {
          const data = await res.json()
          setImported((p: Record<string, string>) => ({ ...p, [match.id]: data.demoId }))
          return
        }
      }

      // Fallback: open HLTV search for this match
      const query = encodeURIComponent(`${match.team1} vs ${match.team2} ${match.event}`)
      window.open(`https://www.hltv.org/search#query=${query}`, '_blank')
    } finally {
      setImporting((p: Record<string, boolean>) => ({ ...p, [match.id]: false }))
    }
  }

  const filtered = teamSearch
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
                    : `${total.toLocaleString()}+ professional CS2 matches`
                  }
                </p>
              </div>
            </div>
            {teams.length > 0 && (
              <select
                value={selectedTeamId}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedTeamId(e.target.value)}
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
              Showing curated matches. For the full 200K+ match database, the{' '}
              <a href="https://huggingface.co/datasets/blanchon/opencs2_dataset" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-200">
                OpenCS2 dataset
              </a>{' '}
              is temporarily unavailable.
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
                  onClick={() => { setMapFilter(m.value); setOffset(0) }}
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
              onChange={e => setTeamSearch(e.target.value)}
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
              style={{ gridTemplateColumns: '1fr 80px 100px 160px auto' }}>
              <div>Match</div>
              <div>Map</div>
              <div>Score</div>
              <div>Event</div>
              <div className="text-right">Action</div>
            </div>

            {filtered.map(match => {
              const isImporting = importing[match.id]
              const demoId = imported[match.id]
              const mapShort = match.map.replace('de_', '').replace('cs_', '')

              return (
                <div
                  key={match.id}
                  className="grid items-center gap-3 px-4 py-3 hover:bg-accent/20 transition-colors"
                  style={{ gridTemplateColumns: '1fr 80px 100px 160px auto' }}
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

                  <div>
                    <span className="text-xs font-mono text-foreground capitalize">{mapShort}</span>
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
                    ) : match.demo_url ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7 text-xs gap-1"
                        onClick={() => handleImport(match)}
                        disabled={isImporting || !selectedTeamId}
                      >
                        {isImporting
                          ? <><Loader2 size={10} className="animate-spin" /> Importing…</>
                          : <><Download size={10} /> Import</>
                        }
                      </Button>
                    ) : (
                      <a
                        href={`https://www.hltv.org/search#query=${encodeURIComponent(`${match.team1} vs ${match.team2}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground">
                          <ExternalLink size={10} />
                          HLTV
                        </Button>
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Pagination */}
        {!fallback && total > PAGE_SIZE && (
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              disabled={offset === 0 || loading}
              onClick={() => { const next = Math.max(0, offset - PAGE_SIZE); setOffset(next); fetchMatches(next, mapFilter) }}
              className="gap-1.5"
            >
              <ChevronLeft size={14} />
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total.toLocaleString()}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={offset + PAGE_SIZE >= total || loading}
              onClick={() => { const next = offset + PAGE_SIZE; setOffset(next); fetchMatches(next, mapFilter) }}
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
              Matches are sourced from the{' '}
              <a href="https://huggingface.co/datasets/blanchon/opencs2_dataset" target="_blank" rel="noopener noreferrer" className="text-neon-green hover:underline">
                OpenCS2 dataset
              </a>{' '}
              (200K+ professional matches). To import a demo, click HLTV to find the match, download the .dem file, then upload it via the{' '}
              <Link href="/opponents" className="text-neon-green hover:underline">Opponents</Link> page.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
