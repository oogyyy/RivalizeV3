'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Trash2, AlertTriangle, Loader2, CheckCircle2, AlertCircle,
  CheckSquare, Square, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import SetOpponentSideButton from '@/components/teams/SetOpponentSideButton'
import ReparseButton from '@/components/teams/ReparseButton'
import DeleteDemoButton from '@/components/teams/DeleteDemoButton'
import { createClient } from '@/lib/supabase/client'

// ── Demo row type ──────────────────────────────────────────────────────────────

export interface DemoRowData {
  id: string
  status: string
  map: string | null
  match_date: string | null
  created_at: string
  processing_started_at?: string | null
  error_message?: string | null
  opponent_slug?: string | null
  faceit_match_id?: string | null
  league?: string | null
  parsed_data: {
    header?: {
      map?: string
      score_team1?: number
      score_team2?: number
      team1?: string
      team2?: string
    }
    opponentSide?: string
    players?: Array<{
      name: string
      kills: number
      deaths: number
      assists: number
      rating: number
      adr: number
      team: string
    }>
  } | null
}

interface Props {
  demos: DemoRowData[]
  demoHrefPrefix: string
  showSideSelector?: boolean
  showReparse?: boolean
  canDelete?: boolean
  demoHrefSuffix?: string
  layout?: 'list' | 'cards'
  onSideChange?: (demoId: string, opponentSide: 'team1' | 'team2') => void
}

function cleanTeamName(name: string | undefined): string | null {
  if (!name || name === 'T-Side' || name === 'CT-Side') return null
  return name
}

// ── Bulk delete modal ──────────────────────────────────────────────────────────

function BulkDeleteModal({
  count, onConfirm, onCancel, deleting, error,
}: {
  count: number; onConfirm: () => void; onCancel: () => void; deleting: boolean; error: string | null
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
            <p className="text-sm font-semibold text-foreground">Delete {count} demo{count !== 1 ? 's' : ''}?</p>
            <p className="text-xs text-muted-foreground mt-1">
              All selected demo files and their parsed stats will be permanently deleted. This cannot be undone.
            </p>
          </div>
        </div>
        {error && <p className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{error}</p>}
        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={deleting}>Cancel</Button>
          <Button size="sm" className="bg-red-500 hover:bg-red-600 text-white gap-1.5" onClick={onConfirm} disabled={deleting}>
            {deleting ? <><Loader2 size={13} className="animate-spin" /> Deleting…</> : <><Trash2 size={13} /> Delete {count}</>}
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
  layout = 'list',
  onSideChange,
}: Props) {
  const router = useRouter()

  // Supabase real-time: refresh instantly when any processing demo's status changes.
  const processingIds = demos.filter(d => d.status === 'processing').map(d => d.id)
  const hasProcessing = processingIds.length > 0

  useEffect(() => {
    // When parent manages side-change state (onSideChange provided), skip router.refresh()
    // to avoid resetting parent's optimistic updates. Parent handles its own state.
    if (!hasProcessing || onSideChange) return

    const supabase = createClient()
    const channel = supabase
      .channel('demo-list-status')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'demos' },
        (payload) => {
          const updated = payload.new as { id: string; status: string }
          if (processingIds.includes(updated.id) && updated.status !== 'processing') {
            router.refresh()
          }
        },
      )
      .subscribe()

    // Fallback poll every 8 s in case real-time is not enabled on the project
    const poll = setInterval(() => router.refresh(), 8_000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(poll)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasProcessing, !!onSideChange])

  // null on server/hydration to avoid Date.now() mismatch (React error #418)
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => { setNow(Date.now()) }, [])

  const [selecting,   setSelecting]   = useState(false)
  const [selected,    setSelected]    = useState<Set<string>>(new Set())
  const [showConfirm, setShowConfirm] = useState(false)
  const [deleting,    setDeleting]    = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const toggleSelect = useCallback((id: string) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }, [])
  const toggleAll = useCallback(() => {
    setSelected(prev => prev.size === demos.length ? new Set() : new Set(demos.map(d => d.id)))
  }, [demos])
  const exitSelect = useCallback(() => { setSelecting(false); setSelected(new Set()); setDeleteError(null) }, [])

  async function handleBulkDelete() {
    setDeleting(true); setDeleteError(null)
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
      setShowConfirm(false); exitSelect(); router.refresh()
    } catch (err) {
      setDeleteError(String(err instanceof Error ? err.message : err))
    } finally {
      setDeleting(false)
    }
  }

  const allSelected  = demos.length > 0 && selected.size === demos.length
  const noneSelected = selected.size === 0

  return (
    <>
      {/* List header */}
      <div className="flex items-center justify-between mb-3">
        {selecting ? (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={toggleAll}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {allSelected ? <CheckSquare size={13} className="text-neon-green" /> : <Square size={13} />}
              {allSelected ? 'Deselect all' : 'Select all'}
            </button>
            {selected.size > 0 && (
              <span className="text-[11px] text-muted-foreground">{selected.size} of {demos.length} selected</span>
            )}
            <Button
              size="sm" variant="ghost" disabled={noneSelected}
              onClick={() => { setDeleteError(null); setShowConfirm(true) }}
              className={cn('h-7 gap-1.5 text-xs', noneSelected ? 'text-muted-foreground opacity-40' : 'text-red-400 hover:text-red-300 hover:bg-red-400/10')}
            >
              <Trash2 size={12} />
              Delete{selected.size > 0 ? ` (${selected.size})` : ''}
            </Button>
          </div>
        ) : <span />}

        <div className="flex items-center gap-2">
          {selecting ? (
            <Button size="sm" variant="ghost" onClick={exitSelect} className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground">
              <X size={12} /> Cancel
            </Button>
          ) : (
            canDelete && demos.length > 0 && (
              <Button size="sm" variant="ghost" onClick={() => setSelecting(true)} className="h-7 text-xs text-muted-foreground hover:text-foreground">
                Select
              </Button>
            )
          )}
        </div>
      </div>

      {/* Demo rows / cards */}
      {layout === 'cards' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[600px] overflow-y-auto pr-1 -mr-1">
          {demos.map(demo => {
            const pd         = demo.parsed_data
            const h          = pd?.header
            const opSide     = (pd?.opponentSide ?? 'team2') as 'team1' | 'team2'
            const ourScore   = h ? (opSide === 'team1' ? (h.score_team2 ?? 0) : (h.score_team1 ?? 0)) : null
            const theirScore = h ? (opSide === 'team1' ? (h.score_team1 ?? 0) : (h.score_team2 ?? 0)) : null
            const isWin  = ourScore !== null && theirScore !== null && ourScore > theirScore
            const isDraw = ourScore !== null && theirScore !== null && ourScore === theirScore
            const isLoss = ourScore !== null && theirScore !== null && ourScore < theirScore
            const href       = demo.status === 'completed' ? `${demoHrefPrefix}/${demo.id}${demoHrefSuffix}` : null
            const isSelected = selected.has(demo.id)
            const isStuck    = demo.status === 'processing' || demo.status === 'failed'
            const ourTeamName   = cleanTeamName(opSide === 'team1' ? h?.team2 : h?.team1) ?? 'My Team'
            const theirTeamName = cleanTeamName(opSide === 'team1' ? h?.team1 : h?.team2) ?? demo.opponent_slug ?? 'Opponent'

            const resultColor = isWin ? 'var(--win)' : isLoss ? 'var(--loss)' : '#facc15'
            const resultLabel = isWin ? 'W' : isLoss ? 'L' : 'D'

            const cardContent = (
              <div
                key={demo.id}
                className={cn(
                  'rv-panel relative rounded-xl border border-border overflow-hidden transition-all duration-150',
                  selecting && isSelected ? 'ring-1 ring-neon-green bg-neon-green/5' : 'hover:border-accent/40 hover:shadow-md',
                  selecting && 'cursor-pointer',
                )}
                onClick={selecting ? () => toggleSelect(demo.id) : undefined}
              >
                {/* Accent top bar colored by result */}
                {demo.status === 'completed' && ourScore !== null && (
                  <div className="h-0.5 w-full" style={{ background: resultColor }} />
                )}

                <div className="p-3">
                  {/* Top row: checkbox (if selecting) + status + actions */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {selecting && (
                        <button onClick={e => { e.stopPropagation(); toggleSelect(demo.id) }} className="shrink-0 text-muted-foreground hover:text-neon-green transition-colors">
                          {isSelected ? <CheckSquare size={14} className="text-neon-green" /> : <Square size={14} />}
                        </button>
                      )}
                      {/* Status icon */}
                      {demo.status === 'completed' ? (
                        <CheckCircle2 size={12} className="text-neon-green" />
                      ) : demo.status === 'failed' ? (
                        <AlertCircle size={12} className="text-red-400" />
                      ) : (
                        <div className="w-3 h-3 rounded-full border border-yellow-400 border-t-transparent animate-spin" />
                      )}
                      {/* Result badge */}
                      {demo.status === 'completed' && ourScore !== null && (
                        <span
                          className="text-[10px] font-black px-1.5 py-0.5 rounded font-mono"
                          style={{ color: resultColor, background: `color-mix(in srgb, ${resultColor} 12%, transparent)` }}
                        >
                          {resultLabel}
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    {!selecting && (
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        {showReparse && demo.status === 'completed' && (
                          <ReparseButton demoId={demo.id} variant="icon" />
                        )}
                        {canDelete && <DeleteDemoButton demoId={demo.id} />}
                      </div>
                    )}
                  </div>

                  {/* Team names + score */}
                  <div className="mb-1.5">
                    {demo.status === 'completed' && ourScore !== null && theirScore !== null ? (
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-sm font-bold text-foreground truncate">{ourTeamName}</span>
                        <span
                          className="text-base font-black font-mono shrink-0 tabular-nums"
                          style={{ color: resultColor }}
                        >
                          {ourScore}–{theirScore}
                        </span>
                        <span className="text-sm font-bold text-muted-foreground truncate">{theirTeamName}</span>
                      </div>
                    ) : (
                      <p className="text-sm font-semibold text-foreground truncate">
                        {ourTeamName} vs {theirTeamName}
                      </p>
                    )}
                  </div>

                  {/* Map + date */}
                  <p className="text-[11px] text-muted-foreground truncate">
                    {h?.map ?? demo.map ?? 'Unknown map'}
                    {' · '}
                    {demo.match_date
                      ? new Date(demo.match_date).toLocaleDateString()
                      : new Date(demo.created_at).toLocaleDateString()}
                  </p>

                  {/* Stuck / failed recovery */}
                  {!selecting && isStuck && showReparse && (
                    <div className={cn(
                      'mt-2 flex items-start gap-2 rounded-lg px-2.5 py-1.5 border',
                      demo.status === 'failed' ? 'bg-red-500/5 border-red-500/20' : 'bg-amber-500/5 border-amber-500/20',
                    )}>
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-[10px] font-medium', demo.status === 'failed' ? 'text-red-400' : 'text-amber-400')}>
                          {demo.status === 'failed' ? 'Parsing failed'
                            : !demo.processing_started_at
                              ? !now || now - new Date(demo.created_at).getTime() < 10 * 60 * 1000 ? 'Queued…' : 'Stuck in processing'
                              : !now || now - new Date(demo.processing_started_at).getTime() < 30 * 60 * 1000 ? 'Parsing…' : 'Stuck in processing'}
                        </p>
                        {demo.error_message && (
                          <p className="text-[10px] text-muted-foreground mt-0.5 break-words line-clamp-1">{demo.error_message}</p>
                        )}
                      </div>
                      {now && (demo.status === 'failed' ||
                        (!demo.processing_started_at && now - new Date(demo.created_at).getTime() >= 10 * 60 * 1000) ||
                        (demo.processing_started_at && now - new Date(demo.processing_started_at).getTime() >= 30 * 60 * 1000)) && (
                        <ReparseButton demoId={demo.id} variant="prominent" />
                      )}
                    </div>
                  )}

                  {/* Team selector */}
                  {!selecting && showSideSelector && demo.status === 'completed' && (
                    <div className="mt-2">
                      <SetOpponentSideButton
                        demoId={demo.id}
                        currentSide={opSide}
                        variant="self"
                        teamNames={h ? {
                          team1: (!h.team1 || h.team1 === 'T-Side' || h.team1 === 'CT-Side') ? 'Team 1 (T-Side)' : h.team1,
                          team2: (!h.team2 || h.team2 === 'T-Side' || h.team2 === 'CT-Side') ? 'Team 2 (CT-Side)' : h.team2,
                        } : undefined}
                        onSideChange={onSideChange}
                      />
                    </div>
                  )}
                </div>
              </div>
            )

            return href && !selecting
              ? <Link key={demo.id} href={href} className="block no-underline">{cardContent}</Link>
              : <div key={demo.id}>{cardContent}</div>
          })}
        </div>
      ) : (
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
          const isStuck = demo.status === 'processing' || demo.status === 'failed'

          return (
            <div
              key={demo.id}
              className={cn(
                'py-2 border-b border-border last:border-0 space-y-1.5 transition-colors',
                selecting && isSelected && 'bg-neon-green/5',
              )}
            >
              <div className="flex items-center gap-2.5">
                {selecting && (
                  <button onClick={() => toggleSelect(demo.id)} className="shrink-0 text-muted-foreground hover:text-neon-green transition-colors">
                    {isSelected ? <CheckSquare size={15} className="text-neon-green" /> : <Square size={15} />}
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
                    <Link href={href} className="text-sm text-foreground hover:text-neon-green transition-colors truncate block">
                      {h?.map ?? demo.map ?? 'Unknown map'}
                      {demo.opponent_slug && <span className="text-muted-foreground"> vs {demo.opponent_slug}</span>}
                    </Link>
                  ) : (
                    <p
                      className={cn('text-sm text-foreground truncate', selecting && 'cursor-pointer select-none')}
                      onClick={selecting ? () => toggleSelect(demo.id) : undefined}
                    >
                      {h?.map ?? demo.map ?? 'Unknown map'}
                      {demo.opponent_slug && <span className="text-muted-foreground"> vs {demo.opponent_slug}</span>}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {demo.match_date
                      ? new Date(demo.match_date).toLocaleDateString()
                      : `${new Date(demo.created_at).toLocaleDateString()} · ${new Date(demo.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}
                  </p>
                </div>

                {/* Score badge */}
                {!selecting && demo.status === 'completed' && ourScore !== null && theirScore !== null && (
                  <div className={cn(
                    'text-xs font-mono font-semibold px-2 py-0.5 rounded shrink-0',
                    isWin ? 'text-neon-green bg-neon-green/10' : isDraw ? 'text-yellow-400 bg-yellow-400/10' : isLoss ? 'text-red-400 bg-red-400/10' : '',
                  )}>
                    {ourScore}–{theirScore}
                  </div>
                )}

                {/* Per-row actions */}
                {!selecting && (
                  <>
                    {showReparse && demo.status === 'completed' && (
                      <ReparseButton demoId={demo.id} variant="icon" />
                    )}
                    {canDelete && <DeleteDemoButton demoId={demo.id} />}
                  </>
                )}
              </div>

              {/* Stuck / failed recovery row */}
              {!selecting && isStuck && showReparse && (
                <div className={cn(
                  'ml-[22px] flex items-start gap-3 rounded-lg px-3 py-2 border',
                  demo.status === 'failed'
                    ? 'bg-red-500/5 border-red-500/20'
                    : 'bg-amber-500/5 border-amber-500/20',
                )}>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-[11px] font-medium', demo.status === 'failed' ? 'text-red-400' : 'text-amber-400')}>
                      {demo.status === 'failed'
                        ? 'Parsing failed'
                        : !demo.processing_started_at
                          ? !now || now - new Date(demo.created_at).getTime() < 10 * 60 * 1000
                            ? 'Queued…'
                            : 'Stuck in processing'
                          : !now || now - new Date(demo.processing_started_at).getTime() < 30 * 60 * 1000
                            ? 'Parsing…'
                            : 'Stuck in processing'}
                    </p>
                    {demo.error_message && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 break-words line-clamp-2" title={demo.error_message}>
                        {demo.error_message}
                      </p>
                    )}
                  </div>
                  {now && (demo.status === 'failed' ||
                    (!demo.processing_started_at && now - new Date(demo.created_at).getTime() >= 10 * 60 * 1000) ||
                    (demo.processing_started_at && now - new Date(demo.processing_started_at).getTime() >= 30 * 60 * 1000)) && (
                    <ReparseButton demoId={demo.id} variant="prominent" />
                  )}
                </div>
              )}

              {/* Team selector */}
              {!selecting && showSideSelector && demo.status === 'completed' && (
                <div className="pl-[22px] pt-0.5 pb-0.5">
                  <SetOpponentSideButton
                    demoId={demo.id}
                    currentSide={opSide}
                    variant="self"
                    teamNames={h ? {
                      team1: (!h.team1 || h.team1 === 'T-Side' || h.team1 === 'CT-Side') ? 'Team 1 (T-Side)' : h.team1,
                      team2: (!h.team2 || h.team2 === 'T-Side' || h.team2 === 'CT-Side') ? 'Team 2 (CT-Side)' : h.team2,
                    } : undefined}
                    onSideChange={onSideChange}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
      )}

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
