'use client'

import { useState } from 'react'
import { Swords, Loader2, AlertCircle, RefreshCw, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  opponentName: string
  selfMapStats: Record<string, { wins: number; losses: number; winRate: number }>
  opponentMapPicks: Record<string, number>
}

function VetoText({ text }: { text: string }) {
  return (
    <div className="space-y-1 text-sm text-foreground/90 leading-relaxed">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('## ') || line.startsWith('# ')) {
          return <h3 key={i} className="text-sm font-bold text-foreground mt-3 mb-1">{line.replace(/^#+ /, '')}</h3>
        }
        const numbered = line.match(/^(\d+)\.\s(.+)/)
        const bullet = line.startsWith('- ') || line.startsWith('* ')
        if (numbered || bullet) {
          const content = numbered ? numbered[2] : line.slice(2)
          const parts = content.split(/\*\*(.*?)\*\*/g)
          return (
            <div key={i} className="flex gap-2 items-start">
              <span className="text-neon-green/60 mt-0.5 shrink-0 font-mono text-xs">
                {numbered ? `${numbered[1]}.` : '›'}
              </span>
              <p>{parts.map((p, j) => (j % 2 === 1 ? <strong key={j} className="text-foreground font-semibold">{p}</strong> : p))}</p>
            </div>
          )
        }
        if (line.trim() === '') return <div key={i} className="h-1" />
        const parts = line.split(/\*\*(.*?)\*\*/g)
        return <p key={i}>{parts.map((p, j) => (j % 2 === 1 ? <strong key={j} className="text-foreground font-semibold">{p}</strong> : p))}</p>
      })}
    </div>
  )
}

export default function VetoPlanSection({ opponentName, selfMapStats, opponentMapPicks }: Props) {
  const [plan, setPlan]       = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const hasSelfData = Object.keys(selfMapStats).length > 0

  const generate = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/veto/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selfMapStats,
          opponentMapPicks: Object.keys(opponentMapPicks).length > 0 ? opponentMapPicks : undefined,
          opponentName,
        }),
      })
      const data = await res.json() as { recommendation?: string; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Generation failed')
      setPlan(data.recommendation ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className={cn('prep-section rounded-xl border border-border bg-card p-5', !plan && 'no-print')}>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-orange-500/10 flex items-center justify-center">
            <Swords size={14} className="text-orange-400" />
          </div>
          <h2 className="text-base font-semibold text-foreground">Veto Plan</h2>
        </div>
        {plan && (
          <button
            onClick={generate}
            disabled={loading}
            className="no-print flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-lg border border-border"
          >
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
            Regenerate
          </button>
        )}
      </div>

      {!plan && !loading && !error && (
        <div className="flex flex-col items-center text-center py-6">
          <p className="text-sm text-muted-foreground mb-4 max-w-md">
            {hasSelfData
              ? `Generate an AI veto order built from your map win rates and ${opponentName}'s map picks.`
              : 'Upload some of your own team demos first — the veto plan needs your map win rates to make recommendations.'}
          </p>
          {hasSelfData && (
            <button
              onClick={generate}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500/10 border border-orange-500/30 text-orange-400 text-sm font-medium hover:bg-orange-500/20 transition-colors"
            >
              <Sparkles size={13} />
              Generate veto plan
            </button>
          )}
        </div>
      )}

      {loading && !plan && (
        <div className="flex items-center justify-center gap-3 py-8 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin text-orange-400" />
          Building veto recommendation…
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 text-sm text-red-400">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          <div>
            {error}
            <button onClick={generate} className="block mt-1 text-xs underline text-muted-foreground hover:text-foreground">Try again</button>
          </div>
        </div>
      )}

      {plan && <VetoText text={plan} />}
    </section>
  )
}
