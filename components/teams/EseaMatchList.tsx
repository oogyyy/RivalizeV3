'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Swords, ExternalLink, Upload, Loader2, CheckCircle2, AlertCircle, Info,
} from 'lucide-react'
import { uploadViaServer, isValidDemoFile } from '@/components/teams/DemoUploadButton'

interface FaceitTeamMatch {
  matchId: string
  competitionName: string
  date: number
  opponentName: string
  ourScore: number | null
  oppScore: number | null
  won: boolean | null
  matchUrl: string
  maps: string[]
  bestOf: number | null
}

/** "de_mirage" → "Mirage"; passes through already-clean labels. */
function prettyMap(map: string): string {
  return map.replace(/^de_/, '').replace(/^(.)/, c => c.toUpperCase())
}

type UploadStatus = 'idle' | 'uploading' | 'done' | 'error'
interface UploadState { status: UploadStatus; progress?: number; error?: string }

interface Props {
  folderId: string
  teamId: string
  opponentName: string
  isOwnerOrAdmin: boolean
  /** faceit_match_id values that already have a demo in this folder. */
  uploadedMatchIds: string[]
}

export default function EseaMatchList({ folderId, teamId, opponentName, isOwnerOrAdmin, uploadedMatchIds }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [matches, setMatches] = useState<FaceitTeamMatch[]>([])
  const [states, setStates]   = useState<Record<string, UploadState>>({})

  const fileInputRef = useRef<HTMLInputElement>(null)
  const activeMatch  = useRef<string | null>(null)
  const uploaded = new Set(uploadedMatchIds)

  useEffect(() => {
    let active = true
    fetch(`/api/opponents/${folderId}/faceit-matches`)
      .then(r => r.json())
      .then(d => { if (!active) return; setMatches(d.matches ?? []); if (d.error) setError(d.error) })
      .catch(() => { if (active) setError('Failed to load matches') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [folderId])

  function pickFile(matchId: string) {
    activeMatch.current = matchId
    fileInputRef.current?.click()
  }

  async function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file
    const matchId = activeMatch.current
    if (!file || !matchId) return

    if (!isValidDemoFile(file.name)) {
      setStates(p => ({ ...p, [matchId]: { status: 'error', error: 'Use a .dem or .zst file' } }))
      return
    }

    setStates(p => ({ ...p, [matchId]: { status: 'uploading', progress: 0 } }))
    try {
      await uploadViaServer(
        file,
        { teamId, opponentName, demoType: 'opponent', faceitMatchId: matchId },
        pct => setStates(p => ({ ...p, [matchId]: { status: 'uploading', progress: pct } })),
      )
      setStates(p => ({ ...p, [matchId]: { status: 'done' } }))
      router.refresh()
    } catch (err) {
      setStates(p => ({ ...p, [matchId]: { status: 'error', error: err instanceof Error ? err.message : 'Upload failed' } }))
    }
  }

  return (
    <div className="rv-panel overflow-hidden">
      <input ref={fileInputRef} type="file" accept=".dem,.zst" onChange={onFileChosen} className="hidden" />

      <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-border/50">
        <Swords size={14} style={{ color: 'var(--signal)' }} />
        <h2 className="text-sm font-semibold text-foreground">ESEA Match History</h2>
        {!loading && (
          <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: 'color-mix(in srgb, var(--signal) 12%, transparent)', color: 'var(--signal)' }}>
            {matches.length}
          </span>
        )}
      </div>

      {!loading && matches.length > 0 && isOwnerOrAdmin && (
        <p className="flex items-center gap-1.5 px-4 py-2 text-[10px] text-muted-foreground border-b border-border/40">
          <Info size={10} className="shrink-0" />
          Open the match on FACEIT, download the demo, then upload it here to parse it.
        </p>
      )}

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
            const st = states[m.matchId]
            const isUploaded = uploaded.has(m.matchId) || st?.status === 'done'
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
                  {(m.bestOf || m.maps.length > 0) && (
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      {m.bestOf ? (
                        <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
                          style={{ background: 'color-mix(in srgb, var(--signal) 14%, transparent)', color: 'var(--signal)' }}>
                          BO{m.bestOf}
                        </span>
                      ) : null}
                      {m.maps.map(map => (
                        <span key={map} className="text-[9px] font-semibold px-1.5 py-0.5 rounded text-muted-foreground"
                          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)' }}>
                          {prettyMap(map)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {m.ourScore != null && (
                  <span className="text-xs font-mono text-muted-foreground shrink-0">{m.ourScore}–{m.oppScore}</span>
                )}

                {/* Match page link */}
                <a href={m.matchUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  title="Open the match room on FACEIT to download the demo">
                  <ExternalLink size={12} /> Match page
                </a>

                {/* Upload / status */}
                {isUploaded ? (
                  <span className="flex items-center gap-1 text-[11px] text-[color:var(--win)] font-medium shrink-0">
                    <CheckCircle2 size={12} /> Analyzed
                  </span>
                ) : !isOwnerOrAdmin ? null : st?.status === 'uploading' ? (
                  <span className="flex items-center gap-1 text-[11px] text-[color:var(--accent)] font-medium shrink-0 w-20 justify-end">
                    <Loader2 size={11} className="animate-spin" /> {st.progress ?? 0}%
                  </span>
                ) : st?.status === 'error' ? (
                  <button onClick={() => pickFile(m.matchId)} title={st.error}
                    className="flex items-center gap-1 text-[11px] text-[color:var(--loss)] font-medium shrink-0">
                    <AlertCircle size={12} /> Retry
                  </button>
                ) : (
                  <button onClick={() => pickFile(m.matchId)}
                    className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded shrink-0 transition-colors"
                    style={{ background: 'color-mix(in srgb, var(--accent) 12%, transparent)', color: 'var(--accent)', border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)' }}>
                    <Upload size={11} /> Upload demo
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
