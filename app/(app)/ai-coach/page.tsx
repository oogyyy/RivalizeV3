'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  Brain, Send, RotateCcw, Loader2,
  Target, Crosshair, Shield, Users, Map as MapIcon,
  Sparkles, MessageSquare, ChevronRight, ExternalLink, Database,
  SlidersHorizontal, X, ChevronDown,
} from 'lucide-react'
import type { TeamFolder } from '@/types/database'

type FocusArea = 'general' | 'weakness' | 'antistrat' | 'strategy' | 'player'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const FOCUS_AREAS: { id: FocusArea; label: string; icon: React.ReactNode; description: string }[] = [
  { id: 'general',   label: 'Scouting Report', icon: <Brain size={14} />,    description: 'Full opponent overview' },
  { id: 'weakness',  label: 'Weak Spots',       icon: <Target size={14} />,   description: 'Exploitable patterns' },
  { id: 'antistrat', label: 'Anti-Strat',        icon: <Shield size={14} />,   description: 'Counter their strategies' },
  { id: 'strategy',  label: 'Match Prep',        icon: <Crosshair size={14} />, description: 'Map-specific counter-plays' },
  { id: 'player',    label: 'Player Focus',      icon: <Users size={14} />,    description: 'Opponent player deep-dive' },
]

const CS2_MAPS = [
  'de_dust2', 'de_mirage', 'de_inferno', 'de_nuke',
  'de_overpass', 'de_vertigo', 'de_ancient', 'de_anubis',
]

const SUGGESTED_QUESTIONS = [
  { label: 'Opponent weaknesses',       prompt: "What are this opponent's biggest weaknesses we can exploit?" },
  { label: 'Full anti-strat',           prompt: "Create a detailed anti-strat — their tendencies, executes, and how we counter them." },
  { label: 'T-side tendencies',         prompt: "What are this opponent's most common T-side executes and how should we set up CT rotations?" },
  { label: 'Key threat players',        prompt: "Who are the most dangerous players on this roster and how do we neutralise them?" },
]

function MarkdownContent({ content }: { content: string }) {
  const rendered = content.split('\n').map((line, i) => {
    if (line.startsWith('### ')) return <h3 key={i} className="text-base font-bold text-foreground mt-4 mb-2">{line.slice(4)}</h3>
    if (line.startsWith('## '))  return <h2 key={i} className="text-lg font-bold text-neon-green mt-5 mb-2">{line.slice(3)}</h2>
    if (line.startsWith('# '))   return <h1 key={i} className="text-xl font-bold text-foreground mt-5 mb-3">{line.slice(2)}</h1>
    if (line.startsWith('- ') || line.startsWith('* ')) {
      return (
        <div key={i} className="flex gap-2 my-0.5">
          <span className="text-neon-green mt-1.5 shrink-0 text-xs">▸</span>
          <span>{renderInline(line.slice(2))}</span>
        </div>
      )
    }
    const numbered = line.match(/^(\d+)\.\s(.+)/)
    if (numbered) {
      return (
        <div key={i} className="flex gap-2 my-0.5">
          <span className="text-neon-green shrink-0 font-mono text-xs min-w-[1.2rem]">{numbered[1]}.</span>
          <span>{renderInline(numbered[2])}</span>
        </div>
      )
    }
    if (line.match(/^---+$/)) return <hr key={i} className="border-border my-3" />
    if (line.trim() === '')   return <div key={i} className="h-2" />
    return <p key={i} className="my-0.5 leading-relaxed">{renderInline(line)}</p>
  })
  return <div className="text-sm text-foreground space-y-0.5">{rendered}</div>
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/)
  return parts.map((part, i) => {
    if (part.startsWith('***') && part.endsWith('***')) return <strong key={i}><em>{part.slice(3, -3)}</em></strong>
    if (part.startsWith('**') && part.endsWith('**'))   return <strong key={i} className="font-bold text-foreground">{part.slice(2, -2)}</strong>
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) return <em key={i} className="italic text-muted-foreground">{part.slice(1, -1)}</em>
    if (part.startsWith('`') && part.endsWith('`'))     return <code key={i} className="px-1 py-0.5 bg-muted rounded text-xs font-mono text-neon-green">{part.slice(1, -1)}</code>
    return part
  })
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-3 mb-4">
      <div className="w-8 h-8 rounded-full bg-neon-green/20 border border-neon-green/30 flex items-center justify-center shrink-0">
        <Brain size={14} className="text-neon-green" />
      </div>
      <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-3">
        <div className="flex gap-1 items-center h-4">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-neon-green animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function AIScoutPage() {
  const [opponents, setOpponents] = useState<TeamFolder[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<string>('')
  const [focusArea, setFocusArea] = useState<FocusArea>('general')
  const [selectedPlayer, setSelectedPlayer] = useState<string>('')
  const [selectedMap, setSelectedMap] = useState<string>('')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [loadingOpponents, setLoadingOpponents] = useState(true)
  const [includeProDataset, setIncludeProDataset] = useState(false)
  const [isContextOpen, setIsContextOpen] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Fetch all opponent folders directly — no team selection needed
  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/opponents')
      if (res.ok) setOpponents((await res.json()) as TeamFolder[])
      setLoadingOpponents(false)
    }
    load()
  }, [])

  // Pre-select folder from URL param if present (?folder=xxx)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const fid = params.get('folder')
    if (fid) setSelectedFolderId(fid)
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent, streaming])

  const selectedFolder = opponents.find(f => f.id === selectedFolderId)

  // Derive player list from selected folder's aggregated stats
  const availablePlayers: string[] = (selectedFolder?.aggregated_stats as { top_players?: { name: string }[] } | null)
    ?.top_players?.map(p => p.name) ?? []

  const sendMessage = useCallback(
    async (userMessage: string) => {
      if (!userMessage.trim() || streaming) return

      const newUserMsg: Message = { role: 'user', content: userMessage.trim(), timestamp: new Date() }
      const updatedMessages = [...messages, newUserMsg]
      setMessages(updatedMessages)
      setInput('')
      setStreaming(true)
      setStreamingContent('')
      setIsContextOpen(false)

      try {
        const res = await fetch('/api/ai/coach', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            // teamId derived from the selected folder; falls back to null for general coaching
            teamId: selectedFolder?.user_team_id ?? null,
            folderId: selectedFolderId || null,
            focusArea,
            playerName: focusArea === 'player' ? selectedPlayer : undefined,
            mapName: focusArea === 'strategy' ? selectedMap : undefined,
            includeProDataset,
            messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
          }),
        })

        if (!res.ok) throw new Error('Failed to get AI response')
        if (!res.body) throw new Error('No response body')

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let accum = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          for (const line of chunk.split('\n')) {
            if (line.startsWith('0:')) {
              try {
                accum += JSON.parse(line.slice(2))
                setStreamingContent(accum)
              } catch { /* skip malformed chunk */ }
            }
          }
        }

        if (accum) {
          setMessages(prev => [...prev, { role: 'assistant', content: accum, timestamp: new Date() }])
        }
      } catch {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please check your connection and try again.',
          timestamp: new Date(),
        }])
      } finally {
        setStreaming(false)
        setStreamingContent('')
      }
    },
    [messages, streaming, selectedFolder, selectedFolderId, focusArea, selectedPlayer, selectedMap, includeProDataset]
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const isEmpty = messages.length === 0 && !streaming

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left panel: Context sidebar ── */}
      <div
        className={cn(
          'shrink-0 border-r border-border bg-card flex flex-col h-full overflow-y-auto',
          'md:w-72 md:flex',
          isContextOpen
            ? 'fixed inset-0 z-40 w-full flex flex-col md:relative md:inset-auto md:w-72'
            : 'hidden md:flex'
        )}
      >
        {/* Mobile close */}
        <div className="md:hidden flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <span className="text-sm font-semibold text-foreground">Scout Settings</span>
          <button onClick={() => setIsContextOpen(false)} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        {/* Panel header */}
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-2 mb-1">
            <Brain size={18} className="text-neon-green" />
            <h1 className="text-lg font-bold text-foreground">AI Scout</h1>
            <Badge variant="neon" className="text-xs ml-auto">GPT-4o</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Study opponents · Generate anti-strats
          </p>
        </div>

        <div className="p-4 space-y-5 flex-1">
          {/* Opponent selector */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
              Opponent
            </label>
            {loadingOpponents ? (
              <div className="h-9 bg-muted/30 rounded-md animate-pulse" />
            ) : opponents.length === 0 ? (
              <div className="rounded-md border border-border bg-background/50 px-3 py-2.5 text-xs text-muted-foreground">
                No opponents yet —{' '}
                <a href="/opponents" className="text-neon-green hover:underline">
                  upload a demo first
                </a>
              </div>
            ) : (
              <select
                value={selectedFolderId}
                onChange={e => { setSelectedFolderId(e.target.value); setSelectedPlayer('') }}
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-neon-green/50 transition-colors"
              >
                <option value="">Select an opponent…</option>
                {opponents.map(f => (
                  <option key={f.id} value={f.id}>{f.opponent_display_name}</option>
                ))}
              </select>
            )}

            {selectedFolder && (
              <div className="mt-2 p-2.5 bg-neon-green/5 rounded-md border border-neon-green/20 text-xs">
                <p className="text-neon-green font-semibold">{selectedFolder.opponent_display_name}</p>
                <p className="text-muted-foreground mt-0.5">
                  {(selectedFolder.aggregated_stats as { total_matches?: number } | null)?.total_matches ?? 0} matches ·{' '}
                  {Math.round(((selectedFolder.aggregated_stats as { win_rate?: number } | null)?.win_rate ?? 0) * 100)}% win rate
                </p>
              </div>
            )}
          </div>

          {/* Focus area */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
              Focus Area
            </label>
            <div className="space-y-1.5">
              {FOCUS_AREAS.map(area => (
                <button
                  key={area.id}
                  onClick={() => setFocusArea(area.id)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm font-medium transition-all text-left',
                    focusArea === area.id
                      ? 'bg-neon-green/10 text-neon-green border border-neon-green/20'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent border border-transparent'
                  )}
                >
                  <span className={focusArea === area.id ? 'text-neon-green' : 'text-muted-foreground'}>
                    {area.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="truncate">{area.label}</p>
                    <p className="text-xs text-muted-foreground truncate font-normal">{area.description}</p>
                  </div>
                  {focusArea === area.id && <div className="w-1.5 h-1.5 rounded-full bg-neon-green shrink-0" />}
                </button>
              ))}
            </div>
          </div>

          {/* Player selector — only when Player Focus and a folder is selected */}
          {focusArea === 'player' && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                Player
              </label>
              {availablePlayers.length > 0 ? (
                <select
                  value={selectedPlayer}
                  onChange={e => setSelectedPlayer(e.target.value)}
                  className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-neon-green/50 transition-colors"
                >
                  <option value="">All players…</option>
                  {availablePlayers.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {selectedFolder
                    ? 'No player data yet — demos may still be processing.'
                    : 'Select an opponent to see their players.'}
                </p>
              )}
            </div>
          )}

          {/* Map selector — only when Match Prep */}
          {focusArea === 'strategy' && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                Map
              </label>
              <select
                value={selectedMap}
                onChange={e => setSelectedMap(e.target.value)}
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-neon-green/50 transition-colors"
              >
                <option value="">Any map</option>
                {CS2_MAPS.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          )}

          {/* Pro dataset toggle */}
          <div className="border-t border-border pt-4">
            <button
              onClick={() => setIncludeProDataset(v => !v)}
              className={cn(
                'w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-all',
                includeProDataset
                  ? 'bg-blue-500/10 border-blue-500/30'
                  : 'bg-background border-border hover:border-border/80 hover:bg-accent/40'
              )}
            >
              <div className={cn('w-7 h-7 rounded flex items-center justify-center shrink-0 mt-0.5', includeProDataset ? 'bg-blue-500/20' : 'bg-muted')}>
                <Database size={13} className={includeProDataset ? 'text-blue-400' : 'text-muted-foreground'} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className={cn('text-xs font-semibold', includeProDataset ? 'text-blue-300' : 'text-foreground')}>
                    Pro Dataset Insights
                  </p>
                  <div className={cn('w-7 h-4 rounded-full transition-colors shrink-0', includeProDataset ? 'bg-blue-500' : 'bg-muted-foreground/30')}>
                    <div className={cn('w-3 h-3 rounded-full bg-white shadow transition-transform mt-0.5', includeProDataset ? 'translate-x-3.5' : 'translate-x-0.5')} />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                  Cross-reference pro meta from a public dataset.
                </p>
              </div>
            </button>
            {includeProDataset && (
              <div className="mt-2 px-3 py-2 rounded-md bg-blue-500/5 border border-blue-500/15">
                <p className="text-[10px] text-blue-400/80 leading-relaxed">
                  AI will reference pro-level meta from the{' '}
                  <a href="https://huggingface.co/datasets/blanchon/opencs2_dataset" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-300 inline-flex items-center gap-0.5">
                    OpenCS2 dataset <ExternalLink size={9} />
                  </a>{' '}
                  (200k+ pro matches).
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Active context summary */}
        <div className="p-4 border-t border-border">
          <p className="text-xs text-muted-foreground mb-1">Active context</p>
          <div className="flex flex-wrap gap-1">
            {selectedFolder
              ? <Badge variant="neon" className="text-xs">{selectedFolder.opponent_display_name}</Badge>
              : <Badge variant="outline" className="text-xs text-muted-foreground">No opponent selected</Badge>
            }
            <Badge variant="secondary" className="text-xs capitalize">{focusArea}</Badge>
            {includeProDataset && (
              <Badge className="text-xs bg-blue-500/20 text-blue-300 border-blue-500/30">Pro data</Badge>
            )}
          </div>
        </div>
      </div>

      {/* ── Right panel: Chat ── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-background min-w-0">
        {/* Chat header */}
        <div className="flex items-center justify-between px-4 md:px-5 py-3 border-b border-border bg-card shrink-0">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsContextOpen(true)}
              className="md:hidden gap-1.5 text-xs text-muted-foreground hover:text-foreground -ml-2 mr-1"
            >
              <SlidersHorizontal size={14} />
              Settings
            </Button>
            <MessageSquare size={16} className="text-neon-green hidden md:block" />
            <div className="hidden md:flex items-baseline gap-1.5">
              <span className="text-sm font-semibold text-foreground">
                {selectedFolder ? selectedFolder.opponent_display_name : 'AI Scout'}
              </span>
              {selectedFolder && (
                <span className="text-xs text-muted-foreground capitalize">· {focusArea}</span>
              )}
            </div>
            <span className="text-sm font-medium text-foreground md:hidden">
              {messages.length === 0 ? 'AI Scout' : `${messages.length} messages`}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setMessages([]); setStreamingContent(''); setInput('') }}
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <RotateCcw size={13} />
            <span className="hidden sm:inline">New Session</span>
          </Button>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-1">
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <div className="w-20 h-20 rounded-full bg-neon-green/10 border border-neon-green/20 flex items-center justify-center mb-5">
                <Brain size={36} className="text-neon-green" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-1">
                {selectedFolder ? `Studying ${selectedFolder.opponent_display_name}` : 'AI Scout Ready'}
              </h2>
              <p className="text-muted-foreground text-sm max-w-sm mb-8">
                {selectedFolder
                  ? `Ask anything about ${selectedFolder.opponent_display_name} — tendencies, anti-strats, key players, map reads.`
                  : 'Select an opponent you\'ve uploaded demos for, then ask for scouting reports and anti-strats.'}
              </p>

              {/* Suggested questions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                {SUGGESTED_QUESTIONS.map(q => (
                  <button
                    key={q.label}
                    onClick={() => sendMessage(q.prompt)}
                    disabled={streaming}
                    className={cn(
                      'flex items-center gap-2 p-3 text-left rounded-lg border border-border bg-card',
                      'text-sm text-muted-foreground hover:text-foreground hover:border-neon-green/30 hover:bg-neon-green/5',
                      'transition-all duration-150 group disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                  >
                    <Sparkles size={13} className="text-neon-green shrink-0" />
                    <span className="flex-1 min-w-0 truncate">{q.label}</span>
                    <ChevronRight size={13} className="text-muted-foreground group-hover:text-neon-green shrink-0" />
                  </button>
                ))}
              </div>

              {!selectedFolder && opponents.length > 0 && (
                <p className="text-xs text-muted-foreground mt-5 flex items-center gap-1">
                  <ChevronDown size={12} className="rotate-90" />
                  Pick an opponent in the left panel to get personalised scouting
                </p>
              )}
              {!selectedFolder && opponents.length === 0 && !loadingOpponents && (
                <a
                  href="/opponents"
                  className="mt-5 text-xs text-neon-green hover:underline flex items-center gap-1"
                >
                  <Target size={12} />
                  Upload your first opponent demo →
                </a>
              )}
            </div>
          ) : (
            <>
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={cn('flex items-end gap-3 mb-4', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}
                >
                  {msg.role === 'assistant' ? (
                    <div className="w-8 h-8 rounded-full bg-neon-green/20 border border-neon-green/30 flex items-center justify-center shrink-0 mb-0.5">
                      <Brain size={14} className="text-neon-green" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center shrink-0 mb-0.5">
                      <span className="text-xs font-bold text-muted-foreground">You</span>
                    </div>
                  )}
                  <div
                    className={cn(
                      'max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3',
                      msg.role === 'user'
                        ? 'bg-neon-green/10 border border-neon-green/20 rounded-br-sm'
                        : 'bg-card border border-border rounded-bl-sm'
                    )}
                  >
                    {msg.role === 'assistant'
                      ? <MarkdownContent content={msg.content} />
                      : <p className="text-sm text-foreground">{msg.content}</p>
                    }
                    <p className="text-xs text-muted-foreground mt-2 select-none">
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}

              {streaming && (
                streamingContent ? (
                  <div className="flex items-end gap-3 mb-4">
                    <div className="w-8 h-8 rounded-full bg-neon-green/20 border border-neon-green/30 flex items-center justify-center shrink-0 mb-0.5">
                      <Brain size={14} className="text-neon-green" />
                    </div>
                    <div className="max-w-[85%] sm:max-w-[75%] bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-3">
                      <MarkdownContent content={streamingContent} />
                      <span className="inline-block w-2 h-4 bg-neon-green ml-0.5 animate-pulse rounded-sm" />
                    </div>
                  </div>
                ) : (
                  <TypingIndicator />
                )
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-border bg-card p-3 md:p-4 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:pb-4">
          <div className={cn(
            'flex items-end gap-3 p-2 rounded-xl border transition-colors',
            'border-border focus-within:border-neon-green/50'
          )}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => {
                setInput(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'
              }}
              onKeyDown={handleKeyDown}
              placeholder={
                selectedFolder
                  ? `Ask about ${selectedFolder.opponent_display_name}…`
                  : 'Ask anything about CS2 tactics, or select an opponent for personalised scouting…'
              }
              disabled={streaming}
              rows={1}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none min-h-[36px] max-h-40 py-2 px-2 disabled:cursor-not-allowed"
              style={{ height: '36px' }}
            />
            <Button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || streaming}
              size="sm"
              variant="neon"
              className="shrink-0 h-10 w-10 p-0 rounded-lg"
            >
              {streaming ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2">
            {selectedFolder
              ? `Analysing demos from your ${selectedFolder.opponent_display_name} folder`
              : 'Select an opponent folder for personalised anti-strats and scouting reports'}
          </p>
        </div>
      </div>
    </div>
  )
}
