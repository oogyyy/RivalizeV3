'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Trash2, AlertTriangle, Loader2, CheckCircle2, AlertCircle,
  CheckSquare, Square, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import SetOpponentSideButton from '@/components/teams/SetOpponentSideButton'
import ReparseButton from '@/components/teams/ReparseButton'
import DeleteDemoButton from '@/components/teams/DeleteDemoButton'

// ── Demo row type (shared between My Team and Opponent pages) ─────────────────

export interface DemoRowData {
  id: string
  status: string
  map: string | null
  match_date: string | null
  created_at: string
  opponent_slug?: string | null
  parsed_data: {
    header?: {
      map?: string
      score_team1?: number
      score_team2?: number
      team1?: string
      team2?: string
    }
    opponentSide?: string
  } | null
}

interface Props {
  demos: DemoRowData[]
  /** href prefix for clicking a completed demo — e.g. "/my-team/demos" or "/demos" */
  demoHrefPrefix: string
  /** Show the "My team" side-selector (self demos only) */
  showSideSelector?: boolean
  /** Show reparse button */
  showReparse?: boolean
  /** Whether the user has owner/admin rights (controls delete visibility) */
  canDelete?: boolean
  /** Extra query string appended to each demo href, e.g. "?folder=xxx" */
  demoHrefSuffix?: string
}

// ── Bulk delete confirmation modal ────────────────────────────────────────────

function BulkDeleteModal({
  count,
  onConfirm,
  onCancel,
  deleting,
  error,
}: {
  count: number
  onConfirm: () => void
  onCancel: () => void
  deleting: boolean
  error: string | null
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget && !deleting) onCancel() }}
    >
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-red-500/10 flex items-center justify-center shrink-0 mt-0.5">
            <AlertTriangle size={18} className="text-red-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              Delete {count} demo{count !== 1 ? 's' : ''}?
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              All selected demo files and their parsed stats will be permanently deleted. This cannot be undone.
            </p>
          </div>
        </div>

        {error && (
          <p className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={deleting}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="bg-red-500 hover:bg-red-600 text-white gap-1.5"
            onClick={onConfirm}
            disabled={deleting}
          >
            {deleting ? (
              <><Loader2 size={13} className="animate-spin" /> Deleting…</>
            ) : (
              <><Trash2 size={13} /> Delete {count}</>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function DemoListMultiSelect({
  demos,
  demoHrefPrefix,
  showSideSelector = false,
  showReparse = true,
  canDelete = true,
  demoHrefSuffix = '',
}: Props) {
  const router = useRouter()

  const [selecting,   setSelecting]   = useState(false)
  const [selected,    setSelected]    = useState<Set<string>>(new Set())
  const [showConfirm, setShowConfirm] = useState(false)
  const [deleting,    setDeleting]    = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const toggleSelect = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    setSelected(prev =>
      prev.size === demos.length
        ? new Set()
        : new Set(demos.map(d => d.id))
    )
  }, [demos])

  const exitSelect = useCallback(() => {
    setSelecting(false)
    setSelected(new Set())
    setDeleteError(null)
  }, [])

  async function handleBulkDelete() {
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch('/api/demos/bulk-delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demoIds: [...selected] }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Delete failed')
      }
      setShowConfirm(false)
      exitSelect()
      router.refresh()
    } catch (err) {
      setDeleteError(String(err instanceof Error ? err.message : err))
    } finally {
      setDeleting(false)
    }
  }

  const allSelected = demos.length > 0 && selected.size === demos.length
  const noneSelected = selected.size === 0

  return (
    <>
      {/* List header controls */}
      <div className="flex items-center justify-between mb-3">
        {selecting ? (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Select-all toggle */}
            <button
              onClick={toggleAll}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {allSelected
                ? <CheckSquare size={13} className="text-neon-green" />
                : <Square size={13} />
              }
              {allSelected ? 'Deselect all' : 'Select all'}
            </button>

            {selected.size > 0 && (
              <span className="text-[11px] text-muted-foreground">
                {selected.size} of {demos.length} selected
              </span>
            )}

            {/* Delete selected button */}
            <Button
              size="sm"
              variant="ghost"
              disabled={noneSelected}
              onClick={() => { setDeleteError(null); setShowConfirm(true) }}
              className={cn(
                'h-7 gap-1.5 text-xs',
                noneSelected
                  ? 'text-muted-foreground opacity-40'
                  : 'text-red-400 hover:text-red-300 hover:bg-red-400/10',
              )}
            >
              <Trash2 size={12} />
              Delete{selected.size > 0 ? ` (${selected.size})` : ''}
            </Button>
          </div>
        ) : (
          <span /> /* spacer so cancel button stays right-aligned */
        )}

        <div className="flex items-center gap-2">
          {selecting ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={exitSelect}
              className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <X size={12} />
              Cancel
            </Button>
          ) : (
            canDelete && demos.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelecting(true)}
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
              >
                Select
              </Button>
            )
          )}
        </div>
      </div>

      {/* Demo rows */}
      <div className="space-y-0 max-h-[480px] overflow-y-auto pr-1 -mr-1">
        {demos.map(demo => {
          const pd      = demo.parsed_data
          const h       = pd?.header
          const opSide  = (pd?.opponentSide ?? 'team2') as 'team1' | 'team2'
          const ourScore   = h ? (opSide === 'team1' ? (h.score_team2 ?? 0) : (h.score_team1 ?? 0)) : null
          const theirScore = h ? (opSide === 'team1' ? (h.score_team1 ?? 0) : (h.score_team2 ?? 0)) : null
          const isWin  = ourScore !== null && theirScore !== null && ourScore > theirScore
          const isDraw = ourScore !== null && theirScore !== null && ourScore === theirScore
          const isLoss = ourScore !== null && theirScore !== null && ourScore < theirScore
          const href   = demo.status === 'completed' ? `${demoHrefPrefix}/${demo.id}${demoHrefSuffix}` : null
          const isSelected = selected.has(demo.id)

          return (
            <div
              key={demo.id}
              className={cn(
                'py-2 border-b border-border last:border-0 space-y-1 transition-colors',
                selecting && isSelected && 'bg-neon-green/5',
              )}
            >
              <div className="flex items-center gap-2.5">
                {/* Checkbox — only in selecting mode */}
                {selecting && (
                  <button
                    onClick={() => toggleSelect(demo.id)}
                    className="shrink-0 text-muted-foreground hover:text-neon-green transition-colors"
                  >
                    {isSelected
                      ? <CheckSquare size={15} className="text-neon-green" />
                      : <Square size={15} />
                    }
                  </button>
                )}

                {/* Status icon */}
                <div className="shrink-0">
                  {demo.status === 'completed' ? (
                    <CheckCircle2 size={14} className="text-neon-green" />
                  ) : demo.status === 'failed' ? (
                    <AlertCircle size={14} className="text-red-400" />
                  ) : (
                    <div className="w-3.5 h-3.5 rounded-full border border-yellow-400 border-t-transparent animate-spin" />
                  )}
                </div>

                {/* Map name + date */}
                <div className="flex-1 min-w-0">
                  {href && !selecting ? (
                    <Link
                      href={href}
                      className="text-sm text-foreground hover:text-neon-green transition-colors truncate block"
                    >
                      {h?.map ?? demo.map ?? 'Unknown map'}
                      {demo.opponent_slug && (
                        <span className="text-muted-foreground"> vs {demo.opponent_slug}</span>
                      )}
                    </Link>
                  ) : (
                    <p
                      className={cn(
                        'text-sm text-foreground truncate',
                        selecting && 'cursor-pointer select-none',
                      )}
                      onClick={selecting ? () => toggleSelect(demo.id) : undefined}
                    >
                      {h?.map ?? demo.map ?? 'Unknown map'}
                      {demo.opponent_slug && (
                        <span className="text-muted-foreground"> vs {demo.opponent_slug}</span>
                      )}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {demo.match_date
                      ? new Date(demo.match_date).toLocaleDateString()
                      : new Date(demo.created_at).toLocaleDateString()}
                  </p>
                </div>

                {/* Score badge */}
                {!selecting && demo.status === 'completed' && ourScore !== null && theirScore !== null && (
                  <div className={cn(
                    'text-xs font-mono font-semibold px-2 py-0.5 rounded shrink-0',
                    isWin  ? 'text-neon-green bg-neon-green/10' :
                    isDraw ? 'text-yellow-400 bg-yellow-400/10' :
                    isLoss ? 'text-red-400 bg-red-400/10'       : '',
                  )}>
                    {ourScore}–{theirScore}
                  </div>
                )}

                {/* Per-row actions — hidden during multi-select */}
                {!selecting && (
                  <>
                    {demo.status === 'failed' && (
                      <Badge variant="destructive" className="text-xs shrink-0">Failed</Badge>
                    )}
                    {showReparse && (demo.status === 'completed' || demo.status === 'failed') && (
                      <ReparseButton demoId={demo.id} />
                    )}
                    {canDelete && (
                      <DeleteDemoButton demoId={demo.id} />
                    )}
                  </>
                )}
              </div>

              {/* Team selector — only for self-demos, only outside select mode */}
              {!selecting && showSideSelector && demo.status === 'completed' && (
                <div className="pl-[22px] pt-1.5 pb-0.5">
                  <SetOpponentSideButton
                    demoId={demo.id}
                    currentSide={opSide}
                    variant="self"
                    teamNames={h ? {
                      team1: (!h.team1 || h.team1 === 'T-Side' || h.team1 === 'CT-Side') ? 'Team 1 (T-Side)' : h.team1,
                      team2: (!h.team2 || h.team2 === 'T-Side' || h.team2 === 'CT-Side') ? 'Team 2 (CT-Side)' : h.team2,
                    } : undefined}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Bulk delete confirmation modal */}
      {showConfirm && (
        <BulkDeleteModal
          count={selected.size}
          onConfirm={handleBulkDelete}
          onCancel={() => { if (!deleting) setShowConfirm(false) }}
          deleting={deleting}
          error={deleteError}
        />
      )}
    </>
  )
}
