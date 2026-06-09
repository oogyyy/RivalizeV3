'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, Users, TrendingUp, Globe, ArrowRight, ThumbsUp } from 'lucide-react'
import Link from 'next/link'
interface AggStats {
  wins?: number
  losses?: number
  draws?: number
  map_performance?: Record<string, { wins: number; total: number }>
  [key: string]: unknown
}

interface PublicFolder {
  id: string
  name: string
  slug: string
  publishedAt: string
  stats: AggStats | null
  ratings: { up: number; down: number }
}

function mapLabel(raw: string): string {
  if (!raw || raw === 'unknown') return '—'
  return raw.replace(/^(de_|cs_|ar_)/, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function OpponentCard({ folder }: { folder: PublicFolder }) {
  const stats = folder.stats
  const wins   = stats?.wins   ?? 0
  const losses = stats?.losses ?? 0
  const draws  = stats?.draws  ?? 0
  const total  = wins + losses + draws
  const wr     = total > 0 ? Math.round((wins / total) * 100) : null
  const topMap = stats?.map_performance
    ? Object.entries(stats.map_performance)
        .sort((a, b) => b[1].total - a[1].total)[0]?.[0]
    : null

  return (
    <Link href={`/scouts/${folder.id}`} style={{ textDecoration: 'none' }}>
      <div style={{
        background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14,
        padding: 20, display: 'flex', flexDirection: 'column', gap: 14,
        cursor: 'pointer', transition: 'border-color 0.14s, transform 0.14s',
      }}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent-line)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLDivElement).style.transform = 'none' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: 'var(--accent-soft)', border: '1px solid var(--accent-line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 800, color: 'var(--accent)', fontFamily: 'var(--font-display)', flexShrink: 0 }}>
              {folder.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>{folder.name}</p>
              {topMap && <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>Primary: {mapLabel(topMap)}</p>}
            </div>
          </div>
          <ArrowRight size={15} style={{ color: 'var(--faint)', flexShrink: 0 }} />
        </div>

        {total > 0 ? (
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1, textAlign: 'center', padding: '8px 0', borderRadius: 8, background: 'var(--card-2)' }}>
              <p style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-mono)', color: wr !== null && wr >= 50 ? 'var(--win)' : 'var(--loss)' }}>{wr ?? '—'}%</p>
              <p style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Win Rate</p>
            </div>
            <div style={{ flex: 1, textAlign: 'center', padding: '8px 0', borderRadius: 8, background: 'var(--card-2)' }}>
              <p style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>{total}</p>
              <p style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Demos</p>
            </div>
            <div style={{ flex: 1, textAlign: 'center', padding: '8px 0', borderRadius: 8, background: 'var(--card-2)' }}>
              <p style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--win)' }}>{folder.ratings.up}</p>
              <p style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Helpful</p>
            </div>
          </div>
        ) : (
          <p style={{ fontSize: 12, color: 'var(--faint)' }}>No demos analyzed yet</p>
        )}
      </div>
    </Link>
  )
}

export default function ScoutsPage() {
  const [folders, setFolders] = useState<PublicFolder[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  const load = useCallback(async (q: string) => {
    setLoading(true)
    const res = await fetch(`/api/scouts?limit=40${q ? `&q=${encodeURIComponent(q)}` : ''}`)
    if (res.ok) setFolders(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { load('') }, [load])

  useEffect(() => {
    const t = setTimeout(() => load(query), 300)
    return () => clearTimeout(t)
  }, [query, load])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--panel)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--grad)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={14} color="#fff" />
            </div>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>Rivalize</span>
          </Link>
          <Link href="/login" style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>Sign in →</Link>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px' }}>
        {/* Hero */}
        <div style={{ marginBottom: 40, textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 9999, background: 'var(--accent-soft)', border: '1px solid var(--accent-line)', fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
            <Globe size={11} />
            Community Library
          </div>
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', margin: '0 0 12px' }}>
            CS2 Opponent Scout Reports
          </h1>
          <p style={{ fontSize: 15, color: 'var(--muted)', maxWidth: 480, margin: '0 auto' }}>
            Community-sourced match analysis from teams using Rivalize. Find opponent tendencies, map pools, and player stats.
          </p>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', maxWidth: 480, margin: '0 auto 36px' }}>
          <Search size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search opponents…"
            style={{ width: '100%', boxSizing: 'border-box', paddingLeft: 40, paddingRight: 16, paddingTop: 11, paddingBottom: 11, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
          />
        </div>

        {/* Grid */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ height: 160, borderRadius: 14, background: 'var(--card)', border: '1px solid var(--border)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        ) : folders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Users size={40} style={{ color: 'var(--faint)', margin: '0 auto 16px' }} />
            <p style={{ color: 'var(--muted)', fontSize: 15 }}>{query ? 'No opponents match that search.' : 'No public reports yet. Be the first to publish!'}</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {folders.map(f => <OpponentCard key={f.id} folder={f} />)}
          </div>
        )}
      </div>
    </div>
  )
}
