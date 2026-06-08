'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Shield, BarChart2, Activity } from 'lucide-react'
import PlayerWeaknessPanel from '@/components/demos/PlayerWeaknessPanel'
import PlayerDeepDive from '@/components/demos/PlayerDeepDive'
import PlayerAdvancedStats from '@/components/demos/PlayerAdvancedStats'
import type { PlayerStats, Kill } from '@/types/database'

interface DemoEntry {
  demoId: string
  map: string
  date: string | null
  stats: PlayerStats
  kills: Kill[]
  deaths: Kill[]
  result?: 'Win' | 'Loss' | 'Draw' | null
}

interface Props {
  playerName: string
  teamName: string
  demoEntries: DemoEntry[]
}

export default function PlayerPageClient({ playerName, teamName, demoEntries }: Props) {
  const [tab, setTab] = useState<'overview' | 'advanced'>('overview')

  const tabStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
    fontSize: 13, fontWeight: active ? 600 : 450,
    color: active ? 'var(--text)' : 'var(--muted)',
    background: active ? 'var(--accent-soft)' : 'transparent',
    border: 'none', transition: 'all 0.12s ease',
  })

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--card)', padding: '16px 24px' }}>
        <nav style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
          <Link href="/my-team" style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--muted)', textDecoration: 'none' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
          >
            <Shield size={12} /> My Team
          </Link>
          <span style={{ color: 'var(--faint)' }}>/</span>
          <span style={{ color: 'var(--text)', fontWeight: 500 }}>{playerName}</span>
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/my-team" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', color: 'var(--muted)', textDecoration: 'none', flexShrink: 0 }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
          >
            <ArrowLeft size={15} />
          </Link>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{playerName}</h1>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: '3px 0 0' }}>
              {demoEntries.length} {demoEntries.length === 1 ? 'demo' : 'demos'} · {teamName}
            </p>
          </div>

          {/* Tab toggle */}
          <div style={{ display: 'flex', gap: 4, background: 'var(--elevated)', borderRadius: 10, padding: 3, border: '1px solid var(--border)' }}>
            <button style={tabStyle(tab === 'overview')} onClick={() => setTab('overview')}>
              <Activity size={13} /> Overview
            </button>
            <button style={tabStyle(tab === 'advanced')} onClick={() => setTab('advanced')}>
              <BarChart2 size={13} /> Advanced Stats
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 900, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        {tab === 'overview' ? (
          <>
            <PlayerWeaknessPanel demoEntries={demoEntries} />
            <PlayerDeepDive
              playerName={playerName}
              folderId=""
              demoEntries={demoEntries}
              teamName={teamName}
            />
          </>
        ) : (
          <PlayerAdvancedStats demoEntries={demoEntries} />
        )}
      </div>
    </div>
  )
}
