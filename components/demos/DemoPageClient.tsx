'use client'

import { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn, formatDate, formatDuration, formatPercent, getRatingColor } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import PlayerStatsTable from '@/components/demos/PlayerStatsTable'
import { ReparseProgress } from '@/components/demos/ReparseProgress'
import RoundTimeline from '@/components/demos/RoundTimeline'
import HeatmapCanvas from '@/components/demos/HeatmapCanvas'
import ReplayCanvas from '@/components/demos/ReplayCanvas'
import { MAP_THUMBS } from '@/lib/map-config'

const Replay3DCanvas = dynamic(
  () => import('@/components/demos/Replay3DCanvas'),
  { ssr: false, loading: () => <div className="h-[560px] flex items-center justify-center bg-[#070a16] rounded-lg"><Loader2 size={24} className="text-neon-green animate-spin" /></div> }
)
import {
  Trophy, Crosshair, Target, Shield, Zap, TrendingUp,
  BarChart3, Map, Clock, Brain, ArrowLeft, RefreshCw,
  Loader2, AlertCircle, ChevronUp, ChevronDown, Copy, Check,
  Play, Box,
} from 'lucide-react'
import Link from 'next/link'
import type { Demo, ParsedDemoData, PlayerStats, Round } from '@/types/database'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

type Tab = 'overview' | 'players' | 'rounds' | 'heatmap' | 'economy' | 'replay' | '3d'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview',       icon: <BarChart3 size={14} /> },
  { id: 'players',  label: 'Player Stats',   icon: <Crosshair size={14} /> },
  { id: 'rounds',   label: 'Round Timeline', icon: <Clock size={14} /> },
  { id: 'heatmap',  label: 'Heatmap',        icon: <Map size={14} /> },
  { id: 'economy',  label: 'Economy',        icon: <TrendingUp size={14} /> },
  { id: 'replay',   label: '2D Replay',      icon: <Play size={14} /> },
  { id: '3d',       label: '3D Replay',      icon: <Box size={14} /> },
]

function StatCard({ label, value, sub, color = 'text-foreground' }: {
  label: string
  value: string | number
  sub?: string
  color?: string
}) {
  return (
    <div className="relative bg-card rounded-xl border border-border p-4 overflow-hidden card-hover">
      <div className="absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
      <p className="text-[10px] text-muted-foreground uppercase tracking-[0.14em] font-semibold mb-1.5">{label}</p>
      <p className={cn('text-2xl font-bold font-mono tabular-nums', color)}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground/70 mt-0.5">{sub}</p>}
    </div>
  )
}

function TeamComparisonBar({ label, v1, v2, fmt }: {
  label: string
  v1: number
  v2: number
  fmt?: (n: number) => string
}) {
  const total = v1 + v2
  const pct1 = total > 0 ? (v1 / total) * 100 : 50
  const format = fmt || ((n: number) => n.toString())
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="text-neon-green font-mono font-semibold">{format(v1)}</span>
        <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
        <span className="text-red-400 font-mono font-semibold">{format(v2)}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden flex">
        <div
          className="h-full bg-neon-green rounded-l-full transition-all duration-700"
          style={{ width: `${pct1}%` }}
        />
        <div
          className="h-full bg-red-400 flex-1 rounded-r-full"
        />
      </div>
    </div>
  )
}

// Derive score from win_reason strings for demos parsed before the fix.
function deriveScoresFromRounds(parsed: ParsedDemoData): { s1: number; s2: number } {
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
  return { s1, s2 }
}

function ScoreBanner({ parsed, demo }: { parsed: ParsedDemoData; demo: Demo }) {
  const h = parsed.header
  let score1 = h.score_team1
  let score2 = h.score_team2
  // Fallback for older demos where parser stored 0-0
  if (score1 === 0 && score2 === 0 && parsed.rounds?.length) {
    const { s1, s2 } = deriveScoresFromRounds(parsed)
    if (s1 > 0 || s2 > 0) { score1 = s1; score2 = s2 }
  }
  const team1Won = score1 > score2
  const isDraw = score1 === score2

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
        <div className="absolute top-0 left-0 w-1/2 h-full bg-gradient-to-r from-neon-green/8 to-transparent" />
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-red-500/8 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-card/80 via-transparent to-card/40" />
      </div>

      <div className="relative p-6">
        <div className="flex items-center justify-center gap-3 mb-6">
          <Badge variant="outline" className="font-mono text-xs gap-1">
            <Map size={11} />
            {h.map}
          </Badge>
          {demo.match_date && (
            <Badge variant="outline" className="text-xs gap-1">
              <Clock size={11} />
              {formatDate(demo.match_date)}
            </Badge>
          )}
          <Badge variant="outline" className="font-mono text-xs gap-1">
            <Clock size={11} />
            {formatDuration(h.duration)}
          </Badge>
          <Badge variant="outline" className="text-xs gap-1">
            {h.total_rounds} rounds
          </Badge>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex-1 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-neon-green/20 border border-neon-green/30 mb-3">
              <span className="text-xl font-bold text-neon-green">{h.team1.charAt(0)}</span>
            </div>
            <p className="font-bold text-lg text-foreground truncate">{h.team1}</p>
            {team1Won && (
              <Badge variant="neon" className="mt-1 text-xs">WINNER</Badge>
            )}
          </div>

          <div className="text-center shrink-0">
            <div className="flex items-center gap-3">
              <span className={cn('text-6xl font-black font-mono', team1Won ? 'text-neon-green' : isDraw ? 'text-yellow-400' : 'text-muted-foreground')}>
                {score1}
              </span>
              <span className="text-3xl text-muted-foreground font-bold">:</span>
              <span className={cn('text-6xl font-black font-mono', !team1Won && !isDraw ? 'text-red-400' : isDraw ? 'text-yellow-400' : 'text-muted-foreground')}>
                {score2}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 uppercase tracking-widest">
              {isDraw ? 'Draw' : team1Won ? 'Victory' : 'Defeat'}
            </p>
          </div>

          <div className="flex-1 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-red-400/20 border border-red-400/30 mb-3">
              <span className="text-xl font-bold text-red-400">{h.team2.charAt(0)}</span>
            </div>
            <p className="font-bold text-lg text-foreground truncate">{h.team2}</p>
            {!team1Won && !isDraw && (
              <Badge variant="destructive" className="mt-1 text-xs">WINNER</Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function OverviewTab({ parsed }: { parsed: ParsedDemoData }) {
  const h = parsed.header
  const players = parsed.players || []
  const team1Players = players.filter(p => p.team === h.team1)
  const team2Players = players.filter(p => p.team === h.team2)

  const avgStat = (arr: PlayerStats[], key: keyof PlayerStats) => {
    if (!arr.length) return 0
    return arr.reduce((s, p) => s + (p[key] as number), 0) / arr.length
  }

  const sumStat = (arr: PlayerStats[], key: keyof PlayerStats) =>
    arr.reduce((s, p) => s + (p[key] as number), 0)

  const mvp = [...players].sort((a, b) => b.rating - a.rating)[0]
  const topKills = [...players].sort((a, b) => b.kills - a.kills)[0]
  const topAdr = [...players].sort((a, b) => b.adr - a.adr)[0]

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Target size={16} className="text-neon-green" />
            Team Comparison
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-neon-green truncate">{h.team1}</span>
            <span className="text-sm font-semibold text-red-400 truncate text-right">{h.team2}</span>
          </div>
          <TeamComparisonBar label="Avg Rating" v1={avgStat(team1Players, 'rating')} v2={avgStat(team2Players, 'rating')} fmt={(n) => n.toFixed(2)} />
          <TeamComparisonBar label="Total Kills" v1={sumStat(team1Players, 'kills')} v2={sumStat(team2Players, 'kills')} />
          <TeamComparisonBar label="Avg ADR" v1={avgStat(team1Players, 'adr')} v2={avgStat(team2Players, 'adr')} fmt={(n) => n.toFixed(1)} />
          <TeamComparisonBar label="Avg KAST%" v1={avgStat(team1Players, 'kast')} v2={avgStat(team2Players, 'kast')} fmt={(n) => n.toFixed(1)} />
          <TeamComparisonBar label="HS%" v1={avgStat(team1Players, 'headshot_percentage')} v2={avgStat(team2Players, 'headshot_percentage')} fmt={(n) => n.toFixed(1)} />
          <TeamComparisonBar label="Utility Dmg" v1={sumStat(team1Players, 'utility_damage')} v2={sumStat(team2Players, 'utility_damage')} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {mvp && (
          <Card className="border-neon-green/20 bg-neon-green/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Trophy size={14} className="text-neon-green" />
                <span className="text-xs font-semibold text-neon-green uppercase tracking-wider">MVP</span>
              </div>
              <p className="font-bold text-foreground text-lg">{mvp.name}</p>
              <p className="text-xs text-muted-foreground">{mvp.team}</p>
              <p className={cn('text-2xl font-black font-mono mt-2', getRatingColor(mvp.rating))}>
                {mvp.rating.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">Rating</p>
              <p className="text-sm text-muted-foreground mt-1">
                {mvp.kills}K / {mvp.deaths}D / {mvp.assists}A
              </p>
            </CardContent>
          </Card>
        )}

        {topKills && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Crosshair size={14} className="text-yellow-400" />
                <span className="text-xs font-semibold text-yellow-400 uppercase tracking-wider">Top Fragger</span>
              </div>
              <p className="font-bold text-foreground text-lg">{topKills.name}</p>
              <p className="text-xs text-muted-foreground">{topKills.team}</p>
              <p className="text-2xl font-black font-mono mt-2 text-yellow-400">{topKills.kills}</p>
              <p className="text-xs text-muted-foreground">Kills</p>
              <p className="text-sm text-muted-foreground mt-1">
                ADR: {topKills.adr.toFixed(1)} | HS: {formatPercent(topKills.headshot_percentage)}
              </p>
            </CardContent>
          </Card>
        )}

        {topAdr && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap size={14} className="text-neon-blue" />
                <span className="text-xs font-semibold text-neon-blue uppercase tracking-wider">Top ADR</span>
              </div>
              <p className="font-bold text-foreground text-lg">{topAdr.name}</p>
              <p className="text-xs text-muted-foreground">{topAdr.team}</p>
              <p className="text-2xl font-black font-mono mt-2 text-neon-blue">{topAdr.adr.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">ADR</p>
              <p className="text-sm text-muted-foreground mt-1">
                Rating: {topAdr.rating.toFixed(2)} | KAST: {topAdr.kast.toFixed(1)}%
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Rounds" value={h.total_rounds} />
        <StatCard label="Match Duration" value={formatDuration(h.duration)} />
        <StatCard
          label="Avg Rating"
          value={avgStat(players, 'rating').toFixed(2)}
          color={getRatingColor(avgStat(players, 'rating'))}
        />
        <StatCard
          label="Total Kills"
          value={sumStat(players, 'kills')}
        />
      </div>
    </div>
  )
}

function EconomyTab({ parsed }: { parsed: ParsedDemoData }) {
  const rounds = parsed.rounds || []
  const h = parsed.header

  const chartData = rounds.map(r => ({
    round: r.number,
    [h.team1]: r.team1_economy,
    [h.team2]: r.team2_economy,
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
            <span className="font-mono text-foreground">${entry.value?.toLocaleString()}</span>
          </div>
        ))}
      </div>
    )
  }

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
                <linearGradient id="colorT1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00ff87" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#00ff87" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorT2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ff3860" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ff3860" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="round"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                label={{ value: 'Round', position: 'insideBottom', offset: -2, fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              />
              <YAxis
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: '12px', paddingTop: '16px' }}
                formatter={(value) => <span style={{ color: 'hsl(var(--foreground))' }}>{value}</span>}
              />
              <Area type="monotone" dataKey={h.team1} stroke="#00ff87" strokeWidth={2} fill="url(#colorT1)" dot={false} />
              <Area type="monotone" dataKey={h.team2} stroke="#ff3860" strokeWidth={2} fill="url(#colorT2)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(() => {
          const t1Eco = rounds.map(r => r.team1_economy)
          const t2Eco = rounds.map(r => r.team2_economy)
          const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
          const max = (arr: number[]) => arr.length ? Math.max(...arr) : 0
          return [
            { label: `${h.team1} Avg Eco`, value: `$${Math.round(avg(t1Eco)).toLocaleString()}`, color: 'text-neon-green' },
            { label: `${h.team1} Peak Eco`, value: `$${Math.round(max(t1Eco)).toLocaleString()}`, color: 'text-neon-green' },
            { label: `${h.team2} Avg Eco`, value: `$${Math.round(avg(t2Eco)).toLocaleString()}`, color: 'text-red-400' },
            { label: `${h.team2} Peak Eco`, value: `$${Math.round(max(t2Eco)).toLocaleString()}`, color: 'text-red-400' },
          ]
        })().map(stat => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} color={stat.color} />
        ))}
      </div>
    </div>
  )
}

interface Props {
  demo: Demo
  folderId: string | null
}

export default function DemoPageClient({ demo: initialDemo, folderId }: Props) {
  const [demo, setDemo] = useState<Demo>(initialDemo)
  const [parsing, setParsing] = useState(false)
  const [reparsing, setReparsing] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [debugOpen, setDebugOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const fetchDemo = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('demos')
      .select('*')
      .eq('id', demo.id)
      .single()
    if (data) setDemo(data as Demo)
  }, [demo.id])

  const handleParse = async () => {
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
  const backHref = folderId ? `/opponents/${folderId}` : '/opponents'
  const aiScoutHref = folderId ? `/ai-coach?folder=${folderId}` : '/ai-coach'

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link href={backHref}>
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft size={14} />
            {folderId ? `Back to ${demo.opponent_name}` : 'Back to Opponents'}
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          {demo.status === 'processing' && (
            <Badge variant="processing">Processing...</Badge>
          )}
          {demo.status === 'failed' && (
            <Badge variant="destructive">Failed</Badge>
          )}
          {demo.status === 'completed' && (
            <Badge variant="neon">Analyzed</Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleParse}
            disabled={parsing || reparsing}
          >
            {parsing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {parsing ? 'Parsing...' : demo.status === 'completed' ? 'Re-parse' : 'Parse Now'}
          </Button>
          <Link href={aiScoutHref}>
            <Button variant="neon" size="sm" className="gap-2">
              <Brain size={14} />
              AI Scout
            </Button>
          </Link>
        </div>
      </div>

      {reparsing && (
        <ReparseProgress demoId={demo.id} onDone={handleReparseDone} />
      )}

      <div>
        <h1 className="text-2xl font-bold text-foreground">
          <span className="text-neon-green">{demo.opponent_name}</span>
        </h1>
        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
          <span className="font-mono">{demo.map}</span>
          {demo.match_date && <span>{formatDate(demo.match_date)}</span>}
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
                {demo.status === 'processing' ? 'Demo is being processed...' : 'No analysis data yet'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {demo.status === 'processing'
                  ? 'This usually takes a few seconds. Refresh to check.'
                  : 'Click Parse Now to analyze this demo.'}
              </p>
            </div>
            <Button variant="neon" onClick={handleParse} disabled={parsing} className="gap-2">
              {parsing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {parsing ? 'Parsing...' : 'Parse Demo'}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <ScoreBanner parsed={parsed} demo={demo} />

          <div className="flex gap-0.5 p-1 bg-muted/20 rounded-xl border border-border w-fit shadow-[0_2px_6px_rgba(0,0,0,0.2)]">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-150',
                  activeTab === tab.id
                    ? 'bg-card text-neon-green shadow-[0_1px_4px_rgba(0,0,0,0.3)] border border-neon-green/20'
                    : 'text-muted-foreground/70 hover:text-foreground hover:bg-white/[0.03]'
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          <div className="min-h-[400px]">
            {activeTab === 'overview' && <OverviewTab parsed={parsed} />}

            {activeTab === 'players' && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Crosshair size={16} className="text-neon-green" />
                    Player Statistics
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <PlayerStatsTable
                    players={parsed.players || []}
                    highlightTeam={parsed.header.team1}
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
                    rounds={parsed.rounds || []}
                    team1Name={parsed.header.team1}
                    team2Name={parsed.header.team2}
                  />
                </CardContent>
              </Card>
            )}

            {activeTab === 'heatmap' && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Map size={16} className="text-neon-green" />
                    Position Heatmap
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {parsed.heatmap_data && parsed.heatmap_data.length > 0 ? (
                    <div className="flex justify-center">
                      <HeatmapCanvas
                        points={parsed.heatmap_data}
                        mapName={parsed.header.map}
                        team1Name={parsed.header.team1}
                        team2Name={parsed.header.team2}
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

            {activeTab === 'economy' && <EconomyTab parsed={parsed} />}

            {activeTab === 'replay' && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Play size={16} className="text-neon-green" />
                    2D Kill Replay
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ReplayCanvas
                    rounds={parsed.rounds ?? []}
                    players={parsed.players ?? []}
                    team1Name={parsed.header.team1}
                    team2Name={parsed.header.team2}
                    mapName={parsed.header.map}
                  />
                </CardContent>
              </Card>
            )}

            {activeTab === '3d' && parsed && (
              <Replay3DCanvas
                mapName={parsed.header.map}
                parsed={parsed}
                team1={parsed.header.team1}
                team2={parsed.header.team2}
              />
            )}
          </div>
        </>
      )}
    </div>
  )
}
