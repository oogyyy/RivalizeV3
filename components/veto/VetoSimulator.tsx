'use client'

import { useState, useMemo, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { RotateCcw, Trophy, Ban, Check, ChevronRight, Swords, Shuffle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export type Format = 'bo1' | 'bo3' | 'bo5'

interface MapStat { wins: number; losses: number; winRate: number }
interface OpponentEntry { id: string; name: string; mapPicks: Record<string, number> }

interface VetoStep {
  step: number
  team: 'us' | 'them'
  action: 'ban' | 'pick' | 'decider'
  label: string
}

/**
 * Veto sequences:
 * BO1 (7 maps → 1 played): ABABABABAB ban + decider
 * BO3 (7 maps → 3 played): AB ban, AB pick, AB ban, decider
 * BO5 (7 maps → 5 played): AB ban, ABAB pick, decider
 */
const VETO_SEQUENCES: Record<Format, VetoStep[]> = {
  bo1: [
    { step: 1, team: 'us',   action: 'ban',     label: 'We ban' },
    { step: 2, team: 'them', action: 'ban',     label: 'They ban' },
    { step: 3, team: 'us',   action: 'ban',     label: 'We ban' },
    { step: 4, team: 'them', action: 'ban',     label: 'They ban' },
    { step: 5, team: 'us',   action: 'ban',     label: 'We ban' },
    { step: 6, team: 'them', action: 'ban',     label: 'They ban' },
    { step: 7, team: 'us',   action: 'decider', label: 'Map played' },
  ],
  bo3: [
    { step: 1, team: 'us',   action: 'ban',     label: 'We ban' },
    { step: 2, team: 'them', action: 'ban',     label: 'They ban' },
    { step: 3, team: 'us',   action: 'pick',    label: 'We pick' },
    { step: 4, team: 'them', action: 'pick',    label: 'They pick' },
    { step: 5, team: 'us',   action: 'ban',     label: 'We ban' },
    { step: 6, team: 'them', action: 'ban',     label: 'They ban' },
    { step: 7, team: 'us',   action: 'decider', label: 'Decider' },
  ],
  bo5: [
    { step: 1, team: 'us',   action: 'ban',     label: 'We ban' },
    { step: 2, team: 'them', action: 'ban',     label: 'They ban' },
    { step: 3, team: 'us',   action: 'pick',    label: 'We pick' },
    { step: 4, team: 'them', action: 'pick',    label: 'They pick' },
    { step: 5, team: 'us',   action: 'pick',    label: 'We pick' },
    { step: 6, team: 'them', action: 'pick',    label: 'They pick' },
    { step: 7, team: 'us',   action: 'decider', label: 'Decider' },
  ],
}

const MAP_LABELS: Record<string, string> = {
  de_dust2:    'Dust2',
  de_mirage:   'Mirage',
  de_inferno:  'Inferno',
  de_nuke:     'Nuke',
  de_overpass: 'Overpass',
  de_ancient:  'Ancient',
  de_anubis:   'Anubis',
}

/**
 * Score a map for us: higher = better to pick, lower = better to ban.
 * Range approx 0–1.
 */
function scoreMap(
  map: string,
  selfStats: Record<string, MapStat>,
  oppPicks: Record<string, number>,
  maxOppPicks: number,
): { score: number; confidence: number } {
  const s = selfStats[map]
  const wr = s ? s.winRate : 0.5
  const games = s ? s.wins + s.losses : 0
  const confidence = Math.min(1, games / 10)

  const oppFreq = maxOppPicks > 0 ? (oppPicks[map] ?? 0) / maxOppPicks : 0
  // Score = our_wr penalised by opponent's tendency to pick this map
  const score = wr * (1 - oppFreq * 0.4)
  return { score, confidence }
}

/**
 * Suggest the best map to ban or pick for the current step.
 */
function suggest(
  action: 'ban' | 'pick' | 'decider',
  team: 'us' | 'them',
  remaining: string[],
  selfStats: Record<string, MapStat>,
  oppPicks: Record<string, number>,
  maxOppPicks: number,
): string {
  const scored = remaining.map(m => ({
    map: m,
    ...scoreMap(m, selfStats, oppPicks, maxOppPicks),
  }))

  if (action === 'decider') {
    // Decider: pick the middle ground map
    scored.sort((a, b) => a.score - b.score)
    return scored[Math.floor(scored.length / 2)]?.map ?? scored[0].map
  }

  if (action === 'pick') {
    if (team === 'us') {
      // Pick our strongest map
      scored.sort((a, b) => b.score - a.score)
    } else {
      // They'll pick their strongest (our weakest)
      scored.sort((a, b) => a.score - b.score)
    }
    return scored[0].map
  }

  // Ban
  if (team === 'us') {
    // Ban opponent's best map (our worst, they favor)
    scored.sort((a, b) => a.score - b.score)
  } else {
    // They'll ban our best
    scored.sort((a, b) => b.score - a.score)
  }
  return scored[0].map
}

interface MapAction {
  map: string
  step: VetoStep
}

interface VetoSimulatorProps {
  selfMapStats: Record<string, MapStat>
  opponents: OpponentEntry[]
  activeDutyMaps: string[]
}

export default function VetoSimulator({ selfMapStats, opponents, activeDutyMaps }: VetoSimulatorProps) {
  const [format, setFormat] = useState<Format>('bo3')
  const [selectedOpponentId, setSelectedOpponentId] = useState('')
  const [completedActions, setCompletedActions] = useState<MapAction[]>([])
  const [autoMode, setAutoMode] = useState(false)

  const opponent = opponents.find(o => o.id === selectedOpponentId) ?? null
  const oppPicks = opponent?.mapPicks ?? {}
  const maxOppPicks = Math.max(1, ...Object.values(oppPicks))

  const sequence = VETO_SEQUENCES[format]

  const remainingMaps = useMemo(() => {
    const banned = new Set(completedActions.map(a => a.map))
    return activeDutyMaps.filter(m => !banned.has(m))
  }, [completedActions, activeDutyMaps])

  const currentStepIndex = completedActions.length
  const currentStep = sequence[currentStepIndex] ?? null
  const isComplete = currentStepIndex >= sequence.length

  // Maps already picked / banned for display
  const pickedMaps = completedActions.filter(a => a.step.action === 'pick' || a.step.action === 'decider')
  const bannedMaps = completedActions.filter(a => a.step.action === 'ban')

  // Confidence score for each remaining map
  const mapScores = useMemo(() => {
    const result: Record<string, { score: number; confidence: number }> = {}
    for (const m of remainingMaps) {
      result[m] = scoreMap(m, selfMapStats, oppPicks, maxOppPicks)
    }
    return result
  }, [remainingMaps, selfMapStats, oppPicks, maxOppPicks])

  // AI suggestion for current step
  const aiSuggestion = useMemo(() => {
    if (!currentStep || isComplete) return null
    return suggest(currentStep.action, currentStep.team, remainingMaps, selfMapStats, oppPicks, maxOppPicks)
  }, [currentStep, isComplete, remainingMaps, selfMapStats, oppPicks, maxOppPicks])

  const selectMap = useCallback((map: string) => {
    if (!currentStep || isComplete) return
    setCompletedActions(prev => [...prev, { map, step: currentStep }])
  }, [currentStep, isComplete])

  function applyAiSuggestion() {
    if (aiSuggestion) selectMap(aiSuggestion)
  }

  function applyAllAi() {
    let remaining = [...activeDutyMaps]
    const actions: MapAction[] = []
    for (const step of sequence) {
      if (remaining.length === 0) break
      const picked = suggest(step.action, step.team, remaining, selfMapStats, oppPicks, maxOppPicks)
      actions.push({ map: picked, step })
      remaining = remaining.filter(m => m !== picked)
    }
    setCompletedActions(actions)
  }

  function reset() {
    setCompletedActions([])
  }

  const winProbability = useMemo(() => {
    if (pickedMaps.length === 0) return null
    const maps = pickedMaps.map(a => a.map)
    const scores = maps.map(m => {
      const s = selfMapStats[m]
      return s ? s.winRate : 0.5
    })
    return scores.reduce((a, b) => a + b, 0) / scores.length
  }, [pickedMaps, selfMapStats])

  return (
    <div className="space-y-5">
      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Format selector */}
        <div className="flex items-center rounded-lg border border-border overflow-hidden text-xs font-semibold">
          {(['bo1', 'bo3', 'bo5'] as Format[]).map(f => (
            <button
              key={f}
              onClick={() => { setFormat(f); reset() }}
              className={cn(
                'px-4 py-2 uppercase tracking-wider transition-colors',
                format === f ? 'bg-neon-green/20 text-neon-green' : 'text-muted-foreground hover:text-foreground hover:bg-accent/30'
              )}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Opponent selector */}
        {opponents.length > 0 && (
          <select
            value={selectedOpponentId}
            onChange={e => { setSelectedOpponentId(e.target.value); reset() }}
            className="text-xs bg-card border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-neon-green/50"
          >
            <option value="">— No opponent —</option>
            {opponents.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        )}

        <div className="flex items-center gap-2 ml-auto">
          <Button variant="secondary" size="sm" className="gap-1.5 text-xs h-8" onClick={applyAllAi}>
            <Shuffle size={12} />
            Auto-fill AI
          </Button>
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-8" onClick={reset} disabled={completedActions.length === 0}>
            <RotateCcw size={12} />
            Reset
          </Button>
        </div>
      </div>

      {/* Step progress */}
      <div className="flex items-center gap-1 flex-wrap">
        {sequence.map((step, idx) => {
          const done = idx < currentStepIndex
          const active = idx === currentStepIndex
          const action = completedActions[idx]
          return (
            <div key={idx} className="flex items-center gap-1">
              <div className={cn(
                'flex flex-col items-center rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold transition-all min-w-[72px]',
                done && step.action === 'ban'     && 'border-red-400/30 bg-red-400/10 text-red-400',
                done && step.action === 'pick'    && 'border-neon-green/30 bg-neon-green/10 text-neon-green',
                done && step.action === 'decider' && 'border-yellow-400/30 bg-yellow-400/10 text-yellow-400',
                active && 'border-neon-green/60 bg-neon-green/10 text-neon-green ring-1 ring-neon-green/40 scale-105',
                !done && !active && 'border-border text-muted-foreground',
              )}>
                <span className="uppercase tracking-widest text-[8px]">{step.label}</span>
                <span className="font-mono text-[11px] font-bold mt-0.5 truncate max-w-[64px]">
                  {action ? MAP_LABELS[action.map] ?? action.map : '—'}
                </span>
              </div>
              {idx < sequence.length - 1 && (
                <ChevronRight size={10} className="text-muted-foreground/40 shrink-0" />
              )}
            </div>
          )
        })}
      </div>

      {/* Map grid */}
      {!isComplete && currentStep && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground">
              Step {currentStepIndex + 1}:
              <span className={cn(
                'ml-1.5',
                currentStep.action === 'ban' ? 'text-red-400' : 'text-neon-green'
              )}>
                {currentStep.label}
              </span>
            </p>
            {aiSuggestion && (
              <button
                onClick={applyAiSuggestion}
                className="text-[10px] font-semibold px-2 py-0.5 rounded bg-neon-green/10 text-neon-green border border-neon-green/20 hover:bg-neon-green/20 transition-colors"
              >
                AI suggests: {MAP_LABELS[aiSuggestion] ?? aiSuggestion}
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
            {activeDutyMaps.map(map => {
              const isRemaining = remainingMaps.includes(map)
              const alreadyDone = completedActions.find(a => a.map === map)
              const score = mapScores[map]
              const isTheirTurn = currentStep.team === 'them'
              const isSuggested = map === aiSuggestion

              const pct = Math.round((score?.score ?? 0.5) * 100)
              const barColor = pct >= 60 ? '#00ffc8' : pct >= 40 ? '#facc15' : '#ff4466'

              return (
                <button
                  key={map}
                  onClick={() => isRemaining && selectMap(map)}
                  disabled={!isRemaining}
                  className={cn(
                    'relative flex flex-col items-center gap-1 p-3 rounded-xl border transition-all text-center',
                    isRemaining && !isSuggested && 'border-border hover:border-neon-green/50 hover:bg-card/80 cursor-pointer',
                    isRemaining && isSuggested && 'border-neon-green/60 bg-neon-green/10 ring-1 ring-neon-green/30',
                    !isRemaining && alreadyDone?.step.action === 'ban'     && 'border-red-400/20 bg-red-400/5 opacity-50',
                    !isRemaining && alreadyDone?.step.action === 'pick'    && 'border-neon-green/20 bg-neon-green/5 opacity-70',
                    !isRemaining && alreadyDone?.step.action === 'decider' && 'border-yellow-400/20 bg-yellow-400/5 opacity-70',
                  )}
                >
                  {/* Status badge */}
                  {alreadyDone && (
                    <div className={cn(
                      'absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center',
                      alreadyDone.step.action === 'ban' ? 'bg-red-400 text-white' : 'bg-neon-green text-black'
                    )}>
                      {alreadyDone.step.action === 'ban' ? <Ban size={10} /> : <Check size={10} />}
                    </div>
                  )}

                  {isSuggested && isRemaining && (
                    <div className="absolute -top-1.5 -left-1.5 text-[8px] font-bold px-1 py-0.5 rounded bg-neon-green text-black">
                      AI
                    </div>
                  )}

                  <span className="text-xs font-bold text-foreground">
                    {MAP_LABELS[map] ?? map}
                  </span>

                  {/* Our win rate bar */}
                  {isRemaining && score && (
                    <div className="w-full space-y-0.5">
                      <div className="h-1 bg-border rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, background: barColor }}
                        />
                      </div>
                      <span className="text-[9px] font-mono" style={{ color: barColor }}>
                        {pct}%
                      </span>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
          <p className="text-[10px] text-muted-foreground">
            Bar = our win rate on that map. Click to {currentStep.action}.
          </p>
        </div>
      )}

      {/* Result summary */}
      {isComplete && (
        <div className="rounded-xl border border-neon-green/20 bg-gradient-to-br from-neon-green/10 to-transparent p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Trophy size={18} className="text-neon-green" />
            <h3 className="text-base font-bold text-foreground">Veto Complete</h3>
            {winProbability !== null && (
              <span className={cn(
                'ml-auto text-sm font-bold font-mono px-2.5 py-1 rounded-lg',
                winProbability >= 0.55 ? 'bg-neon-green/20 text-neon-green' :
                winProbability >= 0.45 ? 'bg-yellow-400/20 text-yellow-400' :
                'bg-red-400/20 text-red-400'
              )}>
                Est. {Math.round(winProbability * 100)}% win rate
              </span>
            )}
          </div>

          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${pickedMaps.length}, 1fr)` }}>
            {pickedMaps.map((a, idx) => {
              const s = selfMapStats[a.map]
              const games = s ? s.wins + s.losses : 0
              const wr = s ? Math.round(s.winRate * 100) : null
              const isDecider = a.step.action === 'decider'
              const pickedBy = a.step.team === 'us' ? 'Our pick' : (isDecider ? 'Decider' : 'Their pick')

              return (
                <div key={idx} className={cn(
                  'rounded-xl border p-4 text-center space-y-1',
                  isDecider ? 'border-yellow-400/30 bg-yellow-400/5' :
                  a.step.team === 'us' ? 'border-neon-green/30 bg-neon-green/5' :
                  'border-blue-400/30 bg-blue-400/5'
                )}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {pickedBy}
                  </p>
                  <p className="text-lg font-bold text-foreground">
                    {MAP_LABELS[a.map] ?? a.map}
                  </p>
                  {wr !== null ? (
                    <p className={cn(
                      'text-xs font-mono font-bold',
                      wr >= 60 ? 'text-neon-green' : wr >= 45 ? 'text-yellow-400' : 'text-red-400'
                    )}>
                      {wr}% WR ({games}G)
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">No data</p>
                  )}
                </div>
              )
            })}
          </div>

          {/* Banned maps summary */}
          {bannedMaps.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
              <span className="text-[10px] text-muted-foreground font-semibold">Banned:</span>
              {bannedMaps.map(a => (
                <span key={a.map} className="text-[10px] px-2 py-0.5 rounded bg-red-400/10 text-red-400 font-medium">
                  {MAP_LABELS[a.map] ?? a.map}
                  <span className="text-red-400/50 ml-1">({a.step.team === 'us' ? 'us' : 'them'})</span>
                </span>
              ))}
            </div>
          )}

          <Button variant="secondary" size="sm" className="gap-1.5 text-xs" onClick={reset}>
            <RotateCcw size={12} />
            Simulate again
          </Button>
        </div>
      )}
    </div>
  )
}
