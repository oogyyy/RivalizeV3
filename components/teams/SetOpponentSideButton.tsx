'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Users, Check, Loader2, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  demoId: string
  currentSide: 'team1' | 'team2'
}

const LABELS = { team1: 'Team 1', team2: 'Team 2' } as const

export default function SetOpponentSideButton({ demoId, currentSide }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState<'team1' | 'team2' | null>(null)

  async function select(side: 'team1' | 'team2') {
    if (side === currentSide) { setOpen(false); return }
    setPending(side)
    try {
      await fetch(`/api/demos/${demoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opponentSide: side }),
      })
      setOpen(false)
      router.refresh()
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        disabled={pending !== null}
        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 group"
        title="Choose which team in this demo is the opponent"
      >
        <Users size={9} className="shrink-0" />
        <span>Scouting: <span className="font-medium">{LABELS[currentSide]}</span></span>
        <ChevronDown size={8} className={cn('transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-5 z-20 bg-card border border-border rounded-lg shadow-xl p-1 min-w-[128px]">
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
                {LABELS[side]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
