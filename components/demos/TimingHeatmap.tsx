'use client'

import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import type { Round } from '@/types/database'

interface TimingHeatmapProps {
  rounds: Round[]
  team1Name: string
  team2Name: string
}

type SideFilter = 'all' | 'T' | 'CT'
type EventFilter = 'kills' | 'grenades' | 'plants'

const BUCKET_SECONDS = 5
const MAX_ROUND_SECONDS = 115
const BUCKETS = Math.ceil(MAX_ROUND_SECONDS / BUCKET_SECONDS) // 23

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.min(1, Math.max(0, t))
}

/** Dark brown → bright orange color scale */
function intensityColor(intensity: number): string {
  if (intensity <= 0) return 'rgba(40,25,10,0.4)'
  // 0→1: dark brown → amber → bright orange
  const r = Math.round(lerp(60, 255, intensity))
  const g = Math.round(lerp(30, Math.round(lerp(120, 80, intensity)), intensity))
  const b = Math.round(lerp(10, 0, intensity))
  return `rgb(${r},${g},${b})`
}

function labelForBucket(i: number): string {
  const s = i * BUCKET_SECONDS
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

interface TimingRow {
  label: string        // player name or event name
  buckets: number[]    // count per 5s bucket
  max: number
}

export default function TimingHeatmap({ rounds, team1Name, team2Name }: TimingHeatmapProps) {
  const [sideFilter, setSideFilter] = useState<SideFilter>('all')
  const [eventFilter, setEventFilter] = useState<EventFilter>('kills')
  const [teamFilter, setTeamFilter] = useState<'all' | string>('all')

  // Build per-player (or aggregate) timing rows
  const rows = useMemo<TimingRow[]>(() => {
    // Map round number to which side each team is on
    // Standard: team1 = T rounds 1-15, CT rounds 16-30
    const getTeamSide = (roundNum: number, team: string): 'T' | 'CT' => {
      const isFirstHalf = roundNum <= 15
      const isTeam1 = team === team1Name
      if (isFirstHalf) return isTeam1 ? 'T' : 'CT'
      return isTeam1 ? 'CT' : 'T'
    }

    if (eventFilter === 'kills') {
      // Per-player kill timing
      const playerBuckets: Record<string, { buckets: number[]; team: string }> = {}

      for (const round of rounds) {
        for (const kill of round.kills ?? []) {
          const side = getTeamSide(round.number, kill.killer_name)
          // Find which team this killer is on (approximate — match name across players)
          // We use kill.killer_name for bucketing
          const bucketIdx = Math.min(BUCKETS - 1, Math.floor(kill.time / BUCKET_SECONDS))

          if (sideFilter !== 'all' && side !== sideFilter) continue
          if (teamFilter !== 'all' && kill.killer_name !== teamFilter) {
            // treat teamFilter as player name filter
          }

          if (!playerBuckets[kill.killer_name]) {
            playerBuckets[kill.killer_name] = { buckets: new Array(BUCKETS).fill(0), team: '' }
          }
          playerBuckets[kill.killer_name].buckets[bucketIdx]++
        }
      }

      // Sort by total kills descending
      return Object.entries(playerBuckets)
        .sort((a, b) => b[1].buckets.reduce((s, x) => s + x, 0) - a[1].buckets.reduce((s, x) => s + x, 0))
        .slice(0, 10)
        .map(([name, data]) => ({
          label: name,
          buckets: data.buckets,
          max: Math.max(...data.buckets, 1),
        }))
    }

    if (eventFilter === 'grenades') {
      const grenBuckets: Record<string, number[]> = {
        smoke:   new Array(BUCKETS).fill(0),
        flash:   new Array(BUCKETS).fill(0),
        he:      new Array(BUCKETS).fill(0),
        molotov: new Array(BUCKETS).fill(0),
      }

      for (const round of rounds) {
        for (const gren of round.grenades ?? []) {
          const bucketIdx = Math.min(BUCKETS - 1, Math.floor(gren.time / BUCKET_SECONDS))
          if (gren.type in grenBuckets) {
            grenBuckets[gren.type][bucketIdx]++
          }
        }
      }

      return Object.entries(grenBuckets).map(([type, buckets]) => ({
        label: type.charAt(0).toUpperCase() + type.slice(1),
        buckets,
        max: Math.max(...buckets, 1),
      }))
    }

    // plants
    const plantBuckets = new Array(BUCKETS).fill(0)
    for (const round of rounds) {
      if (!round.bomb_planted) continue
      // Estimate plant time from kills pattern — use round.duration as proxy
      // Most plants happen around 0:30-1:00 into round, we'll use kills just before
      const lastKillTime = round.kills?.reduce((m, k) => Math.max(m, k.time), 0) ?? 0
      // Plant typically happens before or around the last kill — use 2/3 of duration
      const estimatedPlantTime = Math.min(lastKillTime * 0.7, 75)
      const bucketIdx = Math.min(BUCKETS - 1, Math.floor(estimatedPlantTime / BUCKET_SECONDS))
      plantBuckets[bucketIdx]++
    }

    return [{
      label: 'Bomb Plants',
      buckets: plantBuckets,
      max: Math.max(...plantBuckets, 1),
    }]
  }, [rounds, sideFilter, eventFilter, team1Name, team2Name, teamFilter])

  // Compute global max for relative coloring
  const globalMax = Math.max(...rows.flatMap(r => r.buckets), 1)

  const bucketLabels = Array.from({ length: BUCKETS }, (_, i) => labelForBucket(i))

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap gap-3">
        {/* Event type */}
        <div className="flex items-center rounded-lg border border-border overflow-hidden text-xs">
          {(['kills', 'grenades', 'plants'] as EventFilter[]).map(ef => (
            <button
              key={ef}
              onClick={() => setEventFilter(ef)}
              className={cn(
                'px-3 py-1.5 font-medium capitalize transition-colors',
                eventFilter === ef
                  ? 'bg-neon-green/20 text-neon-green'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/30'
              )}
            >
              {ef}
            </button>
          ))}
        </div>

        {/* Side filter (kills only) */}
        {eventFilter === 'kills' && (
          <div className="flex items-center rounded-lg border border-border overflow-hidden text-xs">
            {(['all', 'T', 'CT'] as SideFilter[]).map(sf => (
              <button
                key={sf}
                onClick={() => setSideFilter(sf)}
                className={cn(
                  'px-3 py-1.5 font-medium transition-colors',
                  sideFilter === sf
                    ? 'bg-neon-green/20 text-neon-green'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/30'
                )}
              >
                {sf === 'all' ? 'All Sides' : `${sf}-side`}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Heatmap grid */}
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No timing data available.</p>
      ) : (
        <div className="overflow-x-auto">
          {/* Time axis header */}
          <div className="min-w-[600px]">
            <div className="flex items-center mb-1" style={{ paddingLeft: '140px' }}>
              {bucketLabels.map((label, i) => (
                <div
                  key={i}
                  className="text-center text-[9px] text-muted-foreground/60 font-mono shrink-0"
                  style={{ width: `${100 / BUCKETS}%` }}
                >
                  {i % 4 === 0 ? label : ''}
                </div>
              ))}
            </div>

            {/* Rows */}
            <div className="space-y-0.5">
              {rows.map(row => {
                const total = row.buckets.reduce((s, x) => s + x, 0)
                return (
                  <div key={row.label} className="flex items-center gap-0">
                    {/* Label */}
                    <div
                      className="shrink-0 text-xs text-foreground font-medium truncate pr-2 text-right"
                      style={{ width: '140px' }}
                      title={row.label}
                    >
                      {row.label}
                    </div>

                    {/* Buckets */}
                    {row.buckets.map((count, i) => {
                      const intensity = count / globalMax
                      const bg = intensityColor(intensity)
                      return (
                        <div
                          key={i}
                          title={`${labelForBucket(i)}–${labelForBucket(i + 1)}: ${count}`}
                          className="shrink-0 h-7 rounded-sm mx-px cursor-default transition-opacity hover:opacity-80"
                          style={{
                            width: `calc(${100 / BUCKETS}% - 2px)`,
                            background: bg,
                          }}
                        />
                      )
                    })}

                    {/* Total */}
                    <div className="shrink-0 text-[10px] text-muted-foreground font-mono pl-2 w-10 text-right">
                      {total}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-2 mt-3 justify-end">
              <span className="text-[10px] text-muted-foreground">Rare</span>
              <div className="flex h-2 w-24 rounded overflow-hidden">
                {Array.from({ length: 12 }, (_, i) => (
                  <div
                    key={i}
                    className="flex-1 h-full"
                    style={{ background: intensityColor(i / 11) }}
                  />
                ))}
              </div>
              <span className="text-[10px] text-muted-foreground">Go-to timing</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
