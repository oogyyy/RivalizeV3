'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  demoId: string
  /** Called once the demo status flips to 'completed' or 'failed'. */
  onDone: () => void
}

/**
 * Animated progress bar shown while a demo is being re-parsed.
 *
 * Progress is fake (the backend gives no granular events), so we animate
 * 0 → 85 % over ~30 s via a CSS keyframe and snap to 100 % when the
 * Supabase status flips to 'completed' or 'failed'.
 */
export function ReparseProgress({ demoId, onDone }: Props) {
  const [done, setDone] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  // Elapsed-seconds ticker — drives the "X s" label.
  useEffect(() => {
    const t = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [])

  // Poll Supabase every 2 s until the demo status changes.
  const poll = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('demos')
      .select('status')
      .eq('id', demoId)
      .single()
    if (data?.status === 'completed' || data?.status === 'failed') {
      setDone(true)
      // Small delay so the bar visually reaches 100 % before the parent unmounts it.
      setTimeout(() => onDoneRef.current(), 600)
    }
  }, [demoId])

  useEffect(() => {
    const interval = setInterval(poll, 2000)
    return () => clearInterval(interval)
  }, [poll])

  return (
    <div className="w-full rounded-lg border border-border bg-card/60 px-4 py-3 space-y-2 animate-fade-in">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-muted-foreground font-medium">
          <Loader2 size={13} className="animate-spin text-neon-green" />
          Re-parsing demo…
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {done ? 'Done' : `${elapsed}s — usually 15–30s`}
        </span>
      </div>

      {/* Track */}
      <div className="relative h-1.5 w-full rounded-full bg-muted overflow-hidden">
        {/* Animated fill */}
        <div
          className={
            done
              ? 'absolute inset-y-0 left-0 rounded-full bg-neon-green transition-all duration-500 ease-out w-full'
              : 'absolute inset-y-0 left-0 rounded-full bg-neon-green animate-reparse-fill'
          }
        />
        {/* Shimmer overlay while running */}
        {!done && (
          <div
            className="absolute inset-0 rounded-full opacity-40"
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.35) 50%, transparent 100%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.5s linear infinite',
            }}
          />
        )}
      </div>
    </div>
  )
}
