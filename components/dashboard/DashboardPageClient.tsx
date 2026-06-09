'use client'

import Link from 'next/link'
import { ArrowRight, Brain, Globe, ThumbsUp } from 'lucide-react'

export interface RecentDemoItem {
  id: string
  map: string
  opponent: string
  wl: 'W' | 'L' | 'D' | null
  date: string
  rating: string
  href: string
  hot?: boolean
}

export interface MapPerfItem {
  name: string
  ct: number
}

export interface CommunityFeedItem {
  id: string
  name: string
  publishedAt: string
  winRate: number | null
  total: number
  upRatings: number
  topMap: string | null
}

interface Props {
  winRate: string
  mapsPlayed: number
  demosAnalyzed: number
  avgRating: string
  nextOpponent: string | null
  recentDemos: RecentDemoItem[]
  mapPerformance: MapPerfItem[]
  communityFeed: CommunityFeedItem[]
}

function StatCard({ label, value, sub, accent }: {
  label: string
  value: string | number
  sub: string
  accent: string
}) {
  return (
    <div style={{
      borderRadius: 12, border: '1px solid var(--border)',
      borderLeft: `3px solid ${accent}`,
      background: 'var(--card)', padding: '18px 20px',
      position: 'relative', overflow: 'hidden', cursor: 'default',
    }}>
      <p style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--faint)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
        {label}
      </p>
      <p style={{
        fontFamily: 'var(--font-mono)', fontSize: 34, fontWeight: 700, color: accent,
        lineHeight: 1, letterSpacing: '-0.02em', marginBottom: 8,
        textShadow: `0 0 22px color-mix(in srgb, ${accent} 35%, transparent)`,
      }}>
        {value}
      </p>
      <p style={{ fontSize: 11, color: 'var(--faint)' }}>{sub}</p>
    </div>
  )
}

function PoolBar({ name, win }: { name: string; win: number }) {
  const loss = 100 - win
  return (
    <div>
      <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>{name}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--win)', width: 28, textAlign: 'right', flexShrink: 0 }}>{win}%</span>
        <div style={{ flex: 1, height: 6, borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
          <div style={{ width: `${win}%`, background: 'linear-gradient(90deg, var(--win), #2bb98a)' }} />
          <div style={{ flex: 1, background: 'color-mix(in srgb, var(--loss) 40%, transparent)' }} />
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--loss)', width: 28, flexShrink: 0 }}>{loss}%</span>
      </div>
    </div>
  )
}

function PerfRow({ name, ct }: { name: string; ct: number }) {
  const t = 100 - ct
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--hairline)' }}>
      <span style={{ fontSize: 12, color: 'var(--text)', width: 72, flexShrink: 0 }}>{name}</span>
      <div style={{ flex: 1, height: 11, borderRadius: 4, overflow: 'hidden', display: 'flex', border: '1px solid var(--border)' }}>
        <div style={{ width: `${ct}%`, background: 'linear-gradient(90deg, #4d83e6, var(--ct))' }} />
        <div style={{ flex: 1, background: 'linear-gradient(90deg, var(--tside), #e09a2e)' }} />
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ct)', width: 38, textAlign: 'right', flexShrink: 0 }}>{ct}%</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--tside)', width: 38, textAlign: 'right', flexShrink: 0 }}>{t}%</span>
    </div>
  )
}

const MAP_POOL_STATIC = [
  { name: 'Mirage', win: 60 },
  { name: 'Inferno', win: 45 },
  { name: 'Nuke', win: 70 },
  { name: 'Overpass', win: 55 },
  { name: 'Ancient', win: 50 },
]

function mapLabel(raw: string): string {
  return raw.replace(/^(de_|cs_|ar_)/, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function DashboardPageClient({
  winRate, mapsPlayed, demosAnalyzed, avgRating,
  nextOpponent, recentDemos, mapPerformance, communityFeed,
}: Props) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '28px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* ── Stat Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <StatCard label="Win Rate"       value={winRate}        sub="Last 30 days"   accent="var(--pink)"   />
        <StatCard label="Maps Played"    value={mapsPlayed}     sub="Across all modes" accent="var(--signal)" />
        <StatCard label="Demos Analyzed" value={demosAnalyzed}  sub="Total analyzed"  accent="var(--loss)"   />
        <StatCard label="Avg Rating"     value={avgRating}      sub="Team average"    accent="var(--tside)"  />
      </div>

      {/* ── Next Match Hero ── */}
      <div style={{
        borderRadius: 14, overflow: 'hidden', position: 'relative',
        border: '1px solid color-mix(in srgb, var(--accent) 20%, var(--border))',
        background: 'radial-gradient(800px 350px at 95% -30%, color-mix(in srgb, var(--accent) 12%, transparent), transparent 55%), linear-gradient(180deg, color-mix(in srgb, var(--accent) 3%, var(--card)), var(--card))',
        padding: '22px 24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 22, gap: 16, flexWrap: 'wrap' }}>
          <div>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 6 }}>
              Next Match
            </p>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1.05 }}>
              {nextOpponent ?? 'No upcoming match'}
            </h2>
          </div>
          <Link href="/prep">
            <button
              style={{
                height: 38, padding: '0 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, border: 'none',
                background: 'linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 70%, var(--signal)))',
                color: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7,
                boxShadow: '0 2px 12px color-mix(in srgb, var(--accent) 30%, transparent)',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.opacity = '0.88'}
              onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.opacity = '1'}
            >
              View Full Prep <ArrowRight size={14} />
            </button>
          </Link>
        </div>

        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 14 }}>
          Map Pool Win Rates
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 20 }}>
          {MAP_POOL_STATIC.map(m => <PoolBar key={m.name} name={m.name} win={m.win} />)}
        </div>
      </div>

      {/* ── Two-column: Demos Table + Map Performance ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

        {/* Recent Demos Table */}
        <div style={{ borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Recent Demos</p>
            <Link href="/improve" style={{ textDecoration: 'none' }}>
              <span style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                View all <ArrowRight size={11} />
              </span>
            </Link>
          </div>

          {/* Column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr 44px 70px 60px', padding: '7px 18px', fontSize: 9.5, fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {['Map', 'Opponent', 'W/L', 'Date', 'Rating'].map((h, i) => (
              <span key={h} style={{ textAlign: i >= 2 ? 'center' : 'left' }}>{h}</span>
            ))}
          </div>

          {recentDemos.length === 0 ? (
            <div style={{ padding: '28px 18px', textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>
              No demos yet — upload your first match to get started.
            </div>
          ) : recentDemos.map(demo => (
            <Link key={demo.id} href={demo.href} style={{ textDecoration: 'none' }}>
              <div
                style={{
                  display: 'grid', gridTemplateColumns: '1fr 1.3fr 44px 70px 60px',
                  padding: '10px 18px', alignItems: 'center',
                  borderTop: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.12s',
                  background: demo.hot ? 'color-mix(in srgb, var(--accent) 5%, transparent)' : 'transparent',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = demo.hot ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'rgba(255,255,255,0.03)'}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = demo.hot ? 'color-mix(in srgb, var(--accent) 5%, transparent)' : 'transparent'}
              >
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{demo.map}</span>
                <span style={{ fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>
                  {demo.opponent}
                </span>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                    background: demo.wl === 'W' ? 'rgba(0,255,200,0.12)' : demo.wl === 'L' ? 'rgba(239,68,68,0.12)' : 'rgba(251,191,36,0.12)',
                    color: demo.wl === 'W' ? 'var(--win)' : demo.wl === 'L' ? 'var(--loss)' : 'var(--tside)',
                  }}>
                    {demo.wl ?? '—'}
                  </span>
                </div>
                <span style={{ fontSize: 11, color: 'var(--faint)', textAlign: 'center' }}>{demo.date}</span>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, textAlign: 'center',
                  color: demo.rating !== '—' && parseFloat(demo.rating) >= 1.1
                    ? 'var(--win)'
                    : demo.rating !== '—' && parseFloat(demo.rating) < 1.0
                    ? 'var(--loss)'
                    : 'var(--text)',
                }}>
                  {demo.rating}
                </span>
              </div>
            </Link>
          ))}
        </div>

        {/* Map Performance Chart */}
        <div style={{ borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Map Performance</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--muted)' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--ct)', display: 'inline-block' }} />CT
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--muted)' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--tside)', display: 'inline-block' }} />T
              </span>
            </div>
          </div>
          <div style={{ padding: '8px 18px 14px' }}>
            {mapPerformance.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '28px 0' }}>
                No map data yet — upload demos to see performance breakdown.
              </p>
            ) : mapPerformance.map(m => <PerfRow key={m.name} name={m.name} ct={m.ct} />)}
          </div>
        </div>
      </div>

      {/* ── Community Library Feed ── */}
      {communityFeed.length > 0 && (
        <div style={{ borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Globe size={14} style={{ color: 'var(--accent)' }} />
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Community Scout Reports</p>
            </div>
            <Link href="/scouts" style={{ textDecoration: 'none' }}>
              <span style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                View all <ArrowRight size={11} />
              </span>
            </Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 1, borderTop: 'none' }}>
            {communityFeed.map(item => (
              <Link key={item.id} href={`/scouts/${item.id}`} style={{ textDecoration: 'none' }}>
                <div
                  style={{ padding: '14px 18px', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.12s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.03)'}
                  onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--accent-soft)', border: '1px solid var(--accent-line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: 'var(--accent)', flexShrink: 0 }}>
                      {item.name.charAt(0).toUpperCase()}
                    </div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    {item.winRate !== null && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: item.winRate >= 50 ? 'var(--loss)' : 'var(--win)' }}>
                        {item.winRate}% WR
                      </span>
                    )}
                    {item.total > 0 && (
                      <span style={{ fontSize: 10, color: 'var(--muted)' }}>{item.total} demos</span>
                    )}
                    {item.topMap && (
                      <span style={{ fontSize: 10, color: 'var(--faint)' }}>{mapLabel(item.topMap)}</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                    <span style={{ fontSize: 10, color: 'var(--faint)' }}>{timeAgo(item.publishedAt)}</span>
                    {item.upRatings > 0 && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--muted)' }}>
                        <ThumbsUp size={9} />
                        {item.upRatings}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── AI Brief ── */}
      <div style={{
        borderRadius: 14, overflow: 'hidden', position: 'relative',
        border: '1px solid color-mix(in srgb, var(--signal) 24%, transparent)',
        background: 'radial-gradient(480px 250px at 8% -24%, color-mix(in srgb, var(--signal) 11%, transparent), transparent 60%), linear-gradient(180deg, color-mix(in srgb, var(--signal) 2.5%, var(--card)), var(--card))',
        padding: '20px 24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>AI Brief</p>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 5,
                background: 'rgba(34,211,238,.1)', border: '1px solid rgba(34,211,238,.3)',
                fontFamily: 'var(--font-mono)', fontSize: 9.5, fontWeight: 700, color: 'var(--signal)', letterSpacing: '0.06em',
              }}>
                ✦ AI INSIGHT
              </span>
            </div>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
              Pre-match brief ready
            </p>
            <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.65, maxWidth: 760 }}>
              {demosAnalyzed > 0
                ? `${demosAnalyzed} demo${demosAnalyzed !== 1 ? 's' : ''} analyzed and ready for AI scouting. Upload more demos to unlock detailed opponent breakdowns and personalized anti-strats.`
                : 'Upload your first demo to get started. AI will analyze patterns and generate personalized match insights.'}
            </p>
          </div>
          <Link href="/ai-coach">
            <button
              style={{
                height: 38, padding: '0 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                background: 'color-mix(in srgb, var(--signal) 13%, transparent)', color: 'var(--signal)',
                border: '1px solid color-mix(in srgb, var(--signal) 32%, transparent)', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 7, flexShrink: 0, transition: 'all 0.12s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'color-mix(in srgb, var(--signal) 20%, transparent)'
                ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'color-mix(in srgb, var(--signal) 50%, transparent)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'color-mix(in srgb, var(--signal) 13%, transparent)'
                ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'color-mix(in srgb, var(--signal) 32%, transparent)'
              }}
            >
              <Brain size={14} /> Open AI Coach <ArrowRight size={14} />
            </button>
          </Link>
        </div>
      </div>

    </div>
  )
}
