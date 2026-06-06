'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import {
  Trophy, TrendingUp, Crosshair, BarChart3,
  FileVideo, Info, X,
} from 'lucide-react'
import DemoUploadButton from '@/components/teams/DemoUploadButton'
import DemoListMultiSelect, { type DemoRowData } from '@/components/teams/DemoListMultiSelect'
import RecentMatchesSplit from '@/app/(app)/improve/RecentMatchesSplit'

function mapDisplayName(map: string): string {
  return map
    .replace(/^(de_|cs_|ar_)/, '')
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
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
  faceitPlayerId,
}: {
  initialDemos: DemoRowData[]
  personalTeamId: string
  steamId: string | null
  faceitPlayerId: string | null
}) {
  const [demos] = useState(initialDemos)
  const [mapFilter, setMapFilter] = useState<string | null>(null)
  const stats = useMemo(() => computeStats(demos, steamId), [demos, steamId])

  const uniqueMaps = useMemo(() => {
    const seen = new Set<string>()
    for (const d of demos) {
      const m = (d.parsed_data?.header?.map ?? d.map ?? '').toLowerCase()
      if (m && m !== 'processing') seen.add(m)
    }
    return [...seen].sort()
  }, [demos])

  const filteredDemos = useMemo(() => {
    const sorted = [...demos].sort((a, b) => {
      const da = a.match_date ?? a.created_at
      const db = b.match_date ?? b.created_at
      return db.localeCompare(da)
    })
    if (!mapFilter) return sorted
    return sorted.filter(d => {
      const m = (d.parsed_data?.header?.map ?? d.map ?? '').toLowerCase()
      return m === mapFilter
    })
  }, [demos, mapFilter])

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

      {/* Recent matches split table */}
      <div className="animate-fade-in-up animate-fade-in-up-delay-2">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <FileVideo size={15} className="text-[#00ffc8]" />
            <h2 className="text-[13px] font-semibold text-foreground">My Matches</h2>
            {demos.length > 0 && (
              <span className="text-[10px] text-muted-foreground bg-accent/60 px-1.5 py-0.5 rounded font-mono">
                {demos.length} uploaded
              </span>
            )}
          </div>
          <DemoUploadButton teamId={personalTeamId} demoType="self" />
        </div>

        <RecentMatchesSplit demos={demos} faceitPlayerId={faceitPlayerId} personalTeamId={personalTeamId} />

        {/* Demo Browser — flat recent list with map filter */}
        {demos.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
              <div className="flex items-center gap-2">
                <h2 className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide">Demo Browser</h2>
                <span className="text-[10px] text-muted-foreground bg-accent/60 px-1.5 py-0.5 rounded font-mono">
                  {filteredDemos.length} demos
                </span>
              </div>
              {/* Map filter pills */}
              {uniqueMaps.length > 1 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => setMapFilter(null)}
                    className={cn(
                      'px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors',
                      mapFilter === null
                        ? 'bg-[#00ffc8]/15 text-[#00ffc8] border border-[#00ffc8]/30'
                        : 'bg-accent/40 text-muted-foreground hover:text-foreground border border-transparent',
                    )}
                  >
                    All
                  </button>
                  {uniqueMaps.map(m => (
                    <button
                      key={m}
                      onClick={() => setMapFilter(mapFilter === m ? null : m)}
                      className={cn(
                        'px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors flex items-center gap-1',
                        mapFilter === m
                          ? 'bg-[#00ffc8]/15 text-[#00ffc8] border border-[#00ffc8]/30'
                          : 'bg-accent/40 text-muted-foreground hover:text-foreground border border-transparent',
                      )}
                    >
                      {mapDisplayName(m)}
                      {mapFilter === m && <X size={10} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <DemoListMultiSelect
              demos={filteredDemos}
              demoHrefPrefix="/my-team/demos"
              showSideSelector
              showReparse
              canDelete
            />
          </div>
        )}
      </div>
    </>
  )
}
