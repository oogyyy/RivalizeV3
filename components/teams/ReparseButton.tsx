'use client'

import { useCallback, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { ReparseProgress } from '@/components/demos/ReparseProgress'

interface Props {
  demoId: string
}

export default function ReparseButton({ demoId }: Props) {
  const [loading, setLoading]     = useState(false)
  const [reparsing, setReparsing] = useState(false)
  const [error, setError]         = useState(false)
  const router = useRouter()

  async function handleReparse(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`/api/demos/${demoId}/reparse`, { method: 'POST' })
      if (!res.ok) throw new Error(await res.text())
      setReparsing(true)
    } catch {
      setError(true)
      setTimeout(() => setError(false), 3000)
    } finally {
      setLoading(false)
    }
  }

  const handleDone = useCallback(() => {
    setReparsing(false)
    router.refresh()
  }, [router])

  return (
    <span className="relative inline-flex flex-col gap-1">
      <span className="inline-flex items-center gap-2">
        <button
          onClick={handleReparse}
          disabled={loading || reparsing}
          title="Re-parse demo"
          className="p-1.5 rounded-md text-muted-foreground hover:text-blue-400 hover:bg-blue-400/10 transition-all duration-150 disabled:opacity-40"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
        {error && (
          <span className="text-xs text-red-400 whitespace-nowrap">Failed to start</span>
        )}
      </span>

      {reparsing && (
        <span className="block w-48">
          <ReparseProgress demoId={demoId} onDone={handleDone} />
        </span>
      )}
    </span>
  )
}
