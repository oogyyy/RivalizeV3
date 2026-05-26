'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
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
  BookOpen,
} from 'lucide-react'
import type { TeamFolder } from '@/types/database'
import { CS2_MAPS } from '@/types/database'
import dynamic from 'next/dynamic'

const ChatRoundReplay = dynamic(() => import('@/components/demos/ChatRoundReplay'), { ssr: false })

type Mode = 'opponent' | 'myteam'
type FocusArea = 'general' | 'weakness' | 'antistrat' | 'strategy' | 'player' | 'executes' | 'rounds' | 'drills'

const OPPONENT_FOCUS_AREAS: { id: FocusArea; label: string; icon: React.ReactNode; description: string }[] = [
  { id: 'general',   label: 'Scouting Report', icon: <Brain size={14} />,     description: 'Full opponent overview' },
  { id: 'weakness',  label: 'Weak Spots',       icon: <Target size={14} />,    description: 'Exploitable patterns' },
  { id: 'antistrat', label: 'Anti-Strat',        icon: <Shield size={14} />,    description: 'Counter their strategies' },
  { id: 'strategy',  label: 'Match Prep',        icon: <Crosshair size={14} />, description: 'Map-specific counter-plays' },
  { id: 'player',    label: 'Player Focus',      icon: <Users size={14} />,     description: 'Opponent player deep-dive' },
]

const MY_TEAM_FOCUS_AREAS: { id: FocusArea; label: string; icon: React.ReactNode; description: string }[] = [
  { id: 'general',  label: 'Team Overview',   icon: <Brain size={14} />,     description: 'Strengths, weaknesses, roadmap' },
  { id: 'weakness', label: 'Weak Spots',      icon: <Target size={14} />,    description: 'Patterns costing you rounds' },
  { id: 'executes', label: 'Executes',        icon: <Crosshair size={14} />, description: 'Improve execute quality' },
  { id: 'rounds',   label: 'Round Review',    icon: <BarChart3 size={14} />, description: 'Key rounds deep-dive' },
  { id: 'drills',   label: 'Practice Drills', icon: <Sparkles size={14} />, description: 'Tailored drill recommendations' },
  { id: 'strategy', label: 'Playbook',        icon: <Shield size={14} />,    description: 'Build your team playbook' },
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
    if (line.startsWith('## '))  return <h2 key={i} className="text-base font-bold text-[#00ffc8] mt-5 mb-2">{line.slice(3)}</h2>
    if (line.startsWith('# '))   return <h1 key={i} className="text-xl font-bold text-foreground mt-5 mb-3">{line.slice(2)}</h1>
    if (line.startsWith('- ') || line.startsWith('* ')) {
      return (
        <div key={i} className="flex gap-2 my-0.5">
          <span className="text-[#00ffc8] mt-1.5 shrink-0 text-xs">▸</span>
          <span>{renderInline(line.slice(2))}</span>
        </div>
      )
    }
    const numbered = line.match(/^(\d+)\.\s(.+)/)
    if (numbered) {
      return (
        <div key={i} className="flex gap-2 my-0.5">
          <span className="text-[#00ffc8] shrink-0 font-mono text-xs min-w-[1.2rem]">{numbered[1]}.</span>
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
    if (part.startsWith('`') && part.endsWith('`'))     return <code key={i} className="px-1 py-0.5 bg-muted rounded text-xs font-mono text-[#00ffc8]">{part.slice(1, -1)}</code>
    return part
  })
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-3 mb-4">
      <div className="w-8 h-8 rounded-xl bg-[rgba(0,255,200,0.12)] border border-[rgba(0,255,200,0.25)] flex items-center justify-center shrink-0">
        <Brain size={14} className="text-[#00ffc8]" />
      </div>
      <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-3">
        <div className="flex gap-1 items-center h-4">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-[#00ffc8] animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
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

  // Refs so the sendMessage closure always reads the latest context values
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

  // useChat handles all streaming — append() sends messages with per-call body overrides
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

  // Fetch user's own teams for myteam mode
  useEffect(() => {
    fetch('/api/teams')
      .then(r => r.ok ? r.json() : [])
      .then((teams: Array<{ id: string }>) => {
        if (teams.length > 0) setMyTeamId(teams[0].id)
      })
      .catch(() => {})
  }, [])

  // Fetch opponent folders
  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/opponents')
      if (res.ok) {
        const data = (await res.json()) as TeamFolder[]
        setOpponents(data)
        // Fallback team ID from opponents if teams API returned nothing
        if (!myTeamId && data.length > 0) setMyTeamId(data[0].user_team_id)
      }
      setLoadingOpponents(false)
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Read URL params
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

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // Build context body from current refs (called inside sendMessage so it always reads latest)
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
    // Strip the failed user message so append doesn't duplicate it
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
  // useChat streams into the last assistant message live — show cursor while loading and last msg is assistant
  const lastMsg     = messages[messages.length - 1]
  const isThinking  = isLoading && (!lastMsg || lastMsg.role === 'user')

  const followUpKey    = `${mode}/${focusArea}`
  const followUpChips  = FOLLOW_UP_PROMPTS[followUpKey] ?? []
  const showFollowUps  = !isLoading && !error && lastMsg?.role === 'assistant' && followUpChips.length > 0

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left panel: Context sidebar ── */}
      <div
        className={cn(
          'shrink-0 border-r border-border bg-[hsl(228,22%,8%)] flex flex-col h-full overflow-y-auto',
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
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-7 h-7 rounded-lg bg-[rgba(0,255,200,0.12)] border border-[rgba(0,255,200,0.25)] flex items-center justify-center">
              <Brain size={14} className="text-[#00ffc8]" />
            </div>
            <h1 className="text-[13px] font-bold text-foreground tracking-wide">AI Scout</h1>
            <Badge variant="neon" className="text-[10px] ml-auto">Llama 3.3</Badge>
          </div>
          {/* Mode toggle */}
          <div className="flex rounded-lg border border-border bg-[hsl(228,25%,6%)] p-0.5 gap-0.5">
            <button
              onClick={() => { setMode('opponent'); setFocusArea('general'); setMessages([]) }}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium transition-all',
                mode === 'opponent'
                  ? 'bg-[rgba(0,255,200,0.1)] text-[#00ffc8] border border-[rgba(0,255,200,0.2)]'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Target size={12} />
              Opponent
            </button>
            <button
              onClick={() => { setMode('myteam'); setFocusArea('general'); setMessages([]) }}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium transition-all',
                mode === 'myteam'
                  ? 'bg-[rgba(0,255,200,0.1)] text-[#00ffc8] border border-[rgba(0,255,200,0.2)]'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Shield size={12} />
              My Team
            </button>
          </div>
        </div>

        <div className="p-4 space-y-5 flex-1">
          {/* Opponent selector */}
          {mode === 'opponent' && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                Opponent
              </label>
              {loadingOpponents ? (
                <div className="h-9 bg-muted/30 rounded-md animate-pulse" />
              ) : opponents.length === 0 ? (
                <div className="rounded-md border border-border bg-background/50 px-3 py-2.5 text-xs text-muted-foreground">
                  No opponents yet —{' '}
                  <a href="/opponents" className="text-neon-green hover:underline">upload a demo first</a>
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
                <div className="mt-2 p-2.5 bg-[rgba(0,255,200,0.05)] rounded-md border border-[rgba(0,255,200,0.2)] text-xs">
                  <p className="text-[#00ffc8] font-semibold">{selectedFolder.opponent_display_name}</p>
                  <p className="text-muted-foreground mt-0.5">
                    {(selectedFolder.aggregated_stats as { total_matches?: number } | null)?.total_matches ?? 0} matches ·{' '}
                    {Math.round(((selectedFolder.aggregated_stats as { win_rate?: number } | null)?.win_rate ?? 0) * 100)}% win rate
                  </p>
                </div>
              )}
            </div>
          )}

          {/* My team indicator */}
          {mode === 'myteam' && (
            <div className="p-2.5 bg-[rgba(0,255,200,0.05)] rounded-md border border-[rgba(0,255,200,0.2)] text-xs">
              <p className="text-[#00ffc8] font-semibold flex items-center gap-1.5">
                <Shield size={11} /> My Team Analysis
              </p>
              <p className="text-muted-foreground mt-0.5">
                AI will analyse your own demos to help you improve.
              </p>
            </div>
          )}

          {/* Focus area */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
              Focus Area
            </label>
            <div className="space-y-1.5">
              {activeFocusAreas.map(area => (
                <button
                  key={area.id}
                  onClick={() => setFocusArea(area.id)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm font-medium transition-all text-left',
                    focusArea === area.id
                      ? 'bg-[rgba(0,255,200,0.08)] text-[#00ffc8] border border-[rgba(0,255,200,0.2)]'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent border border-transparent'
                  )}
                >
                  <span className={focusArea === area.id ? 'text-[#00ffc8]' : 'text-muted-foreground'}>
                    {area.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="truncate">{area.label}</p>
                    <p className="text-xs text-muted-foreground truncate font-normal">{area.description}</p>
                  </div>
                  {focusArea === area.id && <div className="w-1.5 h-1.5 rounded-full bg-[#00ffc8] shrink-0" />}
                </button>
              ))}
            </div>
          </div>

          {/* Player selector */}
          {mode === 'opponent' && focusArea === 'player' && (
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
                  {selectedFolder ? 'No player data yet.' : 'Select an opponent to see their players.'}
                </p>
              )}
            </div>
          )}

          {/* Map selector */}
          {(focusArea === 'strategy' || focusArea === 'executes') && (
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

          {/* Playbook builder CTA */}
          {(focusArea === 'strategy' || focusArea === 'executes') && (
            <div className="border-t border-border pt-4">
              <button
                onClick={() => {
                  const params = new URLSearchParams()
                  if (selectedMap) params.set('map', selectedMap)
                  if (myTeamId)    params.set('team', myTeamId)
                  router.push(`/playbook?${params.toString()}`)
                }}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-[rgba(0,255,200,0.25)] bg-[rgba(0,255,200,0.05)] hover:border-[rgba(0,255,200,0.45)] hover:bg-[rgba(0,255,200,0.08)] text-left transition-all group"
              >
                <div className="w-7 h-7 rounded flex items-center justify-center shrink-0 bg-[rgba(0,255,200,0.12)] group-hover:bg-[rgba(0,255,200,0.18)] transition-colors">
                  <BookOpen size={13} className="text-[#00ffc8]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[#00ffc8]">Build a Playbook</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {selectedMap ? `Create a saved ${selectedMap} playbook` : 'Create a structured playbook with AI'}
                  </p>
                </div>
                <ChevronRight size={13} className="text-[#00ffc8]/50 group-hover:text-[#00ffc8] group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>
            </div>
          )}

          {/* Pro dataset toggle */}
          {mode === 'opponent' && (
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
          )}
        </div>

        {/* Active context summary */}
        <div className="p-4 border-t border-border">
          <p className="text-xs text-muted-foreground mb-1">Active context</p>
          <div className="flex flex-wrap gap-1">
            {mode === 'myteam' ? (
              <Badge variant="neon" className="text-xs">My Team</Badge>
            ) : selectedFolder ? (
              <Badge variant="neon" className="text-xs">{selectedFolder.opponent_display_name}</Badge>
            ) : (
              <Badge variant="outline" className="text-xs text-muted-foreground">No opponent selected</Badge>
            )}
            <Badge variant="secondary" className="text-xs capitalize">{focusArea}</Badge>
            {mode === 'opponent' && includeProDataset && (
              <Badge className="text-xs bg-blue-500/20 text-blue-300 border-blue-500/30">Pro data</Badge>
            )}
          </div>
        </div>
      </div>

      {/* ── Right panel: Chat ── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-background min-w-0">
        {/* Chat header */}
        <div className="flex items-center justify-between px-4 md:px-5 py-3 border-b border-border bg-[hsl(229,23%,9%)] shrink-0">
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
            <MessageSquare size={16} className="text-[#00ffc8] hidden md:block" />
            <div className="hidden md:flex items-baseline gap-1.5">
              <span className="text-sm font-semibold text-foreground">
                {mode === 'myteam' ? 'My Team' : selectedFolder ? selectedFolder.opponent_display_name : 'AI Coach'}
              </span>
              <span className="text-xs text-muted-foreground capitalize">· {focusArea}</span>
            </div>
            <span className="text-sm font-medium text-foreground md:hidden">
              {messages.length === 0 ? 'AI Scout' : `${messages.length} messages`}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setMessages([]); setInput('') }}
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <RotateCcw size={13} />
            <span className="hidden sm:inline">New Session</span>
          </Button>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-1">
          {isEmpty ? (
            /* ── Welcome / empty state ── */
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <div className="relative w-16 h-16 rounded-2xl bg-[rgba(0,255,200,0.1)] border border-[rgba(0,255,200,0.2)] flex items-center justify-center mb-5 shadow-[0_0_24px_rgba(0,255,200,0.1)]">
                <Brain size={28} className="text-[#00ffc8]" />
                <div className="absolute inset-0 rounded-2xl bg-[rgba(0,255,200,0.05)] animate-ping opacity-20" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-1.5">
                {mode === 'myteam'
                  ? 'My Team Coach Ready'
                  : selectedFolder ? `Studying ${selectedFolder.opponent_display_name}` : 'AI Scout Ready'}
              </h2>
              <p className="text-muted-foreground text-sm max-w-sm mb-8 leading-relaxed">
                {mode === 'myteam'
                  ? "Ask anything about your team's performance — weaknesses, executes, practice plans, and strategy."
                  : selectedFolder
                    ? `Ask anything about ${selectedFolder.opponent_display_name} — tendencies, anti-strats, key players, map reads.`
                    : "Select an opponent you've uploaded demos for, then ask for scouting reports and anti-strats."}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                {suggestedQuestions.map(q => (
                  <button
                    key={q.label}
                    onClick={() => sendMessage(q.prompt)}
                    disabled={isLoading}
                    className={cn(
                      'flex items-center gap-2.5 p-3.5 text-left rounded-xl border border-border bg-card',
                      'text-[13px] text-muted-foreground hover:text-foreground hover:border-[rgba(0,255,200,0.25)] hover:bg-[rgba(0,255,200,0.04)]',
                      'transition-all duration-150 group disabled:opacity-50 disabled:cursor-not-allowed',
                    )}
                  >
                    <Sparkles size={13} className="text-[#00ffc8] shrink-0" />
                    <span className="flex-1 min-w-0 truncate">{q.label}</span>
                    <ChevronRight size={13} className="text-muted-foreground/40 group-hover:text-[#00ffc8] group-hover:translate-x-0.5 transition-all shrink-0" />
                  </button>
                ))}
              </div>

              {mode === 'opponent' && !selectedFolder && opponents.length > 0 && (
                <p className="text-xs text-muted-foreground mt-5 flex items-center gap-1">
                  <ChevronDown size={12} className="rotate-90" />
                  Pick an opponent in the left panel to get personalised scouting
                </p>
              )}
              {mode === 'opponent' && opponents.length === 0 && !loadingOpponents && (
                <a href="/opponents" className="mt-5 text-xs text-neon-green hover:underline flex items-center gap-1">
                  <Target size={12} />
                  Upload your first opponent demo →
                </a>
              )}
            </div>
          ) : (
            /* ── Conversation ── */
            <>
              {messages.map((msg, i) => {
                const isLast    = i === messages.length - 1
                const streaming = isLoading && isLast && msg.role === 'assistant'

                // Extract any showRoundReplay tool invocations from this message
                const replayInvocations = (msg.toolInvocations ?? []).filter(
                  inv => inv.toolName === 'showRoundReplay'
                )

                return (
                  <div key={msg.id} className="mb-4">
                    <div className={cn('flex items-end gap-3', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
                      {msg.role === 'assistant' ? (
                        <div className="w-8 h-8 rounded-xl bg-[rgba(0,255,200,0.12)] border border-[rgba(0,255,200,0.25)] flex items-center justify-center shrink-0 mb-0.5">
                          <Brain size={14} className="text-[#00ffc8]" />
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
                            ? 'bg-[rgba(0,255,200,0.08)] border border-[rgba(0,255,200,0.18)] rounded-br-sm'
                            : 'bg-card border border-border rounded-bl-sm shadow-[0_2px_8px_rgba(0,0,0,0.3)]'
                        )}
                      >
                        {msg.role === 'assistant' ? (
                          <>
                            <MarkdownContent content={msg.content} />
                            {streaming && (
                              <span className="inline-block w-2 h-4 bg-neon-green ml-0.5 animate-pulse rounded-sm" />
                            )}
                          </>
                        ) : (
                          <p className="text-sm text-foreground">{msg.content}</p>
                        )}
                        {msg.createdAt && (
                          <p className="text-xs text-muted-foreground mt-2 select-none">
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Inline round replays — shown below the message bubble, aligned with it */}
                    {replayInvocations.length > 0 && (
                      <div className="pl-11 mt-2 flex flex-col gap-2">
                        {replayInvocations.map(inv => {
                          if (inv.state === 'result') {
                            const r = inv.result as Record<string, unknown>
                            if (r.error) return (
                              <p key={inv.toolCallId} className="text-xs text-muted-foreground italic">
                                Replay unavailable: {String(r.error)}
                              </p>
                            )
                            return (
                              <ChatRoundReplay
                                key={inv.toolCallId}
                                round={r.round as Parameters<typeof ChatRoundReplay>[0]['round']}
                                players={r.players as Parameters<typeof ChatRoundReplay>[0]['players']}
                                team1Name={String(r.team1Name)}
                                team2Name={String(r.team2Name)}
                                mapName={String(r.mapName)}
                                roundNumber={Number(r.roundNumber)}
                                description={String(r.description)}
                              />
                            )
                          }
                          // Tool is being called — show a small spinner
                          return (
                            <div key={inv.toolCallId} className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Loader2 size={11} className="animate-spin text-[#00ffc8]" />
                              Loading replay…
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Follow-up suggestion chips */}
              {showFollowUps && (
                <div className="flex flex-wrap gap-2 pl-11 pb-2">
                  {followUpChips.map(chip => (
                    <button
                      key={chip.label}
                      onClick={() => sendMessage(chip.prompt)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all',
                        'border-[rgba(0,255,200,0.2)] text-muted-foreground bg-[rgba(0,255,200,0.04)]',
                        'hover:border-[rgba(0,255,200,0.45)] hover:text-[#00ffc8] hover:bg-[rgba(0,255,200,0.08)]',
                      )}
                    >
                      <Sparkles size={10} className="text-[#00ffc8] shrink-0" />
                      {chip.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Typing indicator — shows while waiting for the first streaming token */}
              {isThinking && <TypingIndicator />}

              {/* Error state with retry */}
              {error && !isLoading && (
                <div className="flex items-end gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-red-400/20 border border-red-400/30 flex items-center justify-center shrink-0">
                    <AlertCircle size={14} className="text-red-400" />
                  </div>
                  <div className="bg-card border border-red-400/30 rounded-2xl rounded-bl-sm px-4 py-3 max-w-[75%]">
                    <p className="text-sm text-red-400">
                      {error.message?.includes('Unauthorized')
                        ? 'Not authorised — please refresh the page and try again.'
                        : error.message?.includes('API key') || error.message?.includes('not configured')
                          ? 'Groq API key not configured — add GROQ_API_KEY in Railway variables.'
                          : error.message && error.message.trim().length > 0 && error.message.trim().length < 200
                            ? error.message.trim()
                            : 'Something went wrong. Please try again.'}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={retryLastMessage}
                      className="mt-2 gap-1.5 text-xs border-red-400/30 text-red-400 hover:border-red-400/60"
                    >
                      <RefreshCw size={11} />
                      Retry
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-border bg-[hsl(229,23%,9%)] p-3 md:p-4 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:pb-4">
          <div className={cn(
            'flex items-end gap-3 p-2 rounded-xl border transition-all duration-150',
            'border-border focus-within:border-[rgba(0,255,200,0.4)] focus-within:shadow-[0_0_0_3px_rgba(0,255,200,0.08)]'
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
                mode === 'myteam'
                  ? "Ask about your team's performance, weaknesses, or strategy…"
                  : selectedFolder
                    ? `Ask about ${selectedFolder.opponent_display_name}…`
                    : 'Ask anything about CS2 tactics, or select an opponent for personalised scouting…'
              }
              disabled={isLoading}
              rows={1}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none min-h-[36px] max-h-40 py-2 px-2 disabled:cursor-not-allowed"
              style={{ height: '36px' }}
            />
            <Button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading}
              size="sm"
              variant="neon"
              className="shrink-0 h-10 w-10 p-0 rounded-lg"
            >
              {isLoading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2">
            {mode === 'myteam'
              ? "Analysing your team's own demos for self-improvement coaching"
              : selectedFolder
                ? `Analysing demos from your ${selectedFolder.opponent_display_name} folder`
                : 'Select an opponent folder for personalised anti-strats and scouting reports'}
          </p>
        </div>
      </div>
    </div>
  )
}
