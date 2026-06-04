'use client'

import { useEffect, useState } from 'react'
import type { ParsedDemoData } from '@/types/database'

export function hasPositionFrames(parsed: ParsedDemoData | null) {
  return !!parsed?.rounds?.some(round => (round.frames?.length ?? 0) > 0)
}

export function useFullParsedDemo(
  demoId: string,
  baseParsed: ParsedDemoData | null,
  shouldLoad: boolean,
) {
  const [fullParsed, setFullParsed] = useState<ParsedDemoData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setFullParsed(null)
    setError(null)
  }, [demoId, baseParsed])

  useEffect(() => {
    if (!shouldLoad || !baseParsed || hasPositionFrames(baseParsed) || fullParsed) return

    const controller = new AbortController()
    setLoading(true)
    setError(null)

    fetch(`/api/demos/${demoId}/parsed-json`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) {
          const body = await response.json().catch(() => null) as { error?: string } | null
          throw new Error(body?.error ?? 'Unable to load replay movement data')
        }
        return response.json() as Promise<ParsedDemoData>
      })
      .then(parsed => {
        if (!controller.signal.aborted) setFullParsed(parsed)
      })
      .catch(err => {
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err.message : 'Unable to load replay movement data')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [baseParsed, demoId, fullParsed, shouldLoad])

  const parsed = hasPositionFrames(baseParsed) ? baseParsed : (fullParsed ?? baseParsed)

  return {
    parsed,
    loading,
    error,
    hasFrames: hasPositionFrames(parsed),
  }
}
