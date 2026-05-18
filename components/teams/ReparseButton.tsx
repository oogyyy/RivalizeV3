'use client'

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Props {
  demoId: string
}

export default function ReparseButton({ demoId }: Props) {
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<'queued' | 'error' | null>(null)
  const router = useRouter()

  async function handleReparse(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setLoading(true)
    try {
      const res = await fetch(`/api/demos/${demoId}/reparse`, { method: 'POST' })
      if (!res.ok) throw new Error(await res.text())
      setToast('queued')
      // Poll for completion — large demos take 10–30 s to download + decompress + parse
      let attempts = 0
      const interval = setInterval(() => {
        router.refresh()
        attempts++
        if (attempts >= 12) clearInterval(interval) // give up after ~60 s
      }, 5000)
      setTimeout(() => setToast(null), 3000)
    } catch {
      setToast('error')
      setTimeout(() => setToast(null), 3000)
    } finally {
      setLoading(false)
    }
  }

  return (
    <span className="relative inline-flex items-center">
      <button
        onClick={handleReparse}
        disabled={loading}
        title="Re-parse demo"
        className="p-1.5 rounded-md text-muted-foreground hover:text-blue-400 hover:bg-blue-400/10 transition-all duration-150 disabled:opacity-40"
      >
        <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
      </button>
      {toast === 'queued' && (
        <span className="absolute left-8 top-0 text-xs text-blue-400 whitespace-nowrap">Re-parsing…</span>
      )}
      {toast === 'error' && (
        <span className="absolute left-8 top-0 text-xs text-red-400 whitespace-nowrap">Failed to start</span>
      )}
    </span>
  )
}
