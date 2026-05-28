'use client'

import { useState } from 'react'
import { cn, formatPercent, getRatingColor } from '@/lib/utils'
import type { PlayerStats } from '@/types/database'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'

interface PlayerStatsTableProps {
  players: PlayerStats[]
  highlightTeam?: string
}

type SortKey = keyof Pick<
  PlayerStats,
  'name' | 'kills' | 'deaths' | 'assists' | 'adr' | 'kast' | 'rating' | 'headshot_percentage' | 'utility_damage'
>
type SortDir = 'asc' | 'desc'

const columns: { key: SortKey; label: string; shortLabel?: string }[] = [
  { key: 'name', label: 'Player' },
  { key: 'kills', label: 'K', shortLabel: 'Kills' },
  { key: 'deaths', label: 'D', shortLabel: 'Deaths' },
  { key: 'assists', label: 'A', shortLabel: 'Assists' },
  { key: 'adr', label: 'ADR' },
  { key: 'kast', label: 'KAST%' },
  { key: 'rating', label: 'Rating' },
  { key: 'headshot_percentage', label: 'HS%' },
  { key: 'utility_damage', label: 'UD', shortLabel: 'Utility Dmg' },
]

function sortPlayers(players: PlayerStats[], key: SortKey, dir: SortDir) {
  return [...players].sort((a, b) => {
    const av = a[key] as number | string
    const bv = b[key] as number | string
    if (typeof av === 'string' && typeof bv === 'string') {
      return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    }
    return dir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number)
  })
}

function TeamTable({
  teamName,
  players,
  sortKey,
  sortDir,
  onSort,
  isHighlighted,
}: {
  teamName: string
  players: PlayerStats[]
  sortKey: SortKey
  sortDir: SortDir
  onSort: (key: SortKey) => void
  isHighlighted: boolean
}) {
  const sorted = sortPlayers(players, sortKey, sortDir)

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ChevronsUpDown size={12} className="text-muted-foreground/40" />
    return sortDir === 'desc'
      ? <ChevronDown size={12} className="text-neon-green" />
      : <ChevronUp size={12} className="text-neon-green" />
  }

  return (
    <div className="overflow-x-auto">
      <div className={cn(
        'px-4 py-2 border-b border-border text-xs font-semibold uppercase tracking-wider',
        isHighlighted ? 'text-neon-green bg-neon-green/5' : 'text-muted-foreground bg-muted/20',
      )}>
        {teamName}
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            {columns.map(col => (
              <th
                key={col.key}
                onClick={() => onSort(col.key)}
                title={col.shortLabel}
                className={cn(
                  'px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer select-none whitespace-nowrap hover:text-foreground transition-colors',
                  col.key === 'name' ? 'min-w-[160px]' : 'text-center'
                )}
              >
                <div className={cn('flex items-center gap-1', col.key !== 'name' && 'justify-center')}>
                  {col.label}
                  <SortIcon col={col.key} />
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {sorted.map((player, idx) => (
            <tr
              key={`${player.steam_id}-${idx}`}
              className={cn(
                'transition-colors hover:bg-accent/30',
                isHighlighted && 'bg-neon-green/5 hover:bg-neon-green/10'
              )}
            >
              {/* Player name */}
              <td className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <div className={cn(
                    'w-7 h-7 rounded flex items-center justify-center text-xs font-bold shrink-0',
                    isHighlighted ? 'bg-neon-green/20 text-neon-green' : 'bg-muted text-muted-foreground'
                  )}>
                    {player.name.charAt(0).toUpperCase()}
                  </div>
                  <p className={cn('font-medium', isHighlighted ? 'text-neon-green' : 'text-foreground')}>
                    {player.name}
                  </p>
                </div>
              </td>
              {/* K */}
              <td className="px-4 py-3 text-center font-mono">
                <span className="text-foreground font-semibold">{player.kills}</span>
              </td>
              {/* D */}
              <td className="px-4 py-3 text-center font-mono">
                <span className="text-muted-foreground">{player.deaths}</span>
              </td>
              {/* A */}
              <td className="px-4 py-3 text-center font-mono">
                <span className="text-muted-foreground">{player.assists}</span>
              </td>
              {/* ADR */}
              <td className="px-4 py-3 text-center font-mono">
                <span className={cn(
                  player.adr >= 90 ? 'text-neon-green' : player.adr >= 70 ? 'text-yellow-400' : 'text-muted-foreground'
                )}>
                  {player.adr.toFixed(1)}
                </span>
              </td>
              {/* KAST */}
              <td className="px-4 py-3 text-center font-mono">
                <span className={cn(
                  player.kast >= 75 ? 'text-neon-green' : player.kast >= 60 ? 'text-yellow-400' : 'text-red-400'
                )}>
                  {player.kast.toFixed(1)}%
                </span>
              </td>
              {/* Rating */}
              <td className="px-4 py-3 text-center">
                <span className={cn('font-bold font-mono text-base', getRatingColor(player.rating))}>
                  {player.rating.toFixed(2)}
                </span>
              </td>
              {/* HS% */}
              <td className="px-4 py-3 text-center font-mono">
                <span className="text-muted-foreground">{formatPercent(player.headshot_percentage, 2)}</span>
              </td>
              {/* UD */}
              <td className="px-4 py-3 text-center font-mono">
                <span className="text-muted-foreground">{player.utility_damage}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function PlayerStatsTable({ players, highlightTeam }: PlayerStatsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('rating')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  // Group players by team, putting highlightTeam first
  const teamNames = [...new Set(players.map(p => p.team).filter(Boolean))]
  const ordered = highlightTeam
    ? [highlightTeam, ...teamNames.filter(t => t !== highlightTeam)]
    : teamNames

  if (ordered.length <= 1) {
    // Fallback: single table when team data is missing
    const sorted = sortPlayers(players, sortKey, sortDir)
    const SortIcon = ({ col }: { col: SortKey }) => {
      if (sortKey !== col) return <ChevronsUpDown size={12} className="text-muted-foreground/40" />
      return sortDir === 'desc'
        ? <ChevronDown size={12} className="text-neon-green" />
        : <ChevronUp size={12} className="text-neon-green" />
    }
    return (
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {columns.map(col => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  title={col.shortLabel}
                  className={cn(
                    'px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer select-none whitespace-nowrap hover:text-foreground transition-colors',
                    col.key === 'name' ? 'min-w-[160px]' : 'text-center'
                  )}
                >
                  <div className={cn('flex items-center gap-1', col.key !== 'name' && 'justify-center')}>
                    {col.label}
                    <SortIcon col={col.key} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {sorted.map((player, idx) => {
              const isHighlighted = highlightTeam ? player.team === highlightTeam : false
              return (
                <tr key={`${player.steam_id}-${idx}`} className={cn('transition-colors hover:bg-accent/30', isHighlighted && 'bg-neon-green/5 hover:bg-neon-green/10')}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className={cn('w-7 h-7 rounded flex items-center justify-center text-xs font-bold shrink-0', isHighlighted ? 'bg-neon-green/20 text-neon-green' : 'bg-muted text-muted-foreground')}>
                        {player.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className={cn('font-medium', isHighlighted ? 'text-neon-green' : 'text-foreground')}>{player.name}</p>
                        <p className="text-xs text-muted-foreground">{player.team}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center font-mono"><span className="text-foreground font-semibold">{player.kills}</span></td>
                  <td className="px-4 py-3 text-center font-mono"><span className="text-muted-foreground">{player.deaths}</span></td>
                  <td className="px-4 py-3 text-center font-mono"><span className="text-muted-foreground">{player.assists}</span></td>
                  <td className="px-4 py-3 text-center font-mono"><span className={cn(player.adr >= 90 ? 'text-neon-green' : player.adr >= 70 ? 'text-yellow-400' : 'text-muted-foreground')}>{player.adr.toFixed(1)}</span></td>
                  <td className="px-4 py-3 text-center font-mono"><span className={cn(player.kast >= 75 ? 'text-neon-green' : player.kast >= 60 ? 'text-yellow-400' : 'text-red-400')}>{player.kast.toFixed(1)}%</span></td>
                  <td className="px-4 py-3 text-center"><span className={cn('font-bold font-mono text-base', getRatingColor(player.rating))}>{player.rating.toFixed(2)}</span></td>
                  <td className="px-4 py-3 text-center font-mono"><span className="text-muted-foreground">{formatPercent(player.headshot_percentage, 2)}</span></td>
                  <td className="px-4 py-3 text-center font-mono"><span className="text-muted-foreground">{player.utility_damage}</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
      {ordered.map(teamName => (
        <TeamTable
          key={teamName}
          teamName={teamName}
          players={players.filter(p => p.team === teamName)}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          isHighlighted={teamName === highlightTeam}
        />
      ))}
    </div>
  )
}
