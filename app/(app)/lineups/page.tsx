'use client'

import { useState, useEffect, useCallback, type ChangeEvent, type KeyboardEvent } from 'react'
import { BookMarked, Plus, Trash2, Map, Filter, Loader2, ChevronDown, ChevronUp, Globe } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import LineupBoard, { type DrawAction } from '@/components/lineups/LineupBoard'

const CS2_MAPS = [
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
  { value: 'smoke',   label: 'Smoke',   color: '#c0c0d0' },
  { value: 'flash',   label: 'Flash',   color: '#ffff88' },
  { value: 'molotov', label: 'Molotov', color: '#ff4400' },
  { value: 'he',      label: 'HE',      color: '#ff9900' },
  { value: 'custom',  label: 'Custom',  color: '#818cf8' },
]

interface Team { id: string; name: string }

interface Lineup {
  id: string
  team_id: string
  map: string
  name: string
  type: string
  notes: string | null
  canvas_data: DrawAction[]
  is_public: boolean
  created_at: string
}

export default function LineupsPage() {
  const [lineups, setLineups]     = useState<Lineup[]>([])
  const [teams, setTeams]         = useState<Team[]>([])
  const [loading, setLoading]     = useState(true)
  const [mapFilter, setMapFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [openId, setOpenId]       = useState<string | null>(null)
  const [creating, setCreating]   = useState(false)
  const [newMap, setNewMap]       = useState(CS2_MAPS[0].value)
  const [newName, setNewName]     = useState('')
  const [newType, setNewType]     = useState('smoke')
  const [newNotes, setNewNotes]   = useState('')
  const [selectedTeam, setSelectedTeam] = useState('')
  const [showForm, setShowForm]   = useState(false)
  const [deleting, setDeleting]   = useState<string | null>(null)
  const [publishing, setPublishing] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (mapFilter) params.set('map', mapFilter)
      if (typeFilter) params.set('type', typeFilter)
      const [lineupRes, teamRes] = await Promise.all([
        fetch(`/api/lineups?${params}`),
        fetch('/api/teams'),
      ])
      if (lineupRes.ok) setLineups(await lineupRes.json())
      if (teamRes.ok)   setTeams(await teamRes.json())
    } finally {
      setLoading(false)
    }
  }, [mapFilter, typeFilter])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (teams.length > 0 && !selectedTeam) setSelectedTeam(teams[0].id) }, [teams, selectedTeam])

  async function handleCreate() {
    if (!newName.trim() || !selectedTeam) return
    setCreating(true)
    try {
      const res = await fetch('/api/lineups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: selectedTeam, map: newMap, name: newName, type: newType, notes: newNotes }),
      })
      if (res.ok) {
        const lineup = await res.json()
        setLineups((prev: Lineup[]) => [lineup, ...prev])
        setNewName(''); setNewNotes(''); setShowForm(false)
        setOpenId(lineup.id)
      }
    } finally {
      setCreating(false)
    }
  }

  async function handleSave(id: string, actions: DrawAction[]) {
    await fetch(`/api/lineups/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ canvas_data: actions }),
    })
  }

  async function handlePublish(id: string, makePublic: boolean) {
    setPublishing(id)
    try {
      const res = await fetch(`/api/lineups/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_public: makePublic }),
      })
      if (res.ok) {
        setLineups((prev: Lineup[]) => prev.map((l: Lineup) => l.id === id ? { ...l, is_public: makePublic } : l))
      }
    } finally {
      setPublishing(null)
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    try {
      await fetch(`/api/lineups/${id}`, { method: 'DELETE' })
      setLineups((prev: Lineup[]) => prev.filter((l: Lineup) => l.id !== id))
      if (openId === id) setOpenId(null)
    } finally {
      setDeleting(null)
    }
  }

  const _grouped = CS2_MAPS
    .map(m => ({
      map: m,
      items: lineups.filter((l: Lineup) => l.map === m.value),
    }))
    .filter(g => g.items.length > 0 || (!mapFilter && !typeFilter))

  const displayed = mapFilter
    ? lineups.filter((l: Lineup) => l.map === mapFilter)
    : lineups

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-4 md:py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                <BookMarked size={18} className="text-purple-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Lineup Library</h1>
                <p className="text-sm text-muted-foreground">Smoke, flash and molotov lineups per map</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/lineups/community"
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg border border-border hover:border-border/80"
              >
                <Globe size={13} />
                Community
              </Link>
              <Button variant="neon" size="sm" className="gap-1.5" onClick={() => setShowForm((v: boolean) => !v)}>
                <Plus size={14} />
                New Lineup
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <Filter size={13} className="text-muted-foreground" />
            <div className="flex rounded-lg border border-border overflow-hidden text-xs">
              <button
                onClick={() => setMapFilter('')}
                className={cn('px-3 py-1.5 font-medium transition-colors', !mapFilter ? 'bg-neon-green/20 text-neon-green' : 'text-muted-foreground hover:text-foreground')}
              >
                All Maps
              </button>
              {CS2_MAPS.map(m => (
                <button
                  key={m.value}
                  onClick={() => setMapFilter((v: string) => v === m.value ? '' : m.value)}
                  className={cn('px-3 py-1.5 font-medium transition-colors whitespace-nowrap', mapFilter === m.value ? 'bg-neon-green/20 text-neon-green' : 'text-muted-foreground hover:text-foreground')}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <div className="flex rounded-lg border border-border overflow-hidden text-xs ml-auto">
              <button onClick={() => setTypeFilter('')} className={cn('px-2.5 py-1.5', !typeFilter ? 'bg-purple-500/20 text-purple-400' : 'text-muted-foreground hover:text-foreground')}>
                All
              </button>
              {LINEUP_TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => setTypeFilter((v: string) => v === t.value ? '' : t.value)}
                  className={cn('px-2.5 py-1.5 capitalize', typeFilter === t.value ? 'bg-purple-500/20 text-purple-400' : 'text-muted-foreground hover:text-foreground')}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-4">
        {/* New lineup form */}
        {showForm && (
          <div className="rounded-xl border border-neon-green/20 bg-neon-green/5 p-4 space-y-3">
            <p className="text-sm font-semibold text-foreground">New Lineup</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Name</label>
                <input
                  value={newName}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setNewName(e.target.value)}
                  placeholder="e.g. Mid smoke from T spawn"
                  className="w-full px-3 py-1.5 text-sm bg-card border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-neon-green/50"
                  onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') handleCreate() }}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Map</label>
                <select
                  value={newMap}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => setNewMap(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm bg-card border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-neon-green/50"
                >
                  {CS2_MAPS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Type</label>
                <select
                  value={newType}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => setNewType(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm bg-card border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-neon-green/50"
                >
                  {LINEUP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Team</label>
                <select
                  value={selectedTeam}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedTeam(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm bg-card border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-neon-green/50"
                >
                  {teams.map((t: Team) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2 space-y-1">
                <label className="text-xs text-muted-foreground">Notes (optional)</label>
                <input
                  value={newNotes}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setNewNotes(e.target.value)}
                  placeholder="Aim at the corner of the wall…"
                  className="w-full px-3 py-1.5 text-sm bg-card border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-neon-green/50"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="neon" onClick={handleCreate} disabled={creating || !newName.trim()}>
                {creating ? <Loader2 size={12} className="animate-spin mr-1" /> : null}
                Create & Draw
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="text-neon-green animate-spin" />
          </div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            No lineups yet.{' '}
            <button className="text-neon-green hover:underline" onClick={() => setShowForm(true)}>
              Create your first one
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {displayed.map((lineup: Lineup) => {
              const typeInfo = LINEUP_TYPES.find(t => t.value === lineup.type) ?? LINEUP_TYPES[4]
              const mapLabel = CS2_MAPS.find(m => m.value === lineup.map)?.label ?? lineup.map
              const isOpen = openId === lineup.id
              return (
                <div key={lineup.id} className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: typeInfo.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{lineup.name}</p>
                      <p className="text-xs text-muted-foreground">{mapLabel} · {typeInfo.label}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handlePublish(lineup.id, !lineup.is_public)}
                        disabled={publishing === lineup.id}
                        title={lineup.is_public ? 'Unpublish from Community' : 'Publish to Community'}
                        className={cn(
                          'p-1.5 rounded border transition-colors',
                          lineup.is_public
                            ? 'border-neon-green/40 text-neon-green bg-neon-green/5 hover:bg-neon-green/10'
                            : 'border-border/50 text-muted-foreground hover:text-neon-green',
                        )}
                      >
                        {publishing === lineup.id ? <Loader2 size={13} className="animate-spin" /> : <Globe size={13} />}
                      </button>
                      <button
                        onClick={() => setOpenId((v: string | null) => v === lineup.id ? null : lineup.id)}
                        className="p-1.5 rounded border border-border/50 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                      <button
                        onClick={() => handleDelete(lineup.id)}
                        disabled={deleting === lineup.id}
                        className="p-1.5 rounded border border-border/50 text-muted-foreground hover:text-red-400 transition-colors"
                      >
                        {deleting === lineup.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="border-t border-border p-4 space-y-3">
                      {lineup.notes && (
                        <p className="text-xs text-muted-foreground italic">{lineup.notes}</p>
                      )}
                      <LineupBoard
                        mapName={lineup.map}
                        initialActions={lineup.canvas_data ?? []}
                        onSave={async (actions) => {
                          await handleSave(lineup.id, actions)
                          setLineups((prev: Lineup[]) => prev.map((l: Lineup) => l.id === lineup.id ? { ...l, canvas_data: actions } : l))
                        }}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
