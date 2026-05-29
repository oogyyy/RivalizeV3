'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Download, X, Loader2, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface FaceitMatch {
  match_id: string
  competition_name: string
  started_at: number
  teams: {
    faction1: { name: string; roster: string[] }
    faction2: { name: string; roster: string[] }
  }
  score: { faction1: number; faction2: number } | null
  winner: string | null
  match_url: string
}

type ImportState = 'idle' | 'importing' | 'done' | 'error'

interface MatchRow extends FaceitMatch {
  importState: ImportState
  importError?: string
}

interface Props {
  teamId: string
  faceitNickname: string
}

function detectFaction(match: FaceitMatch, nickname: string): 'faction1' | 'faction2' {
  if (match.teams.faction1.roster.includes(nickname)) return 'faction1'
  if (match.teams.faction2.roster.includes(nickname)) return 'faction2'
  return 'faction2'
}

function formatMatchDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

export default function FaceitImportButton({ teamId, faceitNickname }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<MatchRow[]>([])
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  async function loadMatches() {
    setLoading(true)
    setError(null)
    setRows([])
    try {
      const res = await fetch('/api/demos/faceit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'lookup', nickname: faceitNickname }),
      })
      const data = await res.json() as {
        matches?: FaceitMatch[]
        error?: string
      }
      if (!res.ok || data.error) throw new Error(data.error ?? 'Lookup failed')
      setRows((data.matches ?? []).map(m => ({ ...m, importState: 'idle' })))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load matches')
    } finally {
      setLoading(false)
    }
  }

  function handleOpen() {
    setOpen(true)
    loadMatches()
  }

  function handleClose() {
    setOpen(false)
    setRows([])
    setError(null)
    if (rows.some(r => r.importState === 'done')) router.refresh()
  }

  async function importMatch(matchId: string) {
    const row = rows.find(r => r.match_id === matchId)
    if (!row) return

    const playerFaction = detectFaction(row, faceitNickname)
    const opponentFaction = playerFaction === 'faction1' ? 'faction2' : 'faction1'
    const opponentName = row.teams[opponentFaction].name || 'Unknown'

    setRows(prev => prev.map(r =>
      r.match_id === matchId ? { ...r, importState: 'importing', importError: undefined } : r
    ))

    try {
      const res = await fetch('/api/demos/faceit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'import',
          teamId,
          matchId,
          opponentName,
          playerFaction,
        }),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok || data.error) throw new Error(data.error ?? 'Import failed')
      setRows(prev => prev.map(r =>
        r.match_id === matchId ? { ...r, importState: 'done' } : r
      ))
    } catch (err) {
      setRows(prev => prev.map(r =>
        r.match_id === matchId
          ? { ...r, importState: 'error', importError: err instanceof Error ? err.message : 'Import failed' }
          : r
      ))
    }
  }

  if (!open) {
    return (
      <Button variant="outline" onClick={handleOpen} className="gap-2">
        <Download size={16} />
        Import from FACEIT
      </Button>
    )
  }

  const modal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl bg-card border border-border rounded-xl shadow-2xl max-h-[85vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
          <div>
            <h2 className="text-lg font-bold text-foreground">Import from FACEIT</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Linked as <span className="text-neon-green font-medium">{faceitNickname}</span> · recent CS2 match history
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 size={24} className="text-neon-green animate-spin" />
              <p className="text-sm text-muted-foreground">Loading FACEIT match history…</p>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/5 px-4 py-3">
              <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-red-400 font-medium">Failed to load matches</p>
                <p className="text-xs text-red-400/70 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {!loading && !error && rows.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
              <p className="text-sm font-medium text-foreground">No matches found</p>
              <p className="text-xs text-muted-foreground">
                No recent CS2 matches for <span className="text-neon-green">{faceitNickname}</span>
              </p>
            </div>
          )}

          {!loading && rows.length > 0 && (
            <div className="space-y-2">
              {rows.map(row => {
                const playerFaction = detectFaction(row, faceitNickname)
                const opponentFaction = playerFaction === 'faction1' ? 'faction2' : 'faction1'
                const opponentName = row.teams[opponentFaction].name || 'Unknown'
                const myTeamName = row.teams[playerFaction].name || faceitNickname
                const score = row.score
                const won = row.winner === playerFaction

                return (
                  <div
                    key={row.match_id}
                    className="flex items-center gap-3 rounded-lg border border-border bg-background/50 px-4 py-3"
                  >
                    {/* Match info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground truncate">
                          vs {opponentName}
                        </span>
                        {score && (
                          <span className={`text-xs font-mono font-bold shrink-0 ${won ? 'text-neon-green' : 'text-red-400'}`}>
                            {won
                              ? `W ${score[playerFaction]}–${score[opponentFaction]}`
                              : `L ${score[playerFaction]}–${score[opponentFaction]}`}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                        <span>{row.competition_name}</span>
                        <span>·</span>
                        <span>{formatMatchDate(row.started_at)}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5 truncate">
                        {myTeamName}
                      </p>
                    </div>

                    {/* Action */}
                    <div className="shrink-0 flex items-center gap-2">
                      {row.importState === 'done' && (
                        <CheckCircle2 size={16} className="text-neon-green" />
                      )}
                      {row.importState === 'error' && (
                        <span className="text-[10px] text-red-400 max-w-[100px] text-right leading-tight">
                          {row.importError}
                        </span>
                      )}
                      <a
                        href={row.match_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        title="View on FACEIT"
                      >
                        <ExternalLink size={13} />
                      </a>
                      <Button
                        size="sm"
                        variant={row.importState === 'done' ? 'outline' : 'neon'}
                        className="h-7 text-xs gap-1 px-3"
                        disabled={row.importState === 'importing' || row.importState === 'done'}
                        onClick={() => importMatch(row.match_id)}
                      >
                        {row.importState === 'importing' ? (
                          <><Loader2 size={11} className="animate-spin" /> Importing…</>
                        ) : row.importState === 'done' ? (
                          'Imported'
                        ) : (
                          <><Download size={11} /> Import</>
                        )}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-border px-5 py-3 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {rows.length > 0 && !loading
              ? `${rows.length} match${rows.length !== 1 ? 'es' : ''} found`
              : ' '}
          </p>
          <Button variant="outline" size="sm" onClick={handleClose}>
            {rows.some(r => r.importState === 'done') ? 'Done' : 'Close'}
          </Button>
        </div>
      </div>
    </div>
  )

  return mounted ? createPortal(modal, document.body) : null
}
