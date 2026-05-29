'use client'

import { useMemo } from 'react'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import { Crosshair, TrendingUp, Target, Skull } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PlayerStats, Kill } from '@/types/database'

interface DemoEntry {
  demoId: string
  map: string
  date: string | null
  stats: PlayerStats
  kills: Kill[]
  deaths: Kill[]
}

interface Props {
  playerName: string
  folderId: string
  demoEntries: DemoEntry[]
  teamName: string
}

const MAP_LABELS: Record<string, string> = {
  de_dust2: 'Dust2', de_mirage: 'Mirage', de_inferno: 'Inferno',
  de_nuke: 'Nuke', de_overpass: 'Overpass', de_ancient: 'Ancient',
  de_anubis: 'Anubis', de_vertigo: 'Vertigo',
}

function StatPill({ label, value, color = 'text-foreground' }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="text-center p-3 rounded-lg bg-muted/30">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      <p className={cn('text-xl font-bold font-mono tabular-nums', color)}>{value}</p>
    </div>
  )
}

export default function PlayerDeepDive({ playerName, demoEntries }: Props) {
  // Aggregate totals
  const totals = useMemo(() => {
    const n = demoEntries.length
    const sum = (fn: (s: PlayerStats) => number) => demoEntries.reduce((acc, e) => acc + fn(e.stats), 0)
    const avg = (fn: (s: PlayerStats) => number) => n > 0 ? sum(fn) / n : 0
    return {
      games: n,
      kills: sum(s => s.kills),
      deaths: sum(s => s.deaths),
      assists: sum(s => s.assists),
      avgKills: avg(s => s.kills),
      avgDeaths: avg(s => s.deaths),
      avgAdr: avg(s => s.adr),
      avgRating: avg(s => s.rating),
      avgKast: avg(s => s.kast),
      avgHs: avg(s => s.headshot_percentage),
      kd: sum(s => s.deaths) > 0 ? sum(s => s.kills) / sum(s => s.deaths) : 0,
    }
  }, [demoEntries])

  // Per-demo trend data
  const trendData = useMemo(() =>
    demoEntries.map((e, i) => ({
      idx: i + 1,
      map: MAP_LABELS[e.map] ?? e.map,
      kills: e.stats.kills,
      deaths: e.stats.deaths,
      adr: Math.round(e.stats.adr),
      rating: Math.round(e.stats.rating * 100) / 100,
      hs: Math.round(e.stats.headshot_percentage),
    })),
  [demoEntries])

  // Weapon breakdown across all kills
  const weaponData = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const e of demoEntries) {
      for (const k of e.kills) {
        counts[k.weapon] = (counts[k.weapon] ?? 0) + 1
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([weapon, count]) => ({ weapon, count }))
  }, [demoEntries])

  // Per-map stats
  const mapStats = useMemo(() => {
    const stats: Record<string, { kills: number; deaths: number; adr: number; rating: number; games: number }> = {}
    for (const e of demoEntries) {
      if (!stats[e.map]) stats[e.map] = { kills: 0, deaths: 0, adr: 0, rating: 0, games: 0 }
      const s = stats[e.map]
      s.kills += e.stats.kills; s.deaths += e.stats.deaths
      s.adr += e.stats.adr; s.rating += e.stats.rating; s.games++
    }
    return Object.entries(stats).map(([map, s]) => ({
      map: MAP_LABELS[map] ?? map,
      avgKills: Math.round((s.kills / s.games) * 10) / 10,
      avgRating: Math.round((s.rating / s.games) * 100) / 100,
      games: s.games,
    })).sort((a, b) => b.avgRating - a.avgRating)
  }, [demoEntries])

  const ratingColor = totals.avgRating >= 1.2 ? 'text-neon-green'
    : totals.avgRating >= 1.0 ? 'text-green-400'
    : totals.avgRating >= 0.8 ? 'text-yellow-400'
    : 'text-red-400'

  return (
    <div className="space-y-5">
      {/* Summary stats */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        <StatPill label="Games" value={totals.games} />
        <StatPill label="Avg Rating" value={totals.avgRating.toFixed(2)} color={ratingColor} />
        <StatPill label="K/D" value={totals.kd.toFixed(2)} color={totals.kd >= 1.1 ? 'text-neon-green' : totals.kd >= 0.9 ? 'text-foreground' : 'text-red-400'} />
        <StatPill label="Avg ADR" value={totals.avgAdr.toFixed(0)} />
        <StatPill label="Avg HS%" value={`${totals.avgHs.toFixed(0)}%`} />
        <StatPill label="Avg KAST" value={`${totals.avgKast.toFixed(0)}%`} />
      </div>

      {/* Rating trend */}
      {trendData.length > 1 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <TrendingUp size={12} />
            Rating per Demo
          </p>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={trendData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="ratingGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#818cf8" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="map" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.35)' }} tickLine={false} />
              <YAxis domain={[0, 'auto']} tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.35)' }} tickLine={false} tickFormatter={(v: number) => v.toFixed(1)} />
              <Tooltip
                contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }}
                formatter={(v: number) => [v.toFixed(2), 'Rating']}
              />
              <Area type="monotone" dataKey="rating" stroke="#818cf8" strokeWidth={2} fill="url(#ratingGrad)" dot={{ r: 3, fill: '#818cf8' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Kills / Deaths per demo */}
      {trendData.length > 1 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Crosshair size={12} />
            Kills & Deaths per Demo
          </p>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={trendData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="map" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.35)' }} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.35)' }} tickLine={false} />
              <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="kills"  name="Kills"  fill="#00ffc8" fillOpacity={0.75} radius={[2, 2, 0, 0]} maxBarSize={20} />
              <Bar dataKey="deaths" name="Deaths" fill="#ff4466" fillOpacity={0.75} radius={[2, 2, 0, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Weapon breakdown */}
        {weaponData.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Target size={12} />
              Top Weapons
            </p>
            <div className="space-y-2">
              {weaponData.map(({ weapon, count }: { weapon: string; count: number }, i: number) => {
                const maxCount = weaponData[0].count
                const pct = Math.round((count / maxCount) * 100)
                return (
                  <div key={weapon}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-mono text-foreground capitalize">{weapon}</span>
                      <span className="text-[10px] text-muted-foreground">{count} kills</span>
                    </div>
                    <div className="h-1.5 bg-border rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          background: i === 0 ? '#00ffc8' : i === 1 ? '#818cf8' : '#facc15',
                          opacity: 0.75,
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Per-map performance */}
        {mapStats.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Skull size={12} />
              Per-Map Performance
            </p>
            <div className="space-y-2">
              {mapStats.map(({ map, avgKills, avgRating, games }: { map: string; avgKills: number; avgRating: number; games: number }) => {
                const rColor = avgRating >= 1.2 ? '#00ffc8' : avgRating >= 1.0 ? '#4ade80' : avgRating >= 0.8 ? '#facc15' : '#ff4466'
                return (
                  <div key={map} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/20">
                    <span className="text-xs font-medium text-foreground w-16 flex-shrink-0">{map}</span>
                    <span className="text-[10px] text-muted-foreground">{games}g · {avgKills} K</span>
                    <span className="ml-auto text-sm font-bold font-mono" style={{ color: rColor }}>
                      {avgRating.toFixed(2)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Demo history table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="grid px-4 py-2.5 bg-muted/30 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider"
          style={{ gridTemplateColumns: '60px 1fr 60px 60px 60px 60px 60px' }}>
          <div>#</div><div>Map</div><div className="text-right">K</div><div className="text-right">D</div>
          <div className="text-right">ADR</div><div className="text-right">HS%</div><div className="text-right">Rating</div>
        </div>
        <div className="divide-y divide-border">
          {demoEntries.map((e, i) => {
            const rColor = e.stats.rating >= 1.2 ? 'text-neon-green' : e.stats.rating >= 1.0 ? 'text-green-400' : e.stats.rating >= 0.8 ? 'text-yellow-400' : 'text-red-400'
            return (
              <div
                key={e.demoId}
                className="grid items-center gap-1 px-4 py-2.5 hover:bg-muted/20 transition-colors text-xs font-mono"
                style={{ gridTemplateColumns: '60px 1fr 60px 60px 60px 60px 60px' }}
              >
                <span className="text-muted-foreground">{i + 1}</span>
                <span className="text-foreground font-sans font-medium">{MAP_LABELS[e.map] ?? e.map}</span>
                <span className="text-right text-neon-green">{e.stats.kills}</span>
                <span className="text-right text-red-400">{e.stats.deaths}</span>
                <span className="text-right">{e.stats.adr.toFixed(0)}</span>
                <span className="text-right">{e.stats.headshot_percentage.toFixed(0)}%</span>
                <span className={cn('text-right font-bold', rColor)}>{e.stats.rating.toFixed(2)}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
