'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Trophy, X, Search, Loader2, AlertCircle, Users, ArrowRight, ExternalLink,
} from 'lucide-react'

interface FaceitTeamPreview {
  id: string
  name: string
  avatar: string
  members: { nickname: string; avatar: string }[]
}

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

export default function AddFromEseaButton({ teamId, label = 'Add from ESEA' }: { teamId: string; label?: string }) {
  const router = useRouter()
  const [open, setOpen]       = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const [input, setInput]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [team, setTeam]       = useState<FaceitTeamPreview | null>(null)
  const [matches, setMatches] = useState<FaceitTeamMatch[]>([])
  const [creating, setCreating] = useState(false)

  function reset() {
    setInput(''); setError(null); setTeam(null); setMatches([]); setLoading(false); setCreating(false)
  }
  function close() {
    if (creating) return
    setOpen(false); reset()
  }

  async function lookup() {
    if (!input.trim()) return
    setLoading(true); setError(null); setTeam(null); setMatches([])
    try {
      const res = await fetch('/api/demos/faceit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'team-lookup', input }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? 'Lookup failed'); return }
      setTeam(data.team)
      setMatches(data.matches ?? [])
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  async function create() {
    if (!team) return
    setCreating(true); setError(null)
    try {
      const res = await fetch('/api/opponents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, faceitInput: team.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? 'Failed to create opponent'); setCreating(false); return }
      setOpen(false)
      router.push(`/opponents/${data.folderId}`)
      router.refresh()
    } catch {
      setError('Network error'); setCreating(false)
    }
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} variant="secondary" className="gap-2">
        <Trophy size={15} />
        {label}
      </Button>
    )
  }

  const modal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
      <div className="rv-panel relative w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ borderRadius: 16 }}>
        <span className="rv-tick rv-tick-tl" />
        <span className="rv-tick rv-tick-br" />
        <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl" style={{ background: 'linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 0%, transparent) 80%)' }} />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'color-mix(in srgb, var(--accent) 14%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 28%, transparent)' }}>
              <Trophy size={16} style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground leading-tight">Add opponent from ESEA</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">Paste a FACEIT team URL or id to pull their matches</p>
            </div>
          </div>
          <button onClick={close} disabled={creating} className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors disabled:opacity-40">
            <X size={15} />
          </button>
        </div>

        <div className="px-5 pb-5 space-y-4">
          {/* Input */}
          <div className="flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') lookup() }}
              placeholder="faceit.com/en/teams/<id>/leagues  or  team id"
              disabled={creating}
              className="flex-1 min-w-0 rounded-lg border bg-white/[0.03] px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none transition-colors"
              style={{ borderColor: input ? 'color-mix(in srgb, var(--accent) 50%, transparent)' : 'var(--border)' }}
            />
            <Button onClick={lookup} disabled={loading || !input.trim()} className="gap-1.5 shrink-0" style={{ background: 'var(--accent)', color: '#fff', boxShadow: 'none' }}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              Look up
            </Button>
          </div>

          {error && (
            <p className="text-xs text-red-400 flex items-center gap-1.5"><AlertCircle size={12} />{error}</p>
          )}

          {/* Team preview */}
          {team && (
            <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-white/[0.02]">
              {team.avatar
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={team.avatar} alt={team.name} className="w-11 h-11 rounded-lg object-cover" />
                : <div className="w-11 h-11 rounded-lg bg-accent/20 flex items-center justify-center text-sm font-bold text-foreground">{team.name.charAt(0).toUpperCase()}</div>}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground truncate">{team.name}</p>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Users size={10} /> {team.members.map(m => m.nickname).join(', ') || 'Roster unavailable'}
                </p>
              </div>
            </div>
          )}

          {/* Matches preview */}
          {team && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-foreground flex items-center gap-2">
                Recent ESEA matches
                <span className="text-[10px] text-muted-foreground font-normal">{matches.length} found</span>
              </p>
              {matches.length === 0 ? (
                <p className="text-[11px] text-muted-foreground py-2">
                  No recent league matches found — you can still create the opponent and upload demos manually.
                </p>
              ) : (
                <div className="rounded-lg border border-border divide-y divide-border max-h-56 overflow-y-auto">
                  {matches.slice(0, 12).map(m => (
                    <div key={m.matchId} className="flex items-center gap-2 px-3 py-2 text-xs">
                      <span className={`w-4 text-center font-bold ${m.won === true ? 'text-[color:var(--win)]' : m.won === false ? 'text-[color:var(--loss)]' : 'text-muted-foreground'}`}>
                        {m.won === true ? 'W' : m.won === false ? 'L' : '–'}
                      </span>
                      <span className="flex-1 min-w-0 truncate text-foreground">vs {m.opponentName}</span>
                      {m.ourScore != null && (
                        <span className="font-mono text-[11px] text-muted-foreground">{m.ourScore}–{m.oppScore}</span>
                      )}
                      <span className="text-[10px] text-muted-foreground shrink-0">{new Date(m.date).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          {team && (
            <div className="flex items-center justify-between pt-3 border-t border-border/60">
              <span className="text-[11px] text-muted-foreground">Demos can be imported per-match after creating.</span>
              <Button onClick={create} disabled={creating} className="gap-1.5 h-9 text-xs" style={{ background: 'var(--accent)', color: '#fff', boxShadow: 'none' }}>
                {creating ? <><Loader2 size={13} className="animate-spin" /> Creating…</> : <>Create opponent <ArrowRight size={13} /></>}
              </Button>
            </div>
          )}

          {!team && (
            <a href="https://www.faceit.com" target="_blank" rel="noopener noreferrer" className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              <ExternalLink size={9} /> Find the team on FACEIT, copy the URL from their page
            </a>
          )}
        </div>
      </div>
    </div>
  )

  return mounted ? createPortal(modal, document.body) : null
}
