'use client'

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Props {
  demoId: string
}

export default function ReparseButton({ demoId }: Props) {
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<'success' | 'error' | null>(null)
  const router = useRouter()

  async function handleReparse(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setLoading(true)
    try {
      const res = await fetch(`/api/demos/${demoId}/reparse`, { method: 'POST' })
      if (!res.ok) throw new Error(await res.text())
      setToast('success')
      setTimeout(() => {
        setToast(null)
        router.refresh()
      }, 1500)
    } catch {
      setToast('error')
      setTimeout(() => setToast(null), 2500)
    } finally {
      setLoading(false)
    }
  }

  return (
    <span className="relative inline-flex items-center">
      <button
        onClick={handleReparse}
        disabled={loading}
        title="Re-parse demo with real data"
        className="p-1.5 rounded-md text-muted-foreground hover:text-blue-400 hover:bg-blue-400/10 transition-all duration-150 disabled:opacity-40"
      >
        <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
      </button>
      {toast === 'success' && (
        <span className="absolute left-8 top-0 text-xs text-green-400 whitespace-nowrap">Re-parsing…</span>
      )}
      {toast === 'error' && (
        <span className="absolute left-8 top-0 text-xs text-red-400 whitespace-nowrap">Failed</span>
      )}
    </span>
  )
}
