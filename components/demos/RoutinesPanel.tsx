'use client'

import { useState, useEffect } from 'react'
import { Brain, Loader2, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import type { Routine } from '@/lib/routines'

interface Props {
  folderId: string
  opponentName: string
}

export default function RoutinesPanel({ folderId, opponentName: _opponentName }: Props) {
  const [routines, setRoutines] = useState<Routine[]>([])
  const [totalRounds, setTotalRounds] = useState(0)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(true)
  const [loaded, setLoaded] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch(`/api/opponents/${folderId}/routines`)
      if (!res.ok) return
      const data = await res.json()
      setRoutines(data.routines ?? [])
      setTotalRounds(data.totalRounds ?? 0)
      setLoaded(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [folderId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!loaded && !loading) return null

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((v: boolean) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Brain size={15} className="text-purple-400" />
          <span className="text-sm font-semibold text-foreground">Routine Detection</span>
          {!loading && totalRounds > 0 && (
            <span className="text-xs text-muted-foreground">— {totalRounds} rounds analysed</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); load() }}
            className="p-1 rounded text-muted-foreground hover:text-foreground"
            title="Re-detect"
          >
            <RefreshCw size={12} />
          </button>
          {open ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-border px-4 py-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 size={14} className="animate-spin" />
              Detecting patterns…
            </div>
          ) : routines.length === 0 ? (
            <p className="text-sm text-muted-foreground">Not enough round data to detect routines.</p>
          ) : (
            <div className="space-y-3">
              {routines.map((r: Routine) => (
                <div key={r.id} className="rounded-lg border border-border p-3 bg-card/50">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ background: r.color }}
                      />
                      <span className="text-sm font-semibold text-foreground">{r.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{r.rounds.length} rounds</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{r.description}</p>
                  <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
                    <span>Avg kills: <span className="text-foreground font-mono">{r.avgKills}</span></span>
                    <span>Plant rate: <span className="text-foreground font-mono">{r.plantRate}%</span></span>
                    <span>Avg first kill: <span className="text-foreground font-mono">{r.avgFirstKillTime}s</span></span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {r.rounds.slice(0, 16).map((rn: number) => (
                      <span
                        key={rn}
                        className="px-1.5 py-0.5 rounded text-[9px] font-mono"
                        style={{ background: r.color + '22', color: r.color }}
                      >
                        R{rn}
                      </span>
                    ))}
                    {r.rounds.length > 16 && (
                      <span className="px-1.5 py-0.5 text-[9px] text-muted-foreground">
                        +{r.rounds.length - 16} more
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
