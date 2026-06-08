'use client'

import { useState } from 'react'
import { RefreshCw, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  teamId: string
  lastUpdated?: string | null
}

export default function RefreshStatsButton({ teamId, lastUpdated }: Props) {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleRefresh() {
    setLoading(true)
    setError(null)
    setDone(false)
    try {
      const res = await fetch(`/api/teams/${teamId}/refresh-stats`, { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      setDone(true)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  const age = lastUpdated
    ? Math.floor((Date.now() - new Date(lastUpdated).getTime()) / 60000)
    : null

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleRefresh}
        disabled={loading}
        className={cn(
          'h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground',
          done && 'text-neon-green hover:text-neon-green',
        )}
      >
        {loading
          ? <Loader2 size={12} className="animate-spin" />
          : <RefreshCw size={12} className={done ? 'text-neon-green' : ''} />
        }
        {loading ? 'Refreshing…' : done ? 'Updated' : 'Refresh stats'}
      </Button>
      {age !== null && !error && (
        <span className="text-[10px] text-muted-foreground/60">
          {age === 0 ? 'Updated just now' : `Updated ${age}m ago`}
        </span>
      )}
      {error && (
        <span className="text-[10px] text-red-400">{error}</span>
      )}
    </div>
  )
}
