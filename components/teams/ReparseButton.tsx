'use client'

import { useState } from 'react'
import { RefreshCw, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  demoId: string
  /** 'icon' = small icon-only button (default, for completed demos)
   *  'prominent' = labelled button used on stuck/failed demos */
  variant?: 'icon' | 'prominent'
}

export default function ReparseButton({ demoId, variant = 'icon' }: Props) {
  const [loading, setLoading] = useState(false)
  const [done,    setDone]    = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const router = useRouter()

  async function handleReparse(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setLoading(true)
    setError(null)
    setDone(false)
    try {
      // /reparse is synchronous — it keeps the connection open until parsing completes.
      const res = await fetch(`/api/demos/${demoId}/reparse`, { method: 'POST' })
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

  if (variant === 'prominent') {
    return (
      <div className="flex flex-col gap-1">
        <Button
          size="sm"
          variant="outline"
          onClick={handleReparse}
          disabled={loading}
          className={cn(
            'h-7 gap-1.5 text-xs border-amber-500/40 text-amber-400 hover:bg-amber-400/10 hover:border-amber-400/60 hover:text-amber-300',
            done && 'border-neon-green/40 text-neon-green hover:bg-neon-green/10',
            'disabled:opacity-60',
          )}
        >
          {loading
            ? <><Loader2 size={11} className="animate-spin" /> Parsing…</>
            : done
            ? <><RefreshCw size={11} /> Done</>
            : <><RefreshCw size={11} /> Retry parsing</>
          }
        </Button>
        {error && (
          <p className="text-[10px] text-red-400 max-w-[200px] truncate" title={error}>
            {error}
          </p>
        )}
      </div>
    )
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        onClick={handleReparse}
        disabled={loading}
        title={loading ? 'Parsing…' : 'Re-parse demo'}
        className="p-1.5 rounded-md text-muted-foreground hover:text-blue-400 hover:bg-blue-400/10 transition-all duration-150 disabled:opacity-40"
      >
        {loading
          ? <Loader2 size={13} className="animate-spin" />
          : <RefreshCw size={13} />
        }
      </button>
      {error && (
        <span className="text-[10px] text-red-400 whitespace-nowrap">Failed</span>
      )}
    </span>
  )
}
