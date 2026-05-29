'use client'

import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { StickyNote, Pin, Trash2, Plus, Tag, X, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'

interface Note {
  id: string
  content: string
  tags: string[]
  pinned: boolean
  round_number: number | null
  folder_id: string | null
  demo_id: string | null
  created_at: string
  updated_at: string
  author: { username: string; display_name: string | null; avatar_url: string | null } | null
}

interface TeamNotesProps {
  teamId: string
  folderId?: string
  demoId?: string
  currentUserId: string
  className?: string
}

const PRESET_TAGS = ['T-side', 'CT-side', 'Economy', 'Utility', 'Execute', 'Default', 'Weakness', 'Watch out']

export default function TeamNotes({ teamId, folderId, demoId, currentUserId, className }: TeamNotesProps) {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(true)
  const [composing, setComposing] = useState(false)
  const [draft, setDraft] = useState('')
  const [draftTags, setDraftTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [saving, setSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const apiBase = `/api/teams/${teamId}/notes`

  function buildQuery() {
    const p = new URLSearchParams()
    if (folderId) p.set('folder_id', folderId)
    if (demoId) p.set('demo_id', demoId)
    return p.toString() ? `${apiBase}?${p}` : apiBase
  }

  useEffect(() => {
    fetch(buildQuery())
      .then(r => r.json())
      .then(d => { setNotes(d.notes ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, folderId, demoId])

  async function handleCreate() {
    if (!draft.trim()) return
    setSaving(true)
    try {
      const body: Record<string, unknown> = { content: draft.trim(), tags: draftTags }
      if (folderId) body.folder_id = folderId
      if (demoId) body.demo_id = demoId
      const res = await fetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.note) {
        setNotes(prev => [{ ...data.note, author: null }, ...prev])
        setDraft('')
        setDraftTags([])
        setComposing(false)
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    await fetch(`${apiBase}/${id}`, { method: 'DELETE' })
    setNotes(prev => prev.filter(n => n.id !== id))
  }

  async function handleTogglePin(note: Note) {
    const res = await fetch(`${apiBase}/${note.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinned: !note.pinned }),
    })
    const data = await res.json()
    if (data.note) {
      setNotes(prev =>
        prev.map(n => n.id === note.id ? { ...n, pinned: data.note.pinned } : n)
          .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))
      )
    }
  }

  function addTag(tag: string) {
    const t = tag.trim()
    if (t && !draftTags.includes(t) && draftTags.length < 10) {
      setDraftTags(prev => [...prev, t])
    }
    setTagInput('')
  }

  return (
    <div className={cn('rounded-lg border border-border bg-card overflow-hidden', className)}>
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <StickyNote size={14} className="text-neon-green" />
          <span className="text-sm font-semibold text-foreground">Team Notes</span>
          {notes.length > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-neon-green/10 text-neon-green">
              {notes.length}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="border-t border-border">
          {/* Note list */}
          {loading ? (
            <div className="px-4 py-6 text-center text-xs text-muted-foreground">Loading…</div>
          ) : notes.length === 0 && !composing ? (
            <div className="px-4 py-6 text-center text-xs text-muted-foreground">
              No notes yet. Be the first to add one.
            </div>
          ) : (
            <div className="divide-y divide-border/50 max-h-72 overflow-y-auto">
              {notes.map(note => (
                <div key={note.id} className={cn('px-4 py-3 group relative', note.pinned && 'bg-yellow-400/5')}>
                  {note.pinned && (
                    <Pin size={9} className="absolute top-2 right-2 text-yellow-400 fill-yellow-400" />
                  )}
                  <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">{note.content}</p>
                  {note.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {note.tags.map(tag => (
                        <span key={tag} className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-accent text-muted-foreground">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[10px] text-muted-foreground/60">
                      {note.author?.display_name ?? note.author?.username ?? 'Teammate'} · {formatDate(note.created_at)}
                    </span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleTogglePin(note)}
                        title={note.pinned ? 'Unpin' : 'Pin'}
                        className={cn('p-1 rounded hover:bg-accent transition-colors', note.pinned ? 'text-yellow-400' : 'text-muted-foreground hover:text-foreground')}
                      >
                        <Pin size={11} />
                      </button>
                      {(note.author == null || currentUserId === (note as unknown as { created_by?: string }).created_by) && (
                        <button
                          onClick={() => handleDelete(note.id)}
                          className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Composer */}
          {composing ? (
            <div className="border-t border-border p-3 space-y-2">
              <textarea
                ref={textareaRef}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                placeholder="Add a note for your team…"
                rows={3}
                className="w-full text-xs bg-background border border-border rounded-md px-3 py-2 text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-neon-green/50"
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleCreate()
                  if (e.key === 'Escape') { setComposing(false); setDraft(''); setDraftTags([]) }
                }}
              />

              {/* Tag input */}
              <div className="flex flex-wrap gap-1 items-center">
                <Tag size={11} className="text-muted-foreground shrink-0" />
                {draftTags.map(tag => (
                  <span key={tag} className="flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-neon-green/10 text-neon-green">
                    {tag}
                    <button onClick={() => setDraftTags(d => d.filter(t => t !== tag))}><X size={8} /></button>
                  </span>
                ))}
                <input
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => {
                    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
                      e.preventDefault()
                      addTag(tagInput)
                    }
                  }}
                  placeholder="Add tag…"
                  className="text-[10px] bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/50 w-16"
                />
              </div>

              {/* Preset tags */}
              <div className="flex flex-wrap gap-1">
                {PRESET_TAGS.filter(t => !draftTags.includes(t)).map(tag => (
                  <button
                    key={tag}
                    onClick={() => addTag(tag)}
                    className="text-[9px] px-1.5 py-0.5 rounded-full border border-border hover:border-neon-green/40 text-muted-foreground hover:text-neon-green transition-colors"
                  >
                    {tag}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">⌘↵ to save · Esc to cancel</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setComposing(false); setDraft(''); setDraftTags([]) }}>
                    Cancel
                  </Button>
                  <Button size="sm" variant="neon" className="h-7 text-xs" onClick={handleCreate} disabled={saving || !draft.trim()}>
                    {saving ? 'Saving…' : 'Save Note'}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="border-t border-border p-3">
              <button
                onClick={() => { setComposing(true); setTimeout(() => textareaRef.current?.focus(), 50) }}
                className="w-full flex items-center gap-2 text-xs text-muted-foreground hover:text-neon-green transition-colors py-1"
              >
                <Plus size={13} />
                Add note
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
