'use client'

import { useEffect, useState } from 'react'
import { Brain, RefreshCw, Loader2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  folderId: string
  cachedBrief: string | null
  updatedAt: string | null
}

function MarkdownBlock({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <div className="space-y-1 text-sm text-foreground/90 leading-relaxed">
      {lines.map((line, i) => {
        if (line.startsWith('## ')) {
          return (
            <h2 key={i} className="text-base font-bold text-foreground mt-5 mb-2 first:mt-0">
              {line.replace('## ', '')}
            </h2>
          )
        }
        if (line.startsWith('### ')) {
          return <h3 key={i} className="text-sm font-semibold text-foreground/90 mt-3 mb-1">{line.replace('### ', '')}</h3>
        }
        if (line.startsWith('- ') || line.startsWith('• ')) {
          const content = line.replace(/^[-•] /, '')
          const parts = content.split(/\*\*(.*?)\*\*/g)
          return (
            <div key={i} className="flex gap-2 items-start">
              <span className="text-neon-green/60 mt-0.5 shrink-0">›</span>
              <p>
                {parts.map((p, j) =>
                  j % 2 === 1 ? <strong key={j} className="text-foreground font-semibold">{p}</strong> : p
                )}
              </p>
            </div>
          )
        }
        if (line.trim() === '') return <div key={i} className="h-1" />
        const parts = line.split(/\*\*(.*?)\*\*/g)
        return (
          <p key={i}>
            {parts.map((p, j) =>
              j % 2 === 1 ? <strong key={j} className="text-foreground font-semibold">{p}</strong> : p
            )}
          </p>
        )
      })}
    </div>
  )
}

export default function AiBriefSection({ folderId, cachedBrief, updatedAt }: Props) {
  const [brief, setBrief]           = useState<string | null>(cachedBrief)
  const [loading, setLoading]       = useState(!cachedBrief)
  const [regenerating, setRegen]    = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [briefUpdatedAt, setUpdatedAt] = useState(updatedAt)

  const fetchBrief = async (regenerate = false) => {
    if (regenerate) setRegen(true)
    else setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/opponents/${folderId}/ai-brief`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regenerate }),
      })
      const data = await res.json() as { brief?: string; error?: string; updatedAt?: string }
      if (!res.ok) throw new Error(data.error ?? 'Generation failed')
      setBrief(data.brief ?? null)
      setUpdatedAt(data.updatedAt ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
      setRegen(false)
    }
  }

  useEffect(() => {
    if (!cachedBrief) fetchBrief()
  }, [folderId])

  const formattedDate = briefUpdatedAt
    ? new Date(briefUpdatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  if (loading) {
    return (
      <section className="prep-section rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-md bg-purple-500/10 flex items-center justify-center">
            <Brain size={16} className="text-purple-400" />
          </div>
          <h2 className="text-base font-semibold text-foreground">AI Intelligence Brief</h2>
        </div>
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <Loader2 size={24} className="text-purple-400 animate-spin" />
          <div>
            <p className="text-sm font-medium text-foreground">Generating AI Brief</p>
            <p className="text-xs text-muted-foreground mt-0.5">Analysing opponent patterns with Groq…</p>
          </div>
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section className="prep-section rounded-xl border border-red-500/20 bg-red-500/5 p-5">
        <div className="flex items-start gap-3">
          <AlertCircle size={18} className="text-red-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-400">AI Brief generation failed</p>
            <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
            <button
              onClick={() => fetchBrief()}
              className="mt-3 text-xs text-muted-foreground hover:text-foreground underline"
            >
              Try again
            </button>
          </div>
        </div>
      </section>
    )
  }

  if (!brief) return null

  return (
    <section className="prep-section rounded-xl border border-purple-500/20 bg-card overflow-hidden">
      <div className="h-0.5 w-full bg-gradient-to-r from-purple-500/60 via-purple-400/30 to-transparent" />
      <div className="p-5">
        <div className="flex items-center justify-between mb-5 no-print">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-purple-500/10 flex items-center justify-center">
              <Brain size={14} className="text-purple-400" />
            </div>
            <h2 className="text-base font-semibold text-foreground">AI Intelligence Brief</h2>
            {formattedDate && (
              <span className="text-[10px] text-muted-foreground/50 font-mono">· {formattedDate}</span>
            )}
          </div>
          <button
            onClick={() => fetchBrief(true)}
            disabled={regenerating}
            className={cn(
              'flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-lg border border-border hover:border-border/80',
              regenerating && 'opacity-50 cursor-not-allowed',
            )}
          >
            <RefreshCw size={11} className={regenerating ? 'animate-spin' : ''} />
            {regenerating ? 'Regenerating…' : 'Regenerate'}
          </button>
        </div>
        {/* Print header */}
        <div className="hidden print-show mb-4">
          <div className="flex items-center gap-2">
            <Brain size={16} className="text-purple-400" />
            <h2 className="text-base font-semibold">AI Intelligence Brief</h2>
          </div>
        </div>

        <MarkdownBlock text={brief} />
      </div>
    </section>
  )
}
