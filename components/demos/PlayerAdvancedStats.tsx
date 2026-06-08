'use client'

import { useMemo } from 'react'
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
  demoEntries: DemoEntry[]
}

const MAP_LABELS: Record<string, string> = {
  de_dust2: 'Dust2', de_mirage: 'Mirage', de_inferno: 'Inferno',
  de_nuke: 'Nuke', de_overpass: 'Overpass', de_ancient: 'Ancient',
  de_anubis: 'Anubis', de_vertigo: 'Vertigo',
}

function scoreColor(score: number): string {
  if (score >= 75) return 'var(--win)'
  if (score >= 55) return '#60a5fa'
  if (score >= 38) return '#f59e0b'
  return 'var(--loss)'
}

function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)) }

function computeAdvanced(entries: DemoEntry[]) {
  if (entries.length === 0) return null

  const n = entries.length
  const avg = (fn: (s: PlayerStats) => number) => entries.reduce((a, e) => a + fn(e.stats), 0) / n

  const avgRating = avg(s => s.rating)
  const avgKast   = avg(s => s.kast)
  const avgAdr    = avg(s => s.adr)
  const avgHs     = avg(s => s.headshot_percentage)
  const avgRounds = avg(s => s.rounds_played)
  const avgFlash  = avg(s => s.flash_assists)
  const avgUtil   = avg(s => s.utility_damage)
  const totalKills  = entries.reduce((a, e) => a + e.stats.kills, 0)
  const totalDeaths = entries.reduce((a, e) => a + e.stats.deaths, 0)
  const kd = totalKills / Math.max(1, totalDeaths)

  const wins   = entries.filter(e => e.result === 'Win').length
  const losses = entries.filter(e => e.result === 'Loss').length
  const winRate = wins + losses > 0 ? (wins / (wins + losses)) * 100 : 50

  const flashPerRound = avgRounds > 0 ? avgFlash / avgRounds : 0
  const utilPerRound  = avgRounds > 0 ? avgUtil / avgRounds : 0

  // Scores 0-100
  const aimScore = Math.round(
    clamp((avgHs / 80) * 40, 0, 40) +
    clamp(((kd - 0.5) / 1.5) * 35, 0, 35) +
    clamp(((avgRating - 0.5) / 1.5) * 25, 0, 25),
  )
  const utilScore = Math.round(
    clamp((flashPerRound / 0.5) * 50, 0, 50) +
    clamp((utilPerRound / 25) * 50, 0, 50),
  )
  const consistencyScore = Math.round(clamp(avgKast * 100, 0, 100))
  const impactScore = Math.round(
    clamp(((avgRating - 0.5) / 1.5) * 80, 0, 80) +
    clamp((avgAdr / 100) * 20, 0, 20),
  )

  return {
    aimScore, utilScore, consistencyScore, impactScore,
    winRate: Math.round(winRate),
    avgRating, avgKast, avgAdr, avgHs, kd,
    flashPerRound, utilPerRound, n,
  }
}

function ScoreCard({ label, score, subLabel }: { label: string; score: number; subLabel?: string }) {
  const color = scoreColor(score)
  const radius = 26
  const circ = 2 * Math.PI * radius
  const dash = (score / 100) * circ

  return (
    <div style={{
      flex: '1 1 0', minWidth: 120,
      background: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: 12, padding: '16px 12px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
    }}>
      <svg width={68} height={68} viewBox="0 0 68 68">
        <circle cx={34} cy={34} r={radius} fill="none" stroke="var(--hairline)" strokeWidth={5} />
        <circle
          cx={34} cy={34} r={radius} fill="none"
          stroke={color} strokeWidth={5}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 34 34)"
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
        <text x={34} y={38} textAnchor="middle"
          fill={color} fontSize={16} fontWeight={700}
          fontFamily="var(--font-mono)"
        >
          {score}
        </text>
      </svg>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text)' }}>{label}</div>
        {subLabel && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{subLabel}</div>}
      </div>
    </div>
  )
}

function StatRow({ label, value, unit, bar, barColor }: {
  label: string; value: string; unit?: string; bar?: number; barColor?: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--hairline)' }}>
      <span style={{ flex: '0 0 160px', fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-ui)' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-mono)', minWidth: 56 }}>
        {value}{unit && <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 2 }}>{unit}</span>}
      </span>
      {bar !== undefined && (
        <div style={{ flex: 1, height: 4, borderRadius: 3, background: 'var(--hairline)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${clamp(bar, 0, 100)}%`,
            background: barColor ?? scoreColor(bar),
            borderRadius: 3, transition: 'width 0.5s ease',
          }} />
        </div>
      )}
    </div>
  )
}

function PerDemoTable({ entries }: { entries: DemoEntry[] }) {
  const rows = [...entries].reverse()

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['Date', 'Map', 'Result', 'Rating', 'K/D', 'KAST', 'ADR', 'HS%', 'FA', 'UD'].map(h => (
              <th key={h} style={{ padding: '7px 10px', textAlign: h === 'Date' || h === 'Map' ? 'left' : 'center', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--faint)', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((e, i) => {
            const kd = e.stats.deaths > 0 ? (e.stats.kills / e.stats.deaths) : e.stats.kills
            const resultColor = e.result === 'Win' ? 'var(--win)' : e.result === 'Loss' ? 'var(--loss)' : 'var(--muted)'
            const ratingColor = e.stats.rating >= 1.1 ? 'var(--win)' : e.stats.rating < 0.85 ? 'var(--loss)' : 'var(--text)'
            return (
              <tr key={e.demoId} style={{ borderBottom: '1px solid var(--hairline)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                <td style={{ padding: '8px 10px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                  {e.date ? new Date(e.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'}
                </td>
                <td style={{ padding: '8px 10px', color: 'var(--text)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                  {MAP_LABELS[e.map] ?? e.map}
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: resultColor, letterSpacing: '0.06em' }}>
                    {e.result ?? '—'}
                  </span>
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'center', color: ratingColor, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                  {e.stats.rating.toFixed(2)}
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>
                  {kd.toFixed(2)}
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>
                  {Math.round(e.stats.kast * 100)}%
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>
                  {e.stats.adr.toFixed(0)}
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>
                  {Math.round(e.stats.headshot_percentage)}%
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                  {e.stats.flash_assists}
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                  {Math.round(e.stats.utility_damage)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function PlayerAdvancedStats({ demoEntries }: Props) {
  const adv = useMemo(() => computeAdvanced(demoEntries), [demoEntries])

  if (!adv) return null

  const kdBar = clamp(((adv.kd - 0.5) / 1.5) * 100, 0, 100)
  const adrBar = clamp((adv.avgAdr / 120) * 100, 0, 100)
  const kastBar = adv.avgKast * 100
  const hsBar = clamp((adv.avgHs / 80) * 100, 0, 100)
  const ratingBar = clamp(((adv.avgRating - 0.5) / 1.5) * 100, 0, 100)
  const winBar = adv.winRate

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Score cards */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 3, height: 16, borderRadius: 2, background: 'var(--accent)', display: 'inline-block' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Performance Scores</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)' }}>{adv.n} demo{adv.n !== 1 ? 's' : ''}</span>
        </div>
        <div style={{ padding: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <ScoreCard label="AIM" score={adv.aimScore} subLabel="HS% · K/D · Rating" />
          <ScoreCard label="Utility" score={adv.utilScore} subLabel="Flashes · Dmg/round" />
          <ScoreCard label="Consistency" score={adv.consistencyScore} subLabel="KAST" />
          <ScoreCard label="Impact" score={adv.impactScore} subLabel="Rating · ADR" />
          <ScoreCard label="Win Rate" score={adv.winRate} subLabel={`${demoEntries.filter(e => e.result === 'Win').length}W · ${demoEntries.filter(e => e.result === 'Loss').length}L`} />
        </div>
      </div>

      {/* Detailed stats */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 3, height: 16, borderRadius: 2, background: 'var(--accent)', display: 'inline-block' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Detailed Averages</span>
        </div>
        <div style={{ padding: '4px 18px 12px' }}>
          <StatRow label="Rating" value={adv.avgRating.toFixed(2)} bar={ratingBar} />
          <StatRow label="K/D Ratio" value={adv.kd.toFixed(2)} bar={kdBar} />
          <StatRow label="KAST" value={`${Math.round(adv.avgKast * 100)}`} unit="%" bar={kastBar} />
          <StatRow label="ADR" value={adv.avgAdr.toFixed(0)} bar={adrBar} />
          <StatRow label="Headshot %" value={`${Math.round(adv.avgHs)}`} unit="%" bar={hsBar} />
          <StatRow label="Win Rate" value={`${adv.winRate}`} unit="%" bar={winBar} />
          <StatRow label="Flash Assists / Round" value={adv.flashPerRound.toFixed(2)} bar={clamp((adv.flashPerRound / 0.5) * 100, 0, 100)} barColor="#60a5fa" />
          <StatRow label="Utility Damage / Round" value={adv.utilPerRound.toFixed(1)} bar={clamp((adv.utilPerRound / 25) * 100, 0, 100)} barColor="#818cf8" />
        </div>
      </div>

      {/* Per-demo breakdown */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 3, height: 16, borderRadius: 2, background: 'var(--accent)', display: 'inline-block' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Per-Demo Breakdown</span>
          <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--faint)' }}>FA = Flash Assists · UD = Utility Dmg</span>
        </div>
        <PerDemoTable entries={demoEntries} />
      </div>

    </div>
  )
}
