'use client'

import { useState } from 'react'
import { Search, Calendar, Swords } from 'lucide-react'
import OpponentCardWithDelete from './OpponentCardWithDelete'
import type { AggregatedStats } from '@/types/database'

export interface OpponentRow {
  id: string
  opponent_display_name: string
  opponent_slug: string
  aggregated_stats: AggregatedStats | null
  demoCount: number
  lastActivity?: string
}

interface Props {
  opponents: OpponentRow[]
  uploadButton?: React.ReactNode
}

const FILTERS = ['All', 'Analyzed', 'Upcoming'] as const
type Filter = (typeof FILTERS)[number]

export default function OpponentsPageClient({ opponents, uploadButton }: Props) {
  const [query, setQuery]   = useState('')
  const [filter, setFilter] = useState<Filter>('All')

  const filtered = opponents.filter(o => {
    const matchesQuery = o.opponent_display_name.toLowerCase().includes(query.toLowerCase())
    if (!matchesQuery) return false
    if (filter === 'Analyzed') return (o.aggregated_stats?.total_matches ?? 0) > 0
    if (filter === 'Upcoming') return o.demoCount > 0
    return true
  })

  const nextMatchup = opponents[0] ?? null

  return (
    <div className="p-5 md:p-7 space-y-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 pb-5 border-b border-[rgba(30,34,56,0.8)] animate-fade-in-up">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest mb-0.5" style={{ color: '#4b5563' }}>
            Scouting
          </p>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
            Opponents
          </h1>
          <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>
            Your scouting library — teams you're preparing to face
          </p>
        </div>
        {uploadButton && (
          <div className="shrink-0">{uploadButton}</div>
        )}
      </div>

      {/* Search + filter bar */}
      <div className="flex items-center gap-3 flex-wrap animate-fade-in-up">
        <div className="relative min-w-[200px] flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: '#6b7280' }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search opponents..."
            className="w-full rounded-xl text-xs text-white placeholder-gray-500 pl-9 pr-3 py-2 focus:outline-none transition-colors"
            style={{ background: '#0f111e', border: '1px solid #1e2238' }}
            onFocus={e => (e.currentTarget.style.borderColor = 'rgba(112,71,235,0.6)')}
            onBlur={e =>  (e.currentTarget.style.borderColor = '#1e2238')}
          />
        </div>
        <div className="flex items-center gap-1">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-3 py-1.5 text-[11px] font-mono rounded-lg transition-all duration-150"
              style={{
                background: filter === f ? 'rgba(112,71,235,0.2)' : 'transparent',
                border:     filter === f ? '1px solid rgba(112,71,235,0.5)' : '1px solid #1e2238',
                color:      filter === f ? '#fff' : '#6b7280',
              }}
            >
              {f}
            </button>
          ))}
        </div>
        <span className="text-[11px] font-mono" style={{ color: '#4b5563' }}>
          {filtered.length} {filtered.length === 1 ? 'team' : 'teams'}
        </span>
      </div>

      {/* Grid or empty state */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
            style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.15)' }}
          >
            <Swords size={28} style={{ color: '#f43f5e', opacity: 0.7 }} />
          </div>
          <h2 className="text-[17px] font-bold text-white mb-2">
            {query ? 'No opponents found' : 'No opponents scouted yet'}
          </h2>
          <p className="text-[13px] max-w-xs mb-6 leading-relaxed" style={{ color: '#6b7280' }}>
            {query
              ? `No results for "${query}"`
              : 'Upload your first opponent demo to start building your scouting library.'}
          </p>
          {!query && uploadButton}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in-up">
          {filtered.map(o => (
            <OpponentCardWithDelete
              key={o.id}
              folder={{
                id:                     o.id,
                opponent_display_name:  o.opponent_display_name,
                opponent_slug:          o.opponent_slug,
                aggregated_stats:       o.aggregated_stats,
              }}
              demoCount={o.demoCount}
              lastActivity={o.lastActivity}
            />
          ))}
        </div>
      )}

      {/* Next scheduled matchup banner */}
      {nextMatchup && (
        <div
          className="rounded-2xl p-5 flex items-center gap-4"
          style={{
            background: 'linear-gradient(135deg, rgba(112,71,235,0.12), rgba(20,184,166,0.06))',
            border: '1px solid rgba(112,71,235,0.28)',
          }}
        >
          <div
            className="p-3 rounded-xl shrink-0"
            style={{ background: 'rgba(112,71,235,0.18)', border: '1px solid rgba(112,71,235,0.35)' }}
          >
            <Calendar size={18} style={{ color: '#7047eb' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-mono uppercase tracking-widest mb-0.5" style={{ color: '#6b7280' }}>
              Next Scheduled Matchup
            </p>
            <p className="text-sm font-bold text-white">vs {nextMatchup.opponent_display_name}</p>
            {nextMatchup.lastActivity && (
              <p className="text-[11px] font-mono mt-0.5" style={{ color: '#6b7280' }}>
                Last seen: {nextMatchup.lastActivity}
              </p>
            )}
          </div>
          <span
            className="text-[10px] font-mono uppercase px-2.5 py-1 rounded-lg shrink-0"
            style={{
              background: 'rgba(112,71,235,0.15)',
              border: '1px solid rgba(112,71,235,0.35)',
              color: '#7047eb',
            }}
          >
            Prepare
          </span>
        </div>
      )}

    </div>
  )
}
