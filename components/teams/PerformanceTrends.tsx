'use client'

import { useMemo } from 'react'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import { TrendingUp } from 'lucide-react'
import type { DemoRowData } from '@/components/teams/DemoListMultiSelect'

interface Props {
  demos: DemoRowData[]
}

function getResult(demo: DemoRowData): 'Win' | 'Loss' | 'Draw' | null {
  const pd = demo.parsed_data
  if (!pd) return null
  const opSide = pd.opponentSide ?? 'team2'
  const h = pd.header ?? {}
  const ourScore   = opSide === 'team1' ? (h.score_team2 ?? 0) : (h.score_team1 ?? 0)
  const theirScore = opSide === 'team1' ? (h.score_team1 ?? 0) : (h.score_team2 ?? 0)
  if (ourScore === 0 && theirScore === 0) return null
  return ourScore > theirScore ? 'Win' : ourScore < theirScore ? 'Loss' : 'Draw'
}

const MAP_LABELS: Record<string, string> = {
  de_dust2: 'Dust2', de_mirage: 'Mirage', de_inferno: 'Inferno',
  de_nuke: 'Nuke', de_overpass: 'Overpass', de_ancient: 'Ancient',
  de_anubis: 'Anubis', de_vertigo: 'Vertigo',
}

export default function PerformanceTrends({ demos }: Props) {
  const completed = useMemo(
    () => demos.filter(d => d.status === 'completed').slice().reverse(),
    [demos],
  )

  // Rolling win-rate series
  const trendData = useMemo(() => {
    let wins = 0, played = 0
    return completed.map((d: DemoRowData, i: number) => {
      const result = getResult(d)
      if (result) {
        played++
        if (result === 'Win') wins++
      }
      const wr = played > 0 ? Math.round((wins / played) * 100) : null
      const map = d.parsed_data?.header?.map
      return {
        idx: i + 1,
        result,
        winRate: wr,
        map: map ? (MAP_LABELS[map] ?? map) : '—',
      }
    })
  }, [completed])

  // Per-map win rate
  const mapData = useMemo(() => {
    const stats: Record<string, { wins: number; total: number }> = {}
    for (const d of completed) {
      const map = d.parsed_data?.header?.map
      if (!map || map === 'unknown') continue
      if (!stats[map]) stats[map] = { wins: 0, total: 0 }
      const result = getResult(d)
      if (result) {
        stats[map].total++
        if (result === 'Win') stats[map].wins++
      }
    }
    return Object.entries(stats)
      .map(([map, s]) => ({
        map: MAP_LABELS[map] ?? map,
        winRate: s.total > 0 ? Math.round((s.wins / s.total) * 100) : 0,
        games: s.total,
      }))
      .sort((a, b) => b.winRate - a.winRate)
  }, [completed])

  if (completed.length < 2) return null

  return (
    <div className="space-y-5">
      <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <TrendingUp size={15} className="text-neon-green" />
        Performance Trends
      </h2>

      {/* Win-rate over time */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs text-muted-foreground mb-3">Win rate over time (cumulative)</p>
        <ResponsiveContainer width="100%" height={140}>
          <AreaChart data={trendData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="wrGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#00ffc8" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#00ffc8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="idx" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.35)' }} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.35)' }} tickLine={false} tickFormatter={(v: number) => `${v}%`} />
            <Tooltip
              contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }}
              labelFormatter={(v: number) => `Match #${v}`}
              formatter={(v: number) => [`${v}%`, 'Win Rate']}
            />
            <Area type="monotone" dataKey="winRate" stroke="#00ffc8" strokeWidth={2} fill="url(#wrGrad)" dot={false} connectNulls />
          </AreaChart>
        </ResponsiveContainer>
        {/* Result dots */}
        <div className="flex flex-wrap gap-1 mt-2">
          {trendData.map((d: { idx: number; result: string | null; map: string; winRate: number | null }, i: number) => (
            <div
              key={i}
              title={`Match ${d.idx}: ${d.result ?? '?'} on ${d.map}`}
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{
                background: d.result === 'Win' ? '#00ffc8'
                  : d.result === 'Loss' ? '#ff4466'
                  : d.result === 'Draw' ? '#facc15'
                  : '#555',
              }}
            />
          ))}
        </div>
      </div>

      {/* Per-map win rate */}
      {mapData.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-3">Win rate by map</p>
          <ResponsiveContainer width="100%" height={Math.max(80, mapData.length * 32)}>
            <BarChart layout="vertical" data={mapData} margin={{ top: 0, right: 32, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.35)' }} tickLine={false} tickFormatter={(v: number) => `${v}%`} />
              <YAxis type="category" dataKey="map" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.55)' }} tickLine={false} width={52} />
              <Tooltip
                contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }}
                formatter={(v: number, _n: string, p: { payload?: { games?: number } }) => [`${v}% (${p.payload?.games ?? 0}g)`, 'Win Rate']}
              />
              <Bar dataKey="winRate" radius={[0, 4, 4, 0]} maxBarSize={18}>
                {mapData.map((entry: { map: string; winRate: number; games: number }, i: number) => (
                  <Cell
                    key={i}
                    fill={entry.winRate >= 55 ? '#00ffc8' : entry.winRate >= 45 ? '#facc15' : '#ff4466'}
                    fillOpacity={0.75}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
