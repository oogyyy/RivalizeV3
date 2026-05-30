'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  demoId: string
  onDone: () => void
}

// Progress checkpoints: [targetPercent, delayMs from mount]
// Simulates download (fast) → parse (medium) → save (slow) phases.
const STEPS: Array<[number, number]> = [
  [12,  300],
  [28,  2_500],
  [46,  7_000],
  [63,  13_000],
  [79,  21_000],
  [88,  29_000],
]

export function ReparseProgress({ demoId, onDone }: Props) {
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState<'queued' | 'processing' | 'completed' | 'failed' | null>(null)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  // Step up progress on a schedule — JS state + CSS transition is far
  // more reliable than Tailwind keyframe width animations.
  useEffect(() => {
    const timers = STEPS.map(([target, delay]) =>
      setTimeout(() => setProgress(p => Math.max(p, target)), delay),
    )
    return () => timers.forEach(clearTimeout)
  }, [])

  // Poll Supabase every 2 s for status.
  const poll = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('demos')
      .select('status')
      .eq('id', demoId)
      .single()

    if (data?.status) {
      setStatus(data.status as any)

      if (data.status === 'completed' || data.status === 'failed') {
        setProgress(100)
        setTimeout(() => onDoneRef.current(), 500)
      }
    }
  }, [demoId])

  useEffect(() => {
    const interval = setInterval(poll, 2000)
    // Immediate first poll
    poll()
    return () => clearInterval(interval)
  }, [poll])

  const label =
    status === 'queued'
      ? 'Queued for parsing…'
      : status === 'processing'
      ? 'Parsing demo…'
      : 'Re-parsing demo…'

  return (
    <div className="w-full space-y-1.5">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span>{progress < 100 ? `${Math.round(progress)}%` : 'Done'}</span>
      </div>
      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-neon-green transition-all duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
