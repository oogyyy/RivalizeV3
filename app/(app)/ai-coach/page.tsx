'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useChat } from 'ai/react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  Brain, Send, RotateCcw, Loader2,
  Target, Crosshair, Shield, Users,
  Sparkles, MessageSquare, ChevronRight, ExternalLink, Database,
  SlidersHorizontal, X, ChevronDown, BarChart3, AlertCircle, RefreshCw,
  BookOpen, Zap,
} from 'lucide-react'
import type { TeamFolder } from '@/types/database'
import { CS2_MAPS } from '@/types/database'
import dynamic from 'next/dynamic'

const ChatRoundReplay = dynamic(() => import('@/components/demos/ChatRoundReplay'), { ssr: false })

type Mode = 'opponent' | 'myteam'
type FocusArea = 'general' | 'weakness' | 'antistrat' | 'strategy' | 'player' | 'executes' | 'rounds' | 'drills'

const OPPONENT_FOCUS_AREAS: { id: FocusArea; label: string; icon: React.ReactNode; description: string }[] = [
  { id: 'general',   label: 'Scouting Report', icon: <Brain size={13} />,     description: 'Full opponent overview' },
  { id: 'weakness',  label: 'Weak Spots',       icon: <Target size={13} />,    description: 'Exploitable patterns' },
  { id: 'antistrat', label: 'Anti-Strat',        icon: <Shield size={13} />,    description: 'Counter their strategies' },
  { id: 'strategy',  label: 'Match Prep',        icon: <Crosshair size={13} />, description: 'Map-specific counter-plays' },
  { id: 'player',    label: 'Player Focus',      icon: <Users size={13} />,     description: 'Opponent player deep-dive' },
]

const MY_TEAM_FOCUS_AREAS: { id: FocusArea; label: string; icon: React.ReactNode; description: string }[] = [
  { id: 'general',  label: 'Team Overview',   icon: <Brain size={13} />,     description: 'Strengths, weaknesses, roadmap' },
  { id: 'weakness', label: 'Weak Spots',      icon: <Target size={13} />,    description: 'Patterns costing you rounds' },
  { id: 'executes', label: 'Executes',        icon: <Crosshair size={13} />, description: 'Improve execute quality' },
  { id: 'rounds',   label: 'Round Review',    icon: <BarChart3 size={13} />, description: 'Key rounds deep-dive' },
  { id: 'drills',   label: 'Practice Drills', icon: <Sparkles size={13} />, description: 'Tailored drill recommendations' },
  { id: 'strategy', label: 'Playbook',        icon: <Shield size={13} />,    description: 'Build your team playbook' },
]

const OPPONENT_QUESTIONS = [
  { label: 'Opponent weaknesses',  prompt: "What are this opponent's biggest weaknesses we can exploit?" },
  { label: 'Full anti-strat',      prompt: "Create a detailed anti-strat — their tendencies, executes, and how we counter them." },
  { label: 'T-side tendencies',    prompt: "What are this opponent's most common T-side executes and how should we set up CT rotations?" },
  { label: 'Key threat players',   prompt: "Who are the most dangerous players on this roster and how do we neutralise them?" },
]

const MY_TEAM_QUESTIONS = [
  { label: 'Our biggest weaknesses', prompt: "What are our team's biggest weaknesses based on the demo data? Be specific and prioritised." },
  { label: 'Improve our executes',   prompt: "How can we improve our site executes? Review our utility usage, timing, and coordination." },
  { label: 'Practice drill plan',    prompt: "Create a personalised practice plan with specific drills to improve based on our recent performance." },
  { label: 'Build our playbook',     prompt: "Help us build a structured T-side and CT-side playbook with clear roles and go-to strategies." },
]

const FOLLOW_UP_PROMPTS: Record<string, { label: string; prompt: string }[]> = {
  'opponent/general': [
    { label: 'Biggest weaknesses',  prompt: "What are their biggest weaknesses we can exploit in the match?" },
    { label: 'Key threat players',  prompt: "Who are the most dangerous players on this roster and how do we neutralise them?" },
    { label: 'Map bans advice',     prompt: "Based on this data, which maps should we ban and which should we pick?" },
  ],
  'opponent/weakness': [
    { label: 'Best round to force', prompt: "Which round type do they lose most often and how do we set that situation up?" },
    { label: 'Utility counters',    prompt: "What specific utility lineups counter their T-side entry patterns?" },
    { label: 'CT rotation baits',   prompt: "How can we bait their CT rotations to create late-round advantages?" },
  ],
  'opponent/antistrat': [
    { label: 'Counter their AWP',   prompt: "How do we play around their AWP positions — angles, timings, and smokes?" },
    { label: 'Fake response',       prompt: "What's their likely CT response when we fake one site — how do we punish the rotate?" },
    { label: 'Eco counter',         prompt: "What's the best way to play against their eco rounds — where do they peek and with what?" },
  ],
  'opponent/strategy': [
    { label: 'Utility for this map', prompt: "What are the 3 most important utility lineups we need ready for this map?" },
    { label: 'CT anchor positions',  prompt: "Where should our CT anchors hold to maximise time against their common executes?" },
    { label: 'T-side timing reads',  prompt: "Based on their T-side timings, where should we be positioned at key seconds?" },
  ],
  'opponent/player': [
    { label: 'Shut this player down', prompt: "Give me a specific game plan to limit this player's impact throughout the match." },
    { label: 'Their weakest spots',   prompt: "In what situations does this player struggle most and how do we force those?" },
    { label: 'Positioning habits',    prompt: "What are this player's most predictable positions and timings?" },
  ],
  'myteam/general': [
    { label: 'This week\'s priority', prompt: "Based on our demos, what's the single most impactful thing to fix this week?" },
    { label: 'Weakest map',           prompt: "Which map in our pool has the most issues and what are the top problems on it?" },
    { label: 'T-side improvements',   prompt: "What specific changes would most improve our T-side consistency?" },
  ],
  'myteam/weakness': [
    { label: 'Fix it with a drill',   prompt: "Create a concrete drill or scenario we can practice to fix our biggest weakness." },
    { label: 'Economy mistakes',      prompt: "Are we making any patterns of economic mistakes — bad force buys, over-saving, mismanaged eco rounds?" },
    { label: 'CT retake issues',      prompt: "How can we improve our CT-side retakes — positioning, utility, and communication?" },
  ],
  'myteam/executes': [
    { label: 'Best execute to build',  prompt: "Which of our site executes has the highest success rate and how can we develop it further?" },
    { label: 'Post-plant positioning', prompt: "How should we position after planting to win more post-plant rounds?" },
    { label: 'Utility sequence',       prompt: "Walk me through the ideal utility order for our most-used execute." },
  ],
  'myteam/rounds': [
    { label: 'Pistol round fixes',  prompt: "What adjustments would improve our pistol round win rate on both sides?" },
    { label: 'Eco round wins',      prompt: "How can we win more eco rounds — what setups and plays give us the best odds?" },
    { label: 'Clutch improvement',  prompt: "What patterns do we have in clutch situations and how do we improve our clutch win rate?" },
  ],
  'myteam/drills': [
    { label: 'Warm-up routine',       prompt: "Design a 30-minute warm-up routine we should run before every scrim session." },
    { label: 'Role-specific training', prompt: "What should each player role (entry, AWP, support, lurk) focus on individually?" },
    { label: 'Team practice workshop', prompt: "Design a team practice session focused on our worst-performing area." },
  ],
  'myteam/strategy': [
    { label: 'A site default',      prompt: "Help us build a solid A site CT default with clear responsibilities for each player." },
    { label: 'T-side default',      prompt: "Design a structured T-side default — what's everyone's role and where do we gather info?" },
    { label: 'Mid-round calling',   prompt: "What mid-round calling structure would help us adapt better to CT reads?" },
  ],
}

function MarkdownContent({ content }: { content: string }) {
  const rendered = content.split('\n').map((line, i) => {
    if (line.startsWith('### ')) return <h3 key={i} className="text-base font-bold text-foreground mt-4 mb-2">{line.slice(4)}</h3>
    if (line.startsWith('## '))  return <h2 key={i} style={{ fontSize: 14, fontWeight: 700, color: 'var(--win)', marginTop: 20, marginBottom: 8 }}>{line.slice(3)}</h2>
    if (line.startsWith('# '))   return <h1 key={i} className="text-xl font-bold text-foreground mt-5 mb-3">{line.slice(2)}</h1>
    if (line.startsWith('- ') || line.startsWith('* ')) {
      return (
        <div key={i} className="flex gap-2 my-0.5">
          <span style={{ color: 'var(--win)', marginTop: 6, flexShrink: 0, fontSize: 10 }}>▸</span>
          <span>{renderInline(line.slice(2))}</span>
        </div>
      )
    }
    const numbered = line.match(/^(\d+)\.\s(.+)/)
    if (numbered) {
      return (
        <div key={i} className="flex gap-2 my-0.5">
          <span style={{ color: 'var(--win)', flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: 11, minWidth: '1.2rem' }}>{numbered[1]}.</span>
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
    if (part.startsWith('`') && part.endsWith('`'))     return <code key={i} style={{ padding: '1px 5px', background: 'var(--elevated)', borderRadius: 5, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--win)' }}>{part.slice(1, -1)}</code>
    return part
  })
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-3 mb-4">
      <div style={{ width: 32, height: 32, borderRadius: 10, background: 'color-mix(in srgb, var(--win) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--win) 25%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Brain size={14} style={{ color: 'var(--win)' }} />
      </div>
      <div className="rv-panel px-4 py-3">
        <div className="flex gap-1 items-center h-4">
          {[0, 1, 2].map(i => (
            <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--win)' }} className="animate-bounce" style2={{ animationDelay: `${i * 150}ms` }} />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function AIScoutPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('opponent')
  const [opponents, setOpponents] = useState<TeamFolder[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<string>('')
  const [focusArea, setFocusArea] = useState<FocusArea>('general')
  const [selectedPlayer, setSelectedPlayer] = useState<string>('')
  const [selectedMap, setSelectedMap] = useState<string>('')
  const [loadingOpponents, setLoadingOpponents] = useState(true)
  const [includeProDataset, setIncludeProDataset] = useState(false)
  const [isContextOpen, setIsContextOpen] = useState(false)
  const [myTeamId, setMyTeamId] = useState<string | null>(null)

  const messagesEndRef    = useRef<HTMLDivElement>(null)
  const textareaRef       = useRef<HTMLTextAreaElement>(null)
  const lastSentMessageRef = useRef<string>('')

  const modeRef             = useRef(mode)
  const selectedFolderIdRef = useRef(selectedFolderId)
  const focusAreaRef        = useRef(focusArea)
  const selectedPlayerRef   = useRef(selectedPlayer)
  const selectedMapRef      = useRef(selectedMap)
  const includeProDatasetRef = useRef(includeProDataset)
  const myTeamIdRef         = useRef(myTeamId)

  useEffect(() => { modeRef.current = mode },             [mode])
  useEffect(() => { selectedFolderIdRef.current = selectedFolderId }, [selectedFolderId])
  useEffect(() => { focusAreaRef.current = focusArea },   [focusArea])
  useEffect(() => { selectedPlayerRef.current = selectedPlayer }, [selectedPlayer])
  useEffect(() => { selectedMapRef.current = selectedMap }, [selectedMap])
  useEffect(() => { includeProDatasetRef.current = includeProDataset }, [includeProDataset])
  useEffect(() => { myTeamIdRef.current = myTeamId },     [myTeamId])

  const selectedFolder = opponents.find(f => f.id === selectedFolderId)

  const {
    messages,
    input,
    setInput,
    isLoading,
    error,
    append,
    reload,
    setMessages,
  } = useChat({
    api: '/api/ai/coach',
    onError: (err) => console.error('[AI Coach]', err),
  })

  useEffect(() => {
    fetch('/api/teams')
      .then(r => r.ok ? r.json() : [])
      .then((teams: Array<{ id: string }>) => {
        if (teams.length > 0) setMyTeamId(teams[0].id)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/opponents')
      if (res.ok) {
        const data = (await res.json()) as TeamFolder[]
        setOpponents(data)
        if (!myTeamId && data.length > 0) setMyTeamId(data[0].user_team_id)
      }
      setLoadingOpponents(false)
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const fid = params.get('folder')
    if (fid) setSelectedFolderId(fid)
    const m = params.get('mode')
    if (m === 'myteam' || m === 'opponent') setMode(m)
    const f = params.get('focus')
    if (f) setFocusArea(f as FocusArea)
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const buildBody = useCallback(() => {
    const currentFolder = opponents.find(f => f.id === selectedFolderIdRef.current)
    return {
      teamId:           modeRef.current === 'myteam'
                          ? (myTeamIdRef.current ?? undefined)
                          : (currentFolder?.user_team_id ?? undefined),
      folderId:         modeRef.current === 'opponent' ? (selectedFolderIdRef.current || undefined) : undefined,
      focusArea:        focusAreaRef.current,
      mode:             modeRef.current,
      playerName:       focusAreaRef.current === 'player' ? selectedPlayerRef.current : undefined,
      mapName:          (focusAreaRef.current === 'strategy' || focusAreaRef.current === 'executes')
                          ? selectedMapRef.current : undefined,
      includeProDataset: modeRef.current === 'opponent' ? includeProDatasetRef.current : false,
    }
  }, [opponents])

  const sendMessage = useCallback((userMessage: string) => {
    if (!userMessage.trim() || isLoading) return
    lastSentMessageRef.current = userMessage.trim()
    setIsContextOpen(false)
    append(
      { role: 'user', content: userMessage.trim() },
      { body: buildBody() }
    )
    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = '36px'
    }
  }, [isLoading, append, buildBody, setInput])

  const retryLastMessage = useCallback(() => {
    const text = lastSentMessageRef.current
    if (!text) return
    setMessages(prev => {
      const idx = [...prev].reverse().findIndex(m => m.role === 'user' && m.content === text)
      if (idx === -1) return prev
      return prev.slice(0, prev.length - 1 - idx)
    })
    append({ role: 'user', content: text }, { body: buildBody() })
  }, [append, buildBody, setMessages])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const activeFocusAreas   = mode === 'myteam' ? MY_TEAM_FOCUS_AREAS : OPPONENT_FOCUS_AREAS
  const suggestedQuestions  = mode === 'myteam' ? MY_TEAM_QUESTIONS   : OPPONENT_QUESTIONS
  const availablePlayers: string[] = (selectedFolder?.aggregated_stats as { top_players?: { name: string }[] } | null)
    ?.top_players?.map(p => p.name) ?? []

  const isEmpty     = messages.length === 0 && !isLoading
  const lastMsg     = messages[messages.length - 1]
  const isThinking  = isLoading && (!lastMsg || lastMsg.role === 'user')

  const followUpKey    = `${mode}/${focusArea}`
  const followUpChips  = FOLLOW_UP_PROMPTS[followUpKey] ?? []
  const showFollowUps  = !isLoading && !error && lastMsg?.role === 'assistant' && followUpChips.length > 0

  const sidebarStyle: React.CSSProperties = {
    background: 'var(--panel)',
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflowY: 'auto',
    flexShrink: 0,
    width: 260,
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* ── Left sidebar ── */}
      <div
        style={sidebarStyle}
        className={cn(
          'md:flex',
          isContextOpen
            ? 'fixed inset-0 z-40 flex flex-col md:relative md:inset-auto'
            : 'hidden md:flex'
        )}
      >
        {/* Mobile close */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Scout Settings</span>
          <button onClick={() => setIsContextOpen(false)} style={{ color: 'var(--muted)' }}>
            <X size={16} />
          </button>
        </div>

        {/* Header */}
        <div style={{ padding: '16px 14px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          {/* Title row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'color-mix(in srgb, var(--win) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--win) 25%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Brain size={13} style={{ color: 'var(--win)' }} />
            </div>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>AI Scout</span>
            <span style={{ marginLeft: 'auto', padding: '2px 7px', borderRadius: 5, background: 'color-mix(in srgb, var(--win) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--win) 25%, transparent)', fontSize: 10, fontWeight: 700, color: 'var(--win)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>Llama 3.3</span>
          </div>

          {/* Mode toggle */}
          <div style={{ display: 'flex', gap: 3, padding: 3, borderRadius: 9, background: 'var(--bg)', border: '1px solid var(--border)' }}>
            {(['opponent', 'myteam'] as const).map(m => {
              const active = mode === m
              return (
                <button
                  key={m}
                  onClick={() => { setMode(m); setFocusArea('general'); setMessages([]) }}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                    padding: '6px 8px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    background: active ? 'color-mix(in srgb, var(--win) 10%, var(--card))' : 'transparent',
                    color: active ? 'var(--win)' : 'var(--muted)',
                    border: active ? '1px solid color-mix(in srgb, var(--win) 22%, transparent)' : '1px solid transparent',
                    transition: 'all 0.13s',
                  }}
                >
                  {m === 'opponent' ? <Target size={11} /> : <Shield size={11} />}
                  {m === 'opponent' ? 'Opponent' : 'My Team'}
                </button>
              )
            })}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '14px 14px', display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>

          {/* Opponent selector */}
          {mode === 'opponent' && (
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--faint)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 7 }}>Opponent</p>
              {loadingOpponents ? (
                <div style={{ height: 36, background: 'var(--elevated)', borderRadius: 8 }} className="animate-pulse" />
              ) : opponents.length === 0 ? (
                <div style={{ borderRadius: 9, border: '1px solid var(--border)', background: 'var(--card)', padding: '10px 12px', fontSize: 12, color: 'var(--muted)' }}>
                  No opponents yet —{' '}
                  <a href="/opponents" style={{ color: 'var(--win)' }}>upload a demo first</a>
                </div>
              ) : (
                <select
                  value={selectedFolderId}
                  onChange={e => { setSelectedFolderId(e.target.value); setSelectedPlayer('') }}
                  style={{ width: '100%', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: 12, color: 'var(--text)', outline: 'none' }}
                >
                  <option value="">Select an opponent…</option>
                  {opponents.map(f => (
                    <option key={f.id} value={f.id}>{f.opponent_display_name}</option>
                  ))}
                </select>
              )}

              {selectedFolder && (
                <div style={{ marginTop: 7, padding: '8px 10px', borderRadius: 8, background: 'color-mix(in srgb, var(--win) 5%, var(--card))', border: '1px solid color-mix(in srgb, var(--win) 18%, transparent)', fontSize: 12 }}>
                  <p style={{ fontWeight: 600, color: 'var(--win)' }}>{selectedFolder.opponent_display_name}</p>
                  <p style={{ color: 'var(--muted)', marginTop: 2 }}>
                    {(selectedFolder.aggregated_stats as { total_matches?: number } | null)?.total_matches ?? 0} matches ·{' '}
                    {Math.round(((selectedFolder.aggregated_stats as { win_rate?: number } | null)?.win_rate ?? 0) * 100)}% win rate
                  </p>
                </div>
              )}
            </div>
          )}

          {/* My team banner */}
          {mode === 'myteam' && (
            <div style={{ padding: '9px 11px', borderRadius: 9, background: 'color-mix(in srgb, var(--win) 5%, var(--card))', border: '1px solid color-mix(in srgb, var(--win) 18%, transparent)', fontSize: 12 }}>
              <p style={{ fontWeight: 600, color: 'var(--win)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Shield size={11} /> My Team Analysis
              </p>
              <p style={{ color: 'var(--muted)', marginTop: 3, lineHeight: 1.5 }}>
                AI will analyse your own demos to help you improve.
              </p>
            </div>
          )}

          {/* Focus area */}
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--faint)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 7 }}>Focus Area</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {activeFocusAreas.map(area => {
                const active = focusArea === area.id
                return (
                  <button
                    key={area.id}
                    onClick={() => setFocusArea(area.id)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                      padding: '8px 10px', borderRadius: 9, cursor: 'pointer', textAlign: 'left',
                      background: active ? 'color-mix(in srgb, var(--win) 8%, var(--card))' : 'transparent',
                      border: active ? '1px solid color-mix(in srgb, var(--win) 22%, transparent)' : '1px solid transparent',
                      transition: 'all 0.12s',
                    }}
                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'var(--hairline)' }}
                    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                  >
                    <span style={{ color: active ? 'var(--win)' : 'var(--faint)', flexShrink: 0 }}>{area.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: active ? 'var(--win)' : 'var(--text)', truncate: true }}>{area.label}</p>
                      <p style={{ fontSize: 10, color: 'var(--faint)', marginTop: 1 }}>{area.description}</p>
                    </div>
                    {active && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--win)', flexShrink: 0 }} />}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Player selector */}
          {mode === 'opponent' && focusArea === 'player' && (
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--faint)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 7 }}>Player</p>
              {availablePlayers.length > 0 ? (
                <select
                  value={selectedPlayer}
                  onChange={e => setSelectedPlayer(e.target.value)}
                  style={{ width: '100%', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: 12, color: 'var(--text)', outline: 'none' }}
                >
                  <option value="">All players…</option>
                  {availablePlayers.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              ) : (
                <p style={{ fontSize: 11, color: 'var(--faint)' }}>
                  {selectedFolder ? 'No player data yet.' : 'Select an opponent to see their players.'}
                </p>
              )}
            </div>
          )}

          {/* Map selector */}
          {(focusArea === 'strategy' || focusArea === 'executes') && (
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--faint)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 7 }}>Map</p>
              <select
                value={selectedMap}
                onChange={e => setSelectedMap(e.target.value)}
                style={{ width: '100%', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: 12, color: 'var(--text)', outline: 'none' }}
              >
                <option value="">Any map</option>
                {CS2_MAPS.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          )}

          {/* Playbook CTA */}
          {(focusArea === 'strategy' || focusArea === 'executes') && (
            <button
              onClick={() => {
                const params = new URLSearchParams()
                if (selectedMap) params.set('map', selectedMap)
                if (myTeamId)    params.set('team', myTeamId)
                router.push(`/playbook?${params.toString()}`)
              }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 11px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                background: 'color-mix(in srgb, var(--win) 5%, var(--card))',
                border: '1px solid color-mix(in srgb, var(--win) 22%, transparent)',
                transition: 'all 0.12s',
              }}
            >
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'color-mix(in srgb, var(--win) 12%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <BookOpen size={13} style={{ color: 'var(--win)' }} />
              </div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--win)' }}>Build a Playbook</p>
                <p style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                  {selectedMap ? `Create a ${selectedMap} playbook` : 'Create a structured playbook with AI'}
                </p>
              </div>
            </button>
          )}

          {/* Pro dataset toggle */}
          {mode === 'opponent' && (
            <button
              onClick={() => setIncludeProDataset(v => !v)}
              style={{
                width: '100%', display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '10px 11px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                background: includeProDataset ? 'color-mix(in srgb, var(--signal) 6%, var(--card))' : 'var(--card)',
                border: `1px solid ${includeProDataset ? 'color-mix(in srgb, var(--signal) 28%, transparent)' : 'var(--border)'}`,
                transition: 'all 0.12s',
              }}
            >
              <div style={{ width: 28, height: 28, borderRadius: 8, background: includeProDataset ? 'color-mix(in srgb, var(--signal) 15%, transparent)' : 'var(--elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                <Database size={13} style={{ color: includeProDataset ? 'var(--signal)' : 'var(--faint)' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: includeProDataset ? 'var(--signal)' : 'var(--text)' }}>Pro Dataset Insights</p>
                  {/* Toggle pill */}
                  <div style={{ width: 28, height: 16, borderRadius: 8, background: includeProDataset ? 'var(--signal)' : 'var(--elevated)', flexShrink: 0, position: 'relative', transition: 'background 0.12s' }}>
                    <div style={{ position: 'absolute', top: 2, left: includeProDataset ? 12 : 2, width: 12, height: 12, borderRadius: '50%', background: '#fff', transition: 'left 0.12s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                  </div>
                </div>
                <p style={{ fontSize: 10, color: 'var(--faint)', marginTop: 3, lineHeight: 1.5 }}>Cross-reference pro meta from a public dataset.</p>
              </div>
            </button>
          )}
          {includeProDataset && mode === 'opponent' && (
            <div style={{ padding: '8px 10px', borderRadius: 8, background: 'color-mix(in srgb, var(--signal) 4%, transparent)', border: '1px solid color-mix(in srgb, var(--signal) 15%, transparent)', marginTop: -10 }}>
              <p style={{ fontSize: 10, color: 'var(--signal)', lineHeight: 1.6, opacity: 0.8 }}>
                AI will reference pro-level meta from the{' '}
                <a href="https://huggingface.co/datasets/blanchon/opencs2_dataset" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  OpenCS2 dataset <ExternalLink size={9} />
                </a>{' '}
                (200k+ pro matches).
              </p>
            </div>
          )}
        </div>

        {/* Active context footer */}
        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <p style={{ fontSize: 10, color: 'var(--faint)', marginBottom: 6 }}>Active context</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {mode === 'myteam' ? (
              <Badge variant="neon" className="text-xs">My Team</Badge>
            ) : selectedFolder ? (
              <Badge variant="neon" className="text-xs">{selectedFolder.opponent_display_name}</Badge>
            ) : (
              <span style={{ fontSize: 10, color: 'var(--faint)', padding: '2px 7px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--elevated)' }}>No opponent selected</span>
            )}
            <span style={{ fontSize: 10, color: 'var(--muted)', padding: '2px 7px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--elevated)', textTransform: 'capitalize' }}>{focusArea}</span>
            {mode === 'opponent' && includeProDataset && (
              <span style={{ fontSize: 10, color: 'var(--signal)', padding: '2px 7px', borderRadius: 5, border: '1px solid color-mix(in srgb, var(--signal) 28%, transparent)', background: 'color-mix(in srgb, var(--signal) 8%, transparent)' }}>Pro data</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Chat + Insights wrapper ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minWidth: 0 }}>

        {/* ── Chat panel ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)', minWidth: 0 }}>

          {/* Chat header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--panel)', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => setIsContextOpen(true)}
                className="md:hidden"
                style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--muted)', marginRight: 4 }}
              >
                <SlidersHorizontal size={13} />
                Settings
              </button>
              <MessageSquare size={14} style={{ color: 'var(--win)' }} className="hidden md:block" />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }} className="hidden md:block">
                {mode === 'myteam' ? 'My Team' : selectedFolder ? selectedFolder.opponent_display_name : 'AI Coach'}
              </span>
              {(selectedFolder || mode === 'myteam') && (
                <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'capitalize' }} className="hidden md:block">· {focusArea}</span>
              )}
            </div>
            <button
              onClick={() => { setMessages([]); setInput('') }}
              style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--muted)', padding: '5px 9px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', transition: 'all 0.12s' }}
              onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = 'var(--text)'}
              onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = 'var(--muted)'}
            >
              <RotateCcw size={11} />
              <span className="hidden sm:inline">New Session</span>
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {isEmpty ? (
              /* Empty state */
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', padding: '48px 24px' }}>
                <div style={{ position: 'relative', width: 64, height: 64, borderRadius: 18, background: 'color-mix(in srgb, var(--win) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--win) 20%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, boxShadow: '0 0 24px color-mix(in srgb, var(--win) 12%, transparent)' }}>
                  <Brain size={28} style={{ color: 'var(--win)' }} />
                  <div style={{ position: 'absolute', inset: 0, borderRadius: 18, background: 'color-mix(in srgb, var(--win) 5%, transparent)' }} className="animate-ping opacity-20" />
                </div>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-display)', marginBottom: 6 }}>
                  {mode === 'myteam'
                    ? 'My Team Coach Ready'
                    : selectedFolder ? `Studying ${selectedFolder.opponent_display_name}` : 'AI Scout Ready'}
                </h2>
                <p style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 340, marginBottom: 28, lineHeight: 1.6 }}>
                  {mode === 'myteam'
                    ? "Ask anything about your team's performance — weaknesses, executes, practice plans, and strategy."
                    : selectedFolder
                      ? `Ask anything about ${selectedFolder.opponent_display_name} — tendencies, anti-strats, key players, map reads.`
                      : "Select an opponent you've uploaded demos for, then ask for scouting reports and anti-strats."}
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, width: '100%', maxWidth: 480 }}>
                  {suggestedQuestions.map(q => (
                    <button
                      key={q.label}
                      onClick={() => sendMessage(q.prompt)}
                      disabled={isLoading}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 9, padding: '12px 14px', textAlign: 'left',
                        background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, cursor: 'pointer',
                        fontSize: 12, color: 'var(--muted)', transition: 'all 0.12s',
                      }}
                      onMouseEnter={e => {
                        const b = e.currentTarget as HTMLButtonElement
                        b.style.borderColor = 'color-mix(in srgb, var(--win) 28%, transparent)'
                        b.style.color = 'var(--text)'
                      }}
                      onMouseLeave={e => {
                        const b = e.currentTarget as HTMLButtonElement
                        b.style.borderColor = 'var(--border)'
                        b.style.color = 'var(--muted)'
                      }}
                    >
                      <Zap size={12} style={{ color: 'var(--win)', flexShrink: 0 }} />
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.label}</span>
                      <ChevronRight size={12} style={{ color: 'var(--faint)', flexShrink: 0 }} />
                    </button>
                  ))}
                </div>

                {mode === 'opponent' && !selectedFolder && opponents.length > 0 && (
                  <p style={{ fontSize: 11, color: 'var(--faint)', marginTop: 18, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <ChevronDown size={11} style={{ transform: 'rotate(90deg)' }} />
                    Pick an opponent in the left panel to get personalised scouting
                  </p>
                )}
                {mode === 'opponent' && opponents.length === 0 && !loadingOpponents && (
                  <a href="/opponents" style={{ marginTop: 18, fontSize: 12, color: 'var(--win)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Target size={12} />
                    Upload your first opponent demo →
                  </a>
                )}
              </div>
            ) : (
              <>
                {messages.map((msg, i) => {
                  const isLast    = i === messages.length - 1
                  const streaming = isLoading && isLast && msg.role === 'assistant'
                  const replayInvocations = (msg.toolInvocations ?? []).filter(
                    inv => inv.toolName === 'showRoundReplay'
                  )

                  return (
                    <div key={msg.id} style={{ marginBottom: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
                        {msg.role === 'assistant' ? (
                          <div style={{ width: 32, height: 32, borderRadius: 10, background: 'color-mix(in srgb, var(--win) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--win) 25%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginBottom: 2 }}>
                            <Brain size={14} style={{ color: 'var(--win)' }} />
                          </div>
                        ) : (
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--elevated)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginBottom: 2 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)' }}>You</span>
                          </div>
                        )}
                        <div style={{
                          maxWidth: '78%', borderRadius: 16, padding: '12px 16px',
                          ...(msg.role === 'user'
                            ? { background: 'color-mix(in srgb, var(--win) 8%, var(--card))', border: '1px solid color-mix(in srgb, var(--win) 18%, transparent)', borderBottomRightRadius: 4 }
                            : { background: 'var(--card)', border: '1px solid var(--border)', borderBottomLeftRadius: 4 }
                          ),
                        }}>
                          {msg.role === 'assistant' ? (
                            <>
                              <MarkdownContent content={msg.content} />
                              {streaming && (
                                <span style={{ display: 'inline-block', width: 8, height: 16, background: 'var(--win)', marginLeft: 3, borderRadius: 2, verticalAlign: 'middle' }} className="animate-pulse" />
                              )}
                            </>
                          ) : (
                            <p style={{ fontSize: 13, color: 'var(--text)' }}>{msg.content}</p>
                          )}
                          {msg.createdAt && (
                            <p style={{ fontSize: 10, color: 'var(--faint)', marginTop: 6 }}>
                              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          )}
                        </div>
                      </div>

                      {replayInvocations.length > 0 && (
                        <div style={{ paddingLeft: 42, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {replayInvocations.map(inv => {
                            if (inv.state === 'result') {
                              const r = inv.result as Record<string, unknown>
                              if (r.error) return (
                                <p key={inv.toolCallId} style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}>
                                  Replay unavailable: {String(r.error)}
                                </p>
                              )
                              return (
                                <ChatRoundReplay
                                  key={inv.toolCallId}
                                  round={r.round as React.ComponentProps<typeof ChatRoundReplay>['round']}
                                  players={r.players as React.ComponentProps<typeof ChatRoundReplay>['players']}
                                  team1Name={String(r.team1Name)}
                                  team2Name={String(r.team2Name)}
                                  mapName={String(r.mapName)}
                                  roundNumber={Number(r.roundNumber)}
                                  description={String(r.description)}
                                />
                              )
                            }
                            return (
                              <div key={inv.toolCallId} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--muted)' }}>
                                <Loader2 size={11} style={{ color: 'var(--win)' }} className="animate-spin" />
                                Loading replay…
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Follow-up chips */}
                {showFollowUps && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingLeft: 42, paddingBottom: 8 }}>
                    {followUpChips.map(chip => (
                      <button
                        key={chip.label}
                        onClick={() => sendMessage(chip.prompt)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 20,
                          fontSize: 11, fontWeight: 500, cursor: 'pointer',
                          border: '1px solid color-mix(in srgb, var(--win) 22%, transparent)',
                          color: 'var(--muted)', background: 'color-mix(in srgb, var(--win) 4%, transparent)',
                          transition: 'all 0.12s',
                        }}
                        onMouseEnter={e => {
                          const b = e.currentTarget as HTMLButtonElement
                          b.style.color = 'var(--win)'
                          b.style.borderColor = 'color-mix(in srgb, var(--win) 45%, transparent)'
                        }}
                        onMouseLeave={e => {
                          const b = e.currentTarget as HTMLButtonElement
                          b.style.color = 'var(--muted)'
                          b.style.borderColor = 'color-mix(in srgb, var(--win) 22%, transparent)'
                        }}
                      >
                        <Sparkles size={9} style={{ color: 'var(--win)', flexShrink: 0 }} />
                        {chip.label}
                      </button>
                    ))}
                  </div>
                )}

                {isThinking && (
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 16 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: 'color-mix(in srgb, var(--win) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--win) 25%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Brain size={14} style={{ color: 'var(--win)' }} />
                    </div>
                    <div className="rv-panel" style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center', height: 16 }}>
                        {[0, 1, 2].map(i => (
                          <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--win)', animationDelay: `${i * 150}ms` }} className="animate-bounce" />
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {error && !isLoading && (
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 16 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,107,122,0.15)', border: '1px solid rgba(255,107,122,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <AlertCircle size={14} style={{ color: 'var(--loss)' }} />
                    </div>
                    <div style={{ background: 'var(--card)', border: '1px solid rgba(255,107,122,0.28)', borderRadius: 16, borderBottomLeftRadius: 4, padding: '12px 16px', maxWidth: '75%' }}>
                      <p style={{ fontSize: 13, color: 'var(--loss)' }}>
                        {error.message?.includes('Unauthorized')
                          ? 'Not authorised — please refresh the page and try again.'
                          : error.message?.includes('API key') || error.message?.includes('not configured')
                            ? 'Groq API key not configured — add GROQ_API_KEY in Railway variables.'
                            : error.message && error.message.trim().length > 0 && error.message.trim().length < 200
                              ? error.message.trim()
                              : 'Something went wrong. Please try again.'}
                      </p>
                      <button
                        onClick={retryLastMessage}
                        style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--loss)', padding: '4px 9px', border: '1px solid rgba(255,107,122,0.3)', borderRadius: 7, background: 'transparent', cursor: 'pointer' }}
                      >
                        <RefreshCw size={10} />
                        Retry
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div style={{ borderTop: '1px solid var(--border)', background: 'var(--panel)', padding: '12px 16px', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, padding: '8px 10px 8px 14px', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--card)', transition: 'border-color 0.12s' }}
              onFocusCapture={e => (e.currentTarget as HTMLDivElement).style.borderColor = 'color-mix(in srgb, var(--win) 38%, transparent)'}
              onBlurCapture={e => (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'}
            >
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
                  mode === 'myteam'
                    ? "Ask about your team's performance, weaknesses, or strategy…"
                    : selectedFolder
                      ? `Ask about ${selectedFolder.opponent_display_name}…`
                      : 'Ask anything about CS2 tactics, or select an opponent for personalised scouting…'
                }
                disabled={isLoading}
                rows={1}
                style={{ flex: 1, background: 'transparent', fontSize: 13, color: 'var(--text)', resize: 'none', outline: 'none', minHeight: 36, maxHeight: 160, paddingTop: 6, paddingBottom: 6 }}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isLoading}
                style={{
                  width: 36, height: 36, borderRadius: 9, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: input.trim() && !isLoading ? 'linear-gradient(180deg, var(--win), color-mix(in srgb, var(--win) 75%, #000))' : 'var(--elevated)',
                  border: 'none', cursor: input.trim() && !isLoading ? 'pointer' : 'default',
                  transition: 'all 0.12s',
                }}
              >
                {isLoading ? <Loader2 size={14} style={{ color: 'var(--muted)' }} className="animate-spin" /> : <Send size={14} style={{ color: input.trim() ? '#0a1a12' : 'var(--faint)' }} />}
              </button>
            </div>
            <p style={{ fontSize: 10, color: 'var(--faint)', textAlign: 'center', marginTop: 7 }}>
              {mode === 'myteam'
                ? "Analysing your team's own demos for self-improvement coaching"
                : selectedFolder
                  ? `Analysing demos from your ${selectedFolder.opponent_display_name} folder`
                  : 'Select an opponent folder for personalised anti-strats and scouting reports'}
            </p>
          </div>
        </div>

        {/* ── Insights panel ── */}
        <div style={{ width: 300, minWidth: 300, borderLeft: '1px solid var(--border)', background: 'var(--panel)', overflowY: 'auto', padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 10 }} className="hidden lg:flex">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Insights</p>
            {messages.length > 0 && (
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 5, padding: '2px 6px', fontFamily: 'var(--font-mono)' }}>
                {Math.max(0, messages.filter(m => m.role === 'assistant').length)}
              </span>
            )}
          </div>
          {[
            { title: 'Mid-control weakness', text: 'The opponent consistently fails to hold mid on Mirage CT-side, often over-rotating. Exploit with quick mid-pushes or splits.' },
            { title: 'Eco round force pattern', text: 'Expect aggressive force buys with MP9s and Deagles on eco rounds. They stack A-site or push Underpass to disrupt B executes.' },
            { title: 'AWP positioning tendency', text: 'Primary AWPer favors Connector and Ticket Booth on Mirage CT-side. Flashing these angles early can neutralize their impact.' },
          ].map((insight, i) => (
            <div key={i} style={{ padding: '13px 14px', borderRadius: 13, position: 'relative', overflow: 'hidden', border: '1px solid color-mix(in srgb, var(--signal) 22%, transparent)', background: `radial-gradient(300px 180px at 10% -20%, color-mix(in srgb, var(--signal) 9%, transparent), transparent 60%), var(--card)` }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 5, background: 'color-mix(in srgb, var(--signal) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--signal) 28%, transparent)', fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, color: 'var(--signal)', letterSpacing: '0.06em', marginBottom: 9 }}>
                ✦ AI INSIGHT
              </span>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{insight.title}</p>
              <p style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.6 }}>{insight.text}</p>
              <button style={{ marginTop: 9, fontSize: 11, color: 'var(--signal)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                View full analysis →
              </button>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
