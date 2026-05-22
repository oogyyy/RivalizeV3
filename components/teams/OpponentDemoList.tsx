'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Brain, BarChart2, MapPin, Calendar, HardDrive, BarChart3,
  Trash2, AlertTriangle, Loader2, CheckSquare, Square, X,
} from 'lucide-react'
import { cn, formatDate, formatFileSize } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import SetOpponentSideButton from '@/components/teams/SetOpponentSideButton'
import ReparseButton from '@/components/teams/ReparseButton'
import DeleteDemoButton from '@/components/teams/DeleteDemoButton'
import DemoUploadButton from '@/components/teams/DemoUploadButton'
import { createClient } from '@/lib/supabase/client'
import type { DemoHeader } from '@/types/database'

export interface OpponentDemo {
  id: string
  status: string
  map: string | null
  match_date: string | null
  created_at: string
  file_size_bytes?: number | null
  error_message?: string | null
  parsed_data: { header?: DemoHeader; opponentSide?: 'team1' | 'team2' } | null
}

interface Props {
  demos: OpponentDemo[]
  folderId: string
  teamId: string
  isOwnerOrAdmin: boolean
  opponentDisplayName: string
}

const statusVariant = (status: string) => {
  if (status === 'completed')  return 'neon'        as const
  if (status === 'processing') return 'processing'  as const
  return 'destructive' as const
}
const statusLabel = (status: string) => {
  if (status === 'completed')  return 'Analyzed'
  if (status === 'processing') return 'Processing'
  return 'Failed'
}
const normaliseTeamName = (n: string | undefined, fallback: string) => {
  if (!n || n === 'T-Side' || n === 'CT-Side') return fallback
  return n
}

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
            <p className="text-sm font-semibold">Delete {count} demo{count !== 1 ? 's' : ''}?</p>
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

export default function OpponentDemoList({ demos, folderId, teamId, isOwnerOrAdmin, opponentDisplayName }: Props) {
  const router = useRouter()

  const processingIds = demos.filter(d => d.status === 'processing').map(d => d.id)
  const hasProcessing = processingIds.length > 0

  useEffect(() => {
    if (!hasProcessing) return
    const supabase = createClient()
    const channel = supabase
      .channel('opponent-demo-status')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'demos' }, (payload) => {
        const updated = payload.new as { id: string; status: string }
        if (processingIds.includes(updated.id) && updated.status !== 'processing') {
          router.refresh()
        }
      })
      .subscribe()
    const poll = setInterval(() => router.refresh(), 8_000)
    return () => {
      supabase.removeChannel(channel)
      clearInterval(poll)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasProcessing])

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
      setDeleting(false) }
  }

  const allSelected  = demos.length > 0 && selected.size === demos.length
  const noneSelected = selected.size === 0

  if (demos.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm font-medium text-foreground mb-1">No demos yet</p>
          <p className="text-xs text-muted-foreground mb-4">
            Upload demos of {opponentDisplayName} to start scouting them
          </p>
          {isOwnerOrAdmin && <DemoUploadButton teamId={teamId} />}
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      {/* Multi-select toolbar */}
      {isOwnerOrAdmin && (
        <div className="flex items-center justify-between mb-2 min-h-[28px]">
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
              <Button size="sm" variant="ghost" onClick={() => setSelecting(true)} className="h-7 text-xs text-muted-foreground hover:text-foreground">
                Select
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Demo cards */}
      <div className="space-y-2">
        {demos.map(demo => {
          const pd              = demo.parsed_data
          const header          = pd?.header
          const demoOpponentSide = pd?.opponentSide ?? 'team2'
          const ourScore    = header ? (demoOpponentSide === 'team1' ? (header.score_team2 ?? 0) : (header.score_team1 ?? 0)) : null
          const theirScore  = header ? (demoOpponentSide === 'team1' ? (header.score_team1 ?? 0) : (header.score_team2 ?? 0)) : null
          const isWin  = ourScore !== null && theirScore !== null ? ourScore > theirScore : null
          const isDraw = ourScore !== null && theirScore !== null ? ourScore === theirScore : false
          const href   = demo.status === 'completed' ? `/demos/${demo.id}?folder=${folderId}` : null
          const isSelected = selected.has(demo.id)

          return (
            <Card
              key={demo.id}
              className={cn(
                'bg-card border-border transition-all duration-150 hover:border-border/80',
                selecting && isSelected && 'border-neon-green/30 bg-neon-green/5',
              )}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  {/* Checkbox — only in selecting mode */}
                  {selecting && (
                    <button
                      onClick={() => toggleSelect(demo.id)}
                      className="shrink-0 text-muted-foreground hover:text-neon-green transition-colors"
                    >
                      {isSelected
                        ? <CheckSquare size={16} className="text-neon-green" />
                        : <Square size={16} />
                      }
                    </button>
                  )}

                  {/* Map icon */}
                  <div
                    className={cn(
                      'w-10 h-10 rounded-lg bg-accent flex items-center justify-center shrink-0 border border-border',
                      selecting && 'cursor-pointer',
                    )}
                    onClick={selecting ? () => toggleSelect(demo.id) : undefined}
                  >
                    <MapPin size={15} className="text-muted-foreground" />
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-semibold text-foreground">
                        {demo.map && demo.map !== 'unknown' ? demo.map : 'Unknown map'}
                      </span>
                      {ourScore !== null && theirScore !== null && (
                        <span className={cn('text-xs font-bold font-mono', isWin ? 'text-neon-green' : isDraw ? 'text-yellow-400' : 'text-red-400')}>
                          {ourScore}–{theirScore}
                        </span>
                      )}
                      <Badge variant={statusVariant(demo.status)} className="text-[10px] h-4 px-1.5">
                        {statusLabel(demo.status)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <Calendar size={10} />
                        {demo.match_date ? formatDate(demo.match_date) : formatDate(demo.created_at)}
                      </span>
                      {demo.file_size_bytes && (
                        <span className="flex items-center gap-1">
                          <HardDrive size={10} /> {formatFileSize(demo.file_size_bytes)}
                        </span>
                      )}
                      {header && (
                        <span className="flex items-center gap-1">
                          <BarChart3 size={10} /> {header.total_rounds} rounds
                        </span>
                      )}
                      {isOwnerOrAdmin && !selecting && demo.status === 'completed' && (
                        <SetOpponentSideButton
                          demoId={demo.id}
                          currentSide={demoOpponentSide}
                          teamNames={header ? {
                            team1: normaliseTeamName(header.team1, 'Team 1 (T-Side)'),
                            team2: normaliseTeamName(header.team2, 'Team 2 (CT-Side)'),
                          } : undefined}
                        />
                      )}
                      {isOwnerOrAdmin && !selecting && demo.status === 'completed' && (
                        <ReparseButton demoId={demo.id} variant="icon" />
                      )}
                    </div>
                  </div>

                  {/* Right actions — hidden in select mode */}
                  {!selecting && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      {demo.status === 'completed' && (
                        <>
                          <Link href={`/ai-coach?folder=${folderId}`}>
                            <Button variant="ghost" size="sm" className="text-xs gap-1 h-7 text-neon-green hover:bg-neon-green/10">
                              <Brain size={11} /> Scout
                            </Button>
                          </Link>
                          <Link href={`/demos/${demo.id}?folder=${folderId}`}>
                            <Button variant="ghost" size="sm" className="text-xs gap-1 h-7 text-muted-foreground hover:text-foreground">
                              <BarChart2 size={11} /> Stats
                            </Button>
                          </Link>
                        </>
                      )}
                      {isOwnerOrAdmin && <DeleteDemoButton demoId={demo.id} />}
                    </div>
                  )}
                </div>

                {/* Stuck / failed recovery */}
                {!selecting && isOwnerOrAdmin && (demo.status === 'processing' || demo.status === 'failed') && (
                  <div className={cn(
                    'mt-3 flex items-start gap-3 rounded-lg px-3 py-2 border',
                    demo.status === 'failed' ? 'bg-red-500/5 border-red-500/20' : 'bg-amber-500/5 border-amber-500/20',
                  )}>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-[11px] font-medium', demo.status === 'failed' ? 'text-red-400' : 'text-amber-400')}>
                        {demo.status === 'failed' ? 'Parsing failed' : 'Stuck in processing'}
                      </p>
                      {demo.error_message && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2 break-words" title={demo.error_message}>
                          {demo.error_message}
                        </p>
                      )}
                    </div>
                    <ReparseButton demoId={demo.id} variant="prominent" />
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}

        {isOwnerOrAdmin && !selecting && (
          <div className="flex justify-end pt-1">
            <DemoUploadButton teamId={teamId} />
          </div>
        )}
      </div>

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
