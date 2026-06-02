'use client'

import { useState } from 'react'
import { Swords, TrendingUp, TrendingDown, Minus, Brain, Loader2, AlertCircle, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import VetoSimulator from '@/components/veto/VetoSimulator'

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

const MAP_LABELS: Record<string, string> = {
  de_dust2:    'Dust2',
  de_mirage:   'Mirage',
  de_inferno:  'Inferno',
  de_nuke:     'Nuke',
  de_overpass: 'Overpass',
  de_ancient:  'Ancient',
  de_anubis:   'Anubis',
}

function WinRateBar({ winRate, games }: { winRate: number; games: number }) {
  const pct = Math.round(winRate * 100)
  const color = pct >= 60 ? '#00ff87' : pct >= 45 ? '#facc15' : '#ff4466'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-mono w-8 text-right" style={{ color }}>{games > 0 ? `${pct}%` : '—'}</span>
    </div>
  )
}

function PickBar({ picks, maxPicks }: { picks: number; maxPicks: number }) {
  const pct = maxPicks > 0 ? (picks / maxPicks) * 100 : 0
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: '#ff4466' }} />
      </div>
      <span className="text-xs font-mono text-muted-foreground w-6 text-right">{picks}x</span>
    </div>
  )
}

function WinRateIcon({ winRate, games }: { winRate: number; games: number }) {
  if (games === 0) return <Minus size={13} className="text-muted-foreground" />
  if (winRate >= 0.55) return <TrendingUp size={13} className="text-neon-green" />
  if (winRate < 0.45) return <TrendingDown size={13} className="text-red-400" />
  return <Minus size={13} className="text-yellow-400" />
}

export default function VetoClient({ selfMapStats, opponents, activeDutyMaps, hasData }: Props) {
  const [selectedOpponentId, setSelectedOpponentId] = useState<string>('')
  const [recommendation, setRecommendation] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')

  const selectedOpponent = opponents.find(o => o.id === selectedOpponentId) ?? null
  const maxOppPicks = selectedOpponent
    ? Math.max(1, ...Object.values(selectedOpponent.mapPicks))
    : 1

  const getAIRecommendation = async () => {
    setLoading(true)
    setError('')
    setRecommendation('')
    try {
      const res = await fetch('/api/veto/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selfMapStats,
          opponentMapPicks: selectedOpponent?.mapPicks,
          opponentName: selectedOpponent?.name,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setRecommendation(data.recommendation ?? '')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate recommendation')
    } finally {
      setLoading(false)
    }
  }

  // Sort maps: best winRate first for self, most picked for opp
  const sortedMaps = [...activeDutyMaps].sort((a, b) => {
    const aGames = (selfMapStats[a]?.wins ?? 0) + (selfMapStats[a]?.losses ?? 0)
    const bGames = (selfMapStats[b]?.wins ?? 0) + (selfMapStats[b]?.losses ?? 0)
    const aRate = selfMapStats[a]?.winRate ?? 0
    const bRate = selfMapStats[b]?.winRate ?? 0
    if (aGames === 0 && bGames === 0) return 0
    if (aGames === 0) return 1
    if (bGames === 0) return -1
    return bRate - aRate
  })

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-4 md:py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-neon-green/10 border border-neon-green/20 flex items-center justify-center">
                <Swords size={18} className="text-neon-green" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Veto Planner</h1>
                <p className="text-sm text-muted-foreground">Map pool analysis & veto order recommendation</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-8">
        {!hasData && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-yellow-400/10 border border-yellow-400/20 text-sm text-yellow-300">
            <AlertCircle size={16} className="shrink-0" />
            No team data found. Upload self-analysis demos in My Team to populate your map pool stats.
          </div>
        )}

        {/* Opponent selector */}
        {opponents.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-medium text-foreground">Compare against opponent:</label>
            <div className="relative">
              <select
                value={selectedOpponentId}
                onChange={e => { setSelectedOpponentId(e.target.value); setRecommendation(''); setError('') }}
                className="appearance-none bg-card border border-border text-sm text-foreground rounded-md px-3 py-2 pr-8 focus:outline-none focus:ring-1 focus:ring-neon-green/50"
              >
                <option value="">— None (general analysis) —</option>
                {opponents.map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
              <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
          </div>
        )}

        {/* Map comparison table */}
        <div className="rv-panel overflow-hidden">
          {/* Table header */}
          <div className="grid gap-4 px-4 py-3 bg-muted/30 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider"
            style={{ gridTemplateColumns: selectedOpponent ? '140px 1fr 1fr 80px' : '140px 1fr 80px' }}
          >
            <div>Map</div>
            <div>Your Win Rate</div>
            {selectedOpponent && <div>Opponent Picks</div>}
            <div className="text-right">Games</div>
          </div>

          {/* Map rows */}
          <div className="divide-y divide-border">
            {sortedMaps.map(map => {
              const s = selfMapStats[map]
              const games = (s?.wins ?? 0) + (s?.losses ?? 0)
              const oppPicks = selectedOpponent?.mapPicks[map] ?? 0
              const wr = s?.winRate ?? 0

              return (
                <div
                  key={map}
                  className="grid gap-4 px-4 py-3 items-center hover:bg-muted/20 transition-colors"
                  style={{ gridTemplateColumns: selectedOpponent ? '140px 1fr 1fr 80px' : '140px 1fr 80px' }}
                >
                  <div className="flex items-center gap-2">
                    <WinRateIcon winRate={wr} games={games} />
                    <span className="text-sm font-medium text-foreground">{MAP_LABELS[map] ?? map}</span>
                  </div>
                  <WinRateBar winRate={wr} games={games} />
                  {selectedOpponent && <PickBar picks={oppPicks} maxPicks={maxOppPicks} />}
                  <div className="text-right text-xs text-muted-foreground font-mono">
                    {games > 0 ? `${s.wins}W-${s.losses}L` : '—'}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><TrendingUp size={12} className="text-neon-green" />Strong map (≥55% WR)</span>
          <span className="flex items-center gap-1.5"><Minus size={12} className="text-yellow-400" />Even (45–55% WR)</span>
          <span className="flex items-center gap-1.5"><TrendingDown size={12} className="text-red-400" />Weak map (&lt;45% WR)</span>
        </div>

        {/* Interactive Veto Simulator */}
        <div className="rv-panel p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Swords size={16} className="text-neon-green" />
            <h2 className="text-base font-semibold text-foreground">Veto Simulator</h2>
            <span className="text-xs text-muted-foreground">— play out the veto step by step</span>
          </div>
          <VetoSimulator
            selfMapStats={selfMapStats}
            opponents={opponents}
            activeDutyMaps={activeDutyMaps}
          />
        </div>

        {/* AI recommendation */}
        <div className="rv-panel rv-insight p-5 space-y-4" style={{ position: 'relative' }}>
          <span className="rv-tick rv-tick-tl" />
          <span className="rv-tick rv-tick-br" style={{ borderColor: 'color-mix(in srgb, var(--signal) 48%, transparent)' }} />
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Brain size={18} className="text-[#2DE3CE]" />
              <h2 className="text-base font-semibold text-foreground">
                {selectedOpponent ? `Veto Order vs ${selectedOpponent.name}` : 'Map Pool Analysis'}
              </h2>
            </div>
            <Button
              variant="neon"
              size="sm"
              onClick={getAIRecommendation}
              disabled={loading}
              className="gap-2"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Brain size={14} />}
              {loading ? 'Generating…' : 'Get AI Recommendation'}
            </Button>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-400">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          {recommendation ? (
            <div className="prose prose-invert prose-sm max-w-none text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap font-mono">
              {recommendation}
            </div>
          ) : !loading && (
            <p className="text-sm text-muted-foreground italic">
              Click "Get AI Recommendation" to receive a{selectedOpponent ? ' veto order' : 'n analysis'} based on your map data{selectedOpponent ? ` vs ${selectedOpponent.name}` : ''}.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
