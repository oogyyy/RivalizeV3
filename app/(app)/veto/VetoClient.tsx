'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { cn } from '@/lib/utils'
import {
  Shield, Zap, X, Check, Sparkles, Brain, Loader2, AlertCircle,
  RotateCcw, Trophy, Swords, Shuffle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

/* ─── types ────────────────────────────────────────────────────── */

interface MapStat { wins: number; losses: number; winRate: number }

interface OpponentEntry {
  id: string
  name: string
  mapPicks: Record<string, number>
}

interface Props {
  selfMapStats: Record<string, MapStat>
  opponents: OpponentEntry[]
  activeDutyMaps: string[]
  hasData: boolean
}

type MapState = null | 'banned' | 'picked'
type Format = 'bo1' | 'bo3' | 'bo5'

/* ─── constants ─────────────────────────────────────────────────── */

const MAP_LABELS: Record<string, string> = {
  de_dust2:    'Dust2',
  de_mirage:   'Mirage',
  de_inferno:  'Inferno',
  de_nuke:     'Nuke',
  de_overpass: 'Overpass',
  de_ancient:  'Ancient',
  de_anubis:   'Anubis',
}

// Accent colors per map
const MAP_COLORS: Record<string, string> = {
  de_dust2:    '#C8A86B',
  de_mirage:   '#8B7CFF',
  de_inferno:  '#FF8C42',
  de_nuke:     '#4ECDC4',
  de_overpass: '#45B7D1',
  de_ancient:  '#A8D8A8',
  de_anubis:   '#FFD93D',
}

interface VetoStep {
  step: number
  team: 'us' | 'them'
  action: 'ban' | 'pick' | 'decider'
  label: string
}

const VETO_SEQUENCES: Record<Format, VetoStep[]> = {
  bo1: [
    { step: 1, team: 'us',   action: 'ban',     label: 'We ban' },
    { step: 2, team: 'them', action: 'ban',     label: 'They ban' },
    { step: 3, team: 'us',   action: 'ban',     label: 'We ban' },
    { step: 4, team: 'them', action: 'ban',     label: 'They ban' },
    { step: 5, team: 'us',   action: 'ban',     label: 'We ban' },
    { step: 6, team: 'them', action: 'ban',     label: 'They ban' },
    { step: 7, team: 'us',   action: 'decider', label: 'Played' },
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

/* ─── helpers ───────────────────────────────────────────────────── */

function scoreMap(
  map: string,
  selfStats: Record<string, MapStat>,
  oppPicks: Record<string, number>,
  maxOppPicks: number,
): number {
  const s = selfStats[map]
  const wr = s ? s.winRate : 0.5
  const oppFreq = maxOppPicks > 0 ? (oppPicks[map] ?? 0) / maxOppPicks : 0
  return wr * (1 - oppFreq * 0.4)
}

function suggestMap(
  action: 'ban' | 'pick' | 'decider',
  team: 'us' | 'them',
  remaining: string[],
  selfStats: Record<string, MapStat>,
  oppPicks: Record<string, number>,
  maxOppPicks: number,
): string {
  const scored = remaining.map(m => ({ map: m, score: scoreMap(m, selfStats, oppPicks, maxOppPicks) }))
  if (action === 'decider') {
    scored.sort((a, b) => a.score - b.score)
    return scored[Math.floor(scored.length / 2)]?.map ?? scored[0].map
  }
  if (action === 'pick') {
    scored.sort(team === 'us' ? (a, b) => b.score - a.score : (a, b) => a.score - b.score)
  } else {
    scored.sort(team === 'us' ? (a, b) => a.score - b.score : (a, b) => b.score - a.score)
  }
  return scored[0].map
}

/* ─── sub-components ────────────────────────────────────────────── */

function TeamEmblem({ name, icon: Icon, color, size = 52 }: {
  name: string; icon: React.ElementType; color: string; size?: number
}) {
  return (
    <div
      aria-label={name}
      style={{
        width: size, height: size,
        borderRadius: 14,
        background: `linear-gradient(145deg, color-mix(in srgb, ${color} 22%, transparent), color-mix(in srgb, ${color} 8%, transparent))`,
        border: `1.5px solid color-mix(in srgb, ${color} 40%, transparent)`,
        boxShadow: `0 0 18px color-mix(in srgb, ${color} 28%, transparent), inset 0 1px 0 rgba(255,255,255,0.08)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <Icon size={size * 0.42} color={color} strokeWidth={1.8} />
    </div>
  )
}

function MapTile({
  map, mapState, score, isSuggested, isLocked, onSelect, currentAction,
}: {
  map: string
  mapState: MapState
  score: number | null
  isSuggested: boolean
  isLocked: boolean
  onSelect: () => void
  currentAction: 'ban' | 'pick' | 'decider' | null
}) {
  const label = MAP_LABELS[map] ?? map
  const color = MAP_COLORS[map] ?? 'var(--accent)'
  const pct = score !== null ? Math.round(score * 100) : null
  const barColor = pct === null ? '#888' : pct >= 60 ? '#34E2A0' : pct >= 40 ? '#facc15' : '#FF6B7A'
  const isAvailable = mapState === null && !isLocked

  return (
    <button
      onClick={onSelect}
      disabled={!isAvailable}
      className={cn(
        'relative flex flex-col items-center justify-between gap-1.5 rounded-xl border transition-all duration-200 text-center overflow-hidden',
        'p-3 min-h-[110px]',
        isAvailable && !isSuggested && 'border-border hover:border-[color:var(--accent)]/40 hover:bg-white/[0.03] cursor-pointer',
        isAvailable && isSuggested && 'border-[color:var(--signal)]/50 bg-[color:var(--signal)]/5 ring-1 ring-[color:var(--signal)]/20 cursor-pointer',
        mapState === 'banned' && 'border-[#FF6B7A]/20 bg-[#FF6B7A]/5 opacity-70 cursor-not-allowed',
        mapState === 'picked' && 'border-[#34E2A0]/25 bg-[#34E2A0]/5 opacity-80 cursor-not-allowed',
      )}
    >
      {/* Color accent top strip */}
      <div
        className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl"
        style={{ background: mapState === 'banned' ? '#FF6B7A' : mapState === 'picked' ? '#34E2A0' : isSuggested ? 'var(--signal)' : color, opacity: 0.6 }}
      />

      {/* AI badge */}
      {isSuggested && isAvailable && (
        <div className="absolute top-2 left-2 text-[8px] font-bold px-1 py-0.5 rounded" style={{ background: 'var(--signal)', color: '#000' }}>
          AI
        </div>
      )}

      {/* Status overlay icon */}
      {mapState === 'banned' && (
        <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#FF6B7A] flex items-center justify-center">
          <X size={10} color="#fff" strokeWidth={2.5} />
        </div>
      )}
      {mapState === 'picked' && (
        <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#34E2A0] flex items-center justify-center">
          <Check size={10} color="#000" strokeWidth={2.5} />
        </div>
      )}

      {/* Map name */}
      <span className={cn(
        'text-xs font-bold mt-3 leading-tight',
        mapState === 'banned' ? 'text-[#FF6B7A]' : mapState === 'picked' ? 'text-[#34E2A0]' : 'text-foreground',
      )}>
        {label}
      </span>

      {/* State label */}
      {mapState !== null && (
        <span className={cn(
          'text-[9px] font-semibold uppercase tracking-wider',
          mapState === 'banned' ? 'text-[#FF6B7A]/70' : 'text-[#34E2A0]/70'
        )}>
          {mapState === 'banned' ? 'Banned' : 'Picked'}
        </span>
      )}

      {/* Win rate bar */}
      {isAvailable && pct !== null && (
        <div className="w-full mt-auto space-y-0.5">
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: barColor }} />
          </div>
          <span className="text-[9px] font-mono" style={{ color: barColor }}>{pct}% WR</span>
        </div>
      )}
    </button>
  )
}

function SequenceDot({ step, action, done, active, mapLabel }: {
  step: VetoStep; action: MapState | 'decider'; done: boolean; active: boolean; mapLabel: string | null
}) {
  const ring = done && step.action === 'ban'
    ? '#FF6B7A'
    : done && (step.action === 'pick' || step.action === 'decider')
    ? '#34E2A0'
    : active
    ? 'var(--accent)'
    : 'rgba(255,255,255,0.12)'

  const bg = active
    ? 'radial-gradient(circle, color-mix(in srgb, var(--accent) 20%, transparent), transparent 70%)'
    : 'transparent'

  return (
    <div className="flex flex-col items-center gap-1 min-w-[60px]">
      {active && (
        <span className="text-[8px] font-bold uppercase tracking-widest" style={{ color: 'var(--accent)' }}>
          CURRENT
        </span>
      )}
      {!active && <span className="text-[8px] invisible">CURRENT</span>}

      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-[10px] font-bold transition-all"
        style={{
          border: `2px solid ${ring}`,
          background: bg,
          boxShadow: active ? `0 0 14px color-mix(in srgb, var(--accent) 40%, transparent)` : 'none',
          color: done ? ring : active ? 'var(--accent)' : 'rgba(255,255,255,0.35)',
        }}
      >
        {mapLabel ? mapLabel.slice(0, 3).toUpperCase() : step.step}
      </div>

      <div className="text-center">
        <p className="text-[9px] font-semibold leading-tight" style={{ color: ring !== 'rgba(255,255,255,0.12)' ? ring : 'rgba(255,255,255,0.3)' }}>
          {done
            ? step.action === 'ban' ? 'Banned' : step.action === 'decider' ? 'Decider' : 'Picked'
            : active ? step.label : step.label}
        </p>
        <p className="text-[8px] leading-tight" style={{ color: 'rgba(255,255,255,0.25)' }}>
          {step.team === 'us' ? 'You' : 'Opp'}
        </p>
      </div>
    </div>
  )
}

/* ─── main component ────────────────────────────────────────────── */

export default function VetoClient({ selfMapStats, opponents, activeDutyMaps, hasData }: Props) {
  const [format, setFormat] = useState<Format>('bo3')
  const [selectedOpponentId, setSelectedOpponentId] = useState('')
  const [completedActions, setCompletedActions] = useState<Array<{ map: string; step: VetoStep }>>([])
  const [showAIPanel, setShowAIPanel] = useState(true)
  const [aiRecommendation, setAiRecommendation] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')

  const opponent = opponents.find(o => o.id === selectedOpponentId) ?? null
  const oppPicks = opponent?.mapPicks ?? {}
  const maxOppPicks = Math.max(1, ...Object.values(oppPicks).concat([1]))

  const sequence = VETO_SEQUENCES[format]
  const currentStepIndex = completedActions.length
  const currentStep = sequence[currentStepIndex] ?? null
  const isComplete = currentStepIndex >= sequence.length

  const remainingMaps = useMemo(() => {
    const used = new Set(completedActions.map(a => a.map))
    return activeDutyMaps.filter(m => !used.has(m))
  }, [completedActions, activeDutyMaps])

  // Build map state map for display
  const mapStateMap = useMemo(() => {
    const result: Record<string, MapState> = {}
    for (const m of activeDutyMaps) result[m] = null
    for (const a of completedActions) {
      result[a.map] = a.step.action === 'ban' ? 'banned' : 'picked'
    }
    return result
  }, [completedActions, activeDutyMaps])

  const aiSuggestion = useMemo(() => {
    if (!currentStep || isComplete) return null
    return suggestMap(currentStep.action, currentStep.team, remainingMaps, selfMapStats, oppPicks, maxOppPicks)
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
    const actions: Array<{ map: string; step: VetoStep }> = []
    for (const step of sequence) {
      if (remaining.length === 0) break
      const picked = suggestMap(step.action, step.team, remaining, selfMapStats, oppPicks, maxOppPicks)
      actions.push({ map: picked, step })
      remaining = remaining.filter(m => m !== picked)
    }
    setCompletedActions(actions)
  }

  function reset() {
    setCompletedActions([])
    setAiRecommendation('')
    setAiError('')
  }

  async function getAIRecommendation() {
    setAiLoading(true)
    setAiError('')
    setAiRecommendation('')
    try {
      const res = await fetch('/api/veto/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selfMapStats,
          opponentMapPicks: opponent?.mapPicks,
          opponentName: opponent?.name,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setAiRecommendation(data.recommendation ?? '')
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'Failed to generate recommendation')
    } finally {
      setAiLoading(false)
    }
  }

  const pickedMaps = completedActions.filter(a => a.step.action === 'pick' || a.step.action === 'decider')
  const bannedMaps = completedActions.filter(a => a.step.action === 'ban')

  const winProbability = useMemo(() => {
    if (pickedMaps.length === 0) return null
    const scores = pickedMaps.map(a => selfMapStats[a.map]?.winRate ?? 0.5)
    return scores.reduce((a, b) => a + b, 0) / scores.length
  }, [pickedMaps, selfMapStats])

  const yourTeam = 'Your Team'
  const opponentName = opponent?.name ?? 'Opponent'

  return (
    <div className="min-h-full">
      {/* ── page header ── */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-4 md:py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[color:var(--accent)]/10 border border-[color:var(--accent)]/20 flex items-center justify-center">
                <Swords size={18} style={{ color: 'var(--accent)' }} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Veto Planner</h1>
                <p className="text-sm text-muted-foreground">Map pool analysis &amp; veto simulator</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-6">

        {!hasData && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-yellow-400/10 border border-yellow-400/20 text-sm text-yellow-300">
            <AlertCircle size={16} className="shrink-0" />
            No team data found. Upload self-analysis demos in My Team to populate your map pool stats.
          </div>
        )}

        {/* ── VS Header ── */}
        <div className="rv-panel p-5 relative overflow-hidden">
          <span className="rv-tick rv-tick-tl" />
          <span className="rv-tick rv-tick-br" />

          <div className="flex items-center justify-between gap-4">
            {/* Your team */}
            <div className="flex items-center gap-3 flex-1">
              <TeamEmblem name={yourTeam} icon={Shield} color="var(--accent)" />
              <div>
                <p className="text-base font-bold text-foreground">{yourTeam}</p>
                <p className="text-xs text-muted-foreground">ESEA Advanced</p>
              </div>
            </div>

            {/* VS + controls */}
            <div className="flex flex-col items-center gap-2 shrink-0">
              <span className="text-2xl font-black text-foreground/20 tracking-widest">VS</span>
              {/* Format selector */}
              <div className="flex items-center rounded-lg border border-border overflow-hidden text-[10px] font-semibold">
                {(['bo1', 'bo3', 'bo5'] as Format[]).map(f => (
                  <button
                    key={f}
                    onClick={() => { setFormat(f); reset() }}
                    className={cn(
                      'px-3 py-1.5 uppercase tracking-wider transition-colors',
                      format === f
                        ? 'text-black'
                        : 'text-muted-foreground hover:text-foreground hover:bg-white/5',
                    )}
                    style={format === f ? { background: 'var(--accent)', color: '#fff' } : {}}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Opponent */}
            <div className="flex items-center gap-3 flex-1 justify-end flex-row-reverse">
              <TeamEmblem name={opponentName} icon={Zap} color="var(--loss)" />
              <div className="text-right">
                {opponents.length > 0 ? (
                  <select
                    value={selectedOpponentId}
                    onChange={e => { setSelectedOpponentId(e.target.value); reset() }}
                    className="text-sm font-bold bg-transparent border-none text-foreground focus:outline-none cursor-pointer text-right"
                  >
                    <option value="">— Select opponent —</option>
                    {opponents.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                ) : (
                  <p className="text-base font-bold text-foreground">Opponent</p>
                )}
                <p className="text-xs text-muted-foreground">Best of {format === 'bo1' ? '1' : format === 'bo3' ? '3' : '5'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Map Pool Grid ── */}
        <div className="rv-panel p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Map Pool</h2>
              {currentStep && !isComplete && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Step {currentStepIndex + 1}:&nbsp;
                  <span className={cn('font-semibold', currentStep.action === 'ban' ? 'text-[#FF6B7A]' : 'text-[#34E2A0]')}>
                    {currentStep.label}
                  </span>
                  {aiSuggestion && (
                    <span className="ml-2 text-muted-foreground">
                      — AI suggests&nbsp;
                      <button
                        onClick={applyAiSuggestion}
                        className="font-semibold underline underline-offset-2"
                        style={{ color: 'var(--signal)' }}
                      >
                        {MAP_LABELS[aiSuggestion] ?? aiSuggestion}
                      </button>
                    </span>
                  )}
                </p>
              )}
              {isComplete && <p className="text-xs text-muted-foreground mt-0.5">Veto complete</p>}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" className="gap-1.5 text-xs h-7" onClick={applyAllAi}>
                <Shuffle size={11} />
                Auto-fill
              </Button>
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-7" onClick={reset} disabled={completedActions.length === 0}>
                <RotateCcw size={11} />
                Reset
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 sm:grid-cols-4 md:grid-cols-7">
            {activeDutyMaps.map(map => {
              const mapState = mapStateMap[map]
              const isAvailable = mapState === null
              const score = isAvailable
                ? scoreMap(map, selfMapStats, oppPicks, maxOppPicks)
                : null

              return (
                <MapTile
                  key={map}
                  map={map}
                  mapState={mapState}
                  score={score}
                  isSuggested={map === aiSuggestion && !isComplete}
                  isLocked={!isAvailable || isComplete}
                  onSelect={() => isAvailable && !isComplete && selectMap(map)}
                  currentAction={currentStep?.action ?? null}
                />
              )
            })}
          </div>

          {!isComplete && (
            <p className="text-[10px] text-muted-foreground">
              Click an available map to {currentStep?.action ?? 'select'} it. Bar shows your win rate.
            </p>
          )}
        </div>

        {/* ── Veto Sequence Timeline ── */}
        <div className="rv-panel p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Veto Sequence</h2>

          <div className="flex items-start gap-0 overflow-x-auto pb-1">
            {sequence.map((step, idx) => {
              const done = idx < currentStepIndex
              const active = idx === currentStepIndex && !isComplete
              const action = completedActions[idx]
              const mapLabel = action ? (MAP_LABELS[action.map] ?? action.map) : null

              const ringColor = done && step.action === 'ban'
                ? '#FF6B7A'
                : done && (step.action === 'pick' || step.action === 'decider')
                ? '#34E2A0'
                : active ? 'var(--accent)' : 'rgba(255,255,255,0.12)'

              const nextRing = idx < sequence.length - 1 ? (
                idx + 1 < currentStepIndex
                  ? (sequence[idx + 1].action === 'ban' ? '#FF6B7A' : '#34E2A0')
                  : idx + 1 === currentStepIndex ? 'var(--accent)' : 'rgba(255,255,255,0.08)'
              ) : null

              return (
                <div key={idx} className="flex items-start shrink-0">
                  <SequenceDot
                    step={step}
                    action={done ? (step.action === 'ban' ? 'banned' : 'picked') : null}
                    done={done}
                    active={active}
                    mapLabel={mapLabel}
                  />
                  {idx < sequence.length - 1 && (
                    <div className="mt-[30px] flex-1 min-w-[20px] max-w-[32px] h-0.5 self-center shrink-0"
                      style={{
                        background: `linear-gradient(90deg, ${ringColor}, ${nextRing})`,
                        opacity: 0.5,
                      }}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Veto Complete Summary ── */}
        {isComplete && (
          <div className="rv-panel p-5 space-y-4" style={{ borderColor: 'color-mix(in srgb, #34E2A0 25%, transparent)' }}>
            <div className="flex items-center gap-2">
              <Trophy size={18} style={{ color: '#34E2A0' }} />
              <h3 className="text-base font-bold text-foreground">Veto Complete</h3>
              {winProbability !== null && (
                <span
                  className="ml-auto text-sm font-bold font-mono px-2.5 py-1 rounded-lg"
                  style={{
                    background: winProbability >= 0.55
                      ? 'color-mix(in srgb, #34E2A0 15%, transparent)'
                      : winProbability >= 0.45
                      ? 'color-mix(in srgb, #facc15 15%, transparent)'
                      : 'color-mix(in srgb, #FF6B7A 15%, transparent)',
                    color: winProbability >= 0.55 ? '#34E2A0' : winProbability >= 0.45 ? '#facc15' : '#FF6B7A',
                  }}
                >
                  Est. {Math.round(winProbability * 100)}% win rate
                </span>
              )}
            </div>

            {pickedMaps.length > 0 && (
              <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${pickedMaps.length}, 1fr)` }}>
                {pickedMaps.map((a, idx) => {
                  const s = selfMapStats[a.map]
                  const games = s ? s.wins + s.losses : 0
                  const wr = s ? Math.round(s.winRate * 100) : null
                  const isDecider = a.step.action === 'decider'
                  const pickedBy = a.step.team === 'us' ? 'Our pick' : isDecider ? 'Decider' : 'Their pick'

                  return (
                    <div
                      key={idx}
                      className="rounded-xl border p-4 text-center space-y-1"
                      style={{
                        borderColor: isDecider
                          ? 'color-mix(in srgb, #facc15 30%, transparent)'
                          : a.step.team === 'us'
                          ? 'color-mix(in srgb, #34E2A0 30%, transparent)'
                          : 'color-mix(in srgb, var(--loss) 30%, transparent)',
                        background: isDecider
                          ? 'color-mix(in srgb, #facc15 5%, transparent)'
                          : a.step.team === 'us'
                          ? 'color-mix(in srgb, #34E2A0 5%, transparent)'
                          : 'color-mix(in srgb, var(--loss) 5%, transparent)',
                      }}
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{pickedBy}</p>
                      <p className="text-lg font-bold text-foreground">{MAP_LABELS[a.map] ?? a.map}</p>
                      {wr !== null ? (
                        <p className="text-xs font-mono font-bold" style={{ color: wr >= 60 ? '#34E2A0' : wr >= 45 ? '#facc15' : '#FF6B7A' }}>
                          {wr}% WR ({games}G)
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">No data</p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {bannedMaps.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                <span className="text-[10px] text-muted-foreground font-semibold">Banned:</span>
                {bannedMaps.map(a => (
                  <span key={a.map} className="text-[10px] px-2 py-0.5 rounded bg-[#FF6B7A]/10 text-[#FF6B7A] font-medium">
                    {MAP_LABELS[a.map] ?? a.map}
                    <span className="text-[#FF6B7A]/50 ml-1">({a.step.team === 'us' ? 'us' : 'them'})</span>
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

        {/* ── AI Recommendation Panel ── */}
        {showAIPanel && (
          <div className="rv-panel rv-insight p-5 space-y-4 relative">
            <span className="rv-tick rv-tick-tl" />
            <span className="rv-tick rv-tick-br" style={{ borderColor: 'color-mix(in srgb, var(--signal) 48%, transparent)' }} />

            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <Sparkles size={15} style={{ color: 'var(--signal)' }} />
                <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded" style={{ background: 'color-mix(in srgb, var(--signal) 15%, transparent)', color: 'var(--signal)' }}>
                  AI INSIGHT
                </span>
                <h2 className="text-sm font-semibold text-foreground">
                  {opponent ? `Veto Strategy vs ${opponentName}` : 'Map Pool Analysis'}
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7 gap-1.5"
                  onClick={getAIRecommendation}
                  disabled={aiLoading}
                >
                  {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Brain size={12} />}
                  {aiLoading ? 'Generating…' : 'Get Recommendation'}
                </Button>
                {aiRecommendation && (
                  <button
                    onClick={() => setShowAIPanel(false)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Dismiss
                  </button>
                )}
              </div>
            </div>

            {aiError && (
              <div className="flex items-center gap-2 text-sm text-red-400">
                <AlertCircle size={14} />
                {aiError}
              </div>
            )}

            {aiRecommendation ? (
              <>
                <div className="prose prose-invert prose-sm max-w-none text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                  {aiRecommendation}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    size="sm"
                    className="text-xs h-7 gap-1.5"
                    style={{ background: 'color-mix(in srgb, var(--signal) 18%, transparent)', color: 'var(--signal)', border: '1px solid color-mix(in srgb, var(--signal) 32%, transparent)' }}
                    onClick={applyAiSuggestion}
                    disabled={!aiSuggestion || isComplete}
                  >
                    <Check size={11} />
                    Accept &amp; Apply Next Step
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7 gap-1.5"
                    onClick={() => setShowAIPanel(false)}
                  >
                    Ignore
                  </Button>
                </div>
              </>
            ) : !aiLoading && (
              <p className="text-sm text-muted-foreground italic">
                Click &quot;Get Recommendation&quot; for AI-powered veto strategy{opponent ? ` vs ${opponentName}` : ''}.
              </p>
            )}
          </div>
        )}

        {/* Re-show AI panel if dismissed */}
        {!showAIPanel && (
          <button
            onClick={() => setShowAIPanel(true)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
          >
            Show AI panel
          </button>
        )}
      </div>
    </div>
  )
}
