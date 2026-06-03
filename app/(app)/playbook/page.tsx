'use client'

import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, Trash2, Loader2, Swords, Target, ArrowRight, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CS2_MAPS } from '@/types/database'
import { cn } from '@/lib/utils'

type PlaybookMeta = {
  id: string
  team_id: string
  map: string
  name: string
  opponent_name?: string | null
  created_at: string
  updated_at: string
}

type Team     = { id: string; name: string }
type Opponent = {
  id: string
  opponent_display_name: string
  opponent_slug: string
  aggregated_stats: { maps_played?: Record<string, number> } | null
}

const MAP_FILTERS = ['All', 'Mirage', 'Inferno', 'Nuke', 'Overpass', 'Ancient', 'Vertigo', 'Anubis']

function inputCls() {
  return 'w-full rounded-xl text-xs text-white placeholder-gray-500 px-3 py-2 focus:outline-none transition-colors'
}
const inputStyle = { background: '#0f111e', border: '1px solid #1e2238' }
const inputFocus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => (e.currentTarget.style.borderColor = 'rgba(112,71,235,0.6)')
const inputBlur  = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => (e.currentTarget.style.borderColor = '#1e2238')

function PlaybookListInner() {
  const router       = useRouter()
  const searchParams = useSearchParams()

  const [playbooks, setPlaybooks]   = useState<PlaybookMeta[]>([])
  const [teams, setTeams]           = useState<Team[]>([])
  const [opponents, setOpponents]   = useState<Opponent[]>([])
  const [loading, setLoading]       = useState(true)
  const [creating, setCreating]     = useState(false)
  const [showNew, setShowNew]       = useState(false)
  const [newMap, setNewMap]         = useState(searchParams.get('map') ?? '')
  const [newName, setNewName]       = useState('')
  const [selectedTeam, setSelectedTeam]     = useState(searchParams.get('team') ?? '')
  const [selectedFolder, setSelectedFolder] = useState('')
  const [deleting, setDeleting]     = useState<string | null>(null)
  const [availablePlayers, setAvailablePlayers] = useState<string[]>([])
  const [selectedPlayers, setSelectedPlayers]   = useState<string[]>([])
  const [mapFilter, setMapFilter]   = useState('All')

  useEffect(() => {
    Promise.all([
      fetch('/api/playbooks').then(r => r.ok ? r.json() : []),
      fetch('/api/teams').then(r => r.ok ? r.json() : []),
      fetch('/api/opponents').then(r => r.ok ? r.json() : []),
    ]).then(([pbs, ts, ops]) => {
      setPlaybooks(pbs)
      setTeams(ts)
      setOpponents(ops)
      if (!selectedTeam && ts.length > 0) setSelectedTeam(ts[0].id)
    }).finally(() => setLoading(false))

    if (searchParams.get('map')) setShowNew(true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const selectedOpponent = opponents.find(o => o.id === selectedFolder)
  const opponentMaps: string[] = selectedOpponent
    ? Object.entries(selectedOpponent.aggregated_stats?.maps_played ?? {})
        .sort((a, b) => b[1] - a[1]).map(([map]) => map)
    : []

  useEffect(() => {
    if (selectedOpponent && opponentMaps.length > 0 && newMap && !opponentMaps.includes(newMap)) {
      setNewMap(opponentMaps[0])
    }
  }, [selectedFolder]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedTeam) return
    fetch(`/api/teams/players?teamId=${selectedTeam}`)
      .then(r => r.ok ? r.json() : [])
      .then((names: string[]) => { setAvailablePlayers(names); setSelectedPlayers([]) })
  }, [selectedTeam])

  const availableMaps = selectedOpponent ? opponentMaps : CS2_MAPS

  const handleCreate = async () => {
    if (!newMap || !selectedTeam) return
    setCreating(true)
    const opponentName = selectedOpponent?.opponent_display_name ?? null
    const name = newName.trim() || (opponentName ? `vs ${opponentName} — ${newMap}` : `${newMap} Playbook`)
    const res = await fetch('/api/playbooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teamId:       selectedTeam,
        map:          newMap,
        name,
        folderId:     selectedFolder || undefined,
        opponentName: opponentName   || undefined,
        players:      selectedPlayers.length > 0 ? selectedPlayers : undefined,
      }),
    })
    if (res.ok) {
      const pb = await res.json()
      router.push(`/playbook/${pb.id}`)
    } else {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeleting(id)
    await fetch(`/api/playbooks/${id}`, { method: 'DELETE' })
    setPlaybooks(prev => prev.filter(p => p.id !== id))
    setDeleting(null)
  }

  const filtered = playbooks.filter(pb => mapFilter === 'All' || pb.map === mapFilter)

  return (
    <div className="p-5 md:p-7 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div
        className="flex items-start justify-between gap-4 pb-5"
        style={{ borderBottom: '1px solid rgba(30,34,56,0.8)' }}
      >
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest mb-0.5" style={{ color: '#4b5563' }}>
            Prepare
          </p>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
            Playbook Strategy
          </h1>
          <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>
            Collaborative team stratagem builder and interactive blueprint viewer
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white shrink-0 transition-colors"
          style={{ background: '#7047eb' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#8862ff')}
          onMouseLeave={e => (e.currentTarget.style.background = '#7047eb')}
        >
          <Plus size={14} />
          Add New Play
        </button>
      </div>

      {/* Map filter tabs */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {MAP_FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setMapFilter(f)}
            className="px-3 py-1.5 text-[11px] font-mono rounded-lg transition-all duration-150"
            style={{
              background: mapFilter === f ? 'rgba(112,71,235,0.2)' : 'transparent',
              border:     mapFilter === f ? '1px solid rgba(112,71,235,0.5)' : '1px solid #1e2238',
              color:      mapFilter === f ? '#fff' : '#6b7280',
            }}
          >
            {f}
          </button>
        ))}
        {playbooks.length > 0 && (
          <span className="text-[11px] font-mono ml-1" style={{ color: '#4b5563' }}>
            {filtered.length} {filtered.length === 1 ? 'play' : 'plays'}
          </span>
        )}
      </div>

      {/* Create form */}
      {showNew && (
        <div className="rounded-2xl p-5 space-y-4" style={{ background: '#0f111e', border: '1px solid rgba(112,71,235,0.35)' }}>
          <div>
            <h2 className="text-sm font-semibold text-white">Create New Playbook</h2>
            <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>
              Optionally link an opponent to generate targeted anti-strat tactics based on their uploaded demos.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs mb-1 block" style={{ color: '#6b7280' }}>
                Map
                {selectedOpponent && opponentMaps.length > 0 && (
                  <span className="ml-1.5" style={{ color: 'rgba(20,184,166,0.8)' }}>
                    — {opponentMaps.length} map{opponentMaps.length !== 1 ? 's' : ''} with demos
                  </span>
                )}
              </label>
              {selectedOpponent && opponentMaps.length === 0 ? (
                <div className={cn(inputCls(), 'opacity-50')} style={inputStyle}>
                  No demos uploaded for this opponent yet
                </div>
              ) : (
                <select
                  value={newMap}
                  onChange={e => setNewMap(e.target.value)}
                  className={inputCls()}
                  style={inputStyle}
                  onFocus={inputFocus}
                  onBlur={inputBlur}
                >
                  <option value="">Select map…</option>
                  {availableMaps.map(m => (
                    <option key={m} value={m}>
                      {m}{selectedOpponent && selectedOpponent.aggregated_stats?.maps_played?.[m]
                        ? ` (${selectedOpponent.aggregated_stats.maps_played[m]} demo${selectedOpponent.aggregated_stats.maps_played[m] !== 1 ? 's' : ''})`
                        : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: '#6b7280' }}>Name (optional)</label>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder={
                  selectedOpponent && newMap ? `vs ${selectedOpponent.opponent_display_name} — ${newMap}`
                  : newMap ? `${newMap} Playbook` : 'Playbook name…'
                }
                className={inputCls()}
                style={inputStyle}
                onFocus={inputFocus}
                onBlur={inputBlur}
              />
            </div>
          </div>

          <div>
            <label className="text-xs mb-1 block" style={{ color: '#6b7280' }}>
              Anti-strat opponent <span style={{ color: '#374151' }}>(optional)</span>
            </label>
            {opponents.length === 0 ? (
              <p className="text-xs py-1" style={{ color: '#6b7280' }}>
                No opponents yet — <a href="/opponents" style={{ color: '#14b8a6' }} className="hover:underline">upload demos first</a> to enable anti-strat playbooks.
              </p>
            ) : (
              <select
                value={selectedFolder}
                onChange={e => setSelectedFolder(e.target.value)}
                className={inputCls()}
                style={inputStyle}
                onFocus={inputFocus}
                onBlur={inputBlur}
              >
                <option value="">No opponent (general playbook)</option>
                {opponents.map(o => (
                  <option key={o.id} value={o.id}>{o.opponent_display_name}</option>
                ))}
              </select>
            )}
          </div>

          {availablePlayers.length > 0 && (
            <div>
              <label className="text-xs mb-1 block" style={{ color: '#6b7280' }}>
                Teammates <span style={{ color: '#374151' }}>(optional — names used in tactics)</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {availablePlayers.slice(0, 10).map(name => {
                  const on = selectedPlayers.includes(name)
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        if (on) setSelectedPlayers(prev => prev.filter(n => n !== name))
                        else if (selectedPlayers.length < 5) setSelectedPlayers(prev => [...prev, name])
                      }}
                      className="text-xs px-2.5 py-1 rounded-full border transition-colors"
                      style={{
                        background: on ? 'rgba(112,71,235,0.15)' : 'transparent',
                        border:     on ? '1px solid rgba(112,71,235,0.5)' : '1px solid #1e2238',
                        color:      on ? '#7047eb' : '#6b7280',
                        opacity: !on && selectedPlayers.length >= 5 ? 0.4 : 1,
                      }}
                    >
                      {name}
                    </button>
                  )
                })}
              </div>
              {selectedPlayers.length > 0 && (
                <p className="text-[10px] mt-1" style={{ color: '#4b5563' }}>
                  {selectedPlayers.length}/5 selected · AI will use these names in all tactics
                </p>
              )}
            </div>
          )}

          {selectedOpponent && (
            <div className="px-3 py-2 rounded-xl flex items-center gap-2" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <Target size={13} className="text-amber-400 shrink-0" />
              <p className="text-xs text-amber-300">
                AI will generate anti-strat content specifically countering <strong>{selectedOpponent.opponent_display_name}</strong> based on their uploaded demos.
              </p>
            </div>
          )}

          {teams.length > 1 && (
            <div>
              <label className="text-xs mb-1 block" style={{ color: '#6b7280' }}>Team</label>
              <select
                value={selectedTeam}
                onChange={e => setSelectedTeam(e.target.value)}
                className={inputCls()}
                style={inputStyle}
                onFocus={inputFocus}
                onBlur={inputBlur}
              >
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleCreate}
              disabled={!newMap || creating || (!!selectedOpponent && opponentMaps.length === 0)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white transition-colors disabled:opacity-50"
              style={{ background: '#7047eb' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#8862ff')}
              onMouseLeave={e => (e.currentTarget.style.background = '#7047eb')}
            >
              {creating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              {selectedOpponent ? 'Create Anti-Strat Playbook' : 'Create & Open'}
            </button>
            <button
              onClick={() => setShowNew(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold transition-colors"
              style={{ border: '1px solid #1e2238', color: '#6b7280' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin" size={24} style={{ color: '#6b7280' }} />
        </div>
      )}

      {/* Empty state */}
      {!loading && playbooks.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
            style={{ background: 'rgba(112,71,235,0.08)', border: '1px solid rgba(112,71,235,0.15)' }}
          >
            <BookOpen size={26} style={{ color: '#7047eb', opacity: 0.7 }} />
          </div>
          <h2 className="text-[17px] font-bold text-white mb-2">No playbooks yet</h2>
          <p className="text-[13px] max-w-xs mb-6 leading-relaxed" style={{ color: '#6b7280' }}>
            Build your first playbook to get structured AI-generated tactics for your team.
          </p>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: '#7047eb' }}
          >
            <Plus size={14} /> Create your first playbook
          </button>
        </div>
      )}

      {/* No results for current filter */}
      {!loading && playbooks.length > 0 && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm" style={{ color: '#6b7280' }}>No playbooks for {mapFilter}</p>
          <button
            onClick={() => setMapFilter('All')}
            className="text-[11px] mt-2 transition-colors"
            style={{ color: '#7047eb' }}
          >
            Clear filter
          </button>
        </div>
      )}

      {/* Card grid */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(pb => (
            <div
              key={pb.id}
              className="relative group/card rounded-2xl overflow-hidden transition-all duration-200 hover:border-[rgba(112,71,235,0.45)] hover:shadow-[0_8px_28px_rgba(0,0,0,0.5)]"
              style={{ background: '#0f111e', border: '1px solid #1e2238' }}
            >
              {/* Delete button */}
              <button
                onClick={() => handleDelete(pb.id)}
                disabled={deleting === pb.id}
                className="absolute top-3 right-3 z-10 p-1.5 rounded-md opacity-0 group-hover/card:opacity-100 transition-all duration-150 hover:bg-red-400/10"
                style={{ color: '#6b7280' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#f43f5e')}
                onMouseLeave={e => (e.currentTarget.style.color = '#6b7280')}
              >
                {deleting === pb.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              </button>

              <div className="p-5 flex flex-col gap-3 h-full">
                {/* Badge row */}
                <div className="flex items-center justify-between pr-6">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[10px] font-mono uppercase px-2 py-0.5 rounded"
                      style={{ background: 'rgba(112,71,235,0.15)', color: '#7047eb', border: '1px solid rgba(112,71,235,0.3)' }}
                    >
                      {pb.map}
                    </span>
                    {pb.opponent_name && (
                      <span
                        className="text-[9px] font-mono uppercase px-2 py-0.5 rounded flex items-center gap-1"
                        style={{ background: 'rgba(244,63,94,0.1)', color: '#f43f5e', border: '1px solid rgba(244,63,94,0.25)' }}
                      >
                        <Swords size={8} />
                        ANTI-STRAT
                      </span>
                    )}
                  </div>
                  <span
                    className="text-[9px] font-mono uppercase px-2 py-0.5 rounded"
                    style={{
                      background: pb.opponent_name ? 'rgba(244,63,94,0.08)' : 'rgba(20,184,166,0.08)',
                      color:      pb.opponent_name ? '#f43f5e' : '#14b8a6',
                      border:     pb.opponent_name ? '1px solid rgba(244,63,94,0.25)' : '1px solid rgba(20,184,166,0.25)',
                    }}
                  >
                    {pb.opponent_name ? 'ANTI-STRAT' : 'PLAYBOOK'}
                  </span>
                </div>

                {/* Name + description */}
                <div>
                  <h3 className="text-sm font-bold text-white leading-tight pr-2">{pb.name}</h3>
                  <p className="text-[11px] mt-1" style={{ color: '#6b7280' }}>
                    {pb.opponent_name
                      ? `Counter-strategy targeting ${pb.opponent_name} on ${pb.map}. AI-generated anti-strat playbook.`
                      : `Tactical playbook for ${pb.map}. Click to view and edit your team's strategy.`}
                  </p>
                </div>

                {/* Footer: tags + link */}
                <div
                  className="flex items-center justify-between pt-3 mt-auto"
                  style={{ borderTop: '1px solid rgba(30,34,56,0.8)' }}
                >
                  <div className="flex gap-1 flex-wrap">
                    <span
                      className="text-[9px] font-mono px-2 py-0.5 rounded"
                      style={{ background: 'rgba(30,34,56,0.8)', color: '#6b7280', border: '1px solid #1e2238' }}
                    >
                      {pb.map}
                    </span>
                    {pb.opponent_name && (
                      <span
                        className="text-[9px] font-mono px-2 py-0.5 rounded"
                        style={{ background: 'rgba(30,34,56,0.8)', color: '#6b7280', border: '1px solid #1e2238' }}
                      >
                        vs {pb.opponent_name}
                      </span>
                    )}
                  </div>
                  <Link
                    href={`/playbook/${pb.id}`}
                    className="flex items-center gap-1 text-[11px] font-semibold transition-colors"
                    style={{ color: '#7047eb' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#8862ff')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#7047eb')}
                  >
                    Interactive Map
                    <ArrowRight size={11} />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function PlaybookListPage() {
  return (
    <Suspense>
      <PlaybookListInner />
    </Suspense>
  )
}
