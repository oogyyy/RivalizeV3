'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { BookOpen, Plus, Trash2, Loader2, Map, Target, Swords } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CS2_MAPS } from '@/types/database'
import { cn } from '@/lib/utils'
import { Suspense } from 'react'

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
type Opponent = { id: string; opponent_display_name: string; opponent_slug: string }

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
              <label className="text-xs text-muted-foreground mb-1 block">Map</label>
              <select
                value={newMap}
                onChange={e => setNewMap(e.target.value)}
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-neon-green/50"
              >
                <option value="">Select map…</option>
                {CS2_MAPS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
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
            <Button variant="neon" size="sm" onClick={handleCreate} disabled={!newMap || creating} className="gap-1.5">
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
          {playbooks.map(pb => (
            <div
              key={pb.id}
              className={cn(
                'group relative rounded-xl border bg-card p-4 transition-all duration-150',
                pb.opponent_name
                  ? 'border-orange-500/25 hover:border-orange-500/50 hover:bg-orange-500/[0.02]'
                  : 'border-border hover:border-[rgba(0,255,200,0.3)] hover:bg-[rgba(0,255,200,0.02)]'
              )}
            >
              <Link href={`/playbook/${pb.id}`} className="block mb-3">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <div className={cn(
                    'w-8 h-8 rounded-lg border flex items-center justify-center shrink-0',
                    pb.opponent_name
                      ? 'bg-orange-500/10 border-orange-500/30'
                      : 'bg-[rgba(0,255,200,0.1)] border-[rgba(0,255,200,0.2)]'
                  )}>
                    {pb.opponent_name ? <Swords size={14} className="text-orange-400" /> : <Map size={14} className="text-[#00ffc8]" />}
                  </div>
                  <span className={cn(
                    'text-[10px] font-mono px-2 py-0.5 rounded',
                    pb.opponent_name ? 'text-orange-400 bg-orange-500/10' : 'text-[#00ffc8] bg-[rgba(0,255,200,0.08)]'
                  )}>
                    {pb.map}
                  </span>
                  {pb.opponent_name && (
                    <span className="text-[10px] font-medium text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20 flex items-center gap-1">
                      <Target size={9} /> vs {pb.opponent_name}
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-semibold text-foreground group-hover:text-[#00ffc8] transition-colors truncate">
                  {pb.name}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Updated {new Date(pb.updated_at).toLocaleDateString()}
                </p>
              </Link>
              <button
                onClick={() => handleDelete(pb.id)}
                disabled={deleting === pb.id}
                className="absolute top-3 right-3 p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-400 hover:bg-red-400/10"
              >
                {deleting === pb.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              </button>
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
