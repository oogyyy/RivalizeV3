import { cn, formatDuration } from '@/lib/utils'
import type { Round } from '@/types/database'
import { Bomb, Shield, Clock, Crosshair, Timer, Skull } from 'lucide-react'

interface RoundTimelineProps {
  rounds: Round[]
  team1Name: string
  team2Name: string
  /** Optional display-only overrides — used when team1Name/team2Name are raw parser keys like 'T-Side' */
  team1DisplayName?: string
  team2DisplayName?: string
}

function getEcoLevel(economy: number): { label: string; color: string } {
  if (economy >= 15000) return { label: 'Full', color: 'text-neon-green' }
  if (economy >= 10000) return { label: 'Half', color: 'text-yellow-400' }
  if (economy >= 5000) return { label: 'Force', color: 'text-orange-400' }
  return { label: 'Eco', color: 'text-red-400' }
}

function WinReasonIcon({ reason }: { reason: string }) {
  const cls = 'w-4 h-4 shrink-0'
  if (reason === 'bomb_exploded') return <Bomb className={cn(cls, 'text-orange-400')} />
  if (reason === 'bomb_defused') return <Shield className={cn(cls, 'text-neon-blue')} />
  if (reason === 'time_expired') return <Timer className={cn(cls, 'text-yellow-400')} />
  return <Skull className={cn(cls, 'text-red-400')} />
}

function WinReasonLabel({ reason }: { reason: string }) {
  const map: Record<string, string> = {
    bomb_exploded: 'Exploded',
    bomb_defused: 'Defused',
    time_expired: 'Timeout',
    elimination: 'Elim',
  }
  return <>{map[reason] || reason}</>
}

export default function RoundTimeline({ rounds, team1Name, team2Name, team1DisplayName, team2DisplayName }: RoundTimelineProps) {
  const team1Wins = rounds.filter(r => r.winner === team1Name).length
  const team2Wins = rounds.filter(r => r.winner === team2Name).length
  const t1Display = team1DisplayName || team1Name
  const t2Display = team2DisplayName || team2Name

  return (
    <div className="space-y-4">
      {/* Score summary bar */}
      <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/30 border border-border">
        <div className="flex-1 text-right">
          <p className="text-sm font-semibold text-foreground truncate">{t1Display}</p>
          <p className="text-2xl font-bold text-neon-green">{team1Wins}</p>
        </div>
        <div className="text-muted-foreground font-mono text-lg">:</div>
        <div className="flex-1 text-left">
          <p className="text-sm font-semibold text-foreground truncate">{t2Display}</p>
          <p className="text-2xl font-bold text-red-400">{team2Wins}</p>
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[40px_1fr_80px_80px_80px_80px] gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border">
        <div className="text-center">#</div>
        <div>Winner</div>
        <div className="text-center">Result</div>
        <div className="text-center">T Eco</div>
        <div className="text-center">CT Eco</div>
        <div className="text-center flex items-center justify-center gap-1"><Clock size={10} />Duration</div>
      </div>

      {/* Round rows */}
      <div className="space-y-1">
        {rounds.map(round => {
          const team1Won = round.winner === team1Name
          const t1Eco = getEcoLevel(round.team1_economy)
          const t2Eco = getEcoLevel(round.team2_economy)

          return (
            <div
              key={round.number}
              className={cn(
                'grid grid-cols-[40px_1fr_80px_80px_80px_80px] gap-2 items-center px-3 py-2.5 rounded-md text-sm transition-colors hover:bg-accent/20',
                team1Won
                  ? 'border-l-2 border-neon-green bg-neon-green/5'
                  : 'border-l-2 border-red-400/50 bg-red-400/5'
              )}
            >
              {/* Round number */}
              <div className="text-center font-mono text-xs text-muted-foreground">
                {round.number}
              </div>

              {/* Winner name */}
              <div className="min-w-0">
                <span className={cn(
                  'font-medium truncate',
                  team1Won ? 'text-neon-green' : 'text-red-400'
                )}>
                  {round.winner}
                </span>
              </div>

              {/* Win reason */}
              <div className="flex items-center justify-center gap-1.5">
                <WinReasonIcon reason={round.win_reason} />
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  <WinReasonLabel reason={round.win_reason} />
                </span>
              </div>

              {/* T-side economy */}
              <div className="text-center">
                <span className={cn('text-xs font-medium', t1Eco.color)}>
                  {t1Eco.label}
                </span>
                <p className="text-xs text-muted-foreground font-mono">
                  ${round.team1_economy.toLocaleString()}
                </p>
              </div>

              {/* CT-side economy */}
              <div className="text-center">
                <span className={cn('text-xs font-medium', t2Eco.color)}>
                  {t2Eco.label}
                </span>
                <p className="text-xs text-muted-foreground font-mono">
                  ${round.team2_economy.toLocaleString()}
                </p>
              </div>

              {/* Duration */}
              <div className="text-center font-mono text-xs text-muted-foreground">
                {formatDuration(round.duration)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
