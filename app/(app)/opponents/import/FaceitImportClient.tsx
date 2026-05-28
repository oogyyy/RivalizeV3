'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  ArrowLeft, Search, Download, CheckCircle2, AlertCircle,
  ExternalLink, Loader2, Zap, Users, Trophy,
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface Team { id: string; name: string }

interface FaceitPlayer {
  id: string
  nickname: string
  avatar: string
  elo: number
  level: number
}

interface FaceitMatch {
  match_id: string
  competition_name: string
  started_at: number
  teams: { faction1: string; faction2: string }
  score: { faction1: number; faction2: number } | null
  winner: string | null
  match_url: string
}

type ImportStatus = 'idle' | 'importing' | 'done' | 'error'

interface MatchImportState {
  status: ImportStatus
  demoId?: string
  error?: string
}

export default function FaceitImportClient({
  teams,
  defaultTeamId,
}: {
  teams: Team[]
  defaultTeamId: string | null
}) {
  const router = useRouter()

  const [selectedTeamId, setSelectedTeamId] = useState(defaultTeamId ?? '')
  const [nickname, setNickname] = useState('')
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState('')
  const [player, setPlayer] = useState<FaceitPlayer | null>(null)
  const [matches, setMatches] = useState<FaceitMatch[]>([])
  const [importStates, setImportStates] = useState<Record<string, MatchImportState>>({})
  const [configured, setConfigured] = useState<boolean | null>(null)

  // Check if FaceIt API is configured on first render
  useState(() => {
    fetch('/api/demos/faceit')
      .then(r => r.json())
      .then(d => setConfigured(d.configured))
      .catch(() => setConfigured(false))
  })

  async function handleLookup() {
    if (!nickname.trim()) return
    setLookupLoading(true)
    setLookupError('')
    setPlayer(null)
    setMatches([])
    try {
      const res = await fetch('/api/demos/faceit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'lookup', nickname: nickname.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setLookupError(data.error ?? 'Lookup failed')
        return
      }
      setPlayer(data.player)
      setMatches(data.matches ?? [])
    } catch {
      setLookupError('Network error — please try again')
    } finally {
      setLookupLoading(false)
    }
  }

  async function handleImport(match: FaceitMatch) {
    if (!selectedTeamId) return
    const matchId = match.match_id

    // Determine which faction is the "opponent" — opposite of us
    // We don't know which faction our team is, so prompt user
    // For simplicity: treat faction2 as opponent by default (common setup)
    const opponentName = match.teams.faction2

    setImportStates((prev: Record<string, MatchImportState>) => ({ ...prev, [matchId]: { status: 'importing' } }))
    try {
      const res = await fetch('/api/demos/faceit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'import',
          teamId: selectedTeamId,
          matchId,
          opponentName,
          playerFaction: 'faction1',
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setImportStates((prev: Record<string, MatchImportState>) => ({ ...prev, [matchId]: { status: 'error', error: data.error } }))
        return
      }
      setImportStates((prev: Record<string, MatchImportState>) => ({ ...prev, [matchId]: { status: 'done', demoId: data.demoId } }))
    } catch {
      setImportStates((prev: Record<string, MatchImportState>) => ({ ...prev, [matchId]: { status: 'error', error: 'Network error' } }))
    }
  }

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-4 md:py-5">
          <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <Link href="/opponents" className="hover:text-foreground transition-colors">Opponents</Link>
            <span>/</span>
            <span className="text-foreground font-medium">Import from FaceIt</span>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/opponents" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                <Zap size={18} className="text-orange-400" />
                Import from FaceIt
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Search a FaceIt player and import their recent CS2 demos
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-6">

        {/* Not configured warning */}
        {configured === false && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-yellow-400/10 border border-yellow-400/20">
            <AlertCircle size={16} className="text-yellow-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground">FaceIt API key not configured</p>
              <p className="text-xs text-muted-foreground mt-1">
                Add <code className="font-mono text-yellow-400">FACEIT_API_KEY</code> to your environment variables.
                Get a free key at{' '}
                <a href="https://developers.faceit.com" target="_blank" rel="noopener noreferrer" className="text-yellow-400 hover:underline">
                  developers.faceit.com
                </a>.
              </p>
            </div>
          </div>
        )}

        {/* Team selector */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Import to team
          </label>
          <select
            value={selectedTeamId}
            onChange={e => setSelectedTeamId(e.target.value)}
            className="w-full text-sm bg-card border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-neon-green/50"
          >
            {teams.length === 0 && <option value="">No teams</option>}
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        {/* Nickname lookup */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            FaceIt nickname
          </label>
          <div className="flex gap-2">
            <input
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLookup()}
              placeholder="e.g. s1mple"
              className="flex-1 text-sm bg-card border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-neon-green/50"
            />
            <Button
              variant="neon"
              onClick={handleLookup}
              disabled={lookupLoading || !nickname.trim() || configured === false}
              className="gap-2 shrink-0"
            >
              {lookupLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              Search
            </Button>
          </div>
          {lookupError && (
            <p className="text-xs text-red-400 flex items-center gap-1.5">
              <AlertCircle size={12} />
              {lookupError}
            </p>
          )}
        </div>

        {/* Player card */}
        {player && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-card border border-border">
            {player.avatar ? (
              <img src={player.avatar} alt={player.nickname} className="w-12 h-12 rounded-full object-cover" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center">
                <span className="text-lg font-bold text-foreground">{player.nickname.charAt(0).toUpperCase()}</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground">{player.nickname}</p>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Trophy size={10} />
                  Level {player.level}
                </span>
                <span className="text-xs text-orange-400 font-mono font-bold">{player.elo} ELO</span>
              </div>
            </div>
            <span className="text-xs text-muted-foreground">{matches.length} recent matches</span>
          </div>
        )}

        {/* Match list */}
        {matches.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Users size={14} className="text-neon-green" />
              Recent Matches
              <span className="text-xs text-muted-foreground font-normal">— click Import to add a demo</span>
            </h2>
            <div className="rounded-lg border border-border overflow-hidden divide-y divide-border">
              {matches.map(match => {
                const state = importStates[match.match_id]
                const date = new Date(match.started_at * 1000).toLocaleDateString()
                return (
                  <div key={match.match_id} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/20 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-foreground truncate">
                          {match.teams.faction1} <span className="text-muted-foreground">vs</span> {match.teams.faction2}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">{date}</span>
                        <span className="text-[10px] text-muted-foreground">·</span>
                        <span className="text-[10px] text-muted-foreground">{match.competition_name}</span>
                        {match.score && (
                          <>
                            <span className="text-[10px] text-muted-foreground">·</span>
                            <span className="text-[10px] font-mono text-foreground">
                              {match.score.faction1}–{match.score.faction2}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {match.match_url && (
                        <a href={match.match_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
                          <ExternalLink size={13} />
                        </a>
                      )}

                      {state?.status === 'done' ? (
                        <span className="flex items-center gap-1 text-xs text-neon-green font-medium">
                          <CheckCircle2 size={13} />
                          Imported
                        </span>
                      ) : state?.status === 'error' ? (
                        <span className="text-xs text-red-400 flex items-center gap-1" title={state.error}>
                          <AlertCircle size={13} />
                          Failed
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          className={cn('h-7 text-xs gap-1.5', state?.status === 'importing' && 'opacity-70')}
                          onClick={() => handleImport(match)}
                          disabled={state?.status === 'importing' || !selectedTeamId}
                        >
                          {state?.status === 'importing'
                            ? <><Loader2 size={11} className="animate-spin" /> Importing…</>
                            : <><Download size={11} /> Import</>
                          }
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Done CTA */}
        {Object.values(importStates).some(s => s.status === 'done') && (
          <div className="p-4 rounded-lg bg-neon-green/10 border border-neon-green/20 text-center space-y-3">
            <CheckCircle2 size={24} className="text-neon-green mx-auto" />
            <p className="text-sm font-semibold text-foreground">Demos imported successfully</p>
            <p className="text-xs text-muted-foreground">
              They&apos;re being parsed in the background. Check your opponents page in a moment.
            </p>
            <Link href="/opponents">
              <Button variant="neon" size="sm">View Opponents</Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
