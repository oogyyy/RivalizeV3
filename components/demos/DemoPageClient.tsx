'use client'

import { useState, useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatDate, formatDuration, formatPercent } from '@/lib/utils'
import PlayerStatsTable from '@/components/demos/PlayerStatsTable'
import { ReparseProgress } from '@/components/demos/ReparseProgress'
import RoundTimeline from '@/components/demos/RoundTimeline'
import HeatmapCanvas from '@/components/demos/HeatmapCanvas'
import TimingHeatmap from '@/components/demos/TimingHeatmap'
import ReplayCanvas from '@/components/demos/ReplayCanvas'
import DemoInlineChat from '@/components/demos/DemoInlineChat'
import StrategyBoard from '@/components/demos/StrategyBoard'
import VoiceCommsPlayer from '@/components/demos/VoiceCommsPlayer'
import RoutinesPanel from '@/components/demos/RoutinesPanel'
import AiMatchReport from '@/components/demos/AiMatchReport'
import { useFullParsedDemo } from '@/components/demos/useFullParsedDemo'
import { MAP_THUMBS } from '@/lib/map-config'

const Replay3DCanvas = dynamic(
  () => import('@/components/demos/Replay3DCanvas'),
  {
    ssr: false,
    loading: () => (
      <div style={{ height: 560, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', borderRadius: 12 }}>
        <Loader2 size={24} style={{ color: 'var(--win)', animation: 'spin 1s linear infinite' }} />
      </div>
    ),
  }
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

// Chart color constants matching design system vars
const WIN_COLOR  = '#34E2A0'
const LOSS_COLOR = '#FF6B7A'

type Tab = 'overview' | 'players' | 'rounds' | 'heatmap' | 'economy' | 'replay' | '3d' | 'strategy' | 'ai'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview',  label: 'Overview',       icon: <BarChart3 size={14} /> },
  { id: 'players',   label: 'Player Stats',   icon: <Crosshair size={14} /> },
  { id: 'rounds',    label: 'Round Timeline', icon: <Clock size={14} /> },
  { id: 'heatmap',   label: 'Heatmap',        icon: <Map size={14} /> },
  { id: 'economy',   label: 'Economy',        icon: <TrendingUp size={14} /> },
  { id: 'replay',    label: '2D Replay',      icon: <Play size={14} /> },
  { id: '3d',        label: '3D Replay',      icon: <Box size={14} /> },
  { id: 'strategy',  label: 'Strategy Board', icon: <Target size={14} /> },
  { id: 'ai',        label: 'AI Report',      icon: <Brain size={14} /> },
]

function ratingColor(rating: number): string {
  if (rating >= 1.2) return 'var(--win)'
  if (rating >= 1.0) return '#4ade80'
  if (rating >= 0.8) return 'var(--tside)'
  return 'var(--loss)'
}

const panel: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  overflow: 'hidden',
}

const panelHeader: React.CSSProperties = {
  padding: '14px 20px',
  borderBottom: '1px solid var(--border)',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontWeight: 600,
  fontSize: 15,
  color: 'var(--text)',
}

const panelBody: React.CSSProperties = {
  padding: 20,
}

function StatCard({ label, value, sub, color }: {
  label: string
  value: string | number
  sub?: string
  color?: string
}) {
  return (
    <div style={{ ...panel, padding: 16, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(255,255,255,0.02), transparent)', height: 56, pointerEvents: 'none' }} />
      <p style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 600, marginBottom: 6 }}>{label}</p>
      <p style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)', color: color ?? 'var(--text)', tabularNums: true } as React.CSSProperties}>{value}</p>
      {sub && <p style={{ fontSize: 12, color: 'var(--faint)', marginTop: 2 }}>{sub}</p>}
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
        <span style={{ color: 'var(--win)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{format(v1)}</span>
        <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
        <span style={{ color: 'var(--loss)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{format(v2)}</span>
      </div>
      <div style={{ height: 8, borderRadius: 9999, background: 'var(--track)', overflow: 'hidden', display: 'flex' }}>
        <div style={{ height: '100%', background: 'var(--win)', borderRadius: '9999px 0 0 9999px', width: `${pct1}%`, transition: 'width 0.7s' }} />
        <div style={{ height: '100%', background: 'var(--loss)', flex: 1, borderRadius: '0 9999px 9999px 0' }} />
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

function Pill({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 9px', borderRadius: 6,
      border: '1px solid var(--border)',
      fontSize: 11, color: color ?? 'var(--muted)',
      fontFamily: 'var(--font-mono)',
      background: 'transparent',
    }}>
      {children}
    </span>
  )
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string }> = {
    queued:     { color: 'var(--tside)',  bg: 'color-mix(in srgb, var(--tside) 12%, transparent)' },
    processing: { color: 'var(--signal)', bg: 'color-mix(in srgb, var(--signal) 12%, transparent)' },
    completed:  { color: 'var(--win)',    bg: 'color-mix(in srgb, var(--win) 12%, transparent)' },
    failed:     { color: 'var(--loss)',   bg: 'color-mix(in srgb, var(--loss) 12%, transparent)' },
  }
  const s = map[status] ?? { color: 'var(--muted)', bg: 'transparent' }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, color: s.color, background: s.bg, border: `1px solid ${s.color}40` }}>
      {status === 'queued' ? 'Queued' : status === 'processing' ? 'Processing…' : status === 'completed' ? 'Analyzed' : 'Failed'}
    </span>
  )
}

function Btn({ children, onClick, disabled, variant = 'outline', size = 'sm', style: extraStyle }: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  variant?: 'ghost' | 'outline' | 'accent'
  size?: 'sm' | 'md'
  style?: React.CSSProperties
}) {
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: size === 'sm' ? '6px 12px' : '8px 16px',
    borderRadius: 8, cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: 13, fontWeight: 500, transition: 'opacity 0.15s',
    opacity: disabled ? 0.5 : 1,
  }
  const variants: Record<string, React.CSSProperties> = {
    ghost:   { background: 'transparent', border: 'none', color: 'var(--muted)' },
    outline: { background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)' },
    accent:  { background: 'var(--accent)', border: 'none', color: '#fff' },
  }
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant], ...extraStyle }}>
      {children}
    </button>
  )
}

function ScoreBanner({ parsed, demo }: { parsed: ParsedDemoData; demo: Demo }) {
  const h = parsed.header
  let score1 = h.score_team1
  let score2 = h.score_team2
  if (score1 === 0 && score2 === 0 && parsed.rounds?.length) {
    const { s1, s2 } = deriveScoresFromRounds(parsed)
    if (s1 > 0 || s2 > 0) { score1 = s1; score2 = s2 }
  }
  const team1Won = score1 > score2
  const isDraw = score1 === score2
  const thumbUrl = MAP_THUMBS[h.map]

  return (
    <div style={{ ...panel, position: 'relative' }}>
      {thumbUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumbUrl} alt={h.map} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.12, pointerEvents: 'none', userSelect: 'none' }} />
      )}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: '50%', height: '100%', background: `linear-gradient(to right, color-mix(in srgb, var(--win) 8%, transparent), transparent)` }} />
        <div style={{ position: 'absolute', top: 0, right: 0, width: '50%', height: '100%', background: `linear-gradient(to left, color-mix(in srgb, var(--loss) 8%, transparent), transparent)` }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, color-mix(in srgb, var(--card) 80%, transparent), transparent, color-mix(in srgb, var(--card) 40%, transparent))' }} />
      </div>

      <div style={{ position: 'relative', padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
          <Pill><Map size={11} /> {h.map}</Pill>
          {demo.match_date && <Pill><Clock size={11} /> {formatDate(demo.match_date)}</Pill>}
          <Pill><Clock size={11} /> {formatDuration(h.duration)}</Pill>
          <Pill>{h.total_rounds} rounds</Pill>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: 9999, background: 'color-mix(in srgb, var(--win) 20%, transparent)', border: '1px solid color-mix(in srgb, var(--win) 30%, transparent)', marginBottom: 12 }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--win)' }}>{h.team1.charAt(0)}</span>
            </div>
            <p style={{ fontWeight: 700, fontSize: 17, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.team1}</p>
            {team1Won && (
              <span style={{ display: 'inline-block', marginTop: 6, padding: '2px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, color: 'var(--win)', background: 'color-mix(in srgb, var(--win) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--win) 30%, transparent)' }}>WINNER</span>
            )}
          </div>

          <div style={{ textAlign: 'center', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 60, fontWeight: 900, fontFamily: 'var(--font-mono)', color: team1Won ? 'var(--win)' : isDraw ? 'var(--tside)' : 'var(--muted)' }}>{score1}</span>
              <span style={{ fontSize: 30, color: 'var(--muted)', fontWeight: 700 }}>:</span>
              <span style={{ fontSize: 60, fontWeight: 900, fontFamily: 'var(--font-mono)', color: !team1Won && !isDraw ? 'var(--loss)' : isDraw ? 'var(--tside)' : 'var(--muted)' }}>{score2}</span>
            </div>
            <p style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {isDraw ? 'Draw' : team1Won ? 'Victory' : 'Defeat'}
            </p>
          </div>

          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: 9999, background: 'color-mix(in srgb, var(--loss) 20%, transparent)', border: '1px solid color-mix(in srgb, var(--loss) 30%, transparent)', marginBottom: 12 }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--loss)' }}>{h.team2.charAt(0)}</span>
            </div>
            <p style={{ fontWeight: 700, fontSize: 17, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.team2}</p>
            {!team1Won && !isDraw && (
              <span style={{ display: 'inline-block', marginTop: 6, padding: '2px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, color: 'var(--loss)', background: 'color-mix(in srgb, var(--loss) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--loss) 30%, transparent)' }}>WINNER</span>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={panel}>
        <div style={panelHeader}>
          <Target size={16} style={{ color: 'var(--win)' }} />
          Team Comparison
        </div>
        <div style={{ ...panelBody, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--win)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.team1}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--loss)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>{h.team2}</span>
          </div>
          <TeamComparisonBar label="Avg Rating"  v1={avgStat(team1Players, 'rating')} v2={avgStat(team2Players, 'rating')} fmt={(n) => n.toFixed(2)} />
          <TeamComparisonBar label="Total Kills" v1={sumStat(team1Players, 'kills')}  v2={sumStat(team2Players, 'kills')} />
          <TeamComparisonBar label="Avg ADR"     v1={avgStat(team1Players, 'adr')}    v2={avgStat(team2Players, 'adr')} fmt={(n) => n.toFixed(1)} />
          <TeamComparisonBar label="Avg KAST%"   v1={avgStat(team1Players, 'kast')}   v2={avgStat(team2Players, 'kast')} fmt={(n) => n.toFixed(1)} />
          <TeamComparisonBar label="HS%"         v1={avgStat(team1Players, 'headshot_percentage')} v2={avgStat(team2Players, 'headshot_percentage')} fmt={(n) => n.toFixed(1)} />
          <TeamComparisonBar label="Utility Dmg" v1={sumStat(team1Players, 'utility_damage')} v2={sumStat(team2Players, 'utility_damage')} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
        {mvp && (
          <div style={{ ...panel, padding: 16, borderColor: 'color-mix(in srgb, var(--win) 20%, transparent)', background: 'color-mix(in srgb, var(--win) 5%, var(--card))' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Trophy size={14} style={{ color: 'var(--win)' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--win)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>MVP</span>
            </div>
            <p style={{ fontWeight: 700, fontSize: 17, color: 'var(--text)' }}>{mvp.name}</p>
            <p style={{ fontSize: 12, color: 'var(--muted)' }}>{mvp.team}</p>
            <p style={{ fontSize: 28, fontWeight: 900, fontFamily: 'var(--font-mono)', color: ratingColor(mvp.rating), marginTop: 8 }}>{mvp.rating.toFixed(2)}</p>
            <p style={{ fontSize: 12, color: 'var(--muted)' }}>Rating</p>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>{mvp.kills}K / {mvp.deaths}D / {mvp.assists}A</p>
          </div>
        )}
        {topKills && (
          <div style={{ ...panel, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Crosshair size={14} style={{ color: 'var(--tside)' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--tside)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Top Fragger</span>
            </div>
            <p style={{ fontWeight: 700, fontSize: 17, color: 'var(--text)' }}>{topKills.name}</p>
            <p style={{ fontSize: 12, color: 'var(--muted)' }}>{topKills.team}</p>
            <p style={{ fontSize: 28, fontWeight: 900, fontFamily: 'var(--font-mono)', color: 'var(--tside)', marginTop: 8 }}>{topKills.kills}</p>
            <p style={{ fontSize: 12, color: 'var(--muted)' }}>Kills</p>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>ADR: {topKills.adr.toFixed(1)} | HS: {formatPercent(topKills.headshot_percentage)}</p>
          </div>
        )}
        {topAdr && (
          <div style={{ ...panel, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Zap size={14} style={{ color: 'var(--signal)' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--signal)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Top ADR</span>
            </div>
            <p style={{ fontWeight: 700, fontSize: 17, color: 'var(--text)' }}>{topAdr.name}</p>
            <p style={{ fontSize: 12, color: 'var(--muted)' }}>{topAdr.team}</p>
            <p style={{ fontSize: 28, fontWeight: 900, fontFamily: 'var(--font-mono)', color: 'var(--signal)', marginTop: 8 }}>{topAdr.adr.toFixed(1)}</p>
            <p style={{ fontSize: 12, color: 'var(--muted)' }}>ADR</p>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>Rating: {topAdr.rating.toFixed(2)} | KAST: {topAdr.kast.toFixed(1)}%</p>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
        <StatCard label="Total Rounds"   value={h.total_rounds} />
        <StatCard label="Match Duration" value={formatDuration(h.duration)} />
        <StatCard label="Avg Rating"     value={avgStat(players, 'rating').toFixed(2)} color={ratingColor(avgStat(players, 'rating'))} />
        <StatCard label="Total Kills"    value={sumStat(players, 'kills')} />
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
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, fontSize: 12 }}>
        <p style={{ color: 'var(--muted)', marginBottom: 8 }}>Round {label}</p>
        {payload.map((entry: any) => (
          <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: 9999, background: entry.color }} />
            <span style={{ color: 'var(--text)' }}>{entry.name}:</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>${entry.value?.toLocaleString()}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={panel}>
        <div style={panelHeader}>
          <TrendingUp size={16} style={{ color: 'var(--win)' }} />
          Economy by Round
        </div>
        <div style={panelBody}>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorT1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={WIN_COLOR}  stopOpacity={0.3} />
                  <stop offset="95%" stopColor={WIN_COLOR}  stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorT2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={LOSS_COLOR} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={LOSS_COLOR} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="round"
                tick={{ fill: 'rgba(240,240,246,0.56)', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                label={{ value: 'Round', position: 'insideBottom', offset: -2, fill: 'rgba(240,240,246,0.56)', fontSize: 11 }}
              />
              <YAxis
                tick={{ fill: 'rgba(240,240,246,0.56)', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: '12px', paddingTop: '16px' }}
                formatter={(value) => <span style={{ color: 'var(--text)' }}>{value}</span>}
              />
              <Area type="monotone" dataKey={h.team1} stroke={WIN_COLOR}  strokeWidth={2} fill="url(#colorT1)" dot={false} />
              <Area type="monotone" dataKey={h.team2} stroke={LOSS_COLOR} strokeWidth={2} fill="url(#colorT2)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
        {(() => {
          const t1Eco = rounds.map(r => r.team1_economy)
          const t2Eco = rounds.map(r => r.team2_economy)
          const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
          const max = (arr: number[]) => arr.length ? Math.max(...arr) : 0
          return [
            { label: `${h.team1} Avg Eco`,  value: `$${Math.round(avg(t1Eco)).toLocaleString()}`, color: 'var(--win)' },
            { label: `${h.team1} Peak Eco`, value: `$${Math.round(max(t1Eco)).toLocaleString()}`, color: 'var(--win)' },
            { label: `${h.team2} Avg Eco`,  value: `$${Math.round(avg(t2Eco)).toLocaleString()}`, color: 'var(--loss)' },
            { label: `${h.team2} Peak Eco`, value: `$${Math.round(max(t2Eco)).toLocaleString()}`, color: 'var(--loss)' },
          ]
        })().map(stat => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} color={stat.color} />
        ))}
      </div>
    </div>
  )
}

function HeatmapTabPanel({ parsed }: { parsed: ParsedDemoData }) {
  const [heatSubTab, setHeatSubTab] = useState<'position' | 'timing'>('position')
  return (
    <div style={panel}>
      <div style={{ ...panelHeader, justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Map size={16} style={{ color: 'var(--win)' }} />
          {heatSubTab === 'position' ? 'Position Heatmap' : 'Timing Heatmap'}
        </span>
        <div style={{ display: 'flex', borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden', fontSize: 12 }}>
          {(['position', 'timing'] as const).map(t => (
            <button
              key={t}
              onClick={() => setHeatSubTab(t)}
              style={{
                padding: '6px 14px', fontWeight: 500, border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                background: heatSubTab === t ? 'color-mix(in srgb, var(--win) 20%, transparent)' : 'transparent',
                color: heatSubTab === t ? 'var(--win)' : 'var(--muted)',
              }}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div style={panelBody}>
        {heatSubTab === 'position' ? (
          parsed.heatmap_data && parsed.heatmap_data.length > 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
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
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 0', gap: 12, textAlign: 'center' }}>
              <Map size={32} style={{ color: 'var(--muted)' }} />
              <p style={{ color: 'var(--muted)' }}>No heatmap data available for this demo</p>
            </div>
          )
        ) : (
          <TimingHeatmap
            rounds={parsed.rounds ?? []}
            team1Name={parsed.header.team1}
            team2Name={parsed.header.team2}
          />
        )}
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
  const [shareCopied, setShareCopied] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [replayTime, setReplayTime] = useState(0)
  const [replayPlaying, setReplayPlaying] = useState(false)
  const [replayState, setReplayState] = useState<{
    roundIdx: number; time: number; duration: number; mapName: string
    aliveCT: number; aliveT: number; bombStatus: string | null
    recentKills: { killer: string; victim: string; weapon: string; time: number }[]
  } | null>(null)

  const handleShare = useCallback(async () => {
    if (sharing) return
    setSharing(true)
    try {
      const res = await fetch(`/api/demos/${demo.id}/share`, { method: 'POST' })
      if (res.ok) {
        const { shareId } = await res.json() as { shareId: string }
        const url = `${window.location.origin}/share/${shareId}`
        await navigator.clipboard.writeText(url)
        setShareCopied(true)
        setTimeout(() => setShareCopied(false), 3000)
      }
    } finally {
      setSharing(false)
    }
  }, [demo.id, sharing])

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

  useEffect(() => {
    if (demo.status !== 'queued' && demo.status !== 'processing') return
    const interval = setInterval(fetchDemo, 5_000)
    return () => clearInterval(interval)
  }, [demo.status, fetchDemo])

  const parsed = demo.parsed_data as ParsedDemoData | null
  const replayData = useFullParsedDemo(demo.id, parsed, activeTab === 'replay' || activeTab === '3d')
  const replayParsed = replayData.parsed ?? parsed
  const backHref = folderId ? `/opponents/${folderId}` : '/opponents'
  const aiScoutHref = folderId ? `/ai-coach?folder=${folderId}` : '/ai-coach'

  return (
    <div style={{ padding: 24, maxWidth: 1280, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <Link href={backHref} style={{ textDecoration: 'none' }}>
          <Btn variant="ghost">
            <ArrowLeft size={14} />
            {folderId ? `Back to ${demo.opponent_name}` : 'Back to Opponents'}
          </Btn>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <StatusPill status={demo.status} />
          {demo.status !== 'queued' && demo.status !== 'processing' && (
            <Btn variant="outline" onClick={handleParse} disabled={parsing || reparsing}>
              {parsing ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={14} />}
              {parsing ? 'Parsing…' : demo.status === 'completed' ? 'Re-parse' : 'Parse Now'}
            </Btn>
          )}
          {demo.status === 'completed' && (
            <Btn variant="outline" onClick={handleShare} disabled={sharing}>
              {sharing
                ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                : shareCopied
                  ? <Check size={14} style={{ color: 'var(--win)' }} />
                  : <Copy size={14} />}
              {shareCopied ? 'Link copied!' : 'Share'}
            </Btn>
          )}
          <Link href={aiScoutHref} style={{ textDecoration: 'none' }}>
            <Btn variant="accent">
              <Brain size={14} />
              AI Scout
            </Btn>
          </Link>
        </div>
      </div>

      {reparsing && (
        <ReparseProgress demoId={demo.id} onDone={handleReparseDone} />
      )}

      {/* Title */}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
          <span style={{ color: 'var(--accent)' }}>{demo.opponent_name}</span>
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4, fontSize: 13, color: 'var(--muted)' }}>
          <span style={{ fontFamily: 'var(--font-mono)' }}>{demo.map}</span>
          {demo.match_date && <span>{formatDate(demo.match_date)}</span>}
          <span style={{ textTransform: 'capitalize' }}>{demo.status}</span>
        </div>
      </div>

      {/* Debug panel */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        <button
          onClick={() => setDebugOpen(o => !o)}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: 'rgba(255,255,255,0.03)', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--muted)', transition: 'background 0.15s' }}
        >
          <span style={{ fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Debug — Raw parsed_data</span>
          {debugOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {debugOpen && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => { navigator.clipboard.writeText(JSON.stringify(demo.parsed_data, null, 2)); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
              style={{ position: 'absolute', top: 8, right: 8, zIndex: 10, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.08)', border: '1px solid var(--border)', cursor: 'pointer', fontSize: 12, color: 'var(--muted)' }}
            >
              {copied ? <Check size={12} style={{ color: 'var(--win)' }} /> : <Copy size={12} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <pre style={{ padding: 16, overflow: 'auto', maxHeight: 384, fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--muted)', background: 'rgba(0,0,0,0.3)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0 }}>
              {JSON.stringify(demo.parsed_data, null, 2) ?? 'null'}
            </pre>
          </div>
        )}
      </div>

      {!parsed ? (
        <div style={{ ...panel, border: '1px dashed var(--border)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 24px', gap: 16, textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: 9999, background: 'var(--track)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {(demo.status === 'queued' || demo.status === 'processing')
                ? <Loader2 size={28} style={{ color: 'var(--win)', animation: 'spin 1s linear infinite' }} />
                : <BarChart3 size={28} style={{ color: 'var(--muted)' }} />
              }
            </div>
            <div>
              <p style={{ fontWeight: 600, color: 'var(--text)', fontSize: 16, margin: 0 }}>
                {demo.status === 'queued' ? 'Waiting in queue…' : demo.status === 'processing' ? 'Demo is being processed…' : 'No analysis data yet'}
              </p>
              <p style={{ fontSize: 14, color: 'var(--muted)', marginTop: 6 }}>
                {demo.status === 'queued'
                  ? 'Your demo will start processing shortly. This page refreshes automatically.'
                  : demo.status === 'processing'
                  ? 'Analysis in progress. This page refreshes automatically.'
                  : 'Click Parse Now to analyze this demo.'}
              </p>
            </div>
            {demo.status !== 'queued' && demo.status !== 'processing' && (
              <Btn variant="accent" onClick={handleParse} disabled={parsing}>
                {parsing ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={14} />}
                {parsing ? 'Parsing…' : 'Parse Demo'}
              </Btn>
            )}
          </div>
        </div>
      ) : (
        <>
          <ScoreBanner parsed={parsed} demo={demo} />

          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 2, padding: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 12, border: '1px solid var(--border)', width: 'fit-content', flexWrap: 'wrap' }}>
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 12px', fontSize: 13, fontWeight: 500,
                  borderRadius: 8, border: 'none', cursor: 'pointer',
                  transition: 'all 0.15s',
                  background: activeTab === tab.id ? 'var(--card)' : 'transparent',
                  color: activeTab === tab.id ? 'var(--win)' : 'rgba(240,240,246,0.5)',
                  boxShadow: activeTab === tab.id ? '0 1px 4px rgba(0,0,0,0.3)' : 'none',
                  outline: activeTab === tab.id ? '1px solid color-mix(in srgb, var(--win) 20%, transparent)' : 'none',
                }}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ minHeight: 400 }}>
            {activeTab === 'overview' && <OverviewTab parsed={parsed} />}

            {activeTab === 'players' && (
              <div style={panel}>
                <div style={panelHeader}>
                  <Crosshair size={16} style={{ color: 'var(--win)' }} />
                  Player Statistics
                </div>
                <div style={{ padding: 0 }}>
                  <PlayerStatsTable
                    players={parsed.players || []}
                    highlightTeam={parsed.header.team1}
                  />
                </div>
              </div>
            )}

            {activeTab === 'rounds' && (
              <div style={panel}>
                <div style={panelHeader}>
                  <Clock size={16} style={{ color: 'var(--win)' }} />
                  Round Timeline
                </div>
                <div style={panelBody}>
                  <RoundTimeline
                    rounds={parsed.rounds || []}
                    team1Name={parsed.header.team1}
                    team2Name={parsed.header.team2}
                  />
                </div>
              </div>
            )}

            {activeTab === 'heatmap' && <HeatmapTabPanel parsed={parsed} />}

            {activeTab === 'economy' && <EconomyTab parsed={parsed} />}

            {activeTab === 'replay' && replayParsed && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={panel}>
                  <div style={panelHeader}>
                    <Play size={16} style={{ color: 'var(--win)' }} />
                    2D Kill Replay
                  </div>
                  <div style={panelBody}>
                    {replayData.loading && (
                      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>Loading movement data…</p>
                    )}
                    {replayData.error && (
                      <p style={{ fontSize: 12, color: 'var(--tside)', marginBottom: 12 }}>{replayData.error}</p>
                    )}
                    <ReplayCanvas
                      rounds={replayParsed.rounds ?? []}
                      players={replayParsed.players ?? []}
                      team1Name={replayParsed.header.team1}
                      team2Name={replayParsed.header.team2}
                      mapName={replayParsed.header.map}
                      onPlaybackChange={(t, playing) => { setReplayTime(t); setReplayPlaying(playing) }}
                    />
                  </div>
                </div>
                <VoiceCommsPlayer demoId={demo.id} roundTime={replayTime} isPlaying={replayPlaying} />
                {folderId && (
                  <RoutinesPanel folderId={folderId} opponentName={demo.opponent_name} />
                )}
              </div>
            )}

            {activeTab === '3d' && replayParsed && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Replay3DCanvas
                      mapName={replayParsed.header.map}
                      parsed={replayParsed}
                      team1={replayParsed.header.team1}
                      team2={replayParsed.header.team2}
                      onStateChange={setReplayState}
                    />
                  </div>
                  <div style={{ width: 340, flexShrink: 0, height: 548 }}>
                    <DemoInlineChat
                      mode="opponent"
                      folderId={folderId ?? undefined}
                      mapName={parsed.header.map}
                      replayContext={replayState}
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'strategy' && parsed && (
              <StrategyBoard mapName={parsed.header.map} />
            )}

            {activeTab === 'ai' && (
              <AiMatchReport demoId={demo.id} />
            )}
          </div>
        </>
      )}
    </div>
  )
}
