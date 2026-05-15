'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  Brain, Send, RotateCcw, ChevronDown, Loader2,
  Target, Crosshair, Shield, Users, Map as MapIcon,
  Sparkles, MessageSquare, ChevronRight
} from 'lucide-react'
import type { Team, TeamFolder } from '@/types/database'

type FocusArea = 'general' | 'weakness' | 'antistrat' | 'strategy' | 'player'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const FOCUS_AREAS: { id: FocusArea; label: string; icon: React.ReactNode; description: string }[] = [
  { id: 'general', label: 'Scouting Report', icon: <Brain size={14} />, description: 'Full opponent overview' },
  { id: 'weakness', label: 'Weak Spots', icon: <Target size={14} />, description: 'Exploitable opponent patterns' },
  { id: 'antistrat', label: 'Anti-Strat', icon: <Shield size={14} />, description: 'Counter their strategies' },
  { id: 'strategy', label: 'Match Prep', icon: <Crosshair size={14} />, description: 'Map-specific counter-plays' },
  { id: 'player', label: 'Player Focus', icon: <Users size={14} />, description: 'Opponent player deep-dive' },
]

const CS2_MAPS = ['de_dust2', 'de_mirage', 'de_inferno', 'de_nuke', 'de_overpass', 'de_vertigo', 'de_ancient', 'de_anubis']

const SUGGESTED_QUESTIONS = [
  { label: 'Opponent weaknesses', prompt: "What are this opponent's biggest weaknesses we can exploit in our upcoming match?" },
  { label: 'Full anti-strat', prompt: 'Create a detailed anti-strat against this opponent — their tendencies, executes, and how we counter them.' },
  { label: 'Opponent T-side tendencies', prompt: "What are this opponent's most common T-side executes and how should we set up our CT rotations?" },
  { label: 'Key threat players', prompt: "Who are the most dangerous players on this opponent's roster and how do we neutralise them?" },
]

function MarkdownContent({ content }: { content: string }) {
  const rendered = content
    .split('\n')
    .map((line, i) => {
      // Headers
      if (line.startsWith('### ')) {
        return <h3 key={i} className="text-base font-bold text-foreground mt-4 mb-2">{line.slice(4)}</h3>
      }
      if (line.startsWith('## ')) {
        return <h2 key={i} className="text-lg font-bold text-neon-green mt-5 mb-2">{line.slice(3)}</h2>
      }
      if (line.startsWith('# ')) {
        return <h1 key={i} className="text-xl font-bold text-foreground mt-5 mb-3">{line.slice(2)}</h1>
      }
      // Bullet points
      if (line.startsWith('- ') || line.startsWith('* ')) {
        const text = line.slice(2)
        return (
          <div key={i} className="flex gap-2 my-0.5">
            <span className="text-neon-green mt-1.5 shrink-0 text-xs">▸</span>
            <span>{renderInline(text)}</span>
          </div>
        )
      }
      // Numbered list
      const numberedMatch = line.match(/^(\d+)\.\s(.+)/)
      if (numberedMatch) {
        return (
          <div key={i} className="flex gap-2 my-0.5">
            <span className="text-neon-green shrink-0 font-mono text-xs min-w-[1.2rem]">{numberedMatch[1]}.</span>
            <span>{renderInline(numberedMatch[2])}</span>
          </div>
        )
      }
      // Horizontal rule
      if (line.match(/^---+$/)) {
        return <hr key={i} className="border-border my-3" />
      }
      // Empty line
      if (line.trim() === '') {
        return <div key={i} className="h-2" />
      }
      // Normal text
      return <p key={i} className="my-0.5 leading-relaxed">{renderInline(line)}</p>
    })

  return <div className="text-sm text-foreground space-y-0.5">{rendered}</div>
}

function renderInline(text: string): React.ReactNode {
  // Bold + italic combined
  const parts = text.split(/(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/)
  return parts.map((part, i) => {
    if (part.startsWith('***') && part.endsWith('***')) {
      return <strong key={i}><em>{part.slice(3, -3)}</em></strong>
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-bold text-foreground">{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={i} className="italic text-muted-foreground">{part.slice(1, -1)}</em>
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} className="px-1 py-0.5 bg-muted rounded text-xs font-mono text-neon-green">{part.slice(1, -1)}</code>
    }
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
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-neon-green animate-bounce"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function AICoachPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [folders, setFolders] = useState<TeamFolder[]>([])
  const [selectedTeamId, setSelectedTeamId] = useState<string>('')
  const [selectedFolderId, setSelectedFolderId] = useState<string>('')
  const [focusArea, setFocusArea] = useState<FocusArea>('general')
  const [selectedPlayer, setSelectedPlayer] = useState<string>('')
  const [selectedMap, setSelectedMap] = useState<string>('')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [loadingTeams, setLoadingTeams] = useState(true)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const fetchTeams = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: memberships } = await supabase
        .from('team_members')
        .select('teams(*)')
        .eq('user_id', user.id)

      const teamList = (memberships ?? [])
        .map(m => (m.teams as unknown) as Team | null)
        .filter(Boolean) as Team[]

      setTeams(teamList)
      if (teamList[0]) setSelectedTeamId(teamList[0].id)
      setLoadingTeams(false)
    }
    fetchTeams()
  }, [])

  useEffect(() => {
    if (!selectedTeamId) return
    const fetchFolders = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('team_folders')
        .select('*')
        .eq('user_team_id', selectedTeamId)
        .order('opponent_display_name')
      setFolders((data as TeamFolder[]) || [])
      setSelectedFolderId('')
    }
    fetchFolders()
  }, [selectedTeamId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent, streaming])

  const sendMessage = useCallback(async (userMessage: string) => {
    if (!userMessage.trim() || streaming) return

    const newUserMsg: Message = {
      role: 'user',
      content: userMessage.trim(),
      timestamp: new Date(),
    }

    const updatedMessages = [...messages, newUserMsg]
    setMessages(updatedMessages)
    setInput('')
    setStreaming(true)
    setStreamingContent('')

    try {
      const res = await fetch('/api/ai/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: selectedTeamId,
          folderId: selectedFolderId || null,
          focusArea,
          playerName: focusArea === 'player' ? selectedPlayer : undefined,
          mapName: focusArea === 'strategy' ? selectedMap : undefined,
          messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      })

      if (!res.ok) {
        throw new Error('Failed to get AI response')
      }

      if (!res.body) throw new Error('No response body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accum = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        // Parse Vercel AI SDK data stream format
        const lines = chunk.split('\n')
        for (const line of lines) {
          if (line.startsWith('0:')) {
            try {
              const text = JSON.parse(line.slice(2))
              accum += text
              setStreamingContent(accum)
            } catch {
              // skip malformed chunk
            }
          }
        }
      }

      if (accum) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: accum,
          timestamp: new Date(),
        }])
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please check your connection and try again.',
        timestamp: new Date(),
      }])
    } finally {
      setStreaming(false)
      setStreamingContent('')
    }
  }, [messages, streaming, selectedTeamId, selectedFolderId, focusArea, selectedPlayer, selectedMap])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const handleNewSession = () => {
    setMessages([])
    setStreamingContent('')
    setInput('')
  }

  const selectedFolder = folders.find(f => f.id === selectedFolderId)
  const selectedTeam = teams.find(t => t.id === selectedTeamId)

  // Get unique player names from folders (simplified - in real app, load from demos)
  const availablePlayers = ['Player1', 'Player2', 'Player3', 'Player4', 'Player5']

  const isEmpty = messages.length === 0 && !streaming

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel — Context selector */}
      <div className="w-72 shrink-0 border-r border-border bg-card flex flex-col h-full overflow-y-auto">
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-2 mb-1">
            <Brain size={18} className="text-neon-green" />
            <h1 className="text-lg font-bold text-foreground">AI Coach</h1>
            <Badge variant="neon" className="text-xs ml-auto">GPT-4o</Badge>
          </div>
          <p className="text-xs text-muted-foreground">Scout opponents & build anti-strats</p>
        </div>

        <div className="p-4 space-y-5 flex-1">
          {/* Team selector */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Your Team</label>
            {loadingTeams ? (
              <div className="h-9 bg-muted/30 rounded-md animate-pulse" />
            ) : (
              <select
                value={selectedTeamId}
                onChange={e => setSelectedTeamId(e.target.value)}
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-neon-green/50 transition-colors"
              >
                <option value="">Select a team...</option>
                {teams.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Opponent folder selector */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
              Upcoming Opponent
            </label>
            <select
              value={selectedFolderId}
              onChange={e => setSelectedFolderId(e.target.value)}
              disabled={!selectedTeamId || folders.length === 0}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-neon-green/50 transition-colors disabled:opacity-50"
            >
              <option value="">All opponents</option>
              {folders.map(f => (
                <option key={f.id} value={f.id}>{f.opponent_display_name}</option>
              ))}
            </select>
            {selectedFolder && (
              <div className="mt-2 p-2 bg-neon-green/5 rounded-md border border-neon-green/20 text-xs">
                <p className="text-neon-green font-medium">{selectedFolder.opponent_display_name}</p>
                <p className="text-muted-foreground mt-0.5">
                  {(selectedFolder.aggregated_stats as any)?.total_matches || 0} matches ·{' '}
                  {Math.round(((selectedFolder.aggregated_stats as any)?.win_rate || 0) * 100)}% win rate
                </p>
              </div>
            )}
          </div>

          {/* Focus area */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Focus Area</label>
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
                  {focusArea === area.id && (
                    <div className="w-1.5 h-1.5 rounded-full bg-neon-green shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Player selector (when Player Focus) */}
          {focusArea === 'player' && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Player</label>
              <select
                value={selectedPlayer}
                onChange={e => setSelectedPlayer(e.target.value)}
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-neon-green/50 transition-colors"
              >
                <option value="">Select player...</option>
                {availablePlayers.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          )}

          {/* Map selector (when Strategy) */}
          {focusArea === 'strategy' && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Map</label>
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
        </div>

        {/* Context summary */}
        {selectedTeamId && (
          <div className="p-4 border-t border-border">
            <p className="text-xs text-muted-foreground mb-1">Active context</p>
            <div className="flex flex-wrap gap-1">
              {selectedTeam && <Badge variant="outline" className="text-xs">{selectedTeam.name}</Badge>}
              {selectedFolder && <Badge variant="neon" className="text-xs">vs {selectedFolder.opponent_display_name}</Badge>}
              <Badge variant="secondary" className="text-xs capitalize">{focusArea}</Badge>
            </div>
          </div>
        )}
      </div>

      {/* Right panel — Chat */}
      <div className="flex-1 flex flex-col overflow-hidden bg-background">
        {/* Chat header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-card shrink-0">
          <div className="flex items-center gap-2">
            <MessageSquare size={16} className="text-neon-green" />
            <span className="text-sm font-medium text-foreground">
              {messages.length === 0 ? 'New Session' : `${messages.length} messages`}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNewSession}
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <RotateCcw size={13} />
            New Session
          </Button>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-1">
          {isEmpty ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <div className="w-20 h-20 rounded-full bg-neon-green/10 border border-neon-green/20 flex items-center justify-center mb-5">
                <Brain size={36} className="text-neon-green" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">AI Scout Ready</h2>
              <p className="text-muted-foreground text-sm max-w-sm mb-8">
                Select your team and opponent, then get AI-powered anti-strats and scouting reports.
              </p>

              {/* Suggested questions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                {SUGGESTED_QUESTIONS.map(q => (
                  <button
                    key={q.label}
                    onClick={() => sendMessage(q.prompt)}
                    disabled={!selectedTeamId || streaming}
                    className={cn(
                      'flex items-center gap-2 p-3 text-left rounded-lg border border-border bg-card',
                      'text-sm text-muted-foreground hover:text-foreground hover:border-neon-green/30 hover:bg-neon-green/5',
                      'transition-all duration-150 group',
                      (!selectedTeamId || streaming) && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    <Sparkles size={13} className="text-neon-green shrink-0" />
                    <span className="flex-1 min-w-0 truncate">{q.label}</span>
                    <ChevronRight size={13} className="text-muted-foreground group-hover:text-neon-green shrink-0" />
                  </button>
                ))}
              </div>

              {!selectedTeamId && (
                <p className="text-xs text-muted-foreground mt-4 flex items-center gap-1">
                  <ChevronDown size={12} className="rotate-90" />
                  Select a team in the left panel to get started
                </p>
              )}
            </div>
          ) : (
            <>
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex items-end gap-3 mb-4',
                    msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                  )}
                >
                  {/* Avatar */}
                  {msg.role === 'assistant' ? (
                    <div className="w-8 h-8 rounded-full bg-neon-green/20 border border-neon-green/30 flex items-center justify-center shrink-0 mb-0.5">
                      <Brain size={14} className="text-neon-green" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center shrink-0 mb-0.5">
                      <span className="text-xs font-bold text-muted-foreground">You</span>
                    </div>
                  )}

                  {/* Bubble */}
                  <div
                    className={cn(
                      'max-w-[75%] rounded-2xl px-4 py-3',
                      msg.role === 'user'
                        ? 'bg-neon-green/10 border border-neon-green/20 rounded-br-sm'
                        : 'bg-card border border-border rounded-bl-sm'
                    )}
                  >
                    {msg.role === 'assistant' ? (
                      <MarkdownContent content={msg.content} />
                    ) : (
                      <p className="text-sm text-foreground">{msg.content}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2 select-none">
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}

              {/* Streaming message */}
              {streaming && (
                streamingContent ? (
                  <div className="flex items-end gap-3 mb-4">
                    <div className="w-8 h-8 rounded-full bg-neon-green/20 border border-neon-green/30 flex items-center justify-center shrink-0 mb-0.5">
                      <Brain size={14} className="text-neon-green" />
                    </div>
                    <div className="max-w-[75%] bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-3">
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
        <div className="border-t border-border bg-card p-4 shrink-0">
          {!selectedTeamId && (
            <p className="text-xs text-muted-foreground text-center mb-3">
              Select a team in the left panel to start chatting
            </p>
          )}
          <div className={cn(
            'flex items-end gap-3 p-2 rounded-xl border transition-colors',
            selectedTeamId ? 'border-border focus-within:border-neon-green/50' : 'border-border opacity-60'
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
              placeholder={selectedTeamId ? 'Ask about opponent tendencies, anti-strats, weak spots... (Enter to send)' : 'Select a team first...'}
              disabled={!selectedTeamId || streaming}
              rows={1}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none min-h-[36px] max-h-40 py-2 px-2 disabled:cursor-not-allowed"
              style={{ height: '36px' }}
            />
            <Button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || !selectedTeamId || streaming}
              size="sm"
              variant="neon"
              className="shrink-0 h-9 w-9 p-0 rounded-lg"
            >
              {streaming ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Send size={15} />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2">
            AI Scout uses uploaded opponent demos to generate anti-strats and scouting reports.
          </p>
        </div>
      </div>
    </div>
  )
}
