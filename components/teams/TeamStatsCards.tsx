'use client'

import { useMemo } from 'react'
import { Trophy, TrendingUp, Crosshair, BarChart3 } from 'lucide-react'
import type { DemoRowData } from './DemoListMultiSelect'

function computeStats(demos: DemoRowData[]) {
  const completedDemos = demos.filter(d => d.status === 'completed')
  let totalMatches = 0, totalWins = 0, totalDraws = 0
  let totalKills = 0, totalDeaths = 0, totalAdr = 0, playerCount = 0

  for (const demo of completedDemos) {
    const pd = demo.parsed_data
    const h = pd?.header
    const opponentSide = pd?.opponentSide ?? 'team2'
    totalMatches++

    if (h) {
      const ourScore = opponentSide === 'team1' ? (h.score_team2 ?? 0) : (h.score_team1 ?? 0)
      const theirScore = opponentSide === 'team1' ? (h.score_team1 ?? 0) : (h.score_team2 ?? 0)
      if (ourScore > theirScore) totalWins++
      else if (ourScore === theirScore) totalDraws++
    }

    if (pd?.players) {
      const opponentLabel = opponentSide === 'team1' ? (h?.team1 ?? 'T-Side') : (h?.team2 ?? 'CT-Side')
      for (const p of pd.players) {
        if (p.team === opponentLabel) continue
        totalKills += p.kills
        totalDeaths += p.deaths
        totalAdr += p.adr
        playerCount++
      }
    }
  }

  const totalLosses = totalMatches - totalWins - totalDraws
  const winRate = totalMatches > 0 ? totalWins / totalMatches : 0
  const avgKD = totalDeaths > 0 ? (totalKills / totalDeaths).toFixed(2) : '—'
  const avgAdr = playerCount > 0 ? (totalAdr / playerCount).toFixed(1) : '—'

  return { totalMatches, totalWins, totalLosses, totalDraws, winRate, avgKD, avgAdr }
}

interface TeamStatsCardsProps {
  demos: DemoRowData[]
}

export default function TeamStatsCards({ demos }: TeamStatsCardsProps) {
  const stats = useMemo(() => computeStats(demos), [demos])

  const cards = [
    {
      label: 'MATCHES',
      value: `${stats.totalMatches}`,
      sub: `${stats.totalWins}W ${stats.totalLosses}L ${stats.totalDraws}D`,
      icon: <Trophy size={14} className="text-amber-400" />,
      iconBg: 'bg-amber-500/10 border border-amber-500/20',
    },
    {
      label: 'WIN RATE',
      value: `${(stats.winRate * 100).toFixed(0)}%`,
      sub: `${stats.totalWins} wins from ${stats.totalMatches}`,
      icon: <TrendingUp size={14} className="text-emerald-400" />,
      iconBg: 'bg-emerald-500/10 border border-emerald-500/20',
    },
    {
      label: 'TEAM K/D',
      value: stats.avgKD,
      sub: 'Combined team ratio',
      icon: <Crosshair size={14} className="text-violet-400" />,
      iconBg: 'bg-violet-500/10 border border-violet-500/20',
    },
    {
      label: 'AVG ADR',
      value: stats.avgAdr,
      sub: 'Avg damage per round',
      icon: <BarChart3 size={14} className="text-blue-400" />,
      iconBg: 'bg-blue-500/10 border border-blue-500/20',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-fade-in-up">
      {cards.map(card => (
        <div
          key={card.label}
          className="rv-panel lift p-4"
          style={{ cursor: 'default', position: 'relative' }}
        >
          <div className="flex items-center justify-between mb-3">
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--faint)',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              {card.label}
            </p>
            <div className={`${card.iconBg} p-1.5 rounded-lg shrink-0`}>
              {card.icon}
            </div>
          </div>
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 24,
              fontWeight: 700,
              color: 'var(--text)',
              lineHeight: 1.1,
              marginBottom: 4,
            }}
          >
            {card.value}
          </p>
          <p style={{ fontSize: 11, color: 'var(--muted)' }}>{card.sub}</p>
        </div>
      ))}
    </div>
  )
}
