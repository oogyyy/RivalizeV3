'use client'

import { useState } from 'react'
import { Brain, Loader2, AlertCircle, Swords, ChevronDown } from 'lucide-react'
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

function TeamAvatar({ initials, color }: { initials: string; color: string }) {
  return (
    <div
      className="w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold border shrink-0"
      style={{
        background: `${color}18`,
        borderColor: `${color}40`,
        color,
      }}
    >
      {initials}
    </div>
  )
}

export default function VetoClient({ selfMapStats, opponents, activeDutyMaps, hasData }: Props) {
  const [selectedOpponentId, setSelectedOpponentId] = useState<string>('')
  const [recommendation, setRecommendation] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')

  const selectedOpponent = opponents.find(o => o.id === selectedOpponentId) ?? null

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

  return (
    <div className="min-h-full">
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-8">

        {/* Page header */}
        <div style={{ borderBottom: '1px solid rgba(30,34,56,0.8)', paddingBottom: '20px' }}>
          <p className="text-[10px] font-mono uppercase tracking-widest mb-0.5" style={{ color: '#4b5563' }}>
            Prepare
          </p>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
            Veto Simulator
          </h1>
          <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>
            Map banning sequence compiler and AI threat model selector
          </p>
        </div>

        {/* No-data warning */}
        {!hasData && (
          <div
            className="flex items-center gap-3 p-4 rounded-xl text-sm"
            style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#fbbf24' }}
          >
            <AlertCircle size={16} className="shrink-0" />
            No team data found. Upload self-analysis demos in My Team to populate your map pool stats.
          </div>
        )}

        {/* Team matchup header */}
        <div
          className="rounded-2xl p-5 flex items-center gap-4"
          style={{ background: '#0f111e', border: '1px solid #1e2238' }}
        >
          {/* Your team */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <TeamAvatar initials="YT" color="#7047eb" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-white">Your Team</p>
              <p className="text-[10px] font-mono uppercase tracking-wider mt-0.5" style={{ color: '#4b5563' }}>
                ESEA ROSTER &bull; US
              </p>
            </div>
          </div>

          {/* VS divider */}
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold shrink-0"
            style={{ background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.25)', color: '#f43f5e' }}
          >
            VS
          </div>

          {/* Opponent side */}
          <div className="flex items-center gap-3 flex-1 min-w-0 justify-end">
            {selectedOpponent ? (
              <>
                <div className="text-right min-w-0">
                  <p className="text-sm font-bold" style={{ color: '#f43f5e' }}>{selectedOpponent.name}</p>
                  <p className="text-[10px] font-mono uppercase tracking-wider mt-0.5" style={{ color: '#4b5563' }}>
                    ESEA ROSTER &bull; THEM
                  </p>
                </div>
                <TeamAvatar initials={selectedOpponent.name.slice(0, 2).toUpperCase()} color="#f43f5e" />
              </>
            ) : (
              <>
                <div className="text-right min-w-0">
                  <p className="text-sm font-semibold" style={{ color: '#4b5563' }}>No opponent selected</p>
                  <p className="text-[10px] font-mono uppercase tracking-wider mt-0.5" style={{ color: '#374151' }}>
                    Select below
                  </p>
                </div>
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(30,34,56,0.8)', border: '1px dashed #1e2238' }}
                >
                  <Swords size={18} style={{ color: '#374151' }} />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Opponent selector (only when opponents exist) */}
        {opponents.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-medium text-white">Compare against opponent:</label>
            <div className="relative">
              <select
                value={selectedOpponentId}
                onChange={e => { setSelectedOpponentId(e.target.value); setRecommendation(''); setError('') }}
                className="appearance-none text-sm rounded-xl px-3 py-2 pr-8 focus:outline-none transition-colors"
                style={{ background: '#0f111e', border: '1px solid #1e2238', color: '#d1d5db' }}
              >
                <option value="">— None (general analysis) —</option>
                {opponents.map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
              <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#6b7280' }} />
            </div>
          </div>
        )}

        {/* Veto Simulator */}
        <div
          className="rounded-2xl p-6"
          style={{ background: '#0f111e', border: '1px solid #1e2238' }}
        >
          <VetoSimulator
            selfMapStats={selfMapStats}
            opponents={opponents}
            activeDutyMaps={activeDutyMaps}
          />
        </div>

        {/* AI Map Pool Analysis */}
        <div
          className="rounded-2xl p-5 space-y-4"
          style={{ background: '#0f111e', border: '1px solid rgba(20,184,166,0.2)' }}
        >
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Brain size={16} style={{ color: '#14b8a6' }} />
              <h2 className="text-sm font-semibold text-white">
                {selectedOpponent ? `Veto Order vs ${selectedOpponent.name}` : 'Map Pool Analysis'}
              </h2>
            </div>
            <button
              onClick={getAIRecommendation}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
              style={{ background: 'rgba(20,184,166,0.12)', border: '1px solid rgba(20,184,166,0.35)', color: '#14b8a6' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(20,184,166,0.2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(20,184,166,0.12)')}
            >
              {loading ? <Loader2 size={13} className="animate-spin" /> : <Brain size={13} />}
              {loading ? 'Generating…' : 'Get AI Recommendation'}
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm" style={{ color: '#f43f5e' }}>
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          {recommendation ? (
            <div className="text-sm leading-relaxed whitespace-pre-wrap font-mono" style={{ color: 'rgba(255,255,255,0.85)' }}>
              {recommendation}
            </div>
          ) : !loading && (
            <p className="text-sm italic" style={{ color: '#4b5563' }}>
              Click "Get AI Recommendation" to receive a{selectedOpponent ? ' veto order' : 'n analysis'} based on your map data
              {selectedOpponent ? ` vs ${selectedOpponent.name}` : ''}.
            </p>
          )}
        </div>

      </div>
    </div>
  )
}
