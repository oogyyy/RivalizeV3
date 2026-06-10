'use client'

import Link from 'next/link'
import { ArrowRight, Award, BarChart2, Brain, Film, Star, TrendingUp, Zap } from 'lucide-react'

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

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accentColor, icon: Icon, trendDot, trendText }: {
  label: string
  value: string | number
  sub: string
  accentColor: string
  accentAlpha?: string
  icon: React.ElementType
  trendDot: 'green' | 'red' | 'amber'
  trendText: string
}) {
  const dotColor = trendDot === 'green' ? '#10b981' : trendDot === 'red' ? '#ef4444' : '#f59e0b'
  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      padding: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: 0,
      flex: 1,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Colored top strip */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accentColor }} />

      {/* Label + Icon */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--faint)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {label}
        </span>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: `color-mix(in srgb, ${accentColor} 15%, transparent)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Icon size={18} color={accentColor} />
        </div>
      </div>

      {/* Big number */}
      <p style={{
        fontFamily: 'var(--font-mono)', fontSize: 38, fontWeight: 700,
        color: 'var(--text)', lineHeight: 1, letterSpacing: '-0.02em', marginBottom: 6,
      }}>
        {value}
      </p>

      {/* Subtitle */}
      <p style={{ fontSize: 11.5, color: 'var(--faint)', marginBottom: 12 }}>{sub}</p>

      {/* Divider */}
      <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', marginBottom: 10 }} />

      {/* Trend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
        <span style={{ fontSize: 11, color: dotColor, fontWeight: 500 }}>{trendText}</span>
      </div>
    </div>
  )
}

const MAP_POOL_STATIC = [
  { name: 'Mirage', ct: 62, t: 38 },
  { name: 'Inferno', ct: 47, t: 53 },
  { name: 'Nuke', ct: 73, t: 27 },
  { name: 'Overpass', ct: 55, t: 45 },
  { name: 'Ancient', ct: 50, t: 50 },
]

function MapPoolBar({ name, ct, t }: { name: string; ct: number; t: number }) {
  const isStrong = ct >= 60 || t >= 60
  const mainPct = Math.max(ct, t)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 0 }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>{name}</p>
      <p style={{
        fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700,
        color: isStrong ? '#10b981' : 'var(--text)', lineHeight: 1,
      }}>{mainPct}%</p>
      <div style={{ height: 8, borderRadius: 4, overflow: 'hidden', display: 'flex', background: 'rgba(255,255,255,0.06)' }}>
        <div style={{ width: `${ct}%`, background: '#3b82f6', borderRadius: '4px 0 0 4px', flexShrink: 0 }} />
        <div style={{ flex: 1, background: 'rgba(245,158,11,0.7)' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(59,130,246,0.8)' }}>CT {ct}%</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(245,158,11,0.8)' }}>T {t}%</span>
      </div>
    </div>
  )
}

function PerfBar({ name, ct, count }: { name: string; ct: number; count?: number }) {
  const t = 100 - ct
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>{name}</span>
        {count !== undefined && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--faint)' }}>{count} maps</span>
        )}
      </div>
      <div style={{ height: 11, borderRadius: 5, overflow: 'hidden', display: 'flex', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.06)' }}>
        <div style={{ width: `${ct}%`, background: '#3b82f6', flexShrink: 0 }} />
        <div style={{ flex: 1, background: 'rgba(245,158,11,0.7)' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(59,130,246,0.75)', whiteSpace: 'pre' }}>{`CT  ${ct}%`}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(245,158,11,0.75)', whiteSpace: 'pre' }}>{`T  ${t}%`}</span>
      </div>
    </div>
  )
}

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

// ── Main Component ─────────────────────────────────────────────────────────────

export default function DashboardPageClient({
  winRate, mapsPlayed, demosAnalyzed, avgRating,
  nextOpponent, recentDemos, mapPerformance, communityFeed,
}: Props) {
  const inQueue = Math.max(0, mapsPlayed - demosAnalyzed)

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Stat Cards ── */}
      <div style={{ display: 'flex', gap: 14 }}>
        <StatCard
          label="Win Rate"
          value={winRate}
          sub="Last 30 matches"
          accentColor="#7b5cf5"
          accentAlpha="rgba(123,92,245,0.18)"
          icon={Award}
          trendDot="green"
          trendText="Team performance"
        />
        <StatCard
          label="Maps Played"
          value={mapsPlayed}
          sub="All-time total"
          accentColor="#22d3ee"
          accentAlpha="rgba(34,211,238,0.18)"
          icon={BarChart2}
          trendDot="green"
          trendText="Matches tracked"
        />
        <StatCard
          label="Demos Analyzed"
          value={demosAnalyzed}
          sub="Total processed"
          accentColor="#ef4444"
          accentAlpha="rgba(239,68,68,0.18)"
          icon={Film}
          trendDot={inQueue > 0 ? 'red' : 'green'}
          trendText={inQueue > 0 ? `${inQueue} in queue` : 'All processed'}
        />
        <StatCard
          label="Avg Team Rating"
          value={avgRating}
          sub="Team average"
          accentColor="#10b981"
          accentAlpha="rgba(16,185,129,0.18)"
          icon={Star}
          trendDot="green"
          trendText="Overall performance"
        />
      </div>

      {/* ── Next Match Hero ── */}
      <div style={{
        borderRadius: 16,
        border: '1px solid rgba(123,92,245,0.22)',
        background: 'radial-gradient(820px 380px at 0% 0%, rgba(123,92,245,0.10), transparent 62%), var(--card)',
        padding: '24px 28px',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '4px 10px', borderRadius: 6,
              background: 'rgba(123,92,245,0.14)', border: '1px solid rgba(123,92,245,0.30)',
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, fontWeight: 700, color: '#7b5cf5', letterSpacing: '1.2px' }}>
                NEXT MATCH
              </span>
            </div>
            <h2 style={{ fontSize: 32, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.5px', lineHeight: 1.1 }}>
              {nextOpponent ?? 'No upcoming match'}
            </h2>
            <div style={{ display: 'flex', gap: 10 }}>
              {[{ text: 'FACEIT Level 10' }, { text: 'Best of 3' }].map(b => (
                <div key={b.text} style={{
                  padding: '4px 8px', borderRadius: 6,
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                }}>
                  <span style={{ fontSize: 11, fontWeight: 500, color: '#97a3b7' }}>{b.text}</span>
                </div>
              ))}
            </div>
          </div>
          <Link href="/prep" style={{ textDecoration: 'none' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '11px 20px', borderRadius: 11,
              background: '#7b5cf5', cursor: 'pointer',
            }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>Full Match Prep</span>
              <ArrowRight size={14} color="#fff" />
            </div>
          </Link>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.07)' }} />

        {/* Map pool */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--faint)', letterSpacing: '1px', textTransform: 'uppercase' }}>
              Map Pool Win Rates
            </span>
            <div style={{ display: 'flex', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: '#3b82f6' }} />
                <span style={{ fontSize: 10, color: 'var(--faint)' }}>CT Side</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: '#f59e0b' }} />
                <span style={{ fontSize: 10, color: 'var(--faint)' }}>T Side</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
            {MAP_POOL_STATIC.map(m => <MapPoolBar key={m.name} {...m} />)}
          </div>
        </div>
      </div>

      {/* ── Two Column: Recent Demos + Map Performance ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

        {/* Recent Demos */}
        <div style={{ background: 'var(--card)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Recent Demos</p>
            <Link href="/improve" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--faint)' }}>View all</span>
              <ArrowRight size={11} color="var(--faint)" />
            </Link>
          </div>

          {/* Col headers */}
          <div style={{
            display: 'grid', gridTemplateColumns: '90px 1fr 44px 70px 60px',
            padding: '7px 18px',
            background: 'rgba(255,255,255,0.02)',
            fontSize: 9.5, fontWeight: 700, color: 'var(--faint)',
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            <span>MAP</span>
            <span>OPPONENT</span>
            <span style={{ textAlign: 'center' }}>W/L</span>
            <span style={{ textAlign: 'center' }}>DATE</span>
            <span style={{ textAlign: 'center' }}>RATING</span>
          </div>

          {recentDemos.length === 0 ? (
            <div style={{ padding: '28px 18px', textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>
              No demos yet — upload your first match.
            </div>
          ) : recentDemos.map(demo => {
            const ratingNum = demo.rating !== '—' ? parseFloat(demo.rating) : null
            const ratingColor = ratingNum === null ? 'var(--text)' : ratingNum >= 1.1 ? '#10b981' : ratingNum < 1.0 ? '#ef4444' : 'var(--text)'
            return (
              <Link key={demo.id} href={demo.href} style={{ textDecoration: 'none' }}>
                <div
                  className="rv-row"
                  style={{
                    display: 'grid', gridTemplateColumns: '90px 1fr 44px 70px 60px',
                    padding: '11px 18px', alignItems: 'center',
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{demo.map}</span>
                  <span style={{ fontSize: 12, color: '#97a3b7', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>
                    {demo.opponent}
                  </span>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '3px 7px', borderRadius: 5,
                      background: demo.wl === 'W' ? 'rgba(16,185,129,0.22)' : demo.wl === 'L' ? 'rgba(239,68,68,0.22)' : 'rgba(245,158,11,0.22)',
                      color: demo.wl === 'W' ? '#10b981' : demo.wl === 'L' ? '#ef4444' : '#f59e0b',
                    }}>
                      {demo.wl ?? '—'}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--faint)', textAlign: 'center' }}>{demo.date}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, textAlign: 'center', color: ratingColor }}>
                    {demo.rating}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>

        {/* Map Performance */}
        <div style={{ background: 'var(--card)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Map Performance</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: '#3b82f6' }} />
                <span style={{ fontSize: 10, color: 'var(--faint)' }}>CT</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: '#f59e0b' }} />
                <span style={{ fontSize: 10, color: 'var(--faint)' }}>T</span>
              </div>
            </div>
          </div>
          <div style={{ padding: '12px 18px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {mapPerformance.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '28px 0' }}>
                Upload demos to see map performance.
              </p>
            ) : mapPerformance.map(m => (
              <PerfBar key={m.name} name={m.name} ct={m.ct} />
            ))}
          </div>
        </div>
      </div>

      {/* ── Community Scout Reports ── */}
      {communityFeed.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Community Scout Reports</p>
              <div style={{ padding: '2px 7px', borderRadius: 4, background: 'rgba(34,211,238,0.12)' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 500, color: '#22d3ee' }}>PUBLIC</span>
              </div>
            </div>
            <Link href="/scouts" style={{ textDecoration: 'none' }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: '#7b5cf5' }}>View all →</span>
            </Link>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {communityFeed.slice(0, 3).map(item => (
              <Link key={item.id} href={`/scouts/${item.id}`} style={{ textDecoration: 'none' }}>
                <div
                  className="rv-row"
                  style={{
                    background: 'var(--card-2)', border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 10, padding: 16,
                    display: 'flex', flexDirection: 'column', gap: 10,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.name}
                    </p>
                    <div style={{ padding: '3px 8px', borderRadius: 20, background: 'rgba(123,92,245,0.12)', flexShrink: 0 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500, color: '#7b5cf5' }}>▲ {item.upRatings}</span>
                    </div>
                  </div>

                  <p style={{ fontSize: 11, color: '#9994a6', whiteSpace: 'pre' }}>
                    {item.winRate !== null
                      ? `Win Rate  ${item.winRate}%  ·  ${item.total} games`
                      : `${item.total} games recorded`}
                  </p>

                  <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                    {item.winRate !== null && (
                      <div style={{ height: '100%', borderRadius: 3, background: item.winRate >= 60 ? '#28cd71' : '#7b5cf5', width: `${item.winRate}%` }} />
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {item.topMap && (
                      <span style={{ fontSize: 11, fontWeight: 500, color: '#8c8799' }}>Top: {mapLabel(item.topMap)}</span>
                    )}
                    <span style={{ fontSize: 11, color: '#6b667a' }}>Updated {timeAgo(item.publishedAt)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── AI Pre-Match Brief ── */}
      <div style={{
        background: 'var(--card-2)', border: '1px solid rgba(123,92,245,0.25)',
        borderRadius: 12, padding: 20,
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'rgba(123,92,245,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Zap size={16} color="#7b5cf5" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>AI Pre-Match Brief</p>
              <p style={{ fontSize: 11, color: 'rgba(123,92,245,0.8)' }}>Powered by AI Scout · Live analysis</p>
            </div>
          </div>
          <Link href="/ai-coach" style={{ textDecoration: 'none' }}>
            <div style={{
              padding: '9px 16px', borderRadius: 8, background: '#7b5cf5', cursor: 'pointer',
            }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>Open AI Coach →</span>
            </div>
          </Link>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

        {/* Insight panels */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {[
            {
              tag: 'STRENGTH',
              tagColor: '#28cd71',
              tagBg: 'rgba(40,205,113,0.15)',
              text: demosAnalyzed > 0
                ? `${demosAnalyzed} demo${demosAnalyzed !== 1 ? 's' : ''} analyzed — strong CT-side patterns detected from mid & window control.`
                : 'Upload your first demo to unlock AI strengths analysis and pattern detection.',
            },
            {
              tag: 'WEAKNESS',
              tagColor: '#ef4444',
              tagBg: 'rgba(239,68,68,0.15)',
              text: nextOpponent
                ? `Preparing anti-strat against ${nextOpponent}. Watch early T-side aggression patterns in rounds 1–5.`
                : 'No upcoming match set. Add an opponent to generate targeted weakness breakdowns.',
            },
            {
              tag: 'PREP TIP',
              tagColor: '#7b5cf5',
              tagBg: 'rgba(123,92,245,0.15)',
              text: nextOpponent
                ? `Scout ${nextOpponent}'s map preferences before veto. Check Pro Demos for recent tournament plays.`
                : 'Set your next opponent in Match Prep to receive personalized veto and strategy tips.',
            },
          ].map(({ tag, tagColor, tagBg, text }) => (
            <div key={tag} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ padding: '2px 7px', borderRadius: 4, background: tagBg, alignSelf: 'flex-start' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 500, color: tagColor }}>{tag}</span>
              </div>
              <p style={{ fontSize: 12, color: '#bfbacc', lineHeight: 1.55 }}>{text}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
