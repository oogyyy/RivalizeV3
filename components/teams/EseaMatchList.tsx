'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Swords, ExternalLink, Download, Loader2, CheckCircle2, AlertCircle,
} from 'lucide-react'

interface FaceitTeamMatch {
  matchId: string
  competitionName: string
  date: number
  opponentName: string
  ourScore: number | null
  oppScore: number | null
  won: boolean | null
  matchUrl: string
}

type ImportStatus = 'idle' | 'importing' | 'done' | 'error'
interface ImportState { status: ImportStatus; error?: string }

interface Props {
  folderId: string
  teamId: string
  opponentName: string
  isOwnerOrAdmin: boolean
}

export default function EseaMatchList({ folderId, teamId, opponentName, isOwnerOrAdmin }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [matches, setMatches] = useState<FaceitTeamMatch[]>([])
  const [imports, setImports] = useState<Record<string, ImportState>>({})

  useEffect(() => {
    let active = true
    fetch(`/api/opponents/${folderId}/faceit-matches`)
      .then(r => r.json())
      .then(d => { if (!active) return; setMatches(d.matches ?? []); if (d.error) setError(d.error) })
      .catch(() => { if (active) setError('Failed to load matches') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [folderId])

  async function importMatch(m: FaceitTeamMatch) {
    setImports(prev => ({ ...prev, [m.matchId]: { status: 'importing' } }))
    try {
      const res = await fetch('/api/demos/faceit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'import', teamId, matchId: m.matchId, opponentName }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setImports(prev => ({ ...prev, [m.matchId]: { status: 'error', error: data.error?.toString?.() ?? 'Import failed' } }))
        return
      }
      setImports(prev => ({ ...prev, [m.matchId]: { status: 'done' } }))
      router.refresh()
    } catch {
      setImports(prev => ({ ...prev, [m.matchId]: { status: 'error', error: 'Network error' } }))
    }
  }

  return (
    <div className="rv-panel overflow-hidden">
      <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-border/50">
        <Swords size={14} style={{ color: 'var(--signal)' }} />
        <h2 className="text-sm font-semibold text-foreground">ESEA Match History</h2>
        {!loading && (
          <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: 'color-mix(in srgb, var(--signal) 12%, transparent)', color: 'var(--signal)' }}>
            {matches.length}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
          <Loader2 size={14} className="animate-spin" /> Loading FACEIT matches…
        </div>
      ) : matches.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-8">
          {error ?? 'No recent ESEA matches found for this team.'}
        </p>
      ) : (
        <div className="divide-y divide-border/50">
          {matches.map(m => {
            const st = imports[m.matchId]
            return (
              <div key={m.matchId} className="flex items-center gap-3 px-4 py-2.5">
                <span className={`text-xs font-bold w-4 text-center ${m.won === true ? 'text-[color:var(--win)]' : m.won === false ? 'text-[color:var(--loss)]' : 'text-muted-foreground'}`}>
                  {m.won === true ? 'W' : m.won === false ? 'L' : '–'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">vs {m.opponentName}</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {new Date(m.date).toLocaleDateString()} · {m.competitionName}
                  </p>
                </div>
                {m.ourScore != null && (
                  <span className="text-xs font-mono text-muted-foreground shrink-0">{m.ourScore}–{m.oppScore}</span>
                )}
                <a href={m.matchUrl} target="_blank" rel="noopener noreferrer" title="Open match on FACEIT"
                  className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
                  <ExternalLink size={13} />
                </a>
                {isOwnerOrAdmin && (
                  st?.status === 'done' ? (
                    <span className="flex items-center gap-1 text-[11px] text-[color:var(--win)] font-medium shrink-0">
                      <CheckCircle2 size={12} /> Imported
                    </span>
                  ) : st?.status === 'error' ? (
                    <button onClick={() => importMatch(m)} title={st.error}
                      className="flex items-center gap-1 text-[11px] text-[color:var(--loss)] font-medium shrink-0">
                      <AlertCircle size={12} /> Retry
                    </button>
                  ) : (
                    <button onClick={() => importMatch(m)} disabled={st?.status === 'importing'}
                      className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded shrink-0 transition-colors"
                      style={{ background: 'color-mix(in srgb, var(--accent) 12%, transparent)', color: 'var(--accent)', border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)' }}>
                      {st?.status === 'importing'
                        ? <><Loader2 size={11} className="animate-spin" /> …</>
                        : <><Download size={11} /> Import</>}
                    </button>
                  )
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
