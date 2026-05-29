'use client'

import { useState, useEffect, useCallback } from 'react'
import { Globe, Map, Filter, Loader2, ArrowLeft, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import LineupBoard, { type DrawAction } from '@/components/lineups/LineupBoard'

const CS2_MAPS = [
  { value: '', label: 'All Maps' },
  { value: 'de_dust2',    label: 'Dust2' },
  { value: 'de_mirage',   label: 'Mirage' },
  { value: 'de_inferno',  label: 'Inferno' },
  { value: 'de_nuke',     label: 'Nuke' },
  { value: 'de_ancient',  label: 'Ancient' },
  { value: 'de_anubis',   label: 'Anubis' },
  { value: 'de_overpass', label: 'Overpass' },
  { value: 'de_vertigo',  label: 'Vertigo' },
]

const LINEUP_TYPES = [
  { value: '',        label: 'All Types' },
  { value: 'smoke',   label: 'Smoke',   color: '#c0c0d0' },
  { value: 'flash',   label: 'Flash',   color: '#ffff88' },
  { value: 'molotov', label: 'Molotov', color: '#ff4400' },
  { value: 'he',      label: 'HE',      color: '#ff9900' },
  { value: 'custom',  label: 'Custom',  color: '#818cf8' },
]

interface CommunityLineup {
  id: string
  map: string
  name: string
  type: string
  notes: string
  canvas_data: DrawAction[]
  published_at: string | null
  created_at: string
}

const MAP_LABELS: Record<string, string> = {
  de_dust2: 'Dust2', de_mirage: 'Mirage', de_inferno: 'Inferno',
  de_nuke: 'Nuke', de_overpass: 'Overpass', de_ancient: 'Ancient',
  de_anubis: 'Anubis', de_vertigo: 'Vertigo',
}

const TYPE_COLORS: Record<string, string> = {
  smoke: '#c0c0d0', flash: '#ffff88', molotov: '#ff4400', he: '#ff9900', custom: '#818cf8',
}

export default function CommunityLineupsPage() {
  const [lineups, setLineups]   = useState<CommunityLineup[]>([])
  const [loading, setLoading]   = useState(true)
  const [mapFilter, setMap]     = useState('')
  const [typeFilter, setType]   = useState('')
  const [selected, setSelected] = useState<CommunityLineup | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (mapFilter)  params.set('map', mapFilter)
    if (typeFilter) params.set('type', typeFilter)
    const res = await fetch(`/api/lineups/community?${params}`)
    if (res.ok) {
      const data = await res.json() as CommunityLineup[]
      setLineups(data)
    }
    setLoading(false)
  }, [mapFilter, typeFilter])

  useEffect(() => { load() }, [load])

  return (
    <div className="min-h-full">
      <div className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-4">
          <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
            <Link href="/lineups" className="hover:text-foreground flex items-center gap-1">
              <BookOpen size={13} />
              My Lineups
            </Link>
            <span>/</span>
            <span className="text-foreground font-medium">Community</span>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/lineups" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                <Globe size={18} className="text-neon-green" />
                Community Lineups
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Public lineups shared by teams · browse, copy, learn
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6">
        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-card border border-border rounded-lg px-3 py-2">
            <Map size={12} />
            {CS2_MAPS.map(m => (
              <button
                key={m.value}
                onClick={() => setMap(m.value)}
                className={cn(
                  'px-2 py-0.5 rounded transition-colors',
                  mapFilter === m.value
                    ? 'bg-neon-green/15 text-neon-green font-semibold'
                    : 'hover:text-foreground',
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-card border border-border rounded-lg px-3 py-2">
            <Filter size={12} />
            {LINEUP_TYPES.map(t => (
              <button
                key={t.value}
                onClick={() => setType(t.value)}
                className={cn(
                  'px-2 py-0.5 rounded transition-colors',
                  typeFilter === t.value
                    ? 'bg-neon-green/15 text-neon-green font-semibold'
                    : 'hover:text-foreground',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="text-neon-green animate-spin" />
          </div>
        ) : lineups.length === 0 ? (
          <div className="text-center py-20">
            <Globe size={40} className="text-muted-foreground/20 mx-auto mb-4" />
            <p className="text-muted-foreground text-sm">No public lineups yet.</p>
            <p className="text-muted-foreground/60 text-xs mt-1">
              Be the first — publish a lineup from{' '}
              <Link href="/lineups" className="underline hover:text-foreground">My Lineups</Link>.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {lineups.map(lineup => (
              <button
                key={lineup.id}
                onClick={() => setSelected(lineup)}
                className="rounded-xl border border-border bg-card p-4 text-left hover:border-neon-green/30 transition-colors group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground group-hover:text-neon-green transition-colors">{lineup.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{MAP_LABELS[lineup.map] ?? lineup.map}</p>
                  </div>
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase"
                    style={{ color: TYPE_COLORS[lineup.type] ?? '#818cf8', background: `${TYPE_COLORS[lineup.type] ?? '#818cf8'}22` }}
                  >
                    {lineup.type}
                  </span>
                </div>
                {lineup.notes && (
                  <p className="text-xs text-muted-foreground/70 line-clamp-2 mb-3">{lineup.notes}</p>
                )}
                {/* Mini canvas preview */}
                <div className="h-28 rounded-lg overflow-hidden border border-border/50 pointer-events-none">
                  <LineupBoard
                    mapName={lineup.map}
                    initialActions={lineup.canvas_data}
                    readOnly
                    onSave={async () => {}}
                  />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lineup viewer modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-card border border-border rounded-xl w-full max-w-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div>
                <p className="font-semibold text-foreground">{selected.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {MAP_LABELS[selected.map] ?? selected.map} ·{' '}
                  <span style={{ color: TYPE_COLORS[selected.type] ?? '#818cf8' }}>{selected.type}</span>
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-muted-foreground hover:text-foreground text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="p-4">
              {selected.notes && (
                <p className="text-sm text-foreground/80 mb-4 leading-relaxed">{selected.notes}</p>
              )}
              <div className="rounded-lg overflow-hidden border border-border">
                <LineupBoard
                  mapName={selected.map}
                  initialActions={selected.canvas_data}
                  readOnly
                  onSave={async () => {}}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
