'use client'

import { useMemo } from 'react'
import { AlertTriangle, TrendingDown, Crosshair, Map, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PlayerStats, Kill } from '@/types/database'

interface DemoEntry {
  demoId: string
  map: string
  date: string | null
  stats: PlayerStats
  kills: Kill[]
  deaths: Kill[]
  result?: 'Win' | 'Loss' | 'Draw' | null
}

interface Props {
  demoEntries: DemoEntry[]
}

interface Weakness {
  icon: React.ReactNode
  title: string
  detail: string
  severity: 'high' | 'medium' | 'low'
}

const MAP_LABELS: Record<string, string> = {
  de_dust2: 'Dust2', de_mirage: 'Mirage', de_inferno: 'Inferno',
  de_nuke: 'Nuke', de_overpass: 'Overpass', de_ancient: 'Ancient',
  de_anubis: 'Anubis', de_vertigo: 'Vertigo',
}

const SEVERITY_STYLES: Record<string, string> = {
  high:   'border-red-500/30 bg-red-500/5',
  medium: 'border-orange-500/30 bg-orange-500/5',
  low:    'border-yellow-500/20 bg-yellow-500/5',
}

const SEVERITY_BADGE: Record<string, string> = {
  high:   'text-red-400 bg-red-500/10',
  medium: 'text-orange-400 bg-orange-500/10',
  low:    'text-yellow-400 bg-yellow-500/10',
}

function detectWeaknesses(entries: DemoEntry[]): Weakness[] {
  if (entries.length === 0) return []
  const weaknesses: Weakness[] = []
  const n = entries.length
  const avg = (fn: (s: PlayerStats) => number) => entries.reduce((a, e) => a + fn(e.stats), 0) / n

  const avgRating = avg(s => s.rating)
  const avgKast   = avg(s => s.kast)
  const avgAdr    = avg(s => s.adr)
  const avgHs     = avg(s => s.headshot_percentage)
  const kd        = entries.reduce((a, e) => a + e.stats.kills, 0) /
                    Math.max(1, entries.reduce((a, e) => a + e.stats.deaths, 0))

  // Rating trend (last 3 vs first 3)
  if (n >= 4) {
    const half = Math.floor(n / 2)
    const earlyAvg = entries.slice(0, half).reduce((a, e) => a + e.stats.rating, 0) / half
    const recentAvg = entries.slice(n - half).reduce((a, e) => a + e.stats.rating, 0) / half
    const drop = earlyAvg - recentAvg
    if (drop > 0.15) {
      weaknesses.push({
        icon: <TrendingDown size={14} />,
        title: 'Declining Form',
        detail: `Rating dropped from ${earlyAvg.toFixed(2)} to ${recentAvg.toFixed(2)} across recent demos. Performance is trending downward.`,
        severity: drop > 0.3 ? 'high' : 'medium',
      })
    }
  }

  // Low KAST
  if (avgKast < 0.65) {
    weaknesses.push({
      icon: <Zap size={14} />,
      title: 'Low KAST',
      detail: `Average KAST of ${Math.round(avgKast * 100)}% (target ≥65%). Frequently has rounds with zero impact — needs better trade awareness.`,
      severity: avgKast < 0.5 ? 'high' : 'medium',
    })
  }

  // K/D below 1
  if (kd < 0.85) {
    weaknesses.push({
      icon: <Crosshair size={14} />,
      title: 'Negative K/D Ratio',
      detail: `K/D of ${kd.toFixed(2)} — dying more than killing. Average ${avg(s => s.deaths).toFixed(1)} deaths per demo.`,
      severity: kd < 0.7 ? 'high' : 'medium',
    })
  }

  // ADR too low
  if (avgAdr < 65) {
    weaknesses.push({
      icon: <AlertTriangle size={14} />,
      title: 'Low Damage Output',
      detail: `ADR of ${avgAdr.toFixed(0)} is below the team-player threshold of 65. Often winning duels without converting damage, or avoiding engagements.`,
      severity: avgAdr < 50 ? 'high' : 'low',
    })
  }

  // Per-map underperformance
  const mapStats: Record<string, { rating: number; games: number }> = {}
  for (const e of entries) {
    if (!mapStats[e.map]) mapStats[e.map] = { rating: 0, games: 0 }
    mapStats[e.map].rating += e.stats.rating
    mapStats[e.map].games++
  }
  const worstMap = Object.entries(mapStats)
    .map(([map, s]) => ({ map, avg: s.rating / s.games, games: s.games }))
    .filter(m => m.games >= 2 && m.avg < avgRating - 0.2)
    .sort((a, b) => a.avg - b.avg)[0]

  if (worstMap) {
    weaknesses.push({
      icon: <Map size={14} />,
      title: `Underperforming on ${MAP_LABELS[worstMap.map] ?? worstMap.map}`,
      detail: `Rating of ${worstMap.avg.toFixed(2)} on ${MAP_LABELS[worstMap.map] ?? worstMap.map} vs ${avgRating.toFixed(2)} overall across ${worstMap.games} demos. Consider map-specific practice.`,
      severity: worstMap.avg < avgRating - 0.35 ? 'high' : 'low',
    })
  }

  // High HS% with low overall rating — peeking on duels but losing
  if (avgHs > 60 && avgRating < 1.0) {
    weaknesses.push({
      icon: <Crosshair size={14} />,
      title: 'Aggressive Peeker Losing Duels',
      detail: `High HS% (${avgHs.toFixed(0)}%) suggests aggressive play, but ${avgRating.toFixed(2)} rating means the duels aren't converting. Work on positioning and pre-aim.`,
      severity: 'medium',
    })
  }

  // Loss performance (perform worse in losses)
  const lossEntries = entries.filter(e => e.result === 'Loss')
  const winEntries  = entries.filter(e => e.result === 'Win')
  if (lossEntries.length >= 2 && winEntries.length >= 2) {
    const lossRating = lossEntries.reduce((a, e) => a + e.stats.rating, 0) / lossEntries.length
    const winRating  = winEntries.reduce((a, e) => a + e.stats.rating, 0)  / winEntries.length
    if (winRating - lossRating > 0.3) {
      weaknesses.push({
        icon: <TrendingDown size={14} />,
        title: 'Struggles in Losses',
        detail: `Rating drops to ${lossRating.toFixed(2)} in losses vs ${winRating.toFixed(2)} in wins. Performance is correlated with team result — may be tiltable or not stepping up in tough games.`,
        severity: 'medium',
      })
    }
  }

  return weaknesses.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 }
    return order[a.severity] - order[b.severity]
  })
}

export default function PlayerWeaknessPanel({ demoEntries }: Props) {
  const weaknesses = useMemo(() => detectWeaknesses(demoEntries), [demoEntries])

  if (weaknesses.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle size={14} className="text-yellow-400" />
          <h2 className="text-[13px] font-semibold text-foreground">Weakness Report</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          No significant weaknesses detected based on current demo data. Keep it up!
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="accent-line-amber w-full" />
      <div className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-md bg-orange-500/10 flex items-center justify-center">
            <AlertTriangle size={14} className="text-orange-400" />
          </div>
          <h2 className="text-[13px] font-semibold text-foreground">Weakness Report</h2>
          <span className="ml-auto text-[10px] text-muted-foreground/50 font-mono">{weaknesses.length} issue{weaknesses.length !== 1 ? 's' : ''}</span>
        </div>

        <div className="space-y-3">
          {weaknesses.map((w, i) => (
            <div
              key={i}
              className={cn('rounded-lg border p-3.5', SEVERITY_STYLES[w.severity])}
            >
              <div className="flex items-start gap-2.5">
                <div className={cn('text-xs font-bold px-1.5 py-0.5 rounded mt-0.5 shrink-0', SEVERITY_BADGE[w.severity])}>
                  {w.severity.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={cn('shrink-0', SEVERITY_BADGE[w.severity].split(' ')[0])}>{w.icon}</span>
                    <p className="text-sm font-semibold text-foreground">{w.title}</p>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{w.detail}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
