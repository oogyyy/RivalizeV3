'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, ThumbsUp, ThumbsDown, Map, Trophy,
  TrendingUp, Brain, Clock,
} from 'lucide-react'

function mapLabel(raw: string): string {
  if (!raw || raw === 'unknown') return '—'
  return raw.replace(/^(de_|cs_|ar_)/, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function getResult(parsedData: unknown): 'W' | 'L' | 'D' | null {
  if (!parsedData || typeof parsedData !== 'object') return null
  const pd = parsedData as Record<string, unknown>
  const h  = (pd.header ?? {}) as Record<string, number>
  const os = (pd.opponentSide as string | undefined) ?? 'team2'
  const oppScore = os === 'team1' ? (h.score_team1 ?? 0) : (h.score_team2 ?? 0)
  const ourScore = os === 'team1' ? (h.score_team2 ?? 0) : (h.score_team1 ?? 0)
  if (oppScore === 0 && ourScore === 0) return null
  return oppScore > ourScore ? 'W' : oppScore < ourScore ? 'L' : 'D'
}

interface Props {
  folderId: string
  name: string
  publishedAt: string | null
  updatedAt: string
  stats: Record<string, unknown> | null
  aiBrief: string | null
  demos: Array<{ id: string; map: string; match_date: string | null; created_at: string; parsed_data: unknown }>
  initialRatings: { up: number; down: number }
}

export default function ScoutDetailClient({ folderId, name, publishedAt, updatedAt, stats, aiBrief, demos, initialRatings }: Props) {
  const [ratings, setRatings]   = useState(initialRatings)
  const [myRating, setMyRating] = useState<1 | -1 | 0>(0)
  const [ratingLoading, setRatingLoading] = useState(false)

  const wins   = (stats?.wins   as number) ?? 0
  const losses = (stats?.losses as number) ?? 0
  const draws  = (stats?.draws  as number) ?? 0
  const total  = wins + losses + draws
  const wr     = total > 0 ? Math.round((wins / total) * 100) : null

  const mapPerf = (stats?.map_performance ?? {}) as Record<string, { wins: number; losses: number; draws: number; total: number }>
  const topMaps = Object.entries(mapPerf)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 5)

  const topPlayers = ((stats?.top_players ?? []) as Array<{ name: string; rating: number; kills: number; adr: number }>)
    .slice(0, 5)

  const handleRate = async (r: 1 | -1) => {
    if (ratingLoading) return
    const next = myRating === r ? 0 : r
    setRatingLoading(true)
    try {
      const res = await fetch(`/api/scouts/${folderId}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: next }),
      })
      if (res.ok) {
        const data = await res.json() as { up: number; down: number }
        setRatings(data)
        setMyRating(next)
      } else if (res.status === 401) {
        window.location.href = `/login?next=/scouts/${folderId}`
      }
    } finally {
      setRatingLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      {/* Nav */}
      <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--panel)' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/scouts" style={{ display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none', fontSize: 13, color: 'var(--muted)' }}>
            <ArrowLeft size={14} /> Back to Library
          </Link>
          <Link href="/login" style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>Sign in to analyze →</Link>
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '36px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Hero header */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 28 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 60, height: 60, borderRadius: 14, background: 'var(--accent-soft)', border: '1px solid var(--accent-line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800, color: 'var(--accent)', fontFamily: 'var(--font-display)' }}>
                {name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 style={{ fontSize: 'clamp(20px, 3vw, 28px)', fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-display)', margin: 0 }}>{name}</h1>
                <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                  Updated {new Date(updatedAt).toLocaleDateString()}
                  {publishedAt && ` · Published ${new Date(publishedAt).toLocaleDateString()}`}
                </p>
              </div>
            </div>

            {/* Rating */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => handleRate(1)}
                disabled={ratingLoading}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', background: myRating === 1 ? 'color-mix(in srgb, var(--win) 12%, transparent)' : 'transparent', color: myRating === 1 ? 'var(--win)' : 'var(--muted)', cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all 0.14s' }}
              >
                <ThumbsUp size={13} /> {ratings.up}
              </button>
              <button
                onClick={() => handleRate(-1)}
                disabled={ratingLoading}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', background: myRating === -1 ? 'color-mix(in srgb, var(--loss) 12%, transparent)' : 'transparent', color: myRating === -1 ? 'var(--loss)' : 'var(--muted)', cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all 0.14s' }}
              >
                <ThumbsDown size={13} /> {ratings.down}
              </button>
            </div>
          </div>

          {/* Record stats */}
          {total > 0 && (
            <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
              {[
                { label: 'Win Rate', value: wr !== null ? `${wr}%` : '—', color: wr !== null && wr >= 50 ? 'var(--win)' : 'var(--loss)' },
                { label: 'Wins',     value: wins,   color: 'var(--win)' },
                { label: 'Losses',   value: losses, color: 'var(--loss)' },
                { label: 'Draws',    value: draws,  color: 'var(--muted)' },
                { label: 'Demos',    value: total,  color: 'var(--text)' },
              ].map(s => (
                <div key={s.label} style={{ padding: '10px 20px', borderRadius: 10, background: 'var(--card-2)', border: '1px solid var(--border)', textAlign: 'center' }}>
                  <p style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-mono)', color: s.color }}>{s.value}</p>
                  <p style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 2 }}>{s.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
          {/* Map Pool */}
          {topMaps.length > 0 && (
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 14 }}>
                <Map size={14} style={{ color: 'var(--accent)' }} /> Map Pool
              </div>
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {topMaps.map(([map, s]) => {
                  const pct = s.total > 0 ? Math.round((s.wins / s.total) * 100) : 0
                  return (
                    <div key={map}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 12 }}>
                        <span style={{ color: 'var(--text)', fontWeight: 600 }}>{mapLabel(map)}</span>
                        <span style={{ color: pct >= 50 ? 'var(--win)' : 'var(--loss)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{pct}% · {s.total}G</span>
                      </div>
                      <div style={{ height: 5, borderRadius: 9999, background: 'var(--track)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 9999, width: `${pct}%`, background: pct >= 50 ? 'var(--win)' : 'var(--loss)', transition: 'width 0.5s' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Top Players */}
          {topPlayers.length > 0 && (
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 14 }}>
                <Trophy size={14} style={{ color: 'var(--tside)' }} /> Key Players
              </div>
              <div style={{ padding: '8px 0' }}>
                {topPlayers.map((p, i) => (
                  <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: i < topPlayers.length - 1 ? '1px solid var(--hairline)' : 'none' }}>
                    <span style={{ fontSize: 11, color: 'var(--faint)', fontFamily: 'var(--font-mono)', width: 16 }}>#{i + 1}</span>
                    <p style={{ flex: 1, fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{p.name}</p>
                    <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                      <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{p.rating.toFixed(2)}</span>
                      <span style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{p.adr?.toFixed(0) ?? '—'} ADR</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* AI Brief */}
        {aiBrief && (
          <div style={{ background: 'var(--card)', border: '1px solid color-mix(in srgb, var(--signal) 24%, transparent)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid color-mix(in srgb, var(--signal) 16%, transparent)', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 14, color: 'var(--signal)' }}>
              <Brain size={14} /> AI Scouting Brief
            </div>
            <div style={{ padding: 20 }}>
              <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>{aiBrief}</p>
            </div>
          </div>
        )}

        {/* Recent matches */}
        {demos.length > 0 && (
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 14 }}>
              <Clock size={14} style={{ color: 'var(--accent)' }} /> Recent Matches
            </div>
            <div>
              {demos.map((d, i) => {
                const result = getResult(d.parsed_data)
                const pd     = d.parsed_data as Record<string, unknown> | null
                const h      = (pd?.header ?? {}) as Record<string, number | string>
                const os     = (pd?.opponentSide as string | undefined) ?? 'team2'
                const oppScore = os === 'team1' ? (h.score_team1 as number ?? 0) : (h.score_team2 as number ?? 0)
                const ourScore = os === 'team1' ? (h.score_team2 as number ?? 0) : (h.score_team1 as number ?? 0)
                return (
                  <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 18px', borderBottom: i < demos.length - 1 ? '1px solid var(--hairline)' : 'none' }}>
                    {result && (
                      <span style={{ width: 22, height: 22, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, background: result === 'W' ? 'color-mix(in srgb, var(--win) 15%, transparent)' : result === 'L' ? 'color-mix(in srgb, var(--loss) 15%, transparent)' : 'var(--track)', color: result === 'W' ? 'var(--win)' : result === 'L' ? 'var(--loss)' : 'var(--muted)' }}>
                        {result}
                      </span>
                    )}
                    <span style={{ flex: 1, fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{mapLabel(d.map)}</span>
                    {oppScore + ourScore > 0 && (
                      <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>{oppScore} : {ourScore}</span>
                    )}
                    <span style={{ fontSize: 11, color: 'var(--faint)' }}>{new Date(d.match_date ?? d.created_at).toLocaleDateString()}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* CTA */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 28, textAlign: 'center' }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-display)', marginBottom: 8 }}>Want deeper analysis?</p>
          <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 20 }}>Upload your own demos to get AI-powered scouting reports, economy charts, and round-by-round replay.</p>
          <Link href="/signup" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 22px', borderRadius: 11, background: 'linear-gradient(180deg, var(--accent), var(--accent-deep))', color: '#fff', textDecoration: 'none', fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-display)', boxShadow: '0 4px 14px -4px rgba(124,107,255,0.6)' }}>
            <TrendingUp size={14} /> Get started free
          </Link>
        </div>
      </div>
    </div>
  )
}
