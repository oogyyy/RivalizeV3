'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Users, Check, Loader2, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  demoId: string
  currentSide: 'team1' | 'team2'
  teamNames?: { team1: string; team2: string }
  /**
   * 'opponent' (default): the currentSide is the opponent — shows "Scouting: Team X".
   * 'self': the currentSide is still stored as opponentSide in the DB, but the UI
   *   displays the user's own team (the inverse side) and lets them pick "I am Team X".
   */
  variant?: 'opponent' | 'self'
  onSideChange?: (demoId: string, opponentSide: 'team1' | 'team2') => void
}

export default function SetOpponentSideButton({ demoId, currentSide, teamNames, variant = 'opponent', onSideChange }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState<'team1' | 'team2' | null>(null)
  // Optimistic local state — updates instantly on click, avoids refresh race conditions
  const [optimisticSide, setOptimisticSide] = useState<'team1' | 'team2'>(currentSide)

  // currentSide is managed by MyTeamStatsAndDemos local state (always in sync with
  // optimisticSide via onSideChange), so no useEffect sync is needed or safe here.
  const activeSide = optimisticSide

  const labels = {
    team1: teamNames?.team1 || 'Team 1',
    team2: teamNames?.team2 || 'Team 2',
  }

  // In 'self' variant: the user's own team is the side that is NOT the opponent.
  const userSide: 'team1' | 'team2' = activeSide === 'team1' ? 'team2' : 'team1'

  async function select(side: 'team1' | 'team2') {
    // In self mode the caller picks their own team side; we store the opposite as opponentSide.
    const opponentSideToSave: 'team1' | 'team2' =
      variant === 'self' ? (side === 'team1' ? 'team2' : 'team1') : side

    if (opponentSideToSave === activeSide) { setOpen(false); return }

    const prevSide = activeSide
    // Optimistically update the UI immediately
    setOptimisticSide(opponentSideToSave)
    setPending(side)
    setOpen(false)
    // Notify parent immediately so stats/roster update without waiting for server refresh
    onSideChange?.(demoId, opponentSideToSave)
    try {
      const res = await fetch(`/api/demos/${demoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opponentSide: opponentSideToSave }),
      })
      if (!res.ok) throw new Error(`PATCH failed: ${res.status}`)
      // Skip refresh when onSideChange is provided — the parent (MyTeamStatsAndDemos)
      // manages all state client-side. router.refresh() risks remounting the tree and
      // resetting localDemos back to stale server data, causing the visible revert.
      if (!onSideChange) router.refresh()
    } catch {
      // Revert on failure
      setOptimisticSide(prevSide)
      onSideChange?.(demoId, prevSide)
    } finally {
      setPending(null)
    }
  }

  // Self variant — prominent inline two-button team picker
  if (variant === 'self') {
    return (
      <div className="flex items-center gap-2.5 flex-wrap">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          My team
        </span>
        <div className="flex gap-1.5">
          {(['team1', 'team2'] as const).map(side => {
            const isActive = (activeSide === 'team1' ? 'team2' : 'team1') === side
            return (
              <button
                key={side}
                onClick={() => select(side)}
                disabled={pending !== null}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border-2 transition-all duration-150',
                  isActive
                    ? 'border-neon-green bg-neon-green/10 text-neon-green'
                    : 'border-border bg-background/40 text-muted-foreground hover:border-neon-green/40 hover:text-foreground',
                  'disabled:opacity-40',
                )}
              >
                {pending === side ? (
                  <Loader2 size={10} className="animate-spin shrink-0" />
                ) : isActive ? (
                  <Check size={10} className="shrink-0" />
                ) : (
                  <span className="w-2 h-2 rounded-full border border-current/30 shrink-0" />
                )}
                {labels[side]}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // Default 'opponent' variant — small dropdown (unchanged)
  return (
    <div className={cn('relative', open && 'z-30')}>
      <button
        onClick={() => setOpen(v => !v)}
        disabled={pending !== null}
        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 group"
        title="Choose which team in this demo is the opponent"
      >
        <Users size={9} className="shrink-0" />
        <span>Scouting: <span className="font-medium">{labels[activeSide]}</span></span>
        <ChevronDown size={8} className={cn('transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-5 z-20 bg-[#13132a] border border-border rounded-lg shadow-2xl p-1 min-w-[140px]">
            <p className="text-[9px] text-muted-foreground px-2 pt-1 pb-1.5 font-medium uppercase tracking-wide">
              Scout as opponent
            </p>
            {(['team1', 'team2'] as const).map(side => (
              <button
                key={side}
                onClick={() => select(side)}
                disabled={pending !== null}
                className={cn(
                  'flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs text-left transition-colors',
                  activeSide === side
                    ? 'text-neon-green bg-neon-green/10'
                    : 'text-foreground hover:bg-accent',
                  'disabled:opacity-50'
                )}
              >
                {pending === side ? (
                  <Loader2 size={10} className="animate-spin shrink-0" />
                ) : activeSide === side ? (
                  <Check size={10} className="text-neon-green shrink-0" />
                ) : (
                  <span className="w-2.5 shrink-0" />
                )}
                {labels[side]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
