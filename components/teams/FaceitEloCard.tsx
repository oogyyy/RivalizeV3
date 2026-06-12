'use client'

import { useEffect, useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { TrendingUp, TrendingDown, Minus, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EloSnapshot {
  elo: number
  level: number
  recorded_at: string
}

interface Props {
  faceitNickname: string
  teamId: string
}

const LEVEL_COLORS: Record<number, string> = {
  1: '#eee', 2: '#eee', 3: '#ffd700', 4: '#ffd700',
  5: '#ff8c00', 6: '#ff8c00', 7: '#ff4500',
  8: '#ff4500', 9: '#ff2d78', 10: '#9b1dff',
}

const LEVEL_LABELS: Record<number, string> = {
  1: '1', 2: '2', 3: '3', 4: '4', 5: '5',
  6: '6', 7: '7', 8: '8', 9: '9', 10: '10',
}

export default function FaceitEloCard({ faceitNickname, teamId }: Props) {
  const [elo, setElo]       = useState<number | null>(null)
  const [level, setLevel]   = useState<number | null>(null)
  const [history, setHistory] = useState<EloSnapshot[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch(
          `/api/demos/faceit/pending?nickname=${encodeURIComponent(faceitNickname)}&teamId=${teamId}`,
        )
        if (!res.ok) return
        const data = await res.json() as { elo: number | null; level: number | null }
        setElo(data.elo)
        setLevel(data.level)

        // Also fire an elo-check to store a snapshot and get history
        const eloRes = await fetch('/api/demos/faceit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'elo-check', nickname: faceitNickname }),
        })
        if (eloRes.ok) {
          const eloData = await eloRes.json() as {
            elo: number; level: number; history: EloSnapshot[]
          }
          setElo(eloData.elo)
          setLevel(eloData.level)
          setHistory(eloData.history ?? [])
        }
      } catch { /* silent */ } finally {
        setLoading(false)
      }
    }
    run()
  }, [faceitNickname, teamId])

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 animate-pulse">
        <div className="h-4 w-24 bg-muted/50 rounded mb-3" />
        <div className="h-8 w-20 bg-muted/50 rounded" />
      </div>
    )
  }

  if (!elo) return null

  const chartData = history.map((s: EloSnapshot, i: number) => ({
    idx: i + 1,
    elo: s.elo,
    date: new Date(s.recorded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }))

  const firstElo = history[0]?.elo ?? elo
  const delta    = elo - firstElo
  const Trend    = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus
  const trendColor = delta > 0 ? 'text-[#2DE3CE]' : delta < 0 ? 'text-red-400' : 'text-muted-foreground'
  const levelColor = LEVEL_COLORS[level ?? 1] ?? '#eee'

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="accent-line-purple w-full" />
      <div className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 rounded-md bg-purple-500/10 flex items-center justify-center">
            <Zap size={13} className="text-purple-400" />
          </div>
          <h2 className="text-[13px] font-semibold text-foreground">FACEIT ELO</h2>
          <span className="ml-auto text-[10px] text-muted-foreground/50 font-mono">{faceitNickname}</span>
        </div>

        <div className="flex items-end gap-4 mb-4">
          <div>
            <p className="text-3xl font-bold font-mono text-foreground tabular-nums">{elo.toLocaleString()}</p>
            <div className="flex items-center gap-1.5 mt-1">
              {level && (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                  style={{ color: levelColor, background: `${levelColor}22` }}
                >
                  Level {LEVEL_LABELS[level]}
                </span>
              )}
              {history.length > 1 && (
                <span className={cn('flex items-center gap-0.5 text-[11px] font-mono font-semibold', trendColor)}>
                  <Trend size={11} />
                  {delta > 0 ? '+' : ''}{delta}
                </span>
              )}
            </div>
          </div>
        </div>

        {chartData.length > 1 && (
          <div className="h-[72px] -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="eloGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#9b1dff" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#9b1dff" stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" hide />
                <YAxis domain={['auto', 'auto']} hide />
                <Tooltip
                  contentStyle={{
                    background: '#0d0d1a', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8, fontSize: 11, color: '#fff',
                  }}
                  formatter={(v: number) => [v.toLocaleString(), 'ELO']}
                />
                <ReferenceLine y={firstElo} stroke="rgba(255,255,255,0.1)" strokeDasharray="3 3" />
                <Area
                  type="monotone" dataKey="elo"
                  stroke="#9b1dff" strokeWidth={2}
                  fill="url(#eloGrad)" dot={false}
                  activeDot={{ r: 3, fill: '#9b1dff' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {chartData.length <= 1 && (
          <p className="text-[11px] text-muted-foreground/50">
            ELO trend will appear after a few check-ins.
          </p>
        )}
      </div>
    </div>
  )
}
