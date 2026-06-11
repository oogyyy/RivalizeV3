'use client'

import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { BookOpen, Plus, Trash2, Loader2, Map, Target, Swords, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CS2_MAPS } from '@/types/database'
import { cn } from '@/lib/utils'
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

  const [playbooks, setPlaybooks]       = useState<PlaybookMeta[]>([])
  const [teams, setTeams]               = useState<Team[]>([])
  const [opponents, setOpponents]       = useState<Opponent[]>([])
  const [loading, setLoading]           = useState(true)
  const [creating, setCreating]         = useState(false)
  const [showNew, setShowNew]           = useState(false)
  const [search, setSearch]             = useState('')
  const [newMap, setNewMap]             = useState(searchParams.get('map') ?? '')
  const [newName, setNewName]           = useState('')
  const [selectedTeam, setSelectedTeam] = useState(searchParams.get('team') ?? '')
  const [selectedFolder, setSelectedFolder] = useState(searchParams.get('folder') ?? '')
  const [deleting, setDeleting]         = useState<string | null>(null)
  const [hoveredCard, setHoveredCard]   = useState<string | null>(null)
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

    if (searchParams.get('map') || searchParams.get('folder')) setShowNew(true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const selectedOpponent = opponents.find(o => o.id === selectedFolder)

  const opponentMaps: string[] = selectedOpponent
    ? Object.entries(selectedOpponent.aggregated_stats?.maps_played ?? {})
        .sort((a, b) => b[1] - a[1])
        .map(([map]) => map)
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

  const filtered = search
    ? playbooks.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.opponent_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
        p.map.toLowerCase().includes(search.toLowerCase())
      )
    : playbooks

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 13,
    color: 'var(--text)',
    outline: 'none',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    color: 'var(--muted)',
    display: 'block',
    marginBottom: 5,
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '28px 28px' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', lineHeight: 1.1, marginBottom: 5, display: 'flex', alignItems: 'center', gap: 10 }}>
            <BookOpen size={24} style={{ color: 'var(--accent)' }} />
            Playbooks
          </h1>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>
            Build and save tactical playbooks for your team with AI assistance.
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
        >
          <Plus size={15} />
          New Playbook
        </button>
      </div>

      {/* ── New playbook form ── */}
      {showNew && (
        <div style={{
          marginBottom: 24, padding: 20, borderRadius: 14,
          border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)',
          background: 'color-mix(in srgb, var(--accent) 5%, var(--card))',
        }}>
          {/* Form header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: 'color-mix(in srgb, var(--accent) 15%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 28%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Plus size={13} style={{ color: 'var(--accent)' }} />
            </div>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Create New Playbook</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 18, paddingLeft: 38 }}>
            Optionally link an opponent to generate targeted anti-strat tactics based on their uploaded demos.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>
                Map
                {selectedOpponent && opponentMaps.length > 0 && (
                  <span style={{ marginLeft: 6, color: 'var(--accent)', opacity: 0.7 }}>
                    — {opponentMaps.length} map{opponentMaps.length !== 1 ? 's' : ''} with demos
                  </span>
                )}
              </label>
              {selectedOpponent && opponentMaps.length === 0 ? (
                <div style={{ ...inputStyle, color: 'var(--muted)' }}>No demos uploaded for this opponent yet</div>
              ) : (
                <select value={newMap} onChange={e => setNewMap(e.target.value)} style={inputStyle}>
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
              <label style={labelStyle}>Name <span style={{ opacity: 0.5 }}>(optional)</span></label>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder={
                  selectedOpponent && newMap ? `vs ${selectedOpponent.opponent_display_name} — ${newMap}`
                  : newMap ? `${newMap} Playbook` : 'Playbook name…'
                }
                style={inputStyle}
              />
            </div>
          </div>

          {/* Opponent selector */}
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Anti-strat opponent <span style={{ opacity: 0.5 }}>(optional)</span></label>
            {opponents.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--muted)', padding: '8px 0' }}>
                No opponents yet — <Link href="/opponents" style={{ color: 'var(--accent)' }}>upload demos first</Link> to enable anti-strat playbooks.
              </p>
            ) : (
              <select value={selectedFolder} onChange={e => setSelectedFolder(e.target.value)} style={inputStyle}>
                <option value="">No opponent (general playbook)</option>
                {opponents.map(o => (
                  <option key={o.id} value={o.id}>{o.opponent_display_name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Teammate selector */}
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Teammates <span style={{ opacity: 0.5 }}>(optional — names used in tactics)</span></label>
            {availablePlayers.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--faint)', padding: '4px 0' }}>
                No self demos uploaded yet — AI will use role labels (Entry Fragger, AWPer, etc.)
              </p>
            ) : (
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
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
                        style={{
                          fontSize: 11, padding: '4px 10px', borderRadius: 20,
                          border: `1px solid ${on ? 'color-mix(in srgb, var(--accent) 50%, transparent)' : 'var(--border)'}`,
                          background: on ? 'color-mix(in srgb, var(--accent) 14%, transparent)' : 'transparent',
                          color: on ? 'var(--accent)' : 'var(--muted)',
                          cursor: !on && selectedPlayers.length >= 5 ? 'not-allowed' : 'pointer',
                          opacity: !on && selectedPlayers.length >= 5 ? 0.4 : 1,
                          transition: 'all 0.12s',
                        }}
                      >
                        {name}
                      </button>
                    )
                  })}
                </div>
                {selectedPlayers.length > 0 && (
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <p style={{ fontSize: 10, color: 'var(--faint)' }}>
                      {selectedPlayers.length}/5 selected · Assign roles so AI knows each player&apos;s responsibilities
                    </p>
                    {selectedPlayers.map(name => (
                      <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 500, width: 112, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                        <select
                          value={playerRoles[name] ?? ''}
                          onChange={e => setPlayerRoles(prev => {
                            if (!e.target.value) { const next = { ...prev }; delete next[name]; return next }
                            return { ...prev, [name]: e.target.value }
                          })}
                          style={{ ...inputStyle, flex: 1, padding: '4px 8px', fontSize: 12 }}
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
            <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 8, background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.2)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Target size={13} style={{ color: '#fb923c', flexShrink: 0 }} />
              <p style={{ fontSize: 12, color: '#fdba74', margin: 0 }}>
                AI will generate anti-strat content specifically countering <strong>{selectedOpponent.opponent_display_name}</strong> based on their uploaded demos.
              </p>
            </div>
          )}

          {teams.length > 1 && (
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Team</label>
              <select value={selectedTeam} onChange={e => setSelectedTeam(e.target.value)} style={inputStyle}>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
            <button
              onClick={handleCreate}
              disabled={!newMap || creating || (!!selectedOpponent && opponentMaps.length === 0)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
                borderRadius: 8, border: 'none',
                background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600,
                cursor: !newMap || creating ? 'not-allowed' : 'pointer',
                opacity: !newMap || creating || (!!selectedOpponent && opponentMaps.length === 0) ? 0.5 : 1,
                transition: 'opacity 0.12s',
              }}
            >
              {creating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              {selectedOpponent ? 'Create Anti-Strat Playbook' : 'Create & Open'}
            </button>
            <button
              onClick={() => setShowNew(false)}
              style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontSize: 13, cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Search ── */}
      {!loading && playbooks.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '9px 14px', borderRadius: 10,
          border: '1px solid var(--border)', background: 'var(--card)',
          marginBottom: 18, transition: 'border-color 0.14s',
        }}>
          <Search size={13} style={{ color: 'var(--faint)', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search playbooks…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onFocus={e => ((e.currentTarget.parentElement as HTMLDivElement).style.borderColor = 'var(--accent)')}
            onBlur={e => ((e.currentTarget.parentElement as HTMLDivElement).style.borderColor = 'var(--border)')}
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: 'var(--text)' }}
          />
        </div>
      )}

      {/* ── Content ── */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 24px' }}>
          <Loader2 size={24} style={{ color: 'var(--muted)' }} className="animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', textAlign: 'center', borderRadius: 14, border: '1px dashed var(--border)' }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: 'color-mix(in srgb, var(--accent) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <BookOpen size={24} style={{ color: 'var(--accent)' }} />
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
            {search ? 'No playbooks match that search' : 'No playbooks yet'}
          </p>
          <p style={{ fontSize: 12, color: 'var(--muted)', maxWidth: 280, marginBottom: 20 }}>
            {search ? 'Try a different search term' : 'Build your first playbook to get structured AI-generated tactics for your team.'}
          </p>
          {!search && (
            <button
              onClick={() => setShowNew(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 9, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              <Plus size={14} />
              Create your first playbook
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {filtered.map(pb => {
            const thumb = MAP_THUMBS[pb.map]
            const isAntiStrat = !!pb.opponent_name
            return (
              <div
                key={pb.id}
                style={{
                  borderRadius: 12,
                  border: `1px solid ${hoveredCard === pb.id ? (isAntiStrat ? 'rgba(251,146,60,0.45)' : 'color-mix(in srgb, var(--accent) 45%, transparent)') : 'var(--border)'}`,
                  boxShadow: hoveredCard === pb.id ? (isAntiStrat ? '0 4px 20px rgba(251,146,60,0.08)' : '0 4px 20px color-mix(in srgb, var(--accent) 8%, transparent)') : 'none',
                  background: 'var(--card)',
                  overflow: 'hidden', transition: 'border-color 0.14s, box-shadow 0.14s', position: 'relative',
                }}
                onMouseEnter={() => setHoveredCard(pb.id)}
                onMouseLeave={() => setHoveredCard(null)}
              >
                {/* Map thumbnail */}
                <div style={{ position: 'relative', height: 112, overflow: 'hidden' }}>
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt={pb.map} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', background: 'var(--elevated)' }} />
                  )}
                  {/* Gradient overlays */}
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, var(--card) 0%, rgba(0,0,0,0.55) 60%, transparent 100%)' }} />

                  {/* Map badge */}
                  <div style={{ position: 'absolute', bottom: 10, left: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: 6,
                      background: isAntiStrat ? 'rgba(251,146,60,0.2)' : 'color-mix(in srgb, var(--accent) 18%, transparent)',
                      border: `1px solid ${isAntiStrat ? 'rgba(251,146,60,0.4)' : 'color-mix(in srgb, var(--accent) 35%, transparent)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {isAntiStrat
                        ? <Swords size={11} style={{ color: '#fb923c' }} />
                        : <Map size={11} style={{ color: 'var(--accent)' }} />
                      }
                    </div>
                    <span style={{
                      fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600, padding: '2px 8px', borderRadius: 5,
                      background: isAntiStrat ? 'rgba(251,146,60,0.14)' : 'color-mix(in srgb, var(--accent) 12%, transparent)',
                      color: isAntiStrat ? '#fb923c' : 'var(--accent)',
                      backdropFilter: 'blur(4px)',
                    }}>
                      {pb.map}
                    </span>
                  </div>

                  {/* Delete button — visible on card hover */}
                  <button
                    onClick={e => { e.preventDefault(); handleDelete(pb.id) }}
                    disabled={deleting === pb.id}
                    style={{
                      position: 'absolute', top: 8, right: 8,
                      padding: 6, borderRadius: 7, border: 'none',
                      background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
                      color: 'rgba(255,255,255,0.5)', cursor: 'pointer',
                      opacity: hoveredCard === pb.id ? 1 : 0,
                      transition: 'opacity 0.14s, color 0.14s, background 0.14s',
                    }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLButtonElement
                      el.style.color = '#FF6B7A'
                      el.style.background = 'rgba(255,107,122,0.18)'
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLButtonElement
                      el.style.color = 'rgba(255,255,255,0.5)'
                      el.style.background = 'rgba(0,0,0,0.45)'
                    }}
                  >
                    {deleting === pb.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                  </button>
                </div>

                {/* Card content */}
                <Link href={`/playbook/${pb.id}`} style={{ display: 'block', padding: '12px 14px 14px', textDecoration: 'none' }}>
                  {pb.opponent_name && (
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 6,
                      fontSize: 10, fontWeight: 600, color: '#fb923c',
                      background: 'rgba(251,146,60,0.1)', border: '1px solid rgba(251,146,60,0.2)',
                      padding: '2px 8px', borderRadius: 5,
                    }}>
                      <Target size={9} /> vs {pb.opponent_name}
                    </div>
                  )}
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {pb.name}
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--muted)' }}>
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
