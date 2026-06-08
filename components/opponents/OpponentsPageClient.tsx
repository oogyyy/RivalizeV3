'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Search, ChevronDown, ArrowRight, Sparkles } from 'lucide-react'
import type { AggregatedStats } from '@/types/database'

interface OpponentFolder {
  id: string
  opponent_display_name: string
  opponent_slug: string
  aggregated_stats: AggregatedStats | null
}

interface Props {
  folders: OpponentFolder[]
  demosBySlug: Record<string, { id: string; match_date: string | null; created_at: string }[]>
  primaryTeamId: string | null
}

function TeamAvatar({ name, color = 'var(--signal)' }: { name: string; color?: string }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div style={{
      width: 48, height: 48, borderRadius: 10, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: `linear-gradient(135deg, color-mix(in srgb, ${color} 80%, #000), color-mix(in srgb, ${color} 35%, #0c0f1a))`,
      border: `1.5px solid color-mix(in srgb, ${color} 50%, transparent)`,
      fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: '#fff'
    }}>
      {initials}
    </div>
  )
}

export default function OpponentsPageClient({ folders, demosBySlug, primaryTeamId }: Props) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('wr')

  // Compute stats for each opponent
  const opponents = useMemo(() => {
    return folders.map(folder => {
      const demos = demosBySlug[folder.opponent_slug] ?? []
      const stats = folder.aggregated_stats as { win_rate?: number } | null
      const winRate = stats?.win_rate ? Math.round((stats.win_rate ?? 0) * 100) : 0

      return {
        ...folder,
        demoCount: demos.length,
        winRate,
        lastActivity: demos.map(d => d.match_date ?? d.created_at).sort().at(-1) ?? '',
      }
    })
  }, [folders, demosBySlug])

  // Sort and filter
  const sorted = useMemo(() => {
    let result = [...opponents].filter(o =>
      o.opponent_display_name.toLowerCase().includes(search.toLowerCase())
    )

    if (sort === 'wr') {
      result.sort((a, b) => b.winRate - a.winRate)
    } else if (sort === 'recent') {
      result.sort((a, b) => (b.lastActivity ?? '').localeCompare(a.lastActivity ?? ''))
    } else if (sort === 'name') {
      result.sort((a, b) => a.opponent_display_name.localeCompare(b.opponent_display_name))
    }

    return result
  }, [opponents, search, sort])

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ── Header ── */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', lineHeight: 1.1, marginBottom: 6 }}>
          Opponents
        </h1>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>
          Scout and prepare against upcoming opponents
        </p>

        {/* Search + Sort */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Search */}
          <div style={{
            flex: 1, minWidth: 200,
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 12px', borderRadius: 10,
            border: '1px solid var(--border)',
            background: 'var(--card)',
            transition: 'border-color 0.14s'
          }}>
            <Search size={14} style={{ color: 'var(--muted)', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search opponents…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onFocus={e => (e.currentTarget.parentElement as HTMLDivElement).style.borderColor = 'var(--signal)'}
              onBlur={e => (e.currentTarget.parentElement as HTMLDivElement).style.borderColor = 'var(--border)'}
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                fontSize: 13, color: 'var(--text)', padding: 0
              }}
            />
          </div>

          {/* Sort */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <select
              value={sort}
              onChange={e => setSort(e.target.value)}
              style={{
                padding: '8px 12px', paddingRight: 32, borderRadius: 10,
                border: '1px solid var(--border)',
                background: 'var(--card)', color: 'var(--text)',
                fontSize: 13, fontWeight: 500, cursor: 'pointer', outline: 'none',
                appearance: 'none'
              }}
            >
              <option value="wr">Most Competitive</option>
              <option value="recent">Recently Played</option>
              <option value="name">Alphabetical</option>
            </select>
            <ChevronDown size={12} style={{
              position: 'absolute', right: 12, color: 'var(--muted)', pointerEvents: 'none'
            }} />
          </div>
        </div>
      </div>

      {/* ── Grid ── */}
      <div style={{ flex: 1, overflowY: 'auto', marginBottom: 20 }}>
        {sorted.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '60px 24px', textAlign: 'center'
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 14,
              background: 'color-mix(in srgb, var(--signal) 10%, transparent)',
              border: '1px solid color-mix(in srgb, var(--signal) 20%, transparent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 16
            }}>
              <Search size={24} style={{ color: 'var(--signal)' }} />
            </div>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
              {search ? 'No opponents found' : 'No opponents scouted yet'}
            </p>
            <p style={{ fontSize: 12, color: 'var(--muted)', maxWidth: 280 }}>
              {search ? 'Try a different search term' : 'Upload your first opponent demo to start building your scouting library'}
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 14
          }}>
            {sorted.map(opponent => (
              <div
                key={opponent.id}
                style={{
                  padding: 16, borderRadius: 12,
                  border: '1px solid var(--border)',
                  background: 'var(--card)',
                  transition: 'all 0.14s',
                  cursor: 'default'
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = 'color-mix(in srgb, var(--signal) 40%, transparent)'
                  ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px color-mix(in srgb, var(--signal) 8%, transparent)'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'
                  ;(e.currentTarget as HTMLDivElement).style.boxShadow = 'none'
                }}
              >
                {/* Header: Avatar + Name */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
                  <TeamAvatar name={opponent.opponent_display_name} color="var(--signal)" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                      {opponent.opponent_display_name}
                    </p>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                        background: 'color-mix(in srgb, var(--signal) 10%, transparent)',
                        color: 'var(--signal)', letterSpacing: '0.05em', textTransform: 'uppercase'
                      }}>
                        EU
                      </span>
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                        background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
                        color: 'var(--accent)', letterSpacing: '0.05em'
                      }}>
                        LVL 10
                      </span>
                    </div>
                  </div>
                </div>

                {/* Stats grid */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10,
                  padding: '12px 0', marginBottom: 14, borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)'
                }}>
                  <div>
                    <p style={{ fontSize: 10, color: 'var(--faint)', marginBottom: 4, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      DEMOS
                    </p>
                    <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>
                      {opponent.demoCount}
                    </p>
                  </div>
                  <div>
                    <p style={{ fontSize: 10, color: 'var(--faint)', marginBottom: 4, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      W/R
                    </p>
                    <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--win)', fontFamily: 'var(--font-mono)' }}>
                      {opponent.winRate}%
                    </p>
                  </div>
                  <div>
                    <p style={{ fontSize: 10, color: 'var(--faint)', marginBottom: 4, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      BEST MAP
                    </p>
                    <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                      Mirage
                    </p>
                  </div>
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <Link href={`/opponents/${opponent.opponent_slug}`} style={{ flex: 1, textDecoration: 'none' }}>
                    <button
                      style={{
                        width: '100%', padding: '8px 12px', borderRadius: 8,
                        border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        background: 'color-mix(in srgb, var(--signal) 8%, var(--card))',
                        color: 'var(--signal)', transition: 'all 0.12s'
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'color-mix(in srgb, var(--signal) 14%, var(--card))'
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'color-mix(in srgb, var(--signal) 8%, var(--card))'
                      }}
                    >
                      <span>Scouting</span>
                      <ArrowRight size={11} />
                    </button>
                  </Link>
                  <Link href="/ai-coach" style={{ flex: 1, textDecoration: 'none' }}>
                    <button
                      style={{
                        width: '100%', padding: '8px 12px', borderRadius: 8,
                        border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        background: 'color-mix(in srgb, var(--accent) 8%, var(--card))',
                        color: 'var(--accent)', transition: 'all 0.12s'
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'color-mix(in srgb, var(--accent) 14%, var(--card))'
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'color-mix(in srgb, var(--accent) 8%, var(--card))'
                      }}
                    >
                      <Sparkles size={11} />
                      <span>Insights</span>
                    </button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
