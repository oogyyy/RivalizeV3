'use client'

import { useEffect, useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { Ban, Loader2 } from 'lucide-react'

interface MapCount { map: string; count: number }
interface VetoStats {
  analyzed: number
  firstBans: MapCount[]
  secondBans: MapCount[]
  thirdBans: MapCount[]
}

// Stable colour per map so the same map reads the same across all three donuts.
const MAP_COLORS: Record<string, string> = {
  de_mirage:   '#3b82f6',
  de_inferno:  '#f97316',
  de_nuke:     '#22d3ee',
  de_overpass: '#a855f7',
  de_ancient:  '#10b981',
  de_anubis:   '#ec4899',
  de_dust2:    '#facc15',
  de_train:    '#ef4444',
  de_vertigo:  '#8b5cf6',
}
function mapColor(map: string): string {
  return MAP_COLORS[map] ?? '#64748b'
}
function mapLabel(map: string): string {
  return map.replace(/^(de_|cs_)/, '').replace(/^(.)/, c => c.toUpperCase())
}

function Donut({ title, data }: { title: string; data: MapCount[] }) {
  const total = data.reduce((s, d) => s + d.count, 0)
  return (
    <div className="flex flex-col items-center">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{title}</p>
      <div style={{ width: 92, height: 92 }}>
        {total === 0 ? (
          <div className="w-full h-full rounded-full border border-dashed border-border" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="count" nameKey="map" innerRadius={28} outerRadius={44} paddingAngle={2} stroke="none">
                {data.map(d => <Cell key={d.map} fill={mapColor(d.map)} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="mt-1.5 space-y-0.5 w-full">
        {data.slice(0, 4).map(d => (
          <div key={d.map} className="flex items-center gap-1.5 text-[10px]">
            <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: mapColor(d.map) }} />
            <span className="text-foreground truncate flex-1">{mapLabel(d.map)}</span>
            <span className="text-muted-foreground font-mono">{d.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function VetoTendencies({ folderId }: { folderId: string }) {
  const [loading, setLoading] = useState(true)
  const [stats, setStats]     = useState<VetoStats | null>(null)

  useEffect(() => {
    let active = true
    fetch(`/api/opponents/${folderId}/veto-stats`)
      .then(r => r.json())
      .then(d => { if (active) setStats(d) })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [folderId])

  if (loading) {
    return (
      <div className="rv-panel p-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <Loader2 size={14} className="animate-spin" /> Loading veto tendencies…
      </div>
    )
  }

  // No veto data available (older matches, internal endpoint unavailable) — hide.
  if (!stats || stats.analyzed === 0) return null

  return (
    <div className="rv-panel p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Ban size={13} style={{ color: 'var(--signal)' }} />
        <h2 className="text-sm font-semibold text-foreground">Ban Tendencies</h2>
        <span className="text-[10px] text-muted-foreground ml-auto">{stats.analyzed} vetoes analysed</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Donut title="First ban"  data={stats.firstBans} />
        <Donut title="Second ban" data={stats.secondBans} />
        <Donut title="Third ban"  data={stats.thirdBans} />
      </div>
    </div>
  )
}
