'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useChat } from 'ai/react'
import {
  Save, ArrowLeft, Sparkles, Loader2, CheckCircle2,
  Swords, Shield, Crosshair, Users, Coins,
  Brain, Send, RotateCcw, AlertCircle, RefreshCw, Map, MessageSquare, Target,
  Pencil, Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type SectionId = 't_side' | 'ct_side' | 'a_execute' | 'b_execute' | 'roles' | 'economy'

const SECTIONS: { id: SectionId; label: string; antiLabel: string; icon: React.ReactNode; desc: string; antiDesc: string }[] = [
  { id: 't_side',    label: 'T-Side Default',    antiLabel: 'Attack Their CT Setup', icon: <Swords size={14} />,    desc: 'Default routes, info positions, timings',           antiDesc: 'Exploit their CT weaknesses on T side' },
  { id: 'ct_side',   label: 'CT-Side Default',   antiLabel: 'Counter Their T Side',  icon: <Shield size={14} />,    desc: 'Anchors, rotations, crossfires',                   antiDesc: 'Shut down their T-side tendencies' },
  { id: 'a_execute', label: 'A Site Execute',    antiLabel: 'Beat Their A Defence',  icon: <Crosshair size={14} />, desc: 'Utility order, entry, post-plant',                 antiDesc: 'Counter their A setup and retake' },
  { id: 'b_execute', label: 'B Site Execute',    antiLabel: 'Beat Their B Defence',  icon: <Crosshair size={14} />, desc: 'Utility order, entry, post-plant',                 antiDesc: 'Counter their B setup and retake' },
  { id: 'roles',     label: 'Role Assignments',  antiLabel: 'Counter Their Players', icon: <Users size={14} />,     desc: 'Entry, AWP, support, lurk, IGL',                  antiDesc: 'Roles tailored to neutralise their roster' },
  { id: 'economy',   label: 'Economy Rules',     antiLabel: 'Economy Counter-Play',  icon: <Coins size={14} />,     desc: 'Eco thresholds, force buy, weapons',               antiDesc: 'Exploit their buy patterns and eco rounds' },
]

type PlayerRole = 'AWPer' | 'Entry' | 'Support' | 'Lurker' | 'IGL' | 'Rifler'

const ROLE_OPTIONS: { value: PlayerRole; label: string; color: string }[] = [
  { value: 'Entry',   label: 'Entry',   color: 'text-[color:var(--tside)]' },
  { value: 'AWPer',   label: 'AWPer',   color: 'text-[color:var(--accent)]' },
  { value: 'Support', label: 'Support', color: 'text-[color:var(--ct)]' },
  { value: 'Lurker',  label: 'Lurker',  color: 'text-[color:var(--win)]' },
  { value: 'IGL',     label: 'IGL',     color: 'text-brand' },
  { value: 'Rifler',  label: 'Rifler',  color: 'text-muted-foreground' },
]

type Playbook = {
  id: string
  team_id: string
  map: string
  name: string
  sections: Record<string, string>
  notes?: string
  folder_id?: string | null
  opponent_name?: string | null
  players?: string[]
  player_roles?: Record<string, PlayerRole>
  created_at: string
  updated_at: string
}

function MarkdownContent({ content }: { content: string }) {
  const rendered = content.split('\n').map((line, i) => {
    if (line.startsWith('### ')) return <h3 key={i} className="text-sm font-bold text-foreground mt-3 mb-1">{line.slice(4)}</h3>
    if (line.startsWith('## '))  return <h2 key={i} className="text-sm font-bold text-[color:var(--signal)] mt-4 mb-1.5">{line.slice(3)}</h2>
    if (line.startsWith('# '))   return <h1 key={i} className="text-base font-bold text-foreground mt-4 mb-2">{line.slice(2)}</h1>
    if (line.startsWith('- ') || line.startsWith('* ')) {
      return (
        <div key={i} className="flex gap-2 my-0.5">
          <span className="text-[color:var(--signal)] mt-1.5 shrink-0 text-xs">▸</span>
          <span className="text-sm">{renderInline(line.slice(2))}</span>
        </div>
      )
    }
    const numbered = line.match(/^(\d+)\.\s(.+)/)
    if (numbered) {
      return (
        <div key={i} className="flex gap-2 my-0.5">
          <span className="text-[color:var(--signal)] shrink-0 font-mono text-xs min-w-[1.2rem]">{numbered[1]}.</span>
          <span className="text-sm">{renderInline(numbered[2])}</span>
        </div>
      )
    }
    if (line.match(/^---+$/)) return <hr key={i} className="border-border my-2" />
    if (line.trim() === '')   return <div key={i} className="h-1.5" />
    return <p key={i} className="text-sm my-0.5 leading-relaxed">{renderInline(line)}</p>
  })
  return <div className="text-foreground space-y-0.5">{rendered}</div>
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)]+\))/)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) return <em key={i} className="italic text-muted-foreground">{part.slice(1, -1)}</em>
    if (part.startsWith('`') && part.endsWith('`')) return <code key={i} className="px-1 py-0.5 bg-muted rounded text-xs font-mono text-[color:var(--signal)]">{part.slice(1, -1)}</code>
    const linkMatch = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/)
    if (linkMatch) return <a key={i} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className="text-[color:var(--signal)] underline underline-offset-2 hover:opacity-80 text-xs">{linkMatch[1]}</a>
    return part
  })
}

export default function PlaybookBuilderPage() {
  const params  = useParams<{ id: string }>()
  const router  = useRouter()
  const id      = params.id

  const [playbook, setPlaybook]   = useState<Playbook | null>(null)
  const [loading, setLoading]     = useState(true)
  const [notFound, setNotFound]   = useState(false)
  const [sections, setSections]   = useState<Record<string, string>>({})
  const [pbName, setPbName]       = useState('')
  const [playerRoles, setPlayerRoles] = useState<Record<string, PlayerRole>>({})
  const [activeSection, setActiveSection] = useState<SectionId>('t_side')
  const [editingSection, setEditingSection] = useState<SectionId | null>(null)
  const [generating, setGenerating]       = useState<SectionId | null>(null)
  const [generatingAll, setGeneratingAll] = useState(false)
  const [saving, setSaving]               = useState(false)
  const [saved, setSaved]                 = useState(false)
  const [editing, setEditing]             = useState(false)
  const [myTeamId, setMyTeamId]           = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef    = useRef<HTMLTextAreaElement>(null)
  const lastSentRef    = useRef('')

  const modeRef = useRef<'myteam'>('myteam')

  useEffect(() => {
    Promise.all([
      fetch(`/api/playbooks/${id}`).then(r => r.ok ? r.json() : null),
      fetch('/api/teams').then(r => r.ok ? r.json() : []),
    ]).then(([pb, teams]) => {
      if (!pb) { setNotFound(true); setLoading(false); return }
      setPlaybook(pb)
      setPbName(pb.name)
      setSections(pb.sections ?? {})
      setPlayerRoles(pb.player_roles ?? {})
      if (teams.length > 0) setMyTeamId(teams[0].id)
      else setMyTeamId(pb.team_id)
    }).finally(() => setLoading(false))
  }, [id])

  const { messages, input, setInput, isLoading: chatLoading, error: chatError, append, setMessages } = useChat({
    api: '/api/ai/coach',
    onError: err => console.error('[Playbook chat]', err),
  })

  const mapRef     = useRef('')
  const pbNameRef  = useRef('')
  useEffect(() => { if (playbook) { mapRef.current = playbook.map; pbNameRef.current = pbName } }, [playbook, pbName])

  const folderIdRef      = useRef<string | null | undefined>(null)
  const opponentNameRef  = useRef<string | null | undefined>(null)
  useEffect(() => {
    if (playbook) {
      folderIdRef.current     = playbook.folder_id
      opponentNameRef.current = playbook.opponent_name
    }
  }, [playbook])

  const buildChatBody = useCallback(() => ({
    teamId:    myTeamId ?? undefined,
    folderId:  folderIdRef.current ?? undefined,
    focusArea: folderIdRef.current ? 'antistrat' : 'strategy',
    mode:      folderIdRef.current ? ('opponent' as const) : modeRef.current,
    mapName:   mapRef.current,
  }), [myTeamId])

  const sendChat = useCallback((msg: string) => {
    if (!msg.trim() || chatLoading) return
    lastSentRef.current = msg.trim()
    append({ role: 'user', content: msg.trim() }, { body: buildChatBody() })
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = '36px'
  }, [chatLoading, append, buildChatBody, setInput])

  const retryChat = useCallback(() => {
    const text = lastSentRef.current
    if (!text) return
    setMessages(prev => {
      const idx = [...prev].reverse().findIndex(m => m.role === 'user' && m.content === text)
      if (idx === -1) return prev
      return prev.slice(0, prev.length - 1 - idx)
    })
    append({ role: 'user', content: text }, { body: buildChatBody() })
  }, [append, buildChatBody, setMessages])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, chatLoading])

  const generateSection = async (sectionId: SectionId) => {
    setGenerating(sectionId)
    setActiveSection(sectionId)
    setEditingSection(null)
    setSections(prev => ({ ...prev, [sectionId]: '' }))
    try {
      const res = await fetch(`/api/playbooks/${id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionType: sectionId, teamId: playbook?.team_id }),
      })
      if (!res.ok || !res.body) throw new Error('Generation failed')
      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let content   = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        content += decoder.decode(value, { stream: true })
        setSections(prev => ({ ...prev, [sectionId]: content }))
      }
    } catch (e) {
      console.error(e)
    } finally {
      setGenerating(null)
    }
  }

  // Generates every section sequentially (one request per section, matching
  // the per-section API). Fills empty sections first; if all sections already
  // have content, regenerates everything.
  const generateAll = async () => {
    if (generating || generatingAll) return
    const empty   = SECTIONS.filter(s => !sections[s.id])
    const targets = empty.length > 0 ? empty : SECTIONS
    setGeneratingAll(true)
    try {
      for (const s of targets) {
        await generateSection(s.id)
      }
    } finally {
      setGeneratingAll(false)
    }
  }

  const handleSave = async () => {
    if (!playbook) return
    setSaving(true)
    const res = await fetch(`/api/playbooks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: pbName, sections, playerRoles }),
    })
    setSaving(false)
    if (res.ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }
  }

  const isAntistrat   = !!playbook?.opponent_name
  const activeContent = sections[activeSection] ?? ''
  const activeMeta    = SECTIONS.find(s => s.id === activeSection)!
  const sectionLabel  = isAntistrat ? activeMeta.antiLabel : activeMeta.label
  const sectionDesc   = isAntistrat ? activeMeta.antiDesc  : activeMeta.desc
  const lastChatMsg   = messages[messages.length - 1]
  const isThinking    = chatLoading && (!lastChatMsg || lastChatMsg.role === 'user')

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-[color:var(--signal)]" size={28} />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-muted-foreground">Playbook not found.</p>
        <Button variant="ghost" size="sm" onClick={() => router.push('/playbook')}>
          <ArrowLeft size={14} className="mr-1.5" /> Back to Playbooks
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 md:px-5 py-3 border-b border-border bg-[color:var(--panel)] shrink-0">
        <Button variant="ghost" size="sm" onClick={() => router.push('/playbook')} className="gap-1.5 text-muted-foreground -ml-2">
          <ArrowLeft size={14} />
          <span className="hidden sm:inline">Playbooks</span>
        </Button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[color:color-mix(in_srgb,var(--signal)_8%,transparent)] border border-[color:color-mix(in_srgb,var(--signal)_20%,transparent)]">
            <Map size={11} className="text-[color:var(--signal)]" />
            <span className="text-xs font-mono text-[color:var(--signal)]">{playbook?.map}</span>
          </div>
          {isAntistrat && playbook?.opponent_name && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[color:color-mix(in_srgb,var(--tside)_10%,transparent)] border border-[color:color-mix(in_srgb,var(--tside)_25%,transparent)]">
              <Target size={11} className="text-[color:var(--tside)]" />
              <span className="text-xs font-medium text-[color:var(--tside)]">vs {playbook.opponent_name}</span>
            </div>
          )}
          {editing ? (
            <input
              value={pbName}
              onChange={e => setPbName(e.target.value)}
              onBlur={() => setEditing(false)}
              onKeyDown={e => e.key === 'Enter' && setEditing(false)}
              autoFocus
              className="bg-transparent border-b border-[color:color-mix(in_srgb,var(--signal)_40%,transparent)] text-sm font-semibold text-foreground focus:outline-none min-w-0 max-w-[200px]"
            />
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="text-sm font-semibold text-foreground hover:text-[color:var(--signal)] transition-colors truncate max-w-[200px]"
            >
              {pbName}
            </button>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={generateAll}
          disabled={!!generating || generatingAll}
          className="gap-1.5 shrink-0"
          title={Object.values(sections).some(Boolean) ? 'Generate remaining empty sections (or regenerate all if complete)' : 'Generate all six sections with AI'}
        >
          {generatingAll ? (
            <><Loader2 size={13} className="animate-spin" /> <span className="hidden sm:inline">Generating…</span></>
          ) : (
            <><Sparkles size={13} /> <span className="hidden sm:inline">Generate All</span></>
          )}
        </Button>
        <Button
          variant="neon"
          size="sm"
          onClick={handleSave}
          disabled={saving}
          className="gap-1.5 shrink-0"
        >
          {saving ? (
            <Loader2 size={13} className="animate-spin" />
          ) : saved ? (
            <CheckCircle2 size={13} />
          ) : (
            <Save size={13} />
          )}
          {saved ? 'Saved!' : 'Save'}
        </Button>
      </div>

      {/* Main area: sections + chat */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: section nav + content */}
        <div className="flex flex-1 overflow-hidden min-w-0">

          {/* Section nav */}
          <div className="hidden sm:flex flex-col w-52 shrink-0 border-r border-border bg-[color:var(--panel)] overflow-y-auto">
            <div className="p-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">Sections</p>
              <div className="space-y-1">
                {SECTIONS.map(s => {
                  const hasContent = !!sections[s.id]
                  const isGenerating = generating === s.id
                  return (
                    <button
                      key={s.id}
                      onClick={() => setActiveSection(s.id)}
                      className={cn(
                        'w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-xs text-left transition-all',
                        activeSection === s.id
                          ? 'bg-[color:color-mix(in_srgb,var(--signal)_8%,transparent)] text-[color:var(--signal)] border border-[color:color-mix(in_srgb,var(--signal)_20%,transparent)]'
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent border border-transparent'
                      )}
                    >
                      <span className={activeSection === s.id ? 'text-[color:var(--signal)]' : 'text-muted-foreground shrink-0'}>
                        {s.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium">{isAntistrat ? s.antiLabel : s.label}</p>
                      </div>
                      {isGenerating ? (
                        <Loader2 size={10} className="animate-spin text-[color:var(--signal)] shrink-0" />
                      ) : hasContent ? (
                        <div className="w-1.5 h-1.5 rounded-full bg-[color:var(--signal)] shrink-0 opacity-70" />
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Roster role assignments */}
            {playbook?.players && playbook.players.length > 0 && (
              <div className="p-3 border-t border-border mt-auto">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">Roster</p>
                <div className="space-y-1.5">
                  {playbook.players.map(name => {
                    const role = playerRoles[name]
                    const roleInfo = ROLE_OPTIONS.find(r => r.value === role)
                    return (
                      <div key={name} className="flex items-center gap-1.5">
                        <span className="text-[11px] text-foreground truncate flex-1 min-w-0">{name}</span>
                        <select
                          value={role ?? ''}
                          onChange={e => setPlayerRoles(prev => {
                            const val = e.target.value as PlayerRole | ''
                            if (!val) { const next = { ...prev }; delete next[name]; return next }
                            return { ...prev, [name]: val as PlayerRole }
                          })}
                          className={cn(
                            'bg-background border border-border rounded px-1.5 py-0.5 text-[10px] focus:outline-none focus:border-[color:color-mix(in_srgb,var(--signal)_50%,transparent)] shrink-0',
                            roleInfo ? roleInfo.color : 'text-muted-foreground'
                          )}
                        >
                          <option value="">Role…</option>
                          {ROLE_OPTIONS.map(r => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                          ))}
                        </select>
                      </div>
                    )
                  })}
                </div>
                <p className="text-[10px] text-muted-foreground/50 mt-2">Roles are saved with the playbook</p>
              </div>
            )}
          </div>

          {/* Section content */}
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            {/* Section header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                <span className={isAntistrat ? 'text-[color:var(--tside)]' : 'text-[color:var(--signal)]'}>{activeMeta.icon}</span>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">{sectionLabel}</h2>
                  <p className="text-xs text-muted-foreground">{sectionDesc}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant={editingSection === activeSection ? 'neon' : 'outline'}
                  size="sm"
                  onClick={() => setEditingSection(prev => prev === activeSection ? null : activeSection)}
                  disabled={generating === activeSection || generatingAll}
                  className="gap-1.5"
                  title={editingSection === activeSection ? 'Finish editing (hit Save to persist)' : 'Write or edit this section manually'}
                >
                  {editingSection === activeSection ? (
                    <><Check size={12} /> Done</>
                  ) : (
                    <><Pencil size={12} /> {activeContent ? 'Edit' : 'Write'}</>
                  )}
                </Button>
                <Button
                  variant={activeContent ? 'outline' : 'neon'}
                  size="sm"
                  onClick={() => generateSection(activeSection)}
                  disabled={!!generating || generatingAll || editingSection === activeSection}
                  className="gap-1.5"
                >
                  {generating === activeSection ? (
                    <><Loader2 size={12} className="animate-spin" /> Generating…</>
                  ) : (
                    <><Sparkles size={12} /> {activeContent ? 'Regenerate' : 'Generate with AI'}</>
                  )}
                </Button>
              </div>
            </div>

            {/* Mobile section tabs */}
            <div className="sm:hidden flex gap-1.5 overflow-x-auto px-3 py-2 border-b border-border shrink-0">
              {SECTIONS.map(s => (
                <button
                  key={s.id}
                  onClick={() => setActiveSection(s.id)}
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs whitespace-nowrap border shrink-0',
                    activeSection === s.id
                      ? isAntistrat
                        ? 'border-[color:color-mix(in_srgb,var(--tside)_30%,transparent)] text-[color:var(--tside)] bg-[color:color-mix(in_srgb,var(--tside)_10%,transparent)]'
                        : 'border-[color:color-mix(in_srgb,var(--signal)_30%,transparent)] text-[color:var(--signal)] bg-[color:color-mix(in_srgb,var(--signal)_8%,transparent)]'
                      : 'border-border text-muted-foreground bg-transparent'
                  )}
                >
                  {s.icon}
                  {isAntistrat ? s.antiLabel : s.label}
                  {sections[s.id] && <span className={cn('w-1 h-1 rounded-full ml-0.5', isAntistrat ? 'bg-[color:var(--tside)]' : 'bg-[color:var(--signal)]')} />}
                </button>
              ))}
            </div>

            {/* Content area */}
            <div className="flex-1 overflow-y-auto p-4">
              {editingSection === activeSection ? (
                <div className="flex flex-col h-full gap-2">
                  <textarea
                    value={activeContent}
                    onChange={e => setSections(prev => ({ ...prev, [activeSection]: e.target.value }))}
                    placeholder={`Write your ${sectionLabel} here…\n\nMarkdown supported:\n## Heading\n- bullet point\n1. numbered step\n**bold** for player names or callouts`}
                    autoFocus
                    className="flex-1 w-full min-h-[360px] bg-card border border-border rounded-lg p-4 text-sm text-foreground leading-relaxed resize-none focus:outline-none focus:border-[color:color-mix(in_srgb,var(--signal)_40%,transparent)]"
                  />
                  <p className="text-[11px] text-muted-foreground shrink-0">
                    Markdown supported · hit <strong className="text-foreground">Done</strong> to preview, then <strong className="text-foreground">Save</strong> to persist
                  </p>
                </div>
              ) : generating === activeSection && !activeContent ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm py-8">
                  <Loader2 size={16} className="animate-spin text-[color:var(--signal)]" />
                  Generating tactical content…
                </div>
              ) : activeContent ? (
                <div className="prose prose-invert max-w-none">
                  <MarkdownContent content={activeContent} />
                  {generating === activeSection && (
                    <span className="inline-block w-2 h-4 bg-[color:var(--signal)] ml-0.5 animate-pulse rounded-sm" />
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-12 h-12 rounded-xl bg-[color:color-mix(in_srgb,var(--signal)_8%,transparent)] border border-[color:color-mix(in_srgb,var(--signal)_15%,transparent)] flex items-center justify-center mb-3">
                    <span className="text-[color:var(--signal)]">{activeMeta.icon}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4 max-w-xs">
                    No content yet for <strong className="text-foreground">{sectionLabel}</strong>.
                    {isAntistrat
                      ? ` Have AI build counter-play against ${playbook?.opponent_name} on ${playbook?.map}, or write your own.`
                      : ` Have AI build this section for ${playbook?.map}, or write your own strats.`
                    }
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="neon"
                      size="sm"
                      onClick={() => generateSection(activeSection)}
                      disabled={!!generating || generatingAll}
                      className="gap-1.5"
                    >
                      <Sparkles size={13} />
                      Generate with AI
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingSection(activeSection)}
                      disabled={!!generating || generatingAll}
                      className="gap-1.5"
                    >
                      <Pencil size={13} />
                      Write manually
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: AI chat panel */}
        <div className="hidden lg:flex flex-col w-80 xl:w-96 shrink-0 border-l border-border overflow-hidden">
          {/* Chat header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-[color:var(--panel)] shrink-0">
            <div className="flex items-center gap-2">
              <MessageSquare size={14} className="text-[color:var(--signal)]" />
              <span className="text-sm font-semibold text-foreground">AI Assistant</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setMessages([])} className="text-xs text-muted-foreground gap-1">
              <RotateCcw size={11} />
            </Button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {messages.length === 0 && !chatLoading && (
              <div className="flex flex-col items-center text-center py-10 px-3">
                <div className="w-10 h-10 rounded-xl bg-[color:color-mix(in_srgb,var(--signal)_10%,transparent)] border border-[color:color-mix(in_srgb,var(--signal)_20%,transparent)] flex items-center justify-center mb-3">
                  <Brain size={16} className="text-[color:var(--signal)]" />
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {isAntistrat
                    ? `Ask me anything about countering ${playbook?.opponent_name} on ${playbook?.map} — anti-strats, player shutdowns, utility counters.`
                    : `Ask me anything about your ${playbook?.map} strategy — setups, refine sections, or tactical questions.`
                  }
                </p>
                <div className="mt-4 space-y-1.5 w-full">
                  {(isAntistrat ? [
                    `What are ${playbook?.opponent_name}'s biggest weaknesses on ${playbook?.map}?`,
                    `How do we shut down their best player?`,
                    `What utility counters their most common execute?`,
                  ] : [
                    `What's a strong CT setup for ${playbook?.map}?`,
                    'How should we handle eco rounds?',
                    'What utility is most important here?',
                  ]).map(q => (
                    <button
                      key={q}
                      onClick={() => sendChat(q)}
                      className="w-full text-left text-xs px-3 py-2 rounded-lg border border-border hover:border-[color:color-mix(in_srgb,var(--signal)_30%,transparent)] hover:bg-[color:color-mix(in_srgb,var(--signal)_4%,transparent)] text-muted-foreground hover:text-foreground transition-all"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => {
              const isLast   = i === messages.length - 1
              const streaming = chatLoading && isLast && msg.role === 'assistant'
              return (
                <div key={msg.id} className={cn('flex items-end gap-2 mb-3', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
                  {msg.role === 'assistant' ? (
                    <div className="w-6 h-6 rounded-lg bg-[color:color-mix(in_srgb,var(--signal)_12%,transparent)] border border-[color:color-mix(in_srgb,var(--signal)_25%,transparent)] flex items-center justify-center shrink-0">
                      <Brain size={11} className="text-[color:var(--signal)]" />
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-muted border border-border flex items-center justify-center shrink-0">
                      <span className="text-[9px] font-bold text-muted-foreground">You</span>
                    </div>
                  )}
                  <div className={cn(
                    'max-w-[85%] rounded-xl px-3 py-2',
                    msg.role === 'user'
                      ? 'bg-[color:color-mix(in_srgb,var(--signal)_8%,transparent)] border border-[color:color-mix(in_srgb,var(--signal)_18%,transparent)] rounded-br-sm'
                      : 'bg-card border border-border rounded-bl-sm'
                  )}>
                    {msg.role === 'assistant' ? (
                      <>
                        <MarkdownContent content={msg.content} />
                        {streaming && <span className="inline-block w-1.5 h-3.5 bg-[color:var(--signal)] ml-0.5 animate-pulse rounded-sm" />}
                      </>
                    ) : (
                      <p className="text-xs text-foreground">{msg.content}</p>
                    )}
                  </div>
                </div>
              )
            })}

            {isThinking && (
              <div className="flex items-end gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-[color:color-mix(in_srgb,var(--signal)_12%,transparent)] border border-[color:color-mix(in_srgb,var(--signal)_25%,transparent)] flex items-center justify-center shrink-0">
                  <Brain size={11} className="text-[color:var(--signal)]" />
                </div>
                <div className="bg-card border border-border rounded-xl rounded-bl-sm px-3 py-2">
                  <div className="flex gap-1 items-center h-3">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="w-1 h-1 rounded-full bg-[color:var(--signal)] animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {chatError && !chatLoading && (
              <div className="flex items-end gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-[color:color-mix(in_srgb,var(--loss)_18%,transparent)] border border-[color:color-mix(in_srgb,var(--loss)_30%,transparent)] flex items-center justify-center shrink-0">
                  <AlertCircle size={11} className="text-[color:var(--loss)]" />
                </div>
                <div className="bg-card border border-[color:color-mix(in_srgb,var(--loss)_30%,transparent)] rounded-xl rounded-bl-sm px-3 py-2">
                  <p className="text-xs text-[color:var(--loss)]">Something went wrong.</p>
                  <Button variant="outline" size="sm" onClick={retryChat} className="mt-1.5 gap-1 text-xs border-[color:color-mix(in_srgb,var(--loss)_30%,transparent)] text-[color:var(--loss)] h-6 px-2">
                    <RefreshCw size={9} /> Retry
                  </Button>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Chat input */}
          <div className="border-t border-border p-2.5 shrink-0 bg-[color:var(--panel)]">
            <div className={cn(
              'flex items-end gap-2 p-1.5 rounded-lg border transition-all',
              'border-border focus-within:border-[color:color-mix(in_srgb,var(--signal)_40%,transparent)]'
            )}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => {
                  setInput(e.target.value)
                  e.target.style.height = 'auto'
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(input) }
                }}
                placeholder="Ask about strategy…"
                disabled={chatLoading}
                rows={1}
                className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground resize-none focus:outline-none min-h-[28px] max-h-28 py-1 px-1"
                style={{ height: '28px' }}
              />
              <Button
                onClick={() => sendChat(input)}
                disabled={!input.trim() || chatLoading}
                size="sm"
                variant="neon"
                className="shrink-0 h-8 w-8 p-0 rounded-md"
              >
                {chatLoading ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
