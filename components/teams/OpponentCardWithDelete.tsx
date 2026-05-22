'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Trash2, ChevronRight, FileVideo, Calendar, Trophy,
  AlertTriangle, Loader2, CheckCircle,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { AggregatedStats } from '@/types/database'

interface Props {
  folder: {
    id: string
    opponent_display_name: string
    opponent_slug: string
    aggregated_stats: AggregatedStats | null
  }
  demoCount: number
  lastActivity?: string
}

export default function OpponentCardWithDelete({ folder, demoCount, lastActivity }: Props) {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const stats = folder.aggregated_stats
  const wins = stats?.wins ?? 0
  const losses = stats?.losses ?? 0
  const draws = stats?.draws ?? 0
  const total = wins + losses + draws
  const winRate = total > 0 ? Math.round((wins / total) * 100) : null
  const isPositive = wins > losses
  const isNegative = losses > wins

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    try {
      const res = await fetch(`/api/opponents/${folder.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Delete failed')
      }
      setDialogOpen(false)
      setSuccess(true)
      setTimeout(() => {
        router.refresh()
      }, 1500)
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err))
      setDeleting(false)
    }
  }

  return (
    <>
      {/* Success toast */}
      {success && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-card border border-neon-green/30 text-foreground text-sm px-4 py-3 rounded-xl shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200">
          <CheckCircle size={16} className="text-neon-green shrink-0" />
          Opponent folder deleted successfully.
        </div>
      )}

      <div className="relative group/card h-full">
        {/* Trash icon — visible on card hover */}
        <button
          className="absolute top-3 right-3 z-10 p-1.5 rounded-md opacity-0 group-hover/card:opacity-100 transition-all duration-150 text-muted-foreground hover:text-red-400 hover:bg-red-400/10"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setDialogOpen(true)
          }}
          aria-label={`Delete ${folder.opponent_display_name}`}
        >
          <Trash2 size={14} />
        </button>

        <Link href={`/opponents/${folder.id}`} className="h-full block">
          <Card className="relative bg-card border-border hover:border-neon-green/35 hover:shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_20px_rgba(0,255,135,0.05)] transition-all duration-200 cursor-pointer group h-full overflow-hidden">
            {/* Top accent line — revealed on hover */}
            <div className="h-px w-full bg-gradient-to-r from-transparent via-neon-green/0 to-transparent group-hover:via-neon-green/40 transition-all duration-300" />
            <CardContent className="p-5 flex flex-col h-full gap-4">
              {/* Top: avatar + name + chevron */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-neon-green/20 via-neon-green/10 to-accent flex items-center justify-center shrink-0 border border-neon-green/20 shadow-[0_0_10px_rgba(0,255,135,0.1)]">
                    <span className="text-base font-bold text-neon-green">
                      {folder.opponent_display_name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate group-hover:text-neon-green transition-colors leading-tight">
                      {folder.opponent_display_name}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <FileVideo size={10} />
                        {demoCount} {demoCount === 1 ? 'demo' : 'demos'}
                      </span>
                      {lastActivity && (
                        <>
                          <span className="text-muted-foreground/30">·</span>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar size={10} />
                            {formatDate(lastActivity)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <ChevronRight
                  size={15}
                  className="text-muted-foreground/40 group-hover:text-neon-green group-hover:translate-x-0.5 transition-all shrink-0 mt-1 mr-6"
                />
              </div>

              {/* Bottom: record + win rate */}
              <div className="flex items-center justify-between border-t border-border/70 pt-3 mt-auto">
                {total > 0 ? (
                  <>
                    <div className="flex items-center gap-1.5">
                      <span className={cn(
                        'text-base font-bold font-mono tabular-nums',
                        isPositive ? 'text-neon-green' : isNegative ? 'text-red-400' : 'text-muted-foreground'
                      )}>
                        {wins}W
                      </span>
                      <span className="text-muted-foreground/40 text-xs">–</span>
                      <span className={cn(
                        'text-base font-bold font-mono tabular-nums',
                        isNegative ? 'text-red-400' : 'text-muted-foreground'
                      )}>
                        {losses}L
                      </span>
                      {draws > 0 && (
                        <>
                          <span className="text-muted-foreground/40 text-xs">–</span>
                          <span className="text-base font-bold font-mono tabular-nums text-yellow-400">{draws}D</span>
                        </>
                      )}
                    </div>
                    {winRate !== null && (
                      <Badge
                        variant={isPositive ? 'neon' : isNegative ? 'destructive' : 'secondary'}
                        className="text-[10px] gap-1"
                      >
                        <Trophy size={9} />
                        {winRate}%
                      </Badge>
                    )}
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground/60 italic">No completed matches</span>
                )}
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Confirmation dialog */}
      {dialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget && !deleting) setDialogOpen(false) }}
        >
          <div className="bg-card border border-red-500/20 rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-red-500/10 flex items-center justify-center shrink-0 mt-0.5">
                <AlertTriangle size={18} className="text-red-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Delete Opponent?</p>
                <p className="text-xs text-muted-foreground mt-1">
                  This will permanently delete the scouting folder for{' '}
                  <span className="text-foreground font-medium">{folder.opponent_display_name}</span>{' '}
                  and all associated demos. This action cannot be undone.
                </p>
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setDialogOpen(false); setError(null) }}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-red-500 hover:bg-red-600 text-white gap-1.5"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <><Loader2 size={13} className="animate-spin" /> Deleting…</>
                ) : (
                  <><Trash2 size={13} /> Delete</>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
