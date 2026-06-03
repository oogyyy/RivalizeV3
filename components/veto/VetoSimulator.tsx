'use client'

import { useState, useMemo, useCallback } from 'react'
import { RotateCcw, Trophy, Sparkles } from 'lucide-react'

export type Format = 'bo1' | 'bo3' | 'bo5'

interface MapStat { wins: number; losses: number; winRate: number }
interface OpponentEntry { id: string; name: string; mapPicks: Record<string, number> }

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
  const score = wr * (1 - oppFreq * 0.4)
  return { score, confidence }
}

function suggest(
  action: 'ban' | 'pick' | 'decider',
  team: 'us' | 'them',
  remaining: string[],
  selfStats: Record<string, MapStat>,
  oppPicks: Record<string, number>,
  maxOppPicks: number,
): string {
  const scored = remaining.map(m => ({ map: m, ...scoreMap(m, selfStats, oppPicks, maxOppPicks) }))

  if (action === 'decider') {
    scored.sort((a, b) => a.score - b.score)
    return scored[Math.floor(scored.length / 2)]?.map ?? scored[0].map
  }
  if (action === 'pick') {
    scored.sort(team === 'us' ? (a, b) => b.score - a.score : (a, b) => a.score - b.score)
    return scored[0].map
  }
  scored.sort(team === 'us' ? (a, b) => a.score - b.score : (a, b) => b.score - a.score)
  return scored[0].map
}

interface MapAction { map: string; step: VetoStep }

type MapStatus = 'undecided' | 'banned_us' | 'banned_them' | 'picked_us' | 'picked_them' | 'decider'

function getMapStatus(map: string, actions: MapAction[]): MapStatus {
  const a = actions.find(x => x.map === map)
  if (!a) return 'undecided'
  if (a.step.action === 'ban')     return a.step.team === 'us' ? 'banned_us'  : 'banned_them'
  if (a.step.action === 'pick')    return a.step.team === 'us' ? 'picked_us'  : 'picked_them'
  if (a.step.action === 'decider') return 'decider'
  return 'undecided'
}

const STATUS_STYLE: Record<MapStatus, { label: string; bg: string; border: string; color: string }> = {
  undecided:   { label: 'UNDECIDED',    bg: 'transparent',               border: '#1e2238',                    color: '#4b5563' },
  banned_us:   { label: 'BANNED (US)',  bg: 'rgba(244,63,94,0.06)',       border: 'rgba(244,63,94,0.35)',        color: '#f43f5e' },
  banned_them: { label: 'BANNED (THEM)',bg: 'rgba(244,63,94,0.06)',       border: 'rgba(244,63,94,0.35)',        color: '#f43f5e' },
  picked_us:   { label: 'PICKED (US)',  bg: 'rgba(112,71,235,0.12)',      border: 'rgba(112,71,235,0.45)',       color: '#7047eb' },
  picked_them: { label: 'PICKED (THEM)',bg: 'rgba(244,63,94,0.08)',       border: 'rgba(244,63,94,0.35)',        color: '#f43f5e' },
  decider:     { label: 'DECIDER',      bg: 'rgba(245,158,11,0.08)',      border: 'rgba(245,158,11,0.4)',        color: '#f59e0b' },
}

interface VetoSimulatorProps {
  selfMapStats: Record<string, MapStat>
  opponents: OpponentEntry[]
  activeDutyMaps: string[]
  onReset?: () => void
}

export default function VetoSimulator({ selfMapStats, opponents, activeDutyMaps, onReset }: VetoSimulatorProps) {
  const [format, setFormat] = useState<Format>('bo3')
  const [selectedOpponentId, setSelectedOpponentId] = useState('')
  const [completedActions, setCompletedActions] = useState<MapAction[]>([])
  const [ignoredSuggestion, setIgnoredSuggestion] = useState(false)

  const opponent = opponents.find(o => o.id === selectedOpponentId) ?? null
  const oppPicks = opponent?.mapPicks ?? {}
  const maxOppPicks = Math.max(1, ...Object.values(oppPicks))

  const sequence = VETO_SEQUENCES[format]
  const remainingMaps = useMemo(() => {
    const done = new Set(completedActions.map(a => a.map))
    return activeDutyMaps.filter(m => !done.has(m))
  }, [completedActions, activeDutyMaps])

  const currentStepIndex = completedActions.length
  const currentStep = sequence[currentStepIndex] ?? null
  const isComplete = currentStepIndex >= sequence.length

  const pickedMaps = completedActions.filter(a => a.step.action === 'pick' || a.step.action === 'decider')
  const bannedMaps = completedActions.filter(a => a.step.action === 'ban')

  const aiSuggestion = useMemo(() => {
    if (!currentStep || isComplete) return null
    return suggest(currentStep.action, currentStep.team, remainingMaps, selfMapStats, oppPicks, maxOppPicks)
  }, [currentStep, isComplete, remainingMaps, selfMapStats, oppPicks, maxOppPicks])

  const selectMap = useCallback((map: string) => {
    if (!currentStep || isComplete) return
    setIgnoredSuggestion(false)
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
    setIgnoredSuggestion(false)
    onReset?.()
  }

  const winProbability = useMemo(() => {
    if (pickedMaps.length === 0) return null
    const scores = pickedMaps.map(a => selfMapStats[a.map]?.winRate ?? 0.5)
    return scores.reduce((a, b) => a + b, 0) / scores.length
  }, [pickedMaps, selfMapStats])

  const showAiBanner = !isComplete && currentStep && aiSuggestion && !ignoredSuggestion

  return (
    <div className="space-y-6">
      {/* Controls: format + opponent + auto-fill + reset */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-xl overflow-hidden" style={{ border: '1px solid #1e2238' }}>
          {(['bo1', 'bo3', 'bo5'] as Format[]).map(f => (
            <button
              key={f}
              onClick={() => { setFormat(f); reset() }}
              className="px-4 py-2 text-xs font-mono uppercase tracking-wider transition-colors"
              style={{
                background: format === f ? 'rgba(112,71,235,0.2)' : 'transparent',
                color:      format === f ? '#fff' : '#6b7280',
              }}
            >
              {f}
            </button>
          ))}
        </div>

        {opponents.length > 0 && (
          <select
            value={selectedOpponentId}
            onChange={e => { setSelectedOpponentId(e.target.value); reset() }}
            className="text-xs rounded-xl px-3 py-2 focus:outline-none transition-colors"
            style={{ background: '#0f111e', border: '1px solid #1e2238', color: '#d1d5db' }}
          >
            <option value="">— No opponent —</option>
            {opponents.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        )}

        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={applyAllAi}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-mono uppercase transition-colors"
            style={{ background: 'rgba(112,71,235,0.15)', border: '1px solid rgba(112,71,235,0.35)', color: '#7047eb' }}
          >
            <Sparkles size={11} />
            Auto-fill AI
          </button>
          <button
            onClick={reset}
            disabled={completedActions.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-mono uppercase transition-colors disabled:opacity-40"
            style={{ background: 'transparent', border: '1px solid #1e2238', color: '#6b7280' }}
          >
            <RotateCcw size={11} />
            Reset
          </button>
        </div>
      </div>

      {/* MAP POOL SELECTION GRID */}
      <div>
        <h2 className="text-[10px] font-mono uppercase tracking-widest mb-4" style={{ color: '#4b5563' }}>
          Map Pool Selection Grid
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {activeDutyMaps.map(map => {
            const status = getMapStatus(map, completedActions)
            const isRemaining = remainingMaps.includes(map)
            const isSuggested = map === aiSuggestion && isRemaining
            const st = STATUS_STYLE[status]
            const s = selfMapStats[map]
            const ourPct = s ? Math.round(s.winRate * 100) : null
            const oppFreqPct = opponent && maxOppPicks > 0
              ? Math.round((oppPicks[map] ?? 0) / maxOppPicks * 100)
              : null

            const isBanned = status === 'banned_us' || status === 'banned_them'
            const isPicked = status === 'picked_us' || status === 'picked_them' || status === 'decider'

            return (
              <button
                key={map}
                onClick={() => isRemaining && !isComplete && selectMap(map)}
                disabled={!isRemaining || isComplete}
                className="relative p-3 rounded-xl text-left transition-all duration-150 focus:outline-none"
                style={{
                  background:   isSuggested ? 'rgba(112,71,235,0.14)' : st.bg,
                  border:       `1px solid ${isSuggested ? 'rgba(112,71,235,0.6)' : st.border}`,
                  opacity:      isBanned ? 0.45 : 1,
                  cursor:       isRemaining && !isComplete ? 'pointer' : 'default',
                }}
                onMouseEnter={e => {
                  if (isRemaining && !isComplete) e.currentTarget.style.borderColor = 'rgba(112,71,235,0.5)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = isSuggested ? 'rgba(112,71,235,0.6)' : st.border
                }}
              >
                {/* Map name + status */}
                <div className="mb-2">
                  <p className={`text-xs font-bold ${isBanned ? 'line-through' : ''}`} style={{ color: isPicked ? '#fff' : isBanned ? '#6b7280' : '#d1d5db' }}>
                    {MAP_LABELS[map] ?? map}
                  </p>
                  <span
                    className="text-[8px] font-mono uppercase mt-0.5 inline-block"
                    style={{ color: st.color }}
                  >
                    {st.label}
                  </span>
                </div>

                {/* Win rates */}
                <div className="space-y-0.5">
                  <div className="flex justify-between text-[9px] font-mono">
                    <span style={{ color: '#6b7280' }}>Us:</span>
                    <span style={{ color: ourPct !== null ? (ourPct >= 55 ? '#14b8a6' : ourPct >= 45 ? '#f59e0b' : '#f43f5e') : '#374151' }}>
                      {ourPct !== null ? `${ourPct}%` : '—'}
                    </span>
                  </div>
                  {oppFreqPct !== null && (
                    <div className="flex justify-between text-[9px] font-mono">
                      <span style={{ color: '#6b7280' }}>Them:</span>
                      <span style={{ color: '#f43f5e' }}>{oppFreqPct}%</span>
                    </div>
                  )}
                </div>

                {/* AI badge */}
                {isSuggested && (
                  <div
                    className="absolute -top-1.5 -left-1.5 text-[7px] font-bold px-1.5 py-0.5 rounded"
                    style={{ background: '#7047eb', color: '#fff' }}
                  >
                    AI
                  </div>
                )}
              </button>
            )
          })}
        </div>
        {!isComplete && currentStep && (
          <p className="text-[10px] mt-2" style={{ color: '#4b5563' }}>
            Click a map to {currentStep.action} it.
            {currentStep.team === 'them' && ' (Simulating opponent\'s choice)'}
          </p>
        )}
      </div>

      {/* VETO MATCH PROGRESSION SEQUENCE */}
      <div>
        <h2 className="text-[10px] font-mono uppercase tracking-widest mb-4" style={{ color: '#4b5563' }}>
          Veto Match Progression Sequence
        </h2>
        <div className="grid grid-cols-7 gap-2">
          {sequence.map((step, idx) => {
            const done   = idx < currentStepIndex
            const active = idx === currentStepIndex && !isComplete
            const action = completedActions[idx]

            const circleStyle = (() => {
              if (active) return { background: '#7047eb', border: '2px solid #7047eb', color: '#fff' }
              if (done && step.action === 'ban')     return { background: 'rgba(244,63,94,0.15)',  border: '2px solid rgba(244,63,94,0.5)',  color: '#f43f5e' }
              if (done && step.action === 'pick')    return { background: 'rgba(112,71,235,0.15)', border: '2px solid rgba(112,71,235,0.5)', color: '#7047eb' }
              if (done && step.action === 'decider') return { background: 'rgba(245,158,11,0.15)', border: '2px solid rgba(245,158,11,0.5)', color: '#f59e0b' }
              return { background: 'transparent', border: '2px solid #1e2238', color: '#374151' }
            })()

            return (
              <div key={idx} className="flex flex-col items-center gap-1.5 text-center">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200"
                  style={{ ...circleStyle, transform: active ? 'scale(1.15)' : 'scale(1)' }}
                >
                  {idx + 1}
                </div>
                <div>
                  <p className="text-[8px] font-mono uppercase tracking-wider" style={{ color: '#4b5563' }}>
                    {`Step ${idx + 1}: ${step.label}`}
                  </p>
                  <p className="text-[9px] font-mono font-bold mt-0.5" style={{ color: active ? '#7047eb' : done ? '#d1d5db' : '#374151' }}>
                    {action ? (MAP_LABELS[action.map] ?? action.map) : active ? 'CURRENT ACTIVE' : 'FUTURE'}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* AI RECOMMENDATION banner */}
      {showAiBanner && (
        <div
          className="rounded-xl p-4 flex items-start gap-4"
          style={{ background: 'linear-gradient(135deg, rgba(112,71,235,0.12), rgba(20,184,166,0.05))', border: '1px solid rgba(112,71,235,0.3)' }}
        >
          <Sparkles size={16} style={{ color: '#7047eb', marginTop: 1 }} className="shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <span
                className="text-[9px] font-mono uppercase px-2 py-0.5 rounded"
                style={{ background: 'rgba(112,71,235,0.2)', color: '#7047eb', border: '1px solid rgba(112,71,235,0.4)' }}
              >
                AI RECOMMENDATION
              </span>
              <span className="text-xs font-bold text-white">
                RECOMMENDED: {currentStep!.action.toUpperCase()} {MAP_LABELS[aiSuggestion!] ?? aiSuggestion}
              </span>
            </div>
            <p className="text-[11px]" style={{ color: '#9ca3af' }}>
              {currentStep!.action === 'ban' && currentStep!.team === 'us' && `Banning ${MAP_LABELS[aiSuggestion!]} neutralises their strongest map preference from the pool.`}
              {currentStep!.action === 'pick' && currentStep!.team === 'us' && `${MAP_LABELS[aiSuggestion!]} is your highest win-rate map — secure it early in the sequence.`}
              {currentStep!.action === 'decider' && `${MAP_LABELS[aiSuggestion!]} is the most balanced remaining map for the final decider.`}
              {currentStep!.team === 'them' && currentStep!.action !== 'decider' && `Data indicates the opponent is likely to ${currentStep!.action} ${MAP_LABELS[aiSuggestion!] ?? aiSuggestion} on this step.`}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={applyAiSuggestion}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors"
              style={{ background: '#7047eb' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#8862ff')}
              onMouseLeave={e => (e.currentTarget.style.background = '#7047eb')}
            >
              Accept Recommendation
            </button>
            <button
              onClick={() => setIgnoredSuggestion(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              style={{ border: '1px solid #1e2238', color: '#6b7280' }}
            >
              Ignore
            </button>
          </div>
        </div>
      )}

      {/* VETO COMPLETE result */}
      {isComplete && (
        <div
          className="rounded-2xl p-5 space-y-4"
          style={{ background: 'rgba(112,71,235,0.08)', border: '1px solid rgba(112,71,235,0.3)' }}
        >
          <div className="flex items-center gap-2">
            <Trophy size={18} style={{ color: '#7047eb' }} />
            <h3 className="text-base font-bold text-white">Veto Complete</h3>
            {winProbability !== null && (
              <span
                className="ml-auto text-sm font-bold font-mono px-2.5 py-1 rounded-lg"
                style={{
                  background: winProbability >= 0.55 ? 'rgba(20,184,166,0.15)' : winProbability >= 0.45 ? 'rgba(245,158,11,0.15)' : 'rgba(244,63,94,0.15)',
                  color:      winProbability >= 0.55 ? '#14b8a6' : winProbability >= 0.45 ? '#f59e0b' : '#f43f5e',
                }}
              >
                Est. {Math.round(winProbability * 100)}% win rate
              </span>
            )}
          </div>

          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${pickedMaps.length}, 1fr)` }}>
            {pickedMaps.map((a, idx) => {
              const s = selfMapStats[a.map]
              const wr = s ? Math.round(s.winRate * 100) : null
              const games = s ? s.wins + s.losses : 0
              const isDecider = a.step.action === 'decider'
              const pickedBy = a.step.team === 'us' ? 'Our pick' : isDecider ? 'Decider' : 'Their pick'

              return (
                <div
                  key={idx}
                  className="rounded-xl p-4 text-center space-y-1"
                  style={{
                    border: isDecider ? '1px solid rgba(245,158,11,0.3)' : a.step.team === 'us' ? '1px solid rgba(112,71,235,0.3)' : '1px solid rgba(244,63,94,0.3)',
                    background: isDecider ? 'rgba(245,158,11,0.06)' : a.step.team === 'us' ? 'rgba(112,71,235,0.08)' : 'rgba(244,63,94,0.06)',
                  }}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>{pickedBy}</p>
                  <p className="text-lg font-bold text-white">{MAP_LABELS[a.map] ?? a.map}</p>
                  {wr !== null ? (
                    <p
                      className="text-xs font-mono font-bold"
                      style={{ color: wr >= 55 ? '#14b8a6' : wr >= 45 ? '#f59e0b' : '#f43f5e' }}
                    >
                      {wr}% WR ({games}G)
                    </p>
                  ) : (
                    <p className="text-xs" style={{ color: '#4b5563' }}>No data</p>
                  )}
                </div>
              )
            })}
          </div>

          {bannedMaps.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2" style={{ borderTop: '1px solid #1e2238' }}>
              <span className="text-[10px] font-semibold" style={{ color: '#4b5563' }}>Banned:</span>
              {bannedMaps.map(a => (
                <span
                  key={a.map}
                  className="text-[10px] px-2 py-0.5 rounded font-medium"
                  style={{ background: 'rgba(244,63,94,0.1)', color: '#f43f5e' }}
                >
                  {MAP_LABELS[a.map] ?? a.map}
                  <span style={{ color: 'rgba(244,63,94,0.5)', marginLeft: 4 }}>
                    ({a.step.team === 'us' ? 'us' : 'them'})
                  </span>
                </span>
              ))}
            </div>
          )}

          <button
            onClick={reset}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-colors"
            style={{ border: '1px solid #1e2238', color: '#9ca3af' }}
          >
            <RotateCcw size={12} />
            Simulate again
          </button>
        </div>
      )}
    </div>
  )
}
