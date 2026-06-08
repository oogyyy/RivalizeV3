'use client'

import { useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn, formatDate, formatDuration, getRatingColor } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import PlayerStatsTable from '@/components/demos/PlayerStatsTable'
import { ReparseProgress } from '@/components/demos/ReparseProgress'
import RoundTimeline from '@/components/demos/RoundTimeline'
import HeatmapCanvas from '@/components/demos/HeatmapCanvas'
import ReplayCanvas from '@/components/demos/ReplayCanvas'
import dynamic from 'next/dynamic'
import DemoInlineChat from '@/components/demos/DemoInlineChat'
import AiMatchReport from '@/components/demos/AiMatchReport'
import { useFullParsedDemo } from '@/components/demos/useFullParsedDemo'

const Replay3DCanvas = dynamic(
  () => import('@/components/demos/Replay3DCanvas'),
  { ssr: false, loading: () => <div className="h-[460px] flex items-center justify-center bg-[#070a16] rounded-lg"><Loader2 size={24} className="text-neon-green animate-spin" /></div> }
)
import { MAP_THUMBS } from '@/lib/map-config'
import {
  Trophy, Crosshair, Target, Shield, Zap, TrendingUp,
  BarChart3, Map, Clock, Brain, ArrowLeft, RefreshCw,
  Loader2, ArrowRight, ChevronDown, ChevronUp, Copy, Check,
  Play, Box,
} from 'lucide-react'
import Link from 'next/link'
import type { Demo, ParsedDemoData, PlayerStats } from '@/types/database'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'

type Tab = 'overview' | 'players' | 'rounds' | 'heatmap' | 'economy' | 'replay' | '3d' | 'ai'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview',  label: 'Overview',       icon: <BarChart3 size={14} /> },
  { id: 'players',   label: 'Player Stats',   icon: <Crosshair size={14} /> },
  { id: 'rounds',    label: 'Round Timeline', icon: <Clock size={14} /> },
  { id: 'heatmap',   label: 'Heatmap',        icon: <Map size={14} /> },
  { id: 'economy',   label: 'Economy',        icon: <TrendingUp size={14} /> },
  { id: 'replay',    label: '2D Replay',      icon: <Play size={14} /> },
  { id: '3d',        label: '3D Replay',      icon: <Box size={14} /> },
  { id: 'ai',        label: 'AI Report',      icon: <Brain size={14} /> },
]

const AI_ACTIONS = [
  {
    focus: 'weakness',
    icon: <TrendingUp size={16} className="text-red-400" />,
    bg: 'bg-red-500/10 border-red-500/20',
    title: 'Identify Weak Spots',
    description: 'Find recurring mistakes and areas to improve from this match',
  },
  {
    focus: 'executes',
    icon: <Zap size={16} className="text-yellow-400" />,
    bg: 'bg-yellow-500/10 border-yellow-500/20',
    title: 'Improve Executes',
    description: 'Review execute quality, utility usage, and timings',
  },
  {
    focus: 'rounds',
    icon: <BarChart3 size={16} className="text-blue-400" />,
    bg: 'bg-blue-500/10 border-blue-500/20',
    title: 'Round Review',
    description: 'Analyse clutches, eco plays, and late-round decisions',
  },
  {
    focus: 'drills',
    icon: <Crosshair size={16} className="text-purple-400" />,
    bg: 'bg-purple-500/10 border-purple-500/20',
    title: 'Practice Recommendations',
    description: 'Personalised drill suggestions based on this match',
  },
]

function StatPill({ label, value, color = 'text-foreground' }: {
  label: string; value: string | number; color?: string
}) {
  return (
    <div className="bg-muted/20 rounded-lg border border-border p-4 text-center">
      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      <p className={cn('text-2xl font-bold font-mono', color)}>{value}</p>
    </div>
  )
}

function MatchBanner({
  parsed, myTeamLabel, opponentLabel, myScore, theirScore,
}: {
  parsed: ParsedDemoData
  myTeamLabel: string
  opponentLabel: string
  myScore: number
  theirScore: number
}) {
  const isWin  = myScore > theirScore
  const isDraw = myScore === theirScore
  const h = parsed.header

  const thumbUrl = MAP_THUMBS[h.map]

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card">
      {thumbUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbUrl}
          alt={h.map}
          className="absolute inset-0 w-full h-full object-cover opacity-[0.12] pointer-events-none select-none"
        />
      )}
      <div className="absolute inset-0 pointer-events-none">
        <div className={cn(
          'absolute top-0 left-0 w-full h-full',
          isWin  ? 'bg-gradient-to-br from-neon-green/10 via-transparent to-transparent' :
          isDraw ? 'bg-gradient-to-br from-yellow-400/10 via-transparent to-transparent' :
                   'bg-gradient-to-br from-red-500/10 via-transparent to-transparent',
        )} />
        <div className="absolute inset-0 bg-gradient-to-t from-card/80 via-transparent to-card/40" />
      </div>
      <div className="relative p-6">
        <div className="flex items-center justify-center gap-3 mb-6">
          <Badge variant="outline" className="font-mono text-xs gap-1">
            <Map size={11} />
            {h.map}
          </Badge>
          {parsed.header && (
            <Badge variant="outline" className="font-mono text-xs">
              {h.total_rounds} rounds
            </Badge>
          )}
          <Badge
            variant={isWin ? 'neon' : isDraw ? 'secondary' : 'destructive'}
            className="text-xs font-semibold uppercase tracking-wide"
          >
            {isWin ? 'Victory' : isDraw ? 'Draw' : 'Defeat'}
          </Badge>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex-1 text-center">
            <div className={cn(
              'inline-flex items-center justify-center w-14 h-14 rounded-full mb-3 border',
              isWin  ? 'bg-neon-green/20 border-neon-green/40' :
              isDraw ? 'bg-yellow-400/20 border-yellow-400/40' :
                       'bg-red-400/20 border-red-400/40',
            )}>
              <Shield size={22} className={isWin ? 'text-neon-green' : isDraw ? 'text-yellow-400' : 'text-red-400'} />
            </div>
            <p className="font-bold text-lg text-foreground truncate">{myTeamLabel}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Your team</p>
          </div>

          <div className="text-center shrink-0">
            <div className="flex items-center gap-3">
              <span className={cn(
                'text-6xl font-black font-mono',
                isWin  ? 'text-neon-green' :
                isDraw ? 'text-yellow-400'  :
                         'text-red-400',
              )}>{myScore}</span>
              <span className="text-3xl text-muted-foreground font-bold">:</span>
              <span className="text-6xl font-black font-mono text-muted-foreground">{theirScore}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 uppercase tracking-widest">Final score</p>
          </div>

          <div className="flex-1 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-muted/40 border border-border mb-3">
              <Target size={22} className="text-muted-foreground" />
            </div>
            <p className="font-bold text-lg text-foreground truncate">{opponentLabel}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Opponent</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function avg(players: PlayerStats[], key: keyof PlayerStats): number {
  if (!players.length) return 0
  return players.reduce((s, p) => s + (p[key] as number), 0) / players.length
}
function sum(players: PlayerStats[], key: keyof PlayerStats): number {
  return players.reduce((s, p) => s + (p[key] as number), 0)
}

function OverviewTab({
  parsed, myTeamLabel, opponentLabel, myRawTeam, oppRawTeam, myScore, theirScore,
}: {
  parsed: ParsedDemoData
  myTeamLabel: string
  opponentLabel: string
  myRawTeam: string
  oppRawTeam: string
  myScore: number
  theirScore: number
}) {
  const myPlayers  = (parsed.players ?? []).filter(p => p.team === myRawTeam)
  const oppPlayers = (parsed.players ?? []).filter(p => p.team === oppRawTeam)

  const mvp = [...myPlayers].sort((a, b) => b.rating - a.rating)[0]
  const topFrag = [...myPlayers].sort((a, b) => b.kills - a.kills)[0]
  const topAdr  = [...myPlayers].sort((a, b) => b.adr - a.adr)[0]

  const isWin  = myScore > theirScore
  const isDraw = myScore === theirScore

  return (
    <div className="space-y-6">
      {/* Team performance stats */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield size={16} className="text-neon-green" />
            Your Team Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatPill
              label="Avg Rating"
              value={avg(myPlayers, 'rating').toFixed(2)}
              color={getRatingColor(avg(myPlayers, 'rating'))}
            />
            <StatPill label="Avg ADR" value={avg(myPlayers, 'adr').toFixed(1)} />
            <StatPill
              label="Team K/D"
              value={(sum(myPlayers, 'kills') / Math.max(sum(myPlayers, 'deaths'), 1)).toFixed(2)}
            />
            <StatPill label="Avg KAST%" value={`${avg(myPlayers, 'kast').toFixed(1)}%`} />
            <StatPill label="Avg HS%" value={`${avg(myPlayers, 'headshot_percentage').toFixed(1)}%`} />
          </div>
        </CardContent>
      </Card>

      {/* Standout performers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {mvp && (
          <Card className="border-neon-green/20 bg-neon-green/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Trophy size={14} className="text-neon-green" />
                <span className="text-xs font-semibold text-neon-green uppercase tracking-wider">MVP</span>
              </div>
              <p className="font-bold text-foreground text-lg truncate">{mvp.name}</p>
              <p className={cn('text-3xl font-black font-mono mt-2', getRatingColor(mvp.rating))}>
                {mvp.rating.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground mb-1">Rating</p>
              <p className="text-sm text-muted-foreground">{mvp.kills}K / {mvp.deaths}D / {mvp.assists}A</p>
              <p className="text-sm text-muted-foreground">ADR {mvp.adr.toFixed(1)} · HS {mvp.headshot_percentage.toFixed(2)}%</p>
            </CardContent>
          </Card>
        )}

        {topFrag && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Crosshair size={14} className="text-yellow-400" />
                <span className="text-xs font-semibold text-yellow-400 uppercase tracking-wider">Top Fragger</span>
              </div>
              <p className="font-bold text-foreground text-lg truncate">{topFrag.name}</p>
              <p className="text-3xl font-black font-mono mt-2 text-yellow-400">{topFrag.kills}</p>
              <p className="text-xs text-muted-foreground mb-1">Kills</p>
              <p className="text-sm text-muted-foreground">K/D {(topFrag.kills / Math.max(topFrag.deaths, 1)).toFixed(2)} · ADR {topFrag.adr.toFixed(1)}</p>
              <p className="text-sm text-muted-foreground">HS {topFrag.headshot_percentage.toFixed(2)}% · Rating {topFrag.rating.toFixed(2)}</p>
            </CardContent>
          </Card>
        )}

        {topAdr && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap size={14} className="text-blue-400" />
                <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Top ADR</span>
              </div>
              <p className="font-bold text-foreground text-lg truncate">{topAdr.name}</p>
              <p className="text-3xl font-black font-mono mt-2 text-blue-400">{topAdr.adr.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground mb-1">ADR</p>
              <p className="text-sm text-muted-foreground">Rating {topAdr.rating.toFixed(2)} · KAST {topAdr.kast.toFixed(1)}%</p>
              <p className="text-sm text-muted-foreground">{topAdr.kills}K / {topAdr.deaths}D / {topAdr.assists}A</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Us vs them comparison */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Target size={16} className="text-neon-green" />
            Your Team vs Opponent
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className={cn('font-semibold truncate', isWin ? 'text-neon-green' : isDraw ? 'text-yellow-400' : 'text-red-400')}>
              {myTeamLabel}
            </span>
            <span className="text-muted-foreground text-xs mx-2">vs</span>
            <span className="font-semibold text-muted-foreground truncate text-right">{opponentLabel}</span>
          </div>
          {([
            { label: 'Avg Rating', v1: avg(myPlayers, 'rating'), v2: avg(oppPlayers, 'rating'), fmt: (n: number) => n.toFixed(2) },
            { label: 'Total Kills', v1: sum(myPlayers, 'kills'), v2: sum(oppPlayers, 'kills'), fmt: (n: number) => String(n) },
            { label: 'Avg ADR', v1: avg(myPlayers, 'adr'), v2: avg(oppPlayers, 'adr'), fmt: (n: number) => n.toFixed(1) },
            { label: 'Avg HS%', v1: avg(myPlayers, 'headshot_percentage'), v2: avg(oppPlayers, 'headshot_percentage'), fmt: (n: number) => `${n.toFixed(1)}%` },
          ] as const).map(row => {
            const total = row.v1 + row.v2
            const pct = total > 0 ? (row.v1 / total) * 100 : 50
            const winning = row.v1 >= row.v2
            return (
              <div key={row.label} className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className={cn('font-mono font-semibold', winning ? 'text-neon-green' : 'text-foreground')}>{row.fmt(row.v1)}</span>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">{row.label}</span>
                  <span className={cn('font-mono font-semibold', !winning ? 'text-red-400' : 'text-foreground')}>{row.fmt(row.v2)}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden flex">
                  <div
                    className={cn('h-full rounded-l-full transition-all duration-700', winning ? 'bg-neon-green' : 'bg-red-400')}
                    style={{ width: `${pct}%` }}
                  />
                  <div className="h-full bg-muted-foreground/30 flex-1 rounded-r-full" />
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatPill label="Total Rounds" value={parsed.header.total_rounds} />
        <StatPill label="Duration" value={formatDuration(parsed.header.duration)} />
        <StatPill label="Your Kills" value={sum(myPlayers, 'kills')} />
        <StatPill label="Your Deaths" value={sum(myPlayers, 'deaths')} />
      </div>
    </div>
  )
}

function EconomyTab({ parsed, myTeamLabel, opponentLabel, myRawTeam, oppRawTeam }: {
  parsed: ParsedDemoData
  myTeamLabel: string
  opponentLabel: string
  myRawTeam: string
  oppRawTeam: string
}) {
  const h = parsed.header
  const rounds = parsed.rounds ?? []

  // Map raw team names to team1/team2 economy keys in the round data
  const myKey   = myRawTeam  === h.team1 ? 'team1_economy' : 'team2_economy'
  const oppKey  = oppRawTeam === h.team1 ? 'team1_economy' : 'team2_economy'

  const chartData = rounds.map(r => ({
    round: r.number,
    'Your Team':  (r as any)[myKey]  ?? 0,
    'Opponent':   (r as any)[oppKey] ?? 0,
  }))

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-card border border-border rounded-lg p-3 text-xs shadow-xl">
        <p className="text-muted-foreground mb-2">Round {label}</p>
        {payload.map((entry: any) => (
          <div key={entry.name} className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
            <span className="text-foreground">{entry.name}:</span>
            <span className="font-mono">${entry.value?.toLocaleString()}</span>
          </div>
        ))}
      </div>
    )
  }

  const myEcos  = rounds.map(r => (r as any)[myKey]  ?? 0)
  const oppEcos = rounds.map(r => (r as any)[oppKey] ?? 0)
  const avgArr  = (a: number[]) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0
  const maxArr  = (a: number[]) => a.length ? Math.max(...a) : 0

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp size={16} className="text-neon-green" />
            Economy by Round
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="myEco" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#00ff87" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#00ff87" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="oppEco" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#ff3860" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ff3860" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="round" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="Your Team" stroke="#00ff87" strokeWidth={2} fill="url(#myEco)"  dot={false} />
              <Area type="monotone" dataKey="Opponent"  stroke="#ff3860" strokeWidth={2} fill="url(#oppEco)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatPill label="Your Avg Eco"  value={`$${Math.round(avgArr(myEcos)).toLocaleString()}`}  color="text-neon-green" />
        <StatPill label="Your Peak Eco" value={`$${Math.round(maxArr(myEcos)).toLocaleString()}`}  color="text-neon-green" />
        <StatPill label="Opp Avg Eco"   value={`$${Math.round(avgArr(oppEcos)).toLocaleString()}`} color="text-muted-foreground" />
        <StatPill label="Opp Peak Eco"  value={`$${Math.round(maxArr(oppEcos)).toLocaleString()}`} color="text-muted-foreground" />
      </div>
    </div>
  )
}

interface Props {
  demo: Demo
}

export default function MyTeamDemoPageClient({ demo: initialDemo }: Props) {
  const searchParams = useSearchParams()
  const fromPugs = searchParams?.get('from') === 'pugs'

  const [demo, setDemo]     = useState<Demo>(initialDemo)
  const [parsing, setParsing] = useState(false)
  const [reparsing, setReparsing] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [debugOpen, setDebugOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const fetchDemo = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.from('demos').select('*').eq('id', demo.id).single()
    if (data) setDemo(data as Demo)
  }, [demo.id])

  const handleReparse = async () => {
    setParsing(true)
    try {
      const res = await fetch(`/api/demos/${demo.id}/reparse`, { method: 'POST' })
      if (res.ok) setReparsing(true)
    } finally {
      setParsing(false)
    }
  }

  const handleReparseDone = useCallback(async () => {
    await fetchDemo()
    setReparsing(false)
  }, [fetchDemo])

  const parsed = demo.parsed_data as ParsedDemoData | null
  const replayData = useFullParsedDemo(demo.id, parsed, activeTab === 'replay' || activeTab === '3d')
  const replayParsed = replayData.parsed ?? parsed

  // Derive which team label is ours
  const opponentSide  = ((parsed as any)?.opponentSide ?? 'team2') as 'team1' | 'team2'
  const h             = parsed?.header
  // Raw names from the parser — used for data lookups (player.team, round.winner, economy keys)
  const myRawTeam   = opponentSide === 'team1' ? (h?.team2 ?? '') : (h?.team1 ?? '')
  const oppRawTeam  = opponentSide === 'team1' ? (h?.team1 ?? '') : (h?.team2 ?? '')
  // Display labels — fall back to generic strings when parser stored 'T-Side'/'CT-Side'
  const resolveLabel = (raw: string, fallback: string) =>
    (!raw || raw === 'T-Side' || raw === 'CT-Side') ? fallback : raw
  const myTeamLabel   = resolveLabel(myRawTeam,  'Your Team')
  const opponentLabel = resolveLabel(oppRawTeam, 'Opponent')
  let myScore       = opponentSide === 'team1' ? (h?.score_team2 ?? 0)    : (h?.score_team1 ?? 0)
  let theirScore    = opponentSide === 'team1' ? (h?.score_team1 ?? 0)    : (h?.score_team2 ?? 0)

  // Fallback for demos parsed before the win_reason fix: if stored scores are
  // both 0 but rounds exist, derive scores from the win_reason strings.
  if (myScore === 0 && theirScore === 0 && parsed?.rounds?.length) {
    const T_WIN  = new Set(['ct_killed', 'bomb_exploded', 'target_bombed', 'terrorists_win'])
    const CT_WIN = new Set(['t_killed', 'bomb_defused', 'hostage_rescued', 'cts_win', 'time_expired'])
    const half = 12
    let s1 = 0, s2 = 0
    for (let i = 0; i < parsed.rounds.length; i++) {
      const reason = parsed.rounds[i].win_reason
      const tWon = T_WIN.has(reason) ? true : CT_WIN.has(reason) ? false : null
      if (tWon === null) continue
      const isSecondHalf = i >= half
      if (!isSecondHalf) { if (tWon) s1++; else s2++ }
      else               { if (tWon) s2++; else s1++ }
    }
    if (s1 > 0 || s2 > 0) {
      myScore    = opponentSide === 'team1' ? s2 : s1
      theirScore = opponentSide === 'team1' ? s1 : s2
    }
  }

  const isWin         = myScore > theirScore
  const isDraw        = myScore === theirScore

  const myPlayers = (parsed?.players ?? []).filter(p => p.team === myRawTeam)

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top nav */}
      <div className="flex items-center justify-between">
        <Link href={fromPugs ? '/improve' : '/my-team'}>
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft size={14} />
            {fromPugs ? 'Back to My Demos' : 'Back to My Team'}
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          {demo.status === 'processing' && <Badge variant="processing">Processing…</Badge>}
          {demo.status === 'failed'     && <Badge variant="destructive">Failed</Badge>}
          {demo.status === 'completed'  && (
            <Badge variant={isWin ? 'neon' : isDraw ? 'secondary' : 'destructive'}>
              {isWin ? 'Win' : isDraw ? 'Draw' : 'Loss'}
            </Badge>
          )}
          <Button
            variant="outline" size="sm" className="gap-2"
            onClick={handleReparse} disabled={parsing || reparsing}
          >
            {parsing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {parsing ? 'Parsing…' : 'Re-parse'}
          </Button>
          <Link href={`/ai-coach?mode=myteam&demo=${demo.id}`}>
            <Button variant="neon" size="sm" className="gap-2">
              <Brain size={14} />
              AI Analyst
            </Button>
          </Link>
        </div>
      </div>

      {reparsing && (
        <ReparseProgress demoId={demo.id} onDone={handleReparseDone} />
      )}

      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {h?.map ? (
            <>
              <span className="text-neon-green font-mono">{h.map.replace('de_', '').replace('cs_', '')}</span>
              {' '}
              <span className="text-muted-foreground font-normal text-lg">
                {myScore}–{theirScore}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">Untitled Demo</span>
          )}
        </h1>
        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
          {demo.match_date && <span>{formatDate(demo.match_date)}</span>}
          {h?.map && <span className="font-mono text-xs">{h.map}</span>}
          <span className="capitalize">{demo.status}</span>
        </div>
      </div>

      {/* Debug panel */}
      <div className="border border-border rounded-lg overflow-hidden">
        <button
          onClick={() => setDebugOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/20 hover:bg-muted/40 transition-colors text-sm text-muted-foreground"
        >
          <span className="font-mono text-xs uppercase tracking-wider">Debug — Raw parsed_data</span>
          {debugOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {debugOpen && (
          <div className="relative">
            <button
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(demo.parsed_data, null, 2))
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              }}
              className="absolute top-2 right-2 z-10 flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-muted/60 hover:bg-muted border border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {copied ? <Check size={12} className="text-neon-green" /> : <Copy size={12} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <pre className="p-4 overflow-auto max-h-96 text-xs font-mono text-muted-foreground bg-black/30 whitespace-pre-wrap break-all">
              {JSON.stringify(demo.parsed_data, null, 2) ?? 'null'}
            </pre>
          </div>
        )}
      </div>

      {!parsed ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <BarChart3 size={28} className="text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-foreground">
                {demo.status === 'processing' ? 'Demo is being processed…' : 'No analysis data yet'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {demo.status === 'processing'
                  ? 'This usually takes a few seconds. Refresh to check.'
                  : 'Click Re-parse to analyse this demo.'}
              </p>
            </div>
            <Button variant="neon" onClick={handleReparse} disabled={parsing} className="gap-2">
              {parsing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {parsing ? 'Parsing…' : 'Parse Demo'}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <MatchBanner
            parsed={parsed}
            myTeamLabel={myTeamLabel}
            opponentLabel={opponentLabel}
            myScore={myScore}
            theirScore={theirScore}
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main content — full-width on 3D tab to accommodate the inline chat split */}
            <div className={cn(activeTab === '3d' ? 'lg:col-span-3' : 'lg:col-span-2', 'space-y-4')}>
              {/* Tabs */}
              <div className="flex gap-1 p-1 bg-muted/30 rounded-lg border border-border flex-wrap">
                {TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition-all duration-150',
                      activeTab === tab.id
                        ? 'bg-card text-neon-green border border-neon-green/20 shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="min-h-[400px]">
                {activeTab === 'overview' && (
                  <OverviewTab
                    parsed={parsed}
                    myTeamLabel={myTeamLabel}
                    opponentLabel={opponentLabel}
                    myRawTeam={myRawTeam}
                    oppRawTeam={oppRawTeam}
                    myScore={myScore}
                    theirScore={theirScore}
                  />
                )}

                {activeTab === 'players' && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Crosshair size={16} className="text-neon-green" />
                        Your Team — Player Statistics
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <PlayerStatsTable
                        players={myPlayers}
                        highlightTeam={myRawTeam}
                      />
                    </CardContent>
                  </Card>
                )}

                {activeTab === 'rounds' && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Clock size={16} className="text-neon-green" />
                        Round Timeline
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <RoundTimeline
                        rounds={parsed.rounds ?? []}
                        team1Name={myRawTeam}
                        team2Name={oppRawTeam}
                        team1DisplayName={myTeamLabel}
                        team2DisplayName={opponentLabel}
                      />
                    </CardContent>
                  </Card>
                )}

                {activeTab === 'heatmap' && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Map size={16} className="text-neon-green" />
                        Position Heatmap — Your Team
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {parsed.heatmap_data && parsed.heatmap_data.length > 0 ? (
                        <div className="flex justify-center">
                          <HeatmapCanvas
                            points={parsed.heatmap_data}
                            mapName={parsed.header.map}
                            team1Name={myRawTeam}
                            team2Name={oppRawTeam}
                            width={512}
                            height={512}
                          />
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                          <Map size={32} className="text-muted-foreground" />
                          <p className="text-muted-foreground">No heatmap data available for this demo</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {activeTab === 'economy' && (
                  <EconomyTab
                    parsed={parsed}
                    myTeamLabel={myTeamLabel}
                    opponentLabel={opponentLabel}
                    myRawTeam={myRawTeam}
                    oppRawTeam={oppRawTeam}
                  />
                )}

                {activeTab === 'replay' && replayParsed && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Play size={16} className="text-neon-green" />
                        2D Kill Replay
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {replayData.loading && (
                        <p className="text-xs text-muted-foreground mb-3">Loading movement data...</p>
                      )}
                      {replayData.error && (
                        <p className="text-xs text-amber-400 mb-3">{replayData.error}</p>
                      )}
                      <ReplayCanvas
                        rounds={replayParsed.rounds ?? []}
                        players={replayParsed.players ?? []}
                        team1Name={myRawTeam}
                        team2Name={oppRawTeam}
                        mapName={replayParsed.header.map}
                      />
                    </CardContent>
                  </Card>
                )}

                {activeTab === '3d' && replayParsed && (
                  <div className="flex flex-col lg:flex-row gap-4 items-start">
                    <div className="w-full lg:flex-1 min-w-0">
                      <Replay3DCanvas
                        mapName={replayParsed.header.map}
                        parsed={replayParsed}
                        team1={replayParsed.header.team1}
                        team2={replayParsed.header.team2}
                      />
                    </div>
                    <div className="w-full lg:w-[340px] lg:shrink-0 h-[548px]">
                      <DemoInlineChat
                        mode="myteam"
                        teamId={demo.team_id}
                        mapName={parsed.header.map}
                      />
                    </div>
                  </div>
                )}

                {activeTab === 'ai' && (
                  <AiMatchReport demoId={demo.id} />
                )}
              </div>
            </div>

            {/* Right sidebar: hidden when 3D tab is active (chat is inline there) */}
            <div className={cn('space-y-4', activeTab === '3d' && 'hidden')}>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Brain size={16} className="text-neon-green" />
                    AI Analyst
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                    Analyse this specific match to find patterns, improve your team's execution, and build your playbook.
                  </p>
                  {AI_ACTIONS.map(action => (
                    <Link
                      key={action.focus}
                      href={`/ai-coach?mode=myteam&focus=${action.focus}&demo=${demo.id}`}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-lg border transition-all group',
                        action.bg,
                        'hover:brightness-110',
                      )}
                    >
                      <div className="shrink-0">{action.icon}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{action.title}</p>
                        <p className="text-xs text-muted-foreground leading-tight mt-0.5">{action.description}</p>
                      </div>
                      <ArrowRight size={14} className="text-muted-foreground group-hover:text-foreground shrink-0 transition-colors" />
                    </Link>
                  ))}
                </CardContent>
              </Card>

              {/* Quick stats sidebar */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider">Match Info</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-0 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Map</span>
                    <span className="font-mono text-foreground">{h?.map ?? '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Score</span>
                    <span className={cn('font-mono font-semibold', isWin ? 'text-neon-green' : isDraw ? 'text-yellow-400' : 'text-red-400')}>
                      {myScore}–{theirScore}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Result</span>
                    <span className={cn('font-semibold', isWin ? 'text-neon-green' : isDraw ? 'text-yellow-400' : 'text-red-400')}>
                      {isWin ? 'Win' : isDraw ? 'Draw' : 'Loss'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Rounds</span>
                    <span className="font-mono text-foreground">{h?.total_rounds ?? '—'}</span>
                  </div>
                  {demo.match_date && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Date</span>
                      <span className="text-foreground">{formatDate(demo.match_date)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Your Side</span>
                    <span className="font-mono text-foreground text-xs">{myTeamLabel}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
