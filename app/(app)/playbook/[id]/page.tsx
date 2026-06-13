'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useChat } from 'ai/react'
import {
  Save, ArrowLeft, Sparkles, Loader2, CheckCircle2,
  Swords, Shield, Crosshair, Users, Coins,
  Brain, Send, RotateCcw, AlertCircle, RefreshCw, Map, MessageSquare, Target,
  Pencil, Check, ClipboardList, Trash2, Wand2, Plus, X,
  ChevronDown, ChevronRight, Clock, PenLine, Printer,
} from 'lucide-react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { DrawAction } from '@/components/lineups/LineupBoard'

const LineupBoard = dynamic(() => import('@/components/lineups/LineupBoard'), { ssr: false })

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

type StratUtility = { id: string; name: string; type: string }
type StratAssignment = { player: string; role: string; instruction: string; utility: StratUtility[] }
type StratPhase = { id: string; time: string; label: string; notes: string }

const LINEUP_TYPE_COLORS: Record<string, string> = {
  smoke: '#c0c0d0', flash: '#ffff88', molotov: '#ff4400', he: '#ff9900', custom: '#818cf8',
}

type Strat = {
  id: string
  name: string
  side: 't' | 'ct'
  assignments: StratAssignment[]   // always 5 rows
  phases?: StratPhase[]
  sketch?: DrawAction[]
}

type Playbook = {
  id: string
  team_id: string
  map: string
  name: string
  sections: Record<string, string>
  strats?: Strat[]
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
  const [activeSection, setActiveSection] = useState<SectionId | 'strats'>('t_side')
  const [editingSection, setEditingSection] = useState<SectionId | null>(null)
  const [strats, setStrats]               = useState<Strat[]>([])
  const [improvingStrat, setImprovingStrat] = useState<string | null>(null)
  const [hubLineups, setHubLineups]       = useState<StratUtility[]>([])
  const [stratError, setStratError]       = useState<string | null>(null)
  const [expandedPhases, setExpandedPhases] = useState<Record<string, boolean>>({})
  const [sketchingStrat, setSketchingStrat] = useState<string | null>(null)
  const [showPrintView, setShowPrintView] = useState(false)
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
      // Normalize older strats saved before newer columns existed
      setStrats(Array.isArray(pb.strats) ? (pb.strats as Strat[]).map(st => ({
        ...st,
        phases: st.phases ?? [],
        sketch: st.sketch ?? [],
        assignments: (st.assignments ?? []).map(a => ({ player: a.player ?? '', role: a.role ?? '', instruction: a.instruction ?? '', utility: a.utility ?? [] })),
      })) : [])
      setPlayerRoles(pb.player_roles ?? {})
      if (teams.length > 0) setMyTeamId(teams[0].id)
      else setMyTeamId(pb.team_id)
    }).finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!playbook?.map) return
    fetch(`/api/lineups?map=${encodeURIComponent(playbook.map)}`)
      .then(r => r.ok ? r.json() : [])
      .then((ls: Array<{ id: string; name: string; type: string }>) =>
        setHubLineups(ls.map(l => ({ id: l.id, name: l.name, type: l.type }))))
      .catch(() => {})
  }, [playbook?.map])

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

  const addStrat = () => {
    const roster = playbook?.players ?? []
    const strat: Strat = {
      id: typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: `Strat ${strats.length + 1}`,
      side: 't',
      phases: [],
      sketch: [],
      assignments: Array.from({ length: 5 }, (_, i) => ({ player: roster[i] ?? '', role: roster[i] ? (playerRoles[roster[i]] ?? '') : '', instruction: '', utility: [] })),
    }
    setStrats(prev => [...prev, strat])
    setActiveSection('strats')
  }

  const genId = () => typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`

  const addPhase = (stratId: string) => {
    setStrats(prev => prev.map(st => st.id === stratId
      ? { ...st, phases: [...(st.phases ?? []), { id: genId(), time: '', label: '', notes: '' }] }
      : st))
    setExpandedPhases(p => ({ ...p, [stratId]: true }))
  }

  const updatePhase = (stratId: string, phaseId: string, patch: Partial<StratPhase>) =>
    setStrats(prev => prev.map(st => st.id === stratId
      ? { ...st, phases: (st.phases ?? []).map(ph => ph.id === phaseId ? { ...ph, ...patch } : ph) }
      : st))

  const removePhase = (stratId: string, phaseId: string) =>
    setStrats(prev => prev.map(st => st.id === stratId
      ? { ...st, phases: (st.phases ?? []).filter(ph => ph.id !== phaseId) }
      : st))

  const updateStrat = (stratId: string, patch: Partial<Strat>) =>
    setStrats(prev => prev.map(st => st.id === stratId ? { ...st, ...patch } : st))

  const updateAssignment = (stratId: string, idx: number, patch: Partial<StratAssignment>) =>
    setStrats(prev => prev.map(st => st.id === stratId
      ? { ...st, assignments: st.assignments.map((a, i) => i === idx ? { ...a, ...patch } : a) }
      : st))

  const improveStrat = async (strat: Strat) => {
    setImprovingStrat(strat.id)
    setStratError(null)
    try {
      const res = await fetch(`/api/playbooks/${id}/improve-strat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strat }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.strat) throw new Error(data.error ?? 'Improve failed')
      setStrats(prev => prev.map(st => st.id === strat.id ? data.strat as Strat : st))
    } catch (e) {
      setStratError(e instanceof Error ? e.message : 'Improve failed')
    } finally {
      setImprovingStrat(null)
    }
  }

  const handleSave = async () => {
    if (!playbook) return
    setSaving(true)
    const res = await fetch(`/api/playbooks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: pbName, sections, playerRoles, strats }),
    })
    setSaving(false)
    if (res.ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }
  }

  const isAntistrat   = !!playbook?.opponent_name
  const isStratsTab   = activeSection === 'strats'
  const activeContent = isStratsTab ? '' : (sections[activeSection] ?? '')
  const activeMeta    = SECTIONS.find(s => s.id === activeSection) ?? SECTIONS[0]
  const sectionLabel  = isStratsTab ? 'Team Strats' : (isAntistrat ? activeMeta.antiLabel : activeMeta.label)
  const sectionDesc   = isStratsTab ? 'Named set plays with per-player jobs' : (isAntistrat ? activeMeta.antiDesc : activeMeta.desc)
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
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-4 mb-2 px-1">Strats</p>
              <button
                onClick={() => setActiveSection('strats')}
                className={cn(
                  'w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-xs text-left transition-all',
                  isStratsTab
                    ? 'bg-[color:color-mix(in_srgb,var(--signal)_8%,transparent)] text-[color:var(--signal)] border border-[color:color-mix(in_srgb,var(--signal)_20%,transparent)]'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent border border-transparent'
                )}
              >
                <span className={isStratsTab ? 'text-[color:var(--signal)]' : 'text-muted-foreground shrink-0'}>
                  <ClipboardList size={14} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium">Team Strats</p>
                </div>
                {strats.length > 0 && (
                  <span className="text-[10px] font-mono text-muted-foreground shrink-0">{strats.length}</span>
                )}
              </button>
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
              {isStratsTab ? (
                <div className="flex items-center gap-2 shrink-0">
                  {strats.length > 0 && (
                    <Button variant="outline" size="sm" onClick={() => setShowPrintView(true)} className="gap-1.5">
                      <Printer size={12} /> Print / Share
                    </Button>
                  )}
                  <Button variant="neon" size="sm" onClick={addStrat} className="gap-1.5">
                    <Plus size={12} /> Add Strat
                  </Button>
                </div>
              ) : (
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant={editingSection === activeSection ? 'neon' : 'outline'}
                  size="sm"
                  onClick={() => setEditingSection(prev => prev === activeSection ? null : (activeSection as SectionId))}
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
                  onClick={() => generateSection(activeSection as SectionId)}
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
              )}
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
              <button
                onClick={() => setActiveSection('strats')}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs whitespace-nowrap border shrink-0',
                  isStratsTab
                    ? 'border-[color:color-mix(in_srgb,var(--signal)_30%,transparent)] text-[color:var(--signal)] bg-[color:color-mix(in_srgb,var(--signal)_8%,transparent)]'
                    : 'border-border text-muted-foreground bg-transparent'
                )}
              >
                <ClipboardList size={14} />
                Team Strats
                {strats.length > 0 && <span className="ml-0.5 font-mono text-[10px]">{strats.length}</span>}
              </button>
            </div>

            {/* Content area */}
            <div className="flex-1 overflow-y-auto p-4">
              {isStratsTab ? (
                <div className="space-y-4 max-w-3xl">
                  {stratError && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[color:color-mix(in_srgb,var(--loss)_30%,transparent)] bg-[color:color-mix(in_srgb,var(--loss)_6%,transparent)]">
                      <AlertCircle size={13} className="text-[color:var(--loss)] shrink-0" />
                      <p className="text-xs text-[color:var(--loss)]">{stratError}</p>
                    </div>
                  )}

                  {strats.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="w-12 h-12 rounded-xl bg-[color:color-mix(in_srgb,var(--signal)_8%,transparent)] border border-[color:color-mix(in_srgb,var(--signal)_15%,transparent)] flex items-center justify-center mb-3">
                        <ClipboardList size={18} className="text-[color:var(--signal)]" />
                      </div>
                      <p className="text-sm text-muted-foreground mb-4 max-w-xs">
                        No strats yet. Add a play, assign all five players their job, and optionally let AI sharpen the wording.
                      </p>
                      <Button variant="neon" size="sm" onClick={addStrat} className="gap-1.5">
                        <Plus size={13} /> Add your first strat
                      </Button>
                    </div>
                  ) : (
                    <>
                      {strats.map((strat, si) => {
                        const improving = improvingStrat === strat.id
                        return (
                          <div key={strat.id} className="rounded-xl border border-border bg-card overflow-hidden">
                            {/* Strat header */}
                            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border bg-[color:var(--panel)]">
                              <input
                                value={strat.name}
                                onChange={e => updateStrat(strat.id, { name: e.target.value })}
                                placeholder={`Strat ${si + 1}`}
                                className="flex-1 min-w-0 bg-transparent text-sm font-semibold text-foreground focus:outline-none border-b border-transparent focus:border-[color:color-mix(in_srgb,var(--signal)_40%,transparent)]"
                              />
                              <div className="flex rounded-md border border-border overflow-hidden shrink-0">
                                {(['t', 'ct'] as const).map(side => (
                                  <button
                                    key={side}
                                    onClick={() => updateStrat(strat.id, { side })}
                                    className={cn(
                                      'px-2 py-1 text-[10px] font-bold uppercase transition-colors',
                                      strat.side === side
                                        ? side === 't'
                                          ? 'bg-[color:color-mix(in_srgb,var(--tside)_18%,transparent)] text-[color:var(--tside)]'
                                          : 'bg-[color:color-mix(in_srgb,var(--ct)_18%,transparent)] text-[color:var(--ct)]'
                                        : 'text-muted-foreground hover:text-foreground'
                                    )}
                                  >
                                    {side === 't' ? 'T' : 'CT'}
                                  </button>
                                ))}
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => improveStrat(strat)}
                                disabled={!!improvingStrat || strat.assignments.every(a => !a.instruction.trim())}
                                className="gap-1.5 shrink-0"
                                title="AI rewrites the instructions with proper callouts and timings — your players and the play's intent stay yours"
                              >
                                {improving ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                                <span className="hidden md:inline">{improving ? 'Improving…' : 'Improve with AI'}</span>
                              </Button>
                              <button
                                onClick={() => setStrats(prev => prev.filter(st => st.id !== strat.id))}
                                className="p-1.5 rounded text-muted-foreground hover:text-[color:var(--loss)] transition-colors shrink-0"
                                title="Delete strat"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                            {/* Column headers */}
                            <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-[color:color-mix(in_srgb,var(--signal)_3%,transparent)]">
                              <p className="w-32 shrink-0 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Player</p>
                              <p className="w-24 shrink-0 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Role</p>
                              <p className="flex-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">What you do</p>
                              <p className="w-44 shrink-0 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Utility you need</p>
                            </div>
                            {/* Five player rows */}
                            <div className="divide-y divide-border">
                              {strat.assignments.map((a, i) => (
                                <div key={i} className="flex items-start gap-2 px-3 py-2">
                                  <div className="w-32 shrink-0 pt-1">
                                    {(playbook?.players?.length ?? 0) > 0 ? (
                                      <select
                                        value={a.player}
                                        onChange={e => {
                                          const player = e.target.value
                                          updateAssignment(strat.id, i, {
                                            player,
                                            // Auto-fill role from roster assignment unless the row already has one
                                            ...(player && !a.role && playerRoles[player] ? { role: playerRoles[player] } : {}),
                                          })
                                        }}
                                        className="w-full bg-background border border-border rounded px-1.5 py-1 text-[11px] text-foreground focus:outline-none focus:border-[color:color-mix(in_srgb,var(--signal)_50%,transparent)]"
                                      >
                                        <option value="">Player…</option>
                                        {playbook!.players!.map(pl => <option key={pl} value={pl}>{pl}</option>)}
                                        {a.player && !playbook!.players!.includes(a.player) && (
                                          <option value={a.player}>{a.player}</option>
                                        )}
                                      </select>
                                    ) : (
                                      <input
                                        value={a.player}
                                        onChange={e => updateAssignment(strat.id, i, { player: e.target.value })}
                                        placeholder={`Player ${i + 1}`}
                                        className="w-full bg-background border border-border rounded px-1.5 py-1 text-[11px] text-foreground focus:outline-none focus:border-[color:color-mix(in_srgb,var(--signal)_50%,transparent)]"
                                      />
                                    )}
                                  </div>
                                  <div className="w-24 shrink-0 pt-1">
                                    <select
                                      value={a.role}
                                      onChange={e => updateAssignment(strat.id, i, { role: e.target.value })}
                                      className="w-full bg-background border border-border rounded px-1.5 py-1 text-[11px] text-foreground focus:outline-none focus:border-[color:color-mix(in_srgb,var(--signal)_50%,transparent)]"
                                    >
                                      <option value="">Role…</option>
                                      {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                                    </select>
                                  </div>
                                  <textarea
                                    value={a.instruction}
                                    onChange={e => updateAssignment(strat.id, i, { instruction: e.target.value })}
                                    placeholder="e.g. Smoke CT from Top Mid at 1:35, then hold Connector"
                                    rows={2}
                                    className="flex-1 bg-transparent border border-transparent hover:border-border focus:border-[color:color-mix(in_srgb,var(--signal)_40%,transparent)] rounded px-2 py-1 text-xs text-foreground leading-relaxed resize-none focus:outline-none min-h-[44px]"
                                  />
                                  <div className="w-44 shrink-0 pt-1 space-y-1">
                                    {a.utility.map(u => {
                                      const c = LINEUP_TYPE_COLORS[u.type] ?? LINEUP_TYPE_COLORS.custom
                                      return (
                                        <div key={u.id} className="flex items-center gap-1">
                                          <Link
                                            href={`/lineups?map=${encodeURIComponent(playbook?.map ?? '')}&open=${u.id}`}
                                            title={`Open "${u.name}" in Utility Hub`}
                                            className="flex-1 min-w-0 flex items-center gap-1.5 px-1.5 py-0.5 rounded border text-[10px] truncate hover:opacity-80 transition-opacity"
                                            style={{ color: c, borderColor: `color-mix(in srgb, ${c} 35%, transparent)`, background: `color-mix(in srgb, ${c} 8%, transparent)` }}
                                          >
                                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c }} />
                                            <span className="truncate">{u.name}</span>
                                          </Link>
                                          <button
                                            onClick={() => updateAssignment(strat.id, i, { utility: a.utility.filter(x => x.id !== u.id) })}
                                            className="p-0.5 text-muted-foreground hover:text-foreground shrink-0"
                                            title="Remove"
                                          >
                                            <X size={10} />
                                          </button>
                                        </div>
                                      )
                                    })}
                                    {a.utility.length < 4 && hubLineups.filter(l => !a.utility.some(u => u.id === l.id)).length > 0 && (
                                      <select
                                        value=""
                                        onChange={e => {
                                          const l = hubLineups.find(x => x.id === e.target.value)
                                          if (l) updateAssignment(strat.id, i, { utility: [...a.utility, l] })
                                        }}
                                        className="w-full bg-background border border-border rounded px-1.5 py-1 text-[10px] text-muted-foreground focus:outline-none focus:border-[color:color-mix(in_srgb,var(--signal)_50%,transparent)]"
                                      >
                                        <option value="">+ Utility…</option>
                                        {hubLineups.filter(l => !a.utility.some(u => u.id === l.id)).map(l => (
                                          <option key={l.id} value={l.id}>{l.name}</option>
                                        ))}
                                      </select>
                                    )}
                                    {hubLineups.length === 0 && a.utility.length === 0 && (
                                      <Link href="/lineups" className="block text-[9px] text-muted-foreground hover:text-foreground">
                                        No lineups for this map yet → Utility Hub
                                      </Link>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Advanced: phases + sketch */}
                            {(() => {
                              const phases = strat.phases ?? []
                              const open = expandedPhases[strat.id] ?? (phases.length > 0)
                              return (
                                <div className="border-t border-border">
                                  <button
                                    onClick={() => setExpandedPhases(p => ({ ...p, [strat.id]: !open }))}
                                    className="w-full flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                                  >
                                    {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                    <Clock size={11} />
                                    Advanced — phases &amp; sketch
                                    {phases.length > 0 && <span className="font-mono text-[10px] text-[color:var(--signal)]">{phases.length} phase{phases.length === 1 ? '' : 's'}</span>}
                                    {(strat.sketch?.length ?? 0) > 0 && <PenLine size={10} className="text-[color:var(--signal)]" />}
                                  </button>
                                  {open && (
                                    <div className="px-3 pb-3 space-y-3">
                                      {/* Phase timeline */}
                                      <div className="space-y-1.5">
                                        {phases.length > 0 && (
                                          <div className="flex items-center gap-2 px-1">
                                            <p className="w-28 shrink-0 text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Time window</p>
                                            <p className="w-28 shrink-0 text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Phase</p>
                                            <p className="flex-1 text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">What happens</p>
                                          </div>
                                        )}
                                        {phases.map(ph => (
                                          <div key={ph.id} className="flex items-start gap-2">
                                            <input
                                              value={ph.time}
                                              onChange={e => updatePhase(strat.id, ph.id, { time: e.target.value })}
                                              placeholder="1:55 → 1:25"
                                              className="w-28 shrink-0 bg-background border border-border rounded px-1.5 py-1 text-[11px] font-mono text-foreground focus:outline-none focus:border-[color:color-mix(in_srgb,var(--signal)_50%,transparent)]"
                                            />
                                            <input
                                              value={ph.label}
                                              onChange={e => updatePhase(strat.id, ph.id, { label: e.target.value })}
                                              placeholder="Info phase"
                                              className="w-28 shrink-0 bg-background border border-border rounded px-1.5 py-1 text-[11px] font-medium text-foreground focus:outline-none focus:border-[color:color-mix(in_srgb,var(--signal)_50%,transparent)]"
                                            />
                                            <input
                                              value={ph.notes}
                                              onChange={e => updatePhase(strat.id, ph.id, { notes: e.target.value })}
                                              placeholder="Gather info, default spread, no commitment"
                                              className="flex-1 bg-background border border-border rounded px-1.5 py-1 text-[11px] text-foreground focus:outline-none focus:border-[color:color-mix(in_srgb,var(--signal)_50%,transparent)]"
                                            />
                                            <button
                                              onClick={() => removePhase(strat.id, ph.id)}
                                              className="p-1.5 text-muted-foreground hover:text-[color:var(--loss)] shrink-0"
                                              title="Remove phase"
                                            >
                                              <X size={11} />
                                            </button>
                                          </div>
                                        ))}
                                        <Button variant="outline" size="sm" onClick={() => addPhase(strat.id)} className="gap-1.5 h-7 text-[11px]">
                                          <Plus size={11} /> Add phase
                                        </Button>
                                      </div>

                                      {/* Sketch */}
                                      <div>
                                        {sketchingStrat === strat.id ? (
                                          <div className="rounded-lg border border-border bg-card p-2">
                                            <div className="flex items-center justify-between mb-2">
                                              <p className="text-[11px] font-medium text-foreground flex items-center gap-1.5"><PenLine size={11} /> Sketch — {playbook?.map}</p>
                                              <Button variant="outline" size="sm" onClick={() => setSketchingStrat(null)} className="gap-1 h-6 text-[10px]"><Check size={10} /> Done</Button>
                                            </div>
                                            <LineupBoard
                                              mapName={playbook?.map ?? ''}
                                              initialActions={strat.sketch ?? []}
                                              onSave={async (actions: DrawAction[]) => { updateStrat(strat.id, { sketch: actions }) }}
                                            />
                                          </div>
                                        ) : (strat.sketch?.length ?? 0) > 0 ? (
                                          <div className="rounded-lg border border-border bg-card p-2">
                                            <div className="flex items-center justify-between mb-2">
                                              <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5"><PenLine size={11} /> Sketch</p>
                                              <Button variant="outline" size="sm" onClick={() => setSketchingStrat(strat.id)} className="gap-1 h-6 text-[10px]"><Pencil size={10} /> Edit</Button>
                                            </div>
                                            <div className="pointer-events-none max-w-[280px]">
                                              <LineupBoard mapName={playbook?.map ?? ''} initialActions={strat.sketch ?? []} readOnly onSave={async () => {}} />
                                            </div>
                                          </div>
                                        ) : (
                                          <Button variant="outline" size="sm" onClick={() => setSketchingStrat(strat.id)} className="gap-1.5 h-7 text-[11px]">
                                            <PenLine size={11} /> Add sketch on {playbook?.map} radar
                                          </Button>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )
                            })()}
                          </div>
                        )
                      })}
                      <div className="flex items-center justify-between">
                        <Button variant="outline" size="sm" onClick={addStrat} className="gap-1.5">
                          <Plus size={13} /> Add Strat
                        </Button>
                        <p className="text-[11px] text-muted-foreground">
                          Strats are saved with the playbook — hit <strong className="text-foreground">Save</strong>
                        </p>
                      </div>
                    </>
                  )}
                </div>
              ) : editingSection === activeSection ? (
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
                      onClick={() => generateSection(activeSection as SectionId)}
                      disabled={!!generating || generatingAll}
                      className="gap-1.5"
                    >
                      <Sparkles size={13} />
                      Generate with AI
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingSection(activeSection as SectionId)}
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

      {/* Print / Share view */}
      {showPrintView && (
        <PrintStratsView
          playbookName={pbName}
          map={playbook?.map ?? ''}
          opponentName={isAntistrat ? playbook?.opponent_name ?? null : null}
          strats={strats}
          onClose={() => setShowPrintView(false)}
        />
      )}
    </div>
  )
}

const MAP_LABEL: Record<string, string> = {
  de_dust2: 'Dust2', de_mirage: 'Mirage', de_inferno: 'Inferno', de_nuke: 'Nuke',
  de_ancient: 'Ancient', de_anubis: 'Anubis', de_overpass: 'Overpass', de_vertigo: 'Vertigo',
}

function PrintStratsView({
  playbookName, map, opponentName, strats, onClose,
}: {
  playbookName: string
  map: string
  opponentName: string | null
  strats: Strat[]
  onClose: () => void
}) {
  const mapLabel = MAP_LABEL[map] ?? map

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-4 print:bg-white print:p-0 print:block">
      <div className="print-area w-full max-w-3xl bg-[color:var(--card)] rounded-xl border border-border my-6 print:my-0 print:max-w-none print:border-0 print:rounded-none">
        {/* Toolbar — hidden when printing */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border sticky top-0 bg-[color:var(--card)] rounded-t-xl print:hidden">
          <div className="flex items-center gap-2">
            <ClipboardList size={15} className="text-[color:var(--signal)]" />
            <p className="text-sm font-semibold text-foreground">Print / Share — {strats.length} strat{strats.length === 1 ? '' : 's'}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="neon" size="sm" onClick={() => window.print()} className="gap-1.5">
              <Printer size={13} /> Print / Save PDF
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose} className="gap-1"><X size={14} /></Button>
          </div>
        </div>

        {/* Printable content */}
        <div className="p-6 print:p-8 print:text-black">
          <div className="mb-5 pb-3 border-b border-border print:border-gray-300">
            <h1 className="text-xl font-bold text-foreground print:text-black">{playbookName}</h1>
            <p className="text-sm text-muted-foreground print:text-gray-600">
              {mapLabel}{opponentName ? ` · vs ${opponentName}` : ''} · {strats.length} strat{strats.length === 1 ? '' : 's'}
            </p>
          </div>

          <div className="space-y-6">
            {strats.map(strat => (
              <div key={strat.id} className="break-inside-avoid">
                <div className="flex items-center gap-2 mb-2">
                  <span className={cn(
                    'text-[10px] font-bold uppercase px-1.5 py-0.5 rounded',
                    strat.side === 't'
                      ? 'bg-[color:color-mix(in_srgb,var(--tside)_18%,transparent)] text-[color:var(--tside)] print:bg-orange-100 print:text-orange-800'
                      : 'bg-[color:color-mix(in_srgb,var(--ct)_18%,transparent)] text-[color:var(--ct)] print:bg-blue-100 print:text-blue-800'
                  )}>
                    {strat.side === 't' ? 'T' : 'CT'}
                  </span>
                  <h2 className="text-base font-bold text-foreground print:text-black">{strat.name}</h2>
                </div>

                {/* Phases */}
                {(strat.phases?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {strat.phases!.map(ph => (
                      <div key={ph.id} className="text-[11px] px-2 py-1 rounded border border-border print:border-gray-300">
                        <span className="font-mono font-semibold text-[color:var(--signal)] print:text-black">{ph.time || '—'}</span>
                        {ph.label && <span className="text-foreground print:text-black font-medium"> · {ph.label}</span>}
                        {ph.notes && <span className="text-muted-foreground print:text-gray-600"> — {ph.notes}</span>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Player table */}
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="text-left text-muted-foreground print:text-gray-500">
                      <th className="border border-border print:border-gray-300 px-2 py-1 font-semibold w-28">Player</th>
                      <th className="border border-border print:border-gray-300 px-2 py-1 font-semibold w-20">Role</th>
                      <th className="border border-border print:border-gray-300 px-2 py-1 font-semibold">What you do</th>
                      <th className="border border-border print:border-gray-300 px-2 py-1 font-semibold w-32">Utility</th>
                    </tr>
                  </thead>
                  <tbody>
                    {strat.assignments.map((a, i) => (
                      <tr key={i} className="align-top">
                        <td className="border border-border print:border-gray-300 px-2 py-1 text-foreground print:text-black font-medium">{a.player || '—'}</td>
                        <td className="border border-border print:border-gray-300 px-2 py-1 text-muted-foreground print:text-gray-600">{a.role || ''}</td>
                        <td className="border border-border print:border-gray-300 px-2 py-1 text-foreground print:text-black">{a.instruction || ''}</td>
                        <td className="border border-border print:border-gray-300 px-2 py-1 text-muted-foreground print:text-gray-600">{a.utility.map(u => u.name).join(', ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
