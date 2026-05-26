'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useChat } from 'ai/react'
import {
  BookOpen, Save, ArrowLeft, Sparkles, Loader2, CheckCircle2,
  Swords, Shield, Crosshair, Users, BarChart3, Coins,
  Brain, Send, RotateCcw, AlertCircle, RefreshCw, Map, MessageSquare,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type SectionId = 't_side' | 'ct_side' | 'a_execute' | 'b_execute' | 'roles' | 'economy'

const SECTIONS: { id: SectionId; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: 't_side',    label: 'T-Side Default',  icon: <Swords size={14} />,    desc: 'Default routes, info positions, timings' },
  { id: 'ct_side',   label: 'CT-Side Default',  icon: <Shield size={14} />,    desc: 'Anchors, rotations, crossfires' },
  { id: 'a_execute', label: 'A Site Execute',   icon: <Crosshair size={14} />, desc: 'Utility order, entry, post-plant' },
  { id: 'b_execute', label: 'B Site Execute',   icon: <Crosshair size={14} />, desc: 'Utility order, entry, post-plant' },
  { id: 'roles',     label: 'Role Assignments', icon: <Users size={14} />,     desc: 'Entry, AWP, support, lurk, IGL' },
  { id: 'economy',   label: 'Economy Rules',    icon: <Coins size={14} />,     desc: 'Eco thresholds, force buy, weapons' },
]

type Playbook = {
  id: string
  team_id: string
  map: string
  name: string
  sections: Record<string, string>
  notes?: string
  created_at: string
  updated_at: string
}

function MarkdownContent({ content }: { content: string }) {
  const rendered = content.split('\n').map((line, i) => {
    if (line.startsWith('### ')) return <h3 key={i} className="text-sm font-bold text-foreground mt-3 mb-1">{line.slice(4)}</h3>
    if (line.startsWith('## '))  return <h2 key={i} className="text-sm font-bold text-[#00ffc8] mt-4 mb-1.5">{line.slice(3)}</h2>
    if (line.startsWith('# '))   return <h1 key={i} className="text-base font-bold text-foreground mt-4 mb-2">{line.slice(2)}</h1>
    if (line.startsWith('- ') || line.startsWith('* ')) {
      return (
        <div key={i} className="flex gap-2 my-0.5">
          <span className="text-[#00ffc8] mt-1.5 shrink-0 text-xs">▸</span>
          <span className="text-sm">{renderInline(line.slice(2))}</span>
        </div>
      )
    }
    const numbered = line.match(/^(\d+)\.\s(.+)/)
    if (numbered) {
      return (
        <div key={i} className="flex gap-2 my-0.5">
          <span className="text-[#00ffc8] shrink-0 font-mono text-xs min-w-[1.2rem]">{numbered[1]}.</span>
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
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) return <em key={i} className="italic text-muted-foreground">{part.slice(1, -1)}</em>
    if (part.startsWith('`') && part.endsWith('`')) return <code key={i} className="px-1 py-0.5 bg-muted rounded text-xs font-mono text-[#00ffc8]">{part.slice(1, -1)}</code>
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
  const [activeSection, setActiveSection] = useState<SectionId>('t_side')
  const [generating, setGenerating]       = useState<SectionId | null>(null)
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

  const buildChatBody = useCallback(() => ({
    teamId:    myTeamId ?? undefined,
    focusArea: 'strategy',
    mode:      modeRef.current,
    mapName:   mapRef.current,
    playbookContext: `I'm building a playbook called "${pbNameRef.current}" for ${mapRef.current}.`,
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

  const handleSave = async () => {
    if (!playbook) return
    setSaving(true)
    const res = await fetch(`/api/playbooks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: pbName, sections }),
    })
    setSaving(false)
    if (res.ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }
  }

  const activeContent = sections[activeSection] ?? ''
  const activeMeta    = SECTIONS.find(s => s.id === activeSection)!
  const lastChatMsg   = messages[messages.length - 1]
  const isThinking    = chatLoading && (!lastChatMsg || lastChatMsg.role === 'user')

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-[#00ffc8]" size={28} />
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
      <div className="flex items-center gap-3 px-4 md:px-5 py-3 border-b border-border bg-[hsl(229,23%,9%)] shrink-0">
        <Button variant="ghost" size="sm" onClick={() => router.push('/playbook')} className="gap-1.5 text-muted-foreground -ml-2">
          <ArrowLeft size={14} />
          <span className="hidden sm:inline">Playbooks</span>
        </Button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[rgba(0,255,200,0.08)] border border-[rgba(0,255,200,0.2)]">
            <Map size={11} className="text-[#00ffc8]" />
            <span className="text-xs font-mono text-[#00ffc8]">{playbook?.map}</span>
          </div>
          {editing ? (
            <input
              value={pbName}
              onChange={e => setPbName(e.target.value)}
              onBlur={() => setEditing(false)}
              onKeyDown={e => e.key === 'Enter' && setEditing(false)}
              autoFocus
              className="bg-transparent border-b border-[rgba(0,255,200,0.4)] text-sm font-semibold text-foreground focus:outline-none min-w-0 max-w-[200px]"
            />
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="text-sm font-semibold text-foreground hover:text-[#00ffc8] transition-colors truncate max-w-[200px]"
            >
              {pbName}
            </button>
          )}
        </div>
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
          <div className="hidden sm:flex flex-col w-52 shrink-0 border-r border-border bg-[hsl(228,22%,8%)] overflow-y-auto">
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
                          ? 'bg-[rgba(0,255,200,0.08)] text-[#00ffc8] border border-[rgba(0,255,200,0.2)]'
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent border border-transparent'
                      )}
                    >
                      <span className={activeSection === s.id ? 'text-[#00ffc8]' : 'text-muted-foreground shrink-0'}>
                        {s.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium">{s.label}</p>
                      </div>
                      {isGenerating ? (
                        <Loader2 size={10} className="animate-spin text-[#00ffc8] shrink-0" />
                      ) : hasContent ? (
                        <div className="w-1.5 h-1.5 rounded-full bg-[#00ffc8] shrink-0 opacity-70" />
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Section content */}
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            {/* Section header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-[#00ffc8]">{activeMeta.icon}</span>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">{activeMeta.label}</h2>
                  <p className="text-xs text-muted-foreground">{activeMeta.desc}</p>
                </div>
              </div>
              <Button
                variant={activeContent ? 'outline' : 'neon'}
                size="sm"
                onClick={() => generateSection(activeSection)}
                disabled={!!generating}
                className="gap-1.5 shrink-0"
              >
                {generating === activeSection ? (
                  <><Loader2 size={12} className="animate-spin" /> Generating…</>
                ) : (
                  <><Sparkles size={12} /> {activeContent ? 'Regenerate' : 'Generate with AI'}</>
                )}
              </Button>
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
                      ? 'border-[rgba(0,255,200,0.3)] text-[#00ffc8] bg-[rgba(0,255,200,0.08)]'
                      : 'border-border text-muted-foreground bg-transparent'
                  )}
                >
                  {s.icon}
                  {s.label}
                  {sections[s.id] && <span className="w-1 h-1 rounded-full bg-[#00ffc8] ml-0.5" />}
                </button>
              ))}
            </div>

            {/* Content area */}
            <div className="flex-1 overflow-y-auto p-4">
              {generating === activeSection && !activeContent ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm py-8">
                  <Loader2 size={16} className="animate-spin text-[#00ffc8]" />
                  Generating tactical content…
                </div>
              ) : activeContent ? (
                <div className="prose prose-invert max-w-none">
                  <MarkdownContent content={activeContent} />
                  {generating === activeSection && (
                    <span className="inline-block w-2 h-4 bg-[#00ffc8] ml-0.5 animate-pulse rounded-sm" />
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-12 h-12 rounded-xl bg-[rgba(0,255,200,0.08)] border border-[rgba(0,255,200,0.15)] flex items-center justify-center mb-3">
                    <span className="text-[#00ffc8]">{activeMeta.icon}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4 max-w-xs">
                    No content yet for <strong className="text-foreground">{activeMeta.label}</strong>.
                    Click generate to have AI build this section for {playbook?.map}.
                  </p>
                  <Button
                    variant="neon"
                    size="sm"
                    onClick={() => generateSection(activeSection)}
                    disabled={!!generating}
                    className="gap-1.5"
                  >
                    <Sparkles size={13} />
                    Generate with AI
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: AI chat panel */}
        <div className="hidden lg:flex flex-col w-80 xl:w-96 shrink-0 border-l border-border overflow-hidden">
          {/* Chat header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-[hsl(228,22%,8%)] shrink-0">
            <div className="flex items-center gap-2">
              <MessageSquare size={14} className="text-[#00ffc8]" />
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
                <div className="w-10 h-10 rounded-xl bg-[rgba(0,255,200,0.1)] border border-[rgba(0,255,200,0.2)] flex items-center justify-center mb-3">
                  <Brain size={16} className="text-[#00ffc8]" />
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Ask me anything about your {playbook?.map} strategy — I can suggest setups, refine sections, or answer tactical questions.
                </p>
                <div className="mt-4 space-y-1.5 w-full">
                  {[
                    `What's a strong CT setup for ${playbook?.map}?`,
                    'How should we handle eco rounds?',
                    'What utility is most important here?',
                  ].map(q => (
                    <button
                      key={q}
                      onClick={() => sendChat(q)}
                      className="w-full text-left text-xs px-3 py-2 rounded-lg border border-border hover:border-[rgba(0,255,200,0.3)] hover:bg-[rgba(0,255,200,0.04)] text-muted-foreground hover:text-foreground transition-all"
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
                    <div className="w-6 h-6 rounded-lg bg-[rgba(0,255,200,0.12)] border border-[rgba(0,255,200,0.25)] flex items-center justify-center shrink-0">
                      <Brain size={11} className="text-[#00ffc8]" />
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-muted border border-border flex items-center justify-center shrink-0">
                      <span className="text-[9px] font-bold text-muted-foreground">You</span>
                    </div>
                  )}
                  <div className={cn(
                    'max-w-[85%] rounded-xl px-3 py-2',
                    msg.role === 'user'
                      ? 'bg-[rgba(0,255,200,0.08)] border border-[rgba(0,255,200,0.18)] rounded-br-sm'
                      : 'bg-card border border-border rounded-bl-sm'
                  )}>
                    {msg.role === 'assistant' ? (
                      <>
                        <MarkdownContent content={msg.content} />
                        {streaming && <span className="inline-block w-1.5 h-3.5 bg-[#00ffc8] ml-0.5 animate-pulse rounded-sm" />}
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
                <div className="w-6 h-6 rounded-lg bg-[rgba(0,255,200,0.12)] border border-[rgba(0,255,200,0.25)] flex items-center justify-center shrink-0">
                  <Brain size={11} className="text-[#00ffc8]" />
                </div>
                <div className="bg-card border border-border rounded-xl rounded-bl-sm px-3 py-2">
                  <div className="flex gap-1 items-center h-3">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="w-1 h-1 rounded-full bg-[#00ffc8] animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {chatError && !chatLoading && (
              <div className="flex items-end gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-red-400/20 border border-red-400/30 flex items-center justify-center shrink-0">
                  <AlertCircle size={11} className="text-red-400" />
                </div>
                <div className="bg-card border border-red-400/30 rounded-xl rounded-bl-sm px-3 py-2">
                  <p className="text-xs text-red-400">Something went wrong.</p>
                  <Button variant="outline" size="sm" onClick={retryChat} className="mt-1.5 gap-1 text-xs border-red-400/30 text-red-400 h-6 px-2">
                    <RefreshCw size={9} /> Retry
                  </Button>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Chat input */}
          <div className="border-t border-border p-2.5 shrink-0 bg-[hsl(228,22%,8%)]">
            <div className={cn(
              'flex items-end gap-2 p-1.5 rounded-lg border transition-all',
              'border-border focus-within:border-[rgba(0,255,200,0.4)]'
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
