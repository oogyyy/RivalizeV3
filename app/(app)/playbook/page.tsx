'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BookOpen, Plus, Trash2, Loader2, Map } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CS2_MAPS } from '@/types/database'
import { cn } from '@/lib/utils'

type PlaybookMeta = {
  id: string
  team_id: string
  map: string
  name: string
  created_at: string
  updated_at: string
}

type Team = { id: string; name: string }

export default function PlaybookListPage() {
  const router = useRouter()
  const [playbooks, setPlaybooks] = useState<PlaybookMeta[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [newMap, setNewMap] = useState('')
  const [newName, setNewName] = useState('')
  const [selectedTeam, setSelectedTeam] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/playbooks').then(r => r.ok ? r.json() : []),
      fetch('/api/teams').then(r => r.ok ? r.json() : []),
    ]).then(([pbs, ts]) => {
      setPlaybooks(pbs)
      setTeams(ts)
      if (ts.length > 0) setSelectedTeam(ts[0].id)
    }).finally(() => setLoading(false))
  }, [])

  const handleCreate = async () => {
    if (!newMap || !selectedTeam) return
    setCreating(true)
    const name = newName.trim() || `${newMap} Playbook`
    const res = await fetch('/api/playbooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId: selectedTeam, map: newMap, name }),
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
        <Button
          variant="neon"
          size="sm"
          onClick={() => setShowNew(true)}
          className="gap-1.5"
        >
          <Plus size={15} />
          New Playbook
        </Button>
      </div>

      {/* New playbook form */}
      {showNew && (
        <div className="mb-6 p-5 rounded-xl border border-[rgba(0,255,200,0.25)] bg-[rgba(0,255,200,0.04)]">
          <h2 className="text-sm font-semibold text-foreground mb-4">Create New Playbook</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
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
                placeholder={newMap ? `${newMap} Playbook` : 'Playbook name…'}
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-neon-green/50"
              />
            </div>
            {teams.length > 1 && (
              <div>
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
          </div>
          <div className="flex gap-2">
            <Button variant="neon" size="sm" onClick={handleCreate} disabled={!newMap || creating} className="gap-1.5">
              {creating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              Create & Open
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
                'group relative rounded-xl border border-border bg-card p-4 hover:border-[rgba(0,255,200,0.3)]',
                'hover:bg-[rgba(0,255,200,0.02)] transition-all duration-150'
              )}
            >
              <Link href={`/playbook/${pb.id}`} className="block mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-[rgba(0,255,200,0.1)] border border-[rgba(0,255,200,0.2)] flex items-center justify-center">
                    <Map size={14} className="text-[#00ffc8]" />
                  </div>
                  <span className="text-[10px] font-mono text-[#00ffc8] bg-[rgba(0,255,200,0.08)] px-2 py-0.5 rounded">
                    {pb.map}
                  </span>
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
