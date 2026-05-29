'use client'

import { useEffect, useState } from 'react'
import { Brain, RefreshCw, Loader2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  demoId: string
}

function MarkdownBlock({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <div className="space-y-1 text-sm text-foreground/90 leading-relaxed">
      {lines.map((line, i) => {
        if (line.startsWith('## ')) {
          return (
            <h2 key={i} className="text-base font-bold text-foreground mt-5 mb-2 first:mt-0 flex items-center gap-2">
              {line.replace('## ', '')}
            </h2>
          )
        }
        if (line.startsWith('### ')) {
          return <h3 key={i} className="text-sm font-semibold text-foreground/90 mt-3 mb-1">{line.replace('### ', '')}</h3>
        }
        if (line.startsWith('**') && line.endsWith('**')) {
          return <p key={i} className="font-semibold text-foreground">{line.replace(/\*\*/g, '')}</p>
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
        if (line.startsWith('# ')) {
          return <h1 key={i} className="text-lg font-bold text-foreground mb-3">{line.replace('# ', '')}</h1>
        }
        if (line.trim() === '') return <div key={i} className="h-1" />

        // Inline bold
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

export default function AiMatchReport({ demoId }: Props) {
  const [report, setReport] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [regenerating, setRegenerating] = useState(false)
  const [cached, setCached] = useState(false)

  const fetchReport = async (regenerate = false) => {
    if (regenerate) setRegenerating(true)
    else setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/demos/${demoId}/ai-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regenerate }),
      })
      const data = await res.json() as { report?: string; error?: string; cached?: boolean }
      if (!res.ok) throw new Error(data.error ?? 'Failed to generate report')
      setReport(data.report ?? null)
      setCached(data.cached ?? false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
      setRegenerating(false)
    }
  }

  useEffect(() => { fetchReport() }, [demoId])

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 flex flex-col items-center gap-3 text-center">
        <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
          <Loader2 size={20} className="text-purple-400 animate-spin" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Generating AI Report</p>
          <p className="text-xs text-muted-foreground mt-0.5">Analysing match data with Groq…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 flex items-start gap-3">
        <AlertCircle size={18} className="text-red-400 mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-red-400">Report generation failed</p>
          <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
          <button
            onClick={() => fetchReport()}
            className="mt-3 text-xs text-muted-foreground hover:text-foreground underline"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (!report) return null

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="accent-line-purple w-full" />
      <div className="p-5">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-purple-500/10 flex items-center justify-center">
              <Brain size={14} className="text-purple-400" />
            </div>
            <h2 className="text-[13px] font-semibold text-foreground">AI Match Report</h2>
            {cached && (
              <span className="text-[10px] text-muted-foreground/50 font-mono ml-1">cached</span>
            )}
          </div>
          <button
            onClick={() => fetchReport(true)}
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

        <MarkdownBlock text={report} />
      </div>
    </div>
  )
}
