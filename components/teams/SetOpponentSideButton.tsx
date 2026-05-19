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
}

export default function SetOpponentSideButton({ demoId, currentSide, teamNames, variant = 'opponent' }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState<'team1' | 'team2' | null>(null)

  const labels = {
    team1: teamNames?.team1 || 'Team 1',
    team2: teamNames?.team2 || 'Team 2',
  }

  // In 'self' variant: the user's own team is the side that is NOT the opponent.
  const userSide: 'team1' | 'team2' = currentSide === 'team1' ? 'team2' : 'team1'

  async function select(side: 'team1' | 'team2') {
    // In self mode the caller picks their own team side; we store the opposite as opponentSide.
    const opponentSideToSave: 'team1' | 'team2' =
      variant === 'self' ? (side === 'team1' ? 'team2' : 'team1') : side

    if (opponentSideToSave === currentSide) { setOpen(false); return }
    setPending(side)
    try {
      await fetch(`/api/demos/${demoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opponentSide: opponentSideToSave }),
      })
      setOpen(false)
      router.refresh()
    } finally {
      setPending(null)
    }
  }

  if (variant === 'self') {
    return (
      <div className="relative">
        <button
          onClick={() => setOpen(v => !v)}
          disabled={pending !== null}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 group"
          title="Change which team in this demo is your team"
        >
          <Users size={9} className="shrink-0" />
          <span>My team: <span className="font-medium">{labels[userSide]}</span></span>
          <ChevronDown size={8} className={cn('transition-transform', open && 'rotate-180')} />
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute left-0 top-5 z-20 bg-card border border-border rounded-lg shadow-xl p-1 min-w-[160px]">
              <p className="text-[9px] text-muted-foreground px-2 pt-1 pb-1.5 font-medium uppercase tracking-wide">
                Which side are you?
              </p>
              {(['team1', 'team2'] as const).map(side => (
                <button
                  key={side}
                  onClick={() => select(side)}
                  disabled={pending !== null}
                  className={cn(
                    'flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs text-left transition-colors',
                    userSide === side
                      ? 'text-neon-green bg-neon-green/10'
                      : 'text-foreground hover:bg-accent',
                    'disabled:opacity-50'
                  )}
                >
                  {pending === side ? (
                    <Loader2 size={10} className="animate-spin shrink-0" />
                  ) : userSide === side ? (
                    <Check size={10} className="text-neon-green shrink-0" />
                  ) : (
                    <span className="w-2.5 shrink-0" />
                  )}
                  I am {labels[side]}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    )
  }

  // Default 'opponent' variant — unchanged behaviour
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        disabled={pending !== null}
        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 group"
        title="Choose which team in this demo is the opponent"
      >
        <Users size={9} className="shrink-0" />
        <span>Scouting: <span className="font-medium">{labels[currentSide]}</span></span>
        <ChevronDown size={8} className={cn('transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-5 z-20 bg-card border border-border rounded-lg shadow-xl p-1 min-w-[140px]">
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
                  currentSide === side
                    ? 'text-neon-green bg-neon-green/10'
                    : 'text-foreground hover:bg-accent',
                  'disabled:opacity-50'
                )}
              >
                {pending === side ? (
                  <Loader2 size={10} className="animate-spin shrink-0" />
                ) : currentSide === side ? (
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
