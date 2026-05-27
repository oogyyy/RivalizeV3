'use client'

import { useState } from 'react'
import { cn, formatDuration } from '@/lib/utils'
import type { Round } from '@/types/database'
import { Bomb, Shield, Clock, Timer, Skull, ChevronDown, ChevronUp } from 'lucide-react'

interface RoundTimelineProps {
  rounds: Round[]
  team1Name: string
  team2Name: string
  team1DisplayName?: string
  team2DisplayName?: string
}

function getEcoLevel(economy: number): { label: string; color: string; barColor: string; opacity: number } {
  if (economy >= 15000) return { label: 'Full',  color: 'text-neon-green', barColor: '#00ff87', opacity: 1.0 }
  if (economy >= 10000) return { label: 'Half',  color: 'text-yellow-400', barColor: '#facc15', opacity: 0.75 }
  if (economy >= 5000)  return { label: 'Force', color: 'text-orange-400', barColor: '#fb923c', opacity: 0.55 }
  return                       { label: 'Eco',   color: 'text-red-400',    barColor: '#f87171', opacity: 0.35 }
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

// ── Visual Round Strip ────────────────────────────────────────────────────────

interface RoundBlockProps {
  round: Round
  isTeam1Win: boolean
  isSelected: boolean
  halfBreakAfter: boolean
  onClick: () => void
}

function RoundBlock({ round, isTeam1Win, isSelected, halfBreakAfter, onClick }: RoundBlockProps) {
  const t1Eco = getEcoLevel(round.team1_economy)
  const t2Eco = getEcoLevel(round.team2_economy)
  const winnerEco = isTeam1Win ? t1Eco : t2Eco
  const baseColor = isTeam1Win ? '#00ff87' : '#ff4466'

  return (
    <div className="relative flex items-end" style={{ marginRight: halfBreakAfter ? 8 : 1 }}>
      <button
        onClick={onClick}
        title={`Round ${round.number} · ${isTeam1Win ? 'T1' : 'T2'} won · ${round.win_reason.replace(/_/g, ' ')}`}
        style={{
          width: 13,
          height: 28,
          borderRadius: 3,
          background: baseColor,
          opacity: winnerEco.opacity,
          border: isSelected ? '1.5px solid #fff' : '1.5px solid transparent',
          cursor: 'pointer',
          position: 'relative',
          transition: 'opacity 0.1s, transform 0.1s',
          flexShrink: 0,
        }}
        onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scaleY(1.15)' }}
        onMouseLeave={e => { e.currentTarget.style.opacity = String(winnerEco.opacity); e.currentTarget.style.transform = 'scaleY(1)' }}
      >
        {round.bomb_planted && (
          <span
            style={{
              position: 'absolute',
              bottom: 2,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 3,
              height: 3,
              borderRadius: '50%',
              background: '#ff9900',
            }}
          />
        )}
      </button>
      {halfBreakAfter && (
        <div
          style={{
            position: 'absolute',
            right: -5,
            top: 0,
            bottom: 0,
            width: 2,
            background: 'rgba(255,255,255,0.15)',
            borderRadius: 1,
          }}
        />
      )}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function RoundTimeline({ rounds, team1Name, team2Name, team1DisplayName, team2DisplayName }: RoundTimelineProps) {
  const [selectedRound, setSelectedRound] = useState<number | null>(null)
  const [tableExpanded, setTableExpanded] = useState(true)

  const team1Wins = rounds.filter(r => r.winner === team1Name).length
  const team2Wins = rounds.filter(r => r.winner === team2Name).length
  const t1Display = team1DisplayName || team1Name
  const t2Display = team2DisplayName || team2Name
  const halfAt = Math.floor(rounds.length / 2)

  const handleBlockClick = (roundNum: number) => {
    setSelectedRound(roundNum === selectedRound ? null : roundNum)
    if (tableExpanded) {
      const el = document.getElementById(`round-row-${roundNum}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }

  // Economy sparkline data
  const maxEco = 30000
  const halfBreakIdx = halfAt - 1  // insert gap after this index

  return (
    <div className="space-y-4">
      {/* Score summary */}
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

      {/* Visual round strip */}
      <div className="rounded-lg border border-border bg-card/60 p-3 space-y-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Round History</span>
          <div className="flex items-center gap-3 text-[9px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: '#00ff87' }} />{t1Display}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: '#ff4466' }} />{t2Display}</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#ff9900' }} />Plant</span>
          </div>
        </div>

        {/* Round blocks */}
        <div className="flex items-end flex-wrap gap-0" style={{ rowGap: 3 }}>
          {rounds.map((r, idx) => (
            <RoundBlock
              key={r.number}
              round={r}
              isTeam1Win={r.winner === team1Name}
              isSelected={selectedRound === r.number}
              halfBreakAfter={idx === halfBreakIdx}
              onClick={() => handleBlockClick(r.number)}
            />
          ))}
        </div>

        {/* Economy sparklines */}
        <div className="mt-2">
          <p className="text-[9px] text-muted-foreground mb-1 font-mono">Economy</p>
          <div className="relative h-8 flex gap-[1px] items-end">
            {rounds.map((r, idx) => {
              const t1h = Math.max(2, (r.team1_economy / maxEco) * 32)
              const t2h = Math.max(2, (r.team2_economy / maxEco) * 32)
              const t1Eco = getEcoLevel(r.team1_economy)
              const t2Eco = getEcoLevel(r.team2_economy)
              return (
                <div key={r.number} className="flex gap-px items-end" style={{ marginRight: idx === halfBreakIdx ? 8 : 0 }}>
                  <div style={{ width: 5, height: t1h, background: t1Eco.barColor, opacity: 0.7, borderRadius: '1px 1px 0 0' }} />
                  <div style={{ width: 5, height: t2h, background: t2Eco.barColor, opacity: 0.7, borderRadius: '1px 1px 0 0' }} />
                </div>
              )
            })}
          </div>
          <div className="flex items-center gap-3 mt-1 text-[9px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2 h-1 rounded-sm inline-block" style={{ background: '#00ff87' }} />T1</span>
            <span className="flex items-center gap-1"><span className="w-2 h-1 rounded-sm inline-block" style={{ background: '#ff4466' }} />T2</span>
          </div>
        </div>

        {/* Selected round detail */}
        {selectedRound !== null && (() => {
          const r = rounds.find(x => x.number === selectedRound)
          if (!r) return null
          const t1Won = r.winner === team1Name
          const t1e = getEcoLevel(r.team1_economy)
          const t2e = getEcoLevel(r.team2_economy)
          return (
            <div className="mt-2 p-2.5 rounded-md bg-muted/40 border border-border text-[11px] font-mono space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Round {r.number}</span>
                <span className={t1Won ? 'text-neon-green font-semibold' : 'text-red-400 font-semibold'}>
                  {t1Won ? t1Display : t2Display} won
                </span>
              </div>
              <div className="flex gap-4">
                <span><span className="text-muted-foreground">Reason: </span>{r.win_reason.replace(/_/g, ' ')}</span>
                <span><span className="text-muted-foreground">Duration: </span>{formatDuration(r.duration)}</span>
              </div>
              <div className="flex gap-4">
                <span><span className={t1e.color}>{t1Display}</span><span className="text-muted-foreground"> ${r.team1_economy.toLocaleString()} ({t1e.label})</span></span>
                <span><span className={t2e.color}>{t2Display}</span><span className="text-muted-foreground"> ${r.team2_economy.toLocaleString()} ({t2e.label})</span></span>
              </div>
              {r.kills.length > 0 && (
                <span className="text-muted-foreground">{r.kills.length} kills · {r.kills.filter(k => k.headshot).length} HS</span>
              )}
            </div>
          )
        })()}
      </div>

      {/* Table toggle */}
      <button
        onClick={() => setTableExpanded(!tableExpanded)}
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {tableExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        {tableExpanded ? 'Collapse' : 'Expand'} round table
      </button>

      {tableExpanded && (
        <>
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
              const isHighlighted = selectedRound === round.number

              return (
                <div
                  id={`round-row-${round.number}`}
                  key={round.number}
                  onClick={() => setSelectedRound(isHighlighted ? null : round.number)}
                  className={cn(
                    'grid grid-cols-[40px_1fr_80px_80px_80px_80px] gap-2 items-center px-3 py-2.5 rounded-md text-sm transition-colors cursor-pointer',
                    isHighlighted
                      ? 'ring-1 ring-white/20 bg-white/5'
                      : 'hover:bg-accent/20',
                    team1Won
                      ? 'border-l-2 border-neon-green bg-neon-green/5'
                      : 'border-l-2 border-red-400/50 bg-red-400/5'
                  )}
                >
                  <div className="text-center font-mono text-xs text-muted-foreground">{round.number}</div>
                  <div className="min-w-0">
                    <span className={cn('font-medium truncate', team1Won ? 'text-neon-green' : 'text-red-400')}>
                      {round.winner}
                    </span>
                    {round.bomb_planted && <Bomb size={10} className="inline ml-1.5 text-orange-400/70" />}
                  </div>
                  <div className="flex items-center justify-center gap-1.5">
                    <WinReasonIcon reason={round.win_reason} />
                    <span className="text-xs text-muted-foreground hidden sm:inline"><WinReasonLabel reason={round.win_reason} /></span>
                  </div>
                  <div className="text-center">
                    <span className={cn('text-xs font-medium', t1Eco.color)}>{t1Eco.label}</span>
                    <p className="text-xs text-muted-foreground font-mono">${round.team1_economy.toLocaleString()}</p>
                  </div>
                  <div className="text-center">
                    <span className={cn('text-xs font-medium', t2Eco.color)}>{t2Eco.label}</span>
                    <p className="text-xs text-muted-foreground font-mono">${round.team2_economy.toLocaleString()}</p>
                  </div>
                  <div className="text-center font-mono text-xs text-muted-foreground">{formatDuration(round.duration)}</div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
