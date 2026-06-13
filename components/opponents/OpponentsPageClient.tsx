'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Search, ArrowRight, Sparkles, Trophy } from 'lucide-react'
import type { AggregatedStats } from '@/types/database'
import DemoUploadButton from '@/components/teams/DemoUploadButton'
import AddFromEseaButton from '@/components/opponents/AddFromEseaButton'

interface OpponentFolder {
  id: string
  opponent_display_name: string
  opponent_slug: string
  aggregated_stats: AggregatedStats | null
  faceit_team_id?: string | null
}

interface Props {
  folders: OpponentFolder[]
  demosBySlug: Record<string, { id: string; match_date: string | null; created_at: string }[]>
  primaryTeamId: string | null
}

const AVATAR_COLORS = [
  '#6366f1', '#22d3ee', '#f59e0b', '#ec4899', '#10b981',
  '#8b5cf6', '#ef4444', '#3b82f6', '#14b8a6', '#f97316',
]

function TeamAvatar({ name, index = 0 }: { name: string; index?: number }) {
  const initials = name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const color = AVATAR_COLORS[index % AVATAR_COLORS.length]
  return (
    <div style={{
      width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 55%, #0c0f1a))`,
      border: `2px solid color-mix(in srgb, ${color} 45%, transparent)`,
      fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, color: '#fff',
      letterSpacing: '0.02em',
    }}>
      {initials}
    </div>
  )
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return '1 day ago'
  if (days === 1) return '1 day ago'
  if (days < 7) return `${days} days ago`
  if (days < 14) return '1 week ago'
  return `${Math.floor(days / 7)} weeks ago`
}

type FilterTab = 'all' | 'analyzed' | 'favorites'

export default function OpponentsPageClient({ folders, demosBySlug, primaryTeamId }: Props) {
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<FilterTab>('all')

  const opponents = useMemo(() => {
    return folders.map((folder, i) => {
      const demos = demosBySlug[folder.opponent_slug] ?? []
      const stats = folder.aggregated_stats as { win_rate?: number; maps_played?: Record<string, number> } | null
      const winRate = stats?.win_rate ? Math.round(stats.win_rate * 100) : 0
      const totalMatches = (stats as { total_matches?: number } | null)?.total_matches ?? demos.length
      const lastActivity = demos.map(d => d.match_date ?? d.created_at).sort().at(-1) ?? ''
      const completedDemos = demos.length

      // Best map from maps_played (most frequently played map)
      const mapsPlayed = stats?.maps_played ?? {}
      const bestMapEntry = Object.entries(mapsPlayed).sort((a, b) => b[1] - a[1])[0] ?? null
      const bestMapLabel = bestMapEntry
        ? bestMapEntry[0].replace(/^de_/, '').replace(/^(.)/, c => c.toUpperCase())
        : null
      const bestMapCount = bestMapEntry?.[1] ?? 0

      return { ...folder, index: i, demoCount: completedDemos, winRate, totalMatches, lastActivity, bestMap: bestMapLabel, bestMapCount }
    })
  }, [folders, demosBySlug])

  const filtered = useMemo(() => {
    let result = [...opponents].filter(o =>
      o.opponent_display_name.toLowerCase().includes(search.toLowerCase())
    )
    if (tab === 'analyzed') result = result.filter(o => o.demoCount > 0)
    result.sort((a, b) => (b.lastActivity ?? '').localeCompare(a.lastActivity ?? ''))
    return result
  }, [opponents, search, tab])

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'analyzed', label: 'Analyzed' },
    { key: 'favorites', label: 'Favorites' },
  ]

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '28px 28px' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', lineHeight: 1.1, marginBottom: 5 }}>
            Opponents
          </h1>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>
            Your scouting library — teams you&apos;re preparing to face
          </p>
        </div>
        {primaryTeamId && (
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <AddFromEseaButton teamId={primaryTeamId} />
            <DemoUploadButton
              teamId={primaryTeamId}
              demoType="opponent"
              label="Add Opponent"
            />
          </div>
        )}
      </div>

      {/* ── Search bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px', borderRadius: 10,
        border: '1px solid var(--border)', background: 'var(--card)',
        marginBottom: 16, transition: 'border-color 0.14s',
      }}>
        <Search size={14} style={{ color: 'var(--faint)', flexShrink: 0 }} />
        <input
          type="text"
          placeholder="Search opponents…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onFocus={e => (e.currentTarget.parentElement as HTMLDivElement).style.borderColor = 'var(--accent)'}
          onBlur={e => (e.currentTarget.parentElement as HTMLDivElement).style.borderColor = 'var(--border)'}
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: 'var(--text)' }}
        />
      </div>

      {/* ── Filter tabs ── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 22, background: 'var(--elevated)', borderRadius: 10, padding: 4, border: '1px solid var(--border)', width: 'fit-content' }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '6px 16px', borderRadius: 7, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', border: 'none', transition: 'all 0.12s',
              background: tab === t.key ? 'var(--accent)' : 'transparent',
              color: tab === t.key ? '#fff' : 'var(--muted)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Cards grid ── */}
      {filtered.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', textAlign: 'center', borderRadius: 14, border: '1px dashed var(--border)' }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: 'color-mix(in srgb, var(--accent) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Search size={22} style={{ color: 'var(--accent)' }} />
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
            {search ? 'No opponents found' : 'No opponents yet'}
          </p>
          <p style={{ fontSize: 12, color: 'var(--muted)', maxWidth: 280, marginBottom: 20 }}>
            {search ? 'Try a different search term' : 'Upload an opponent demo to start building your scouting library'}
          </p>
          {!search && primaryTeamId && <DemoUploadButton teamId={primaryTeamId} demoType="opponent" label="Add Opponent" />}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
          {filtered.map(opponent => (
            <div
              key={opponent.id}
              style={{
                borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)',
                overflow: 'hidden', transition: 'border-color 0.14s, box-shadow 0.14s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = 'color-mix(in srgb, var(--accent) 45%, transparent)'
                ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 20px color-mix(in srgb, var(--accent) 8%, transparent)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'
                ;(e.currentTarget as HTMLDivElement).style.boxShadow = 'none'
              }}
            >
              {/* Card inner */}
              <div style={{ padding: '16px 16px 14px' }}>

                {/* Top row: avatar + name + trophy */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                    <TeamAvatar name={opponent.opponent_display_name} index={opponent.index} />
                    <div>
                      <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 5, lineHeight: 1 }}>
                        {opponent.opponent_display_name}
                      </p>
                      {opponent.faceit_team_id && (
                        <a
                          href={`https://esea.team/team/${opponent.faceit_team_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 3,
                            fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                            color: 'var(--accent)', textDecoration: 'none',
                            padding: '2px 6px', borderRadius: 5,
                            background: 'var(--accent-soft)', border: '1px solid var(--accent-line)',
                          }}
                        >
                          <Trophy size={9} /> ESEA
                        </a>
                      )}
                    </div>
                  </div>
                  <Trophy size={15} style={{ color: 'var(--faint)', flexShrink: 0, marginTop: 2 }} />
                </div>

                {/* Stats row: DEMOS / WIN RATE / LAST SEEN */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
                  {[
                    { label: 'DEMOS', value: String(opponent.demoCount), color: 'var(--text)' },
                    { label: 'WIN RATE', value: `${opponent.winRate}%`, color: 'var(--win)' },
                    { label: 'LAST SEEN', value: opponent.lastActivity ? timeAgo(opponent.lastActivity) : '—', color: 'var(--text)', small: true },
                  ].map(stat => (
                    <div key={stat.label}>
                      <p style={{ fontSize: 9, fontWeight: 700, color: 'var(--faint)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 5 }}>{stat.label}</p>
                      <p style={{ fontSize: stat.small ? 12 : 20, fontWeight: 700, color: stat.color, fontFamily: stat.small ? 'inherit' : 'var(--font-mono)', lineHeight: 1, letterSpacing: stat.small ? 0 : '-0.02em' }}>
                        {stat.value}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Most played map */}
                {opponent.bestMap ? (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                        Most Played Map
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>
                        {opponent.bestMap}
                        <span style={{ color: 'var(--muted)', fontWeight: 400 }}>{' '}({opponent.bestMapCount}g)</span>
                      </span>
                    </div>
                    <div style={{ height: 5, borderRadius: 3, background: 'var(--hairline)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: opponent.totalMatches > 0 ? `${Math.min(100, (opponent.bestMapCount / opponent.totalMatches) * 100)}%` : '0%',
                        borderRadius: 3,
                        background: 'linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 70%, var(--signal)))',
                      }} />
                    </div>
                  </div>
                ) : (
                  <div style={{ marginBottom: 14, height: 33 }} />
                )}

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <Link href={`/opponents/${opponent.id}`} style={{ flex: 1, textDecoration: 'none' }}>
                    <button
                      style={{
                        width: '100%', padding: '9px 12px', borderRadius: 8,
                        border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                        background: 'linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 70%, var(--signal)))',
                        color: '#fff', transition: 'opacity 0.12s',
                        boxShadow: '0 2px 10px color-mix(in srgb, var(--accent) 30%, transparent)',
                      }}
                      onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.opacity = '0.88'}
                      onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.opacity = '1'}
                    >
                      View Scouting <ArrowRight size={13} />
                    </button>
                  </Link>
                  <Link href={`/ai-coach?folder=${opponent.id}&mode=opponent`} style={{ textDecoration: 'none' }}>
                    <button
                      style={{
                        padding: '9px 13px', borderRadius: 8,
                        border: 'none',
                        cursor: 'pointer', fontSize: 12, fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: 6,
                        background: 'var(--signal)',
                        color: '#07111a', transition: 'opacity 0.12s',
                        whiteSpace: 'nowrap',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.88' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
                    >
                      <Sparkles size={11} /> AI Insight
                    </button>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
