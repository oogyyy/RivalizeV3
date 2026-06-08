'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { BookOpen, Plus, Trash2, Loader2, Map, Target, Swords } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CS2_MAPS } from '@/types/database'
import { cn } from '@/lib/utils'
import { Suspense } from 'react'
import { MAP_THUMBS } from '@/lib/map-config'

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

function PlaybookListInner() {
  const router       = useRouter()
  const searchParams = useSearchParams()

  const [playbooks, setPlaybooks]     = useState<PlaybookMeta[]>([])
  const [teams, setTeams]             = useState<Team[]>([])
  const [opponents, setOpponents]     = useState<Opponent[]>([])
  const [loading, setLoading]         = useState(true)
  const [creating, setCreating]       = useState(false)
  const [showNew, setShowNew]         = useState(false)
  const [newMap, setNewMap]           = useState(searchParams.get('map') ?? '')
  const [newName, setNewName]         = useState('')
  const [selectedTeam, setSelectedTeam]     = useState(searchParams.get('team') ?? '')
  const [selectedFolder, setSelectedFolder] = useState('')
  const [deleting, setDeleting]       = useState<string | null>(null)
  const [availablePlayers, setAvailablePlayers] = useState<string[]>([])
  const [selectedPlayers, setSelectedPlayers]   = useState<string[]>([])
  const [playerRoles, setPlayerRoles]           = useState<Record<string, string>>({})

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

    // Auto-open create form if arriving from AI Scout CTA
    if (searchParams.get('map')) setShowNew(true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const selectedOpponent = opponents.find(o => o.id === selectedFolder)

  // Maps with demos for the selected opponent, sorted by most played
  const opponentMaps: string[] = selectedOpponent
    ? Object.entries(selectedOpponent.aggregated_stats?.maps_played ?? {})
        .sort((a, b) => b[1] - a[1])
        .map(([map]) => map)
    : []

  // Reset map if it's not in the opponent's available maps
  useEffect(() => {
    if (selectedOpponent && opponentMaps.length > 0 && newMap && !opponentMaps.includes(newMap)) {
      setNewMap(opponentMaps[0])
    }
  }, [selectedFolder]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch player names from self demos when team changes
  useEffect(() => {
    if (!selectedTeam) return
    fetch(`/api/teams/players?teamId=${selectedTeam}`)
      .then(r => r.ok ? r.json() : [])
      .then((names: string[]) => {
        setAvailablePlayers(names)
        setSelectedPlayers([])
        setPlayerRoles({})
      })
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
        opponentName: opponentName || undefined,
        players:      selectedPlayers.length > 0 ? selectedPlayers : undefined,
        playerRoles:  Object.keys(playerRoles).length > 0 ? playerRoles : undefined,
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

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2.5">
            <BookOpen className="text-[#00ffc8]" size={22} />
            Playbooks
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Build and save tactical playbooks for your team with AI assistance.
          </p>
        </div>
        <Button variant="neon" size="sm" onClick={() => setShowNew(true)} className="gap-1.5">
          <Plus size={15} />
          New Playbook
        </Button>
      </div>

      {/* New playbook form */}
      {showNew && (
        <div className="mb-6 p-5 rounded-xl border border-[rgba(0,255,200,0.25)] bg-[rgba(0,255,200,0.04)]">
          <h2 className="text-sm font-semibold text-foreground mb-1">Create New Playbook</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Optionally link an opponent to generate targeted anti-strat tactics based on their uploaded demos.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Map
                {selectedOpponent && opponentMaps.length > 0 && (
                  <span className="ml-1.5 text-[#00ffc8]/70">
                    — {opponentMaps.length} map{opponentMaps.length !== 1 ? 's' : ''} with demos
                  </span>
                )}
              </label>
              {selectedOpponent && opponentMaps.length === 0 ? (
                <div className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-muted-foreground">
                  No demos uploaded for this opponent yet
                </div>
              ) : (
                <select
                  value={newMap}
                  onChange={e => setNewMap(e.target.value)}
                  className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-neon-green/50"
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
              <label className="text-xs text-muted-foreground mb-1 block">Name (optional)</label>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder={
                  selectedOpponent && newMap ? `vs ${selectedOpponent.opponent_display_name} — ${newMap}`
                  : newMap ? `${newMap} Playbook` : 'Playbook name…'
                }
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-neon-green/50"
              />
            </div>
          </div>

          {/* Opponent selector */}
          <div className="mb-3">
            <label className="text-xs text-muted-foreground mb-1 block">
              Anti-strat opponent <span className="text-muted-foreground/60">(optional)</span>
            </label>
            {opponents.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">
                No opponents yet — <a href="/opponents" className="text-[#00ffc8] hover:underline">upload demos first</a> to enable anti-strat playbooks.
              </p>
            ) : (
              <select
                value={selectedFolder}
                onChange={e => setSelectedFolder(e.target.value)}
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-neon-green/50"
              >
                <option value="">No opponent (general playbook)</option>
                {opponents.map(o => (
                  <option key={o.id} value={o.id}>{o.opponent_display_name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Teammate selector */}
          <div className="mb-3">
            <label className="text-xs text-muted-foreground mb-1 block">
              Teammates <span className="text-muted-foreground/60">(optional — names used in tactics)</span>
            </label>
            {availablePlayers.length === 0 ? (
              <p className="text-xs text-muted-foreground/60 py-1">
                No self demos uploaded yet — AI will use role labels (Entry Fragger, AWPer, etc.)
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {availablePlayers.slice(0, 10).map(name => {
                    const on = selectedPlayers.includes(name)
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => {
                          if (on) {
                            setSelectedPlayers(prev => prev.filter(n => n !== name))
                            setPlayerRoles(prev => { const next = { ...prev }; delete next[name]; return next })
                          } else if (selectedPlayers.length < 5) {
                            setSelectedPlayers(prev => [...prev, name])
                          }
                        }}
                        className={cn(
                          'text-xs px-2.5 py-1 rounded-full border transition-colors',
                          on
                            ? 'bg-neon-green/15 border-neon-green/50 text-neon-green'
                            : 'bg-background border-border text-muted-foreground hover:border-neon-green/30 hover:text-foreground',
                          !on && selectedPlayers.length >= 5 && 'opacity-40 cursor-not-allowed'
                        )}
                      >
                        {name}
                      </button>
                    )
                  })}
                </div>
                {selectedPlayers.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    <p className="text-[10px] text-muted-foreground/60">
                      {selectedPlayers.length}/5 selected · Assign roles so AI knows each player&apos;s responsibilities
                    </p>
                    {selectedPlayers.map(name => (
                      <div key={name} className="flex items-center gap-2">
                        <span className="text-xs text-neon-green font-medium w-28 truncate">{name}</span>
                        <select
                          value={playerRoles[name] ?? ''}
                          onChange={e => setPlayerRoles(prev => {
                            if (!e.target.value) { const next = { ...prev }; delete next[name]; return next }
                            return { ...prev, [name]: e.target.value }
                          })}
                          className="flex-1 bg-background border border-border rounded px-2 py-0.5 text-xs text-foreground focus:outline-none focus:border-neon-green/50"
                        >
                          <option value="">No role assigned</option>
                          <option value="Entry">Entry Fragger</option>
                          <option value="AWPer">AWPer</option>
                          <option value="Support">Support</option>
                          <option value="Lurker">Lurker</option>
                          <option value="IGL">IGL</option>
                          <option value="Rifler">Rifler</option>
                        </select>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {selectedOpponent && (
            <div className="mb-3 px-3 py-2 rounded-md bg-orange-500/10 border border-orange-500/25 flex items-center gap-2">
              <Target size={13} className="text-orange-400 shrink-0" />
              <p className="text-xs text-orange-300">
                AI will generate anti-strat content specifically countering <strong>{selectedOpponent.opponent_display_name}</strong> based on their uploaded demos.
              </p>
            </div>
          )}

          {teams.length > 1 && (
            <div className="mb-3">
              <label className="text-xs text-muted-foreground mb-1 block">Team</label>
              <select
                value={selectedTeam}
                onChange={e => setSelectedTeam(e.target.value)}
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-neon-green/50"
              >
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button variant="neon" size="sm" onClick={handleCreate} disabled={!newMap || creating || (!!selectedOpponent && opponentMaps.length === 0)} className="gap-1.5">
              {creating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              {selectedOpponent ? 'Create Anti-Strat Playbook' : 'Create & Open'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowNew(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-muted-foreground" size={24} />
        </div>
      ) : playbooks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[rgba(0,255,200,0.08)] border border-[rgba(0,255,200,0.15)] flex items-center justify-center mb-4">
            <BookOpen size={24} className="text-[#00ffc8]" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-1">No playbooks yet</h2>
          <p className="text-muted-foreground text-sm mb-5">
            Build your first playbook to get structured AI-generated tactics for your team.
          </p>
          <Button variant="neon" size="sm" onClick={() => setShowNew(true)} className="gap-1.5">
            <Plus size={14} />
            Create your first playbook
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {playbooks.map(pb => {
            const thumb = MAP_THUMBS[pb.map]
            return (
              <div
                key={pb.id}
                className={cn(
                  'rv-panel group relative overflow-hidden transition-all duration-150',
                  pb.opponent_name
                    ? 'hover:border-orange-500/50'
                    : 'hover:border-[rgba(0,255,200,0.3)]'
                )}
              >
                {/* Map thumbnail banner */}
                <div className="relative h-28 overflow-hidden">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt={pb.map} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-muted/20" />
                  )}
                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-card via-card/60 to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-r from-card/40 to-transparent" />

                  {/* Map name badge pinned to bottom-left */}
                  <div className="absolute bottom-2 left-3 flex items-center gap-1.5">
                    <div className={cn(
                      'w-6 h-6 rounded-md border flex items-center justify-center shrink-0',
                      pb.opponent_name ? 'bg-orange-500/20 border-orange-500/40' : 'bg-[rgba(0,255,200,0.15)] border-[rgba(0,255,200,0.3)]'
                    )}>
                      {pb.opponent_name ? <Swords size={11} className="text-orange-400" /> : <Map size={11} className="text-[#00ffc8]" />}
                    </div>
                    <span className={cn(
                      'text-[10px] font-mono font-semibold px-2 py-0.5 rounded backdrop-blur-sm',
                      pb.opponent_name ? 'text-orange-400 bg-orange-500/15' : 'text-[#00ffc8] bg-[rgba(0,255,200,0.1)]'
                    )}>
                      {pb.map}
                    </span>
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={() => handleDelete(pb.id)}
                    disabled={deleting === pb.id}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/40 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity text-white/60 hover:text-red-400 hover:bg-red-400/20"
                  >
                    {deleting === pb.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                  </button>
                </div>

                {/* Card content */}
                <Link href={`/playbook/${pb.id}`} className="block px-4 py-3">
                  {pb.opponent_name && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20 mb-1.5">
                      <Target size={9} /> vs {pb.opponent_name}
                    </span>
                  )}
                  <h3 className="text-sm font-semibold text-foreground group-hover:text-[#00ffc8] transition-colors truncate">
                    {pb.name}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Updated {new Date(pb.updated_at).toLocaleDateString()}
                  </p>
                </Link>
              </div>
            )
          })}
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
