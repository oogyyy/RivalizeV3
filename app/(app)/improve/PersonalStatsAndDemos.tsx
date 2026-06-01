'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import {
  Trophy, TrendingUp, Crosshair, BarChart3,
  FileVideo, Info,
} from 'lucide-react'
import DemoUploadButton from '@/components/teams/DemoUploadButton'
import MapFolderList, { type MapGroup } from '@/components/teams/MapFolderList'
import type { DemoRowData } from '@/components/teams/DemoListMultiSelect'

const ACTIVE_DUTY_MAPS = [
  'de_ancient', 'de_anubis', 'de_dust2', 'de_inferno',
  'de_mirage', 'de_nuke', 'de_overpass',
]

function buildMapGroups(demos: DemoRowData[]): MapGroup[] {
  const map = new Map<string, { demos: DemoRowData[]; wins: number; losses: number; draws: number; lastActivity: string }>()
  for (const m of ACTIVE_DUTY_MAPS) {
    map.set(m, { demos: [], wins: 0, losses: 0, draws: 0, lastActivity: '' })
  }

  for (const demo of demos) {
    const rawMap = (demo.parsed_data?.header?.map ?? demo.map ?? 'unknown').toLowerCase()
    const key = rawMap === 'processing' || rawMap === '' ? 'unknown' : rawMap
    if (!map.has(key)) map.set(key, { demos: [], wins: 0, losses: 0, draws: 0, lastActivity: demo.created_at })
    const g = map.get(key)!
    g.demos.push(demo)
    if (demo.created_at > g.lastActivity) g.lastActivity = demo.created_at
    if (demo.status === 'completed') {
      const h = demo.parsed_data?.header
      const os = demo.parsed_data?.opponentSide ?? 'team2'
      if (h) {
        const ours   = os === 'team1' ? (h.score_team2 ?? 0) : (h.score_team1 ?? 0)
        const theirs = os === 'team1' ? (h.score_team1 ?? 0) : (h.score_team2 ?? 0)
        if (ours > theirs) g.wins++
        else if (ours === theirs) g.draws++
        else g.losses++
      }
    }
  }

  return [...map.entries()]
    .map(([m, data]) => ({ map: m, ...data }))
    .sort((a, b) => {
      if (a.demos.length !== b.demos.length) return b.demos.length - a.demos.length ? -1 : 1
      if (a.demos.length > 0) return b.lastActivity.localeCompare(a.lastActivity)
      const ai = ACTIVE_DUTY_MAPS.indexOf(a.map), bi = ACTIVE_DUTY_MAPS.indexOf(b.map)
      if (ai !== -1 && bi !== -1) return ai - bi
      if (ai !== -1) return -1
      if (bi !== -1) return 1
      return 0
    })
}

function computeStats(
  demos: DemoRowData[],
  steamId: string | null,
) {
  const completed = demos.filter(d => d.status === 'completed')
  let totalMatches = 0, wins = 0, draws = 0
  let myKills = 0, myDeaths = 0, myAdr = 0, myRating = 0, myGames = 0

  for (const demo of completed) {
    const pd = demo.parsed_data
    const h  = pd?.header
    const os = pd?.opponentSide ?? 'team2'
    totalMatches++

    if (h) {
      const ours   = os === 'team1' ? (h.score_team2 ?? 0) : (h.score_team1 ?? 0)
      const theirs = os === 'team1' ? (h.score_team1 ?? 0) : (h.score_team2 ?? 0)
      if (ours > theirs) wins++
      else if (ours === theirs) draws++
    }

    if (pd?.players) {
      // If steam linked, show only the user's own stats; otherwise avg all non-opponent players
      const opponentLabel = os === 'team1' ? (h?.team1 ?? '') : (h?.team2 ?? '')
      const myPlayers = steamId
        ? pd.players.filter(p => (p as { steam_id?: string }).steam_id === steamId)
        : pd.players.filter(p => p.team !== opponentLabel)

      for (const p of myPlayers) {
        myKills  += p.kills
        myDeaths += p.deaths
        myAdr    += p.adr
        myRating += p.rating
        myGames  ++
      }
    }
  }

  return {
    totalMatches,
    wins,
    losses: totalMatches - wins - draws,
    draws,
    winRate: totalMatches > 0 ? wins / totalMatches : 0,
    kd:      myDeaths > 0 ? myKills / myDeaths : null,
    adr:     myGames  > 0 ? myAdr   / myGames  : null,
    rating:  myGames  > 0 ? myRating / myGames : null,
  }
}

function StatCard({
  label, value, sub, icon, iconBg, highlight, accent,
}: {
  label: string; value: string | number; sub: string
  icon: React.ReactNode; iconBg: string; highlight?: boolean; accent?: string
}) {
  return (
    <div className={cn('relative bg-card border border-border rounded-xl p-4 card-hover overflow-hidden', accent)}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] text-muted-foreground/60 uppercase tracking-[0.12em] font-semibold">{label}</p>
        <div className={cn('p-1.5 rounded-lg shrink-0', iconBg)}>{icon}</div>
      </div>
      <p className={cn(
        'text-[26px] font-bold tracking-tight tabular-nums font-mono leading-none',
        highlight ? 'text-[#00ffc8]' : 'text-foreground',
      )}>{value}</p>
      <p className="text-[11px] text-muted-foreground/50 mt-1">{sub}</p>
    </div>
  )
}

export default function PersonalStatsAndDemos({
  initialDemos,
  personalTeamId,
  steamId,
}: {
  initialDemos: DemoRowData[]
  personalTeamId: string
  steamId: string | null
}) {
  const [demos] = useState(initialDemos)
  const stats    = useMemo(() => computeStats(demos, steamId), [demos, steamId])
  const mapGroups = useMemo(() => buildMapGroups(demos), [demos])

  return (
    <>
      {/* Steam link nudge */}
      {!steamId && demos.filter(d => d.status === 'completed').length > 0 && (
        <div className="flex items-start gap-3 bg-[rgba(0,255,200,0.04)] border border-[rgba(0,255,200,0.12)] rounded-xl px-4 py-3 animate-fade-in-up">
          <Info size={15} className="text-[#00ffc8] mt-0.5 shrink-0" />
          <p className="text-[12px] text-muted-foreground leading-relaxed">
            <span className="text-foreground font-medium">Link your Steam account</span> in Settings to see your own per-match stats (K/D, ADR, Rating) rather than team averages.
          </p>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 animate-fade-in-up animate-fade-in-up-delay-1">
        <StatCard
          label="Matches"
          value={stats.totalMatches || '—'}
          sub={stats.totalMatches > 0 ? `${stats.wins}W ${stats.losses}L ${stats.draws}D` : 'No demos yet'}
          icon={<Trophy size={15} className="text-amber-400" />}
          iconBg="bg-amber-500/10"
          accent="stat-card-amber"
        />
        <StatCard
          label="Win Rate"
          value={stats.totalMatches > 0 ? `${Math.round(stats.winRate * 100)}%` : '—'}
          sub={stats.totalMatches > 0 ? `${stats.wins} wins from ${stats.totalMatches}` : 'Upload demos to track'}
          icon={<TrendingUp size={15} className="text-[#00ffc8]" />}
          iconBg="bg-[rgba(0,255,200,0.1)]"
          accent="stat-card-green"
          highlight={stats.winRate >= 0.5}
        />
        <StatCard
          label={steamId ? 'My K/D' : 'Avg K/D'}
          value={stats.kd !== null ? stats.kd.toFixed(2) : '—'}
          sub={steamId ? 'Your kill/death ratio' : 'Team average'}
          icon={<Crosshair size={15} className="text-blue-400" />}
          iconBg="bg-blue-500/10"
          accent="stat-card-blue"
        />
        <StatCard
          label={steamId ? 'My ADR' : 'Avg ADR'}
          value={stats.adr !== null ? stats.adr.toFixed(1) : '—'}
          sub={steamId ? 'Your avg damage/round' : 'Team average'}
          icon={<BarChart3 size={15} className="text-violet-400" />}
          iconBg="bg-violet-500/10"
          accent="stat-card-purple"
        />
      </div>

      {/* Demo list */}
      <div className="animate-fade-in-up animate-fade-in-up-delay-2">
        <div className="flex items-center gap-2 mb-3">
          <FileVideo size={15} className="text-[#00ffc8]" />
          <h2 className="text-[13px] font-semibold text-foreground">My Matches</h2>
          {demos.length > 0 && (
            <span className="text-[10px] text-muted-foreground bg-accent/60 px-1.5 py-0.5 rounded font-mono">
              {demos.length} · {mapGroups.filter(g => g.demos.length > 0 && g.map !== 'unknown').length} maps
            </span>
          )}
        </div>

        {demos.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/50 p-10 text-center">
            <FileVideo size={28} className="text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-[14px] font-medium text-foreground mb-1">No matches uploaded yet</p>
            <p className="text-[12px] text-muted-foreground mb-5 leading-relaxed max-w-xs mx-auto">
              Upload your pug, matchmaking, or any personal demo to start tracking your individual performance.
            </p>
            <DemoUploadButton teamId={personalTeamId} demoType="self" />
          </div>
        ) : (
          <MapFolderList mapGroups={mapGroups} onSideChange={() => {}} />
        )}
      </div>
    </>
  )
}
