'use client'

import Link from 'next/link'
import { MapPin } from 'lucide-react'
import { MAP_THUMBS } from '@/lib/map-config'
import type { DemoRowData } from '@/components/teams/DemoListMultiSelect'

export interface MapGroup {
  map: string
  demos: DemoRowData[]
  wins: number
  losses: number
  draws: number
  lastActivity: string
}

interface Props {
  mapGroups: MapGroup[]
  onSideChange?: (demoId: string, opponentSide: 'team1' | 'team2') => void
  demoHrefPrefix?: string
}

function mapDisplayName(map: string): string {
  return map
    .replace(/^(de_|cs_|ar_)/, '')
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export default function MapFolderList({ mapGroups }: Props) {
  if (mapGroups.length === 0) return null

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {mapGroups.map(group => {
        const thumb   = MAP_THUMBS[group.map]
        const name    = mapDisplayName(group.map)
        const total   = group.wins + group.losses + group.draws
        const wr      = total > 0 ? Math.round((group.wins / total) * 100) : null
        const isEmpty = group.demos.length === 0
        const pending = group.demos.filter(d => d.status !== 'completed').length

        const wrColor = wr === null ? 'var(--muted-foreground)'
          : wr >= 55 ? 'var(--win)'
          : wr >= 45 ? '#facc15'
          : 'var(--loss)'

        return (
          <Link
            key={group.map}
            href={`/my-team/map/${group.map}`}
            className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
            style={{ borderRadius: 14 }}
          >
            <div
              className="rv-panel overflow-hidden transition-all duration-200 group-hover:border-[color:var(--accent)]/40"
              style={{
                opacity: isEmpty ? 0.55 : 1,
                borderRadius: 14,
              }}
            >
              {/* Map thumbnail banner */}
              <div className="relative w-full h-28 bg-muted/40 overflow-hidden">
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumb}
                    alt={name}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <MapPin size={24} className="text-muted-foreground/40" />
                  </div>
                )}
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                {/* Map name over thumbnail */}
                <div className="absolute bottom-0 left-0 right-0 px-3 pb-2.5">
                  <p className="text-sm font-bold text-white leading-tight drop-shadow">{name}</p>
                </div>

                {/* Pending badge */}
                {pending > 0 && (
                  <div className="absolute top-2 right-2">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-yellow-400/20 text-yellow-300 border border-yellow-400/30">
                      {pending} parsing
                    </span>
                  </div>
                )}
              </div>

              {/* Card body */}
              <div className="px-3 py-2.5 space-y-2">
                {isEmpty ? (
                  <p className="text-[11px] text-muted-foreground">No demos yet</p>
                ) : (
                  <>
                    {/* Win rate bar */}
                    {wr !== null && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">Win rate</span>
                          <span className="text-xs font-bold font-mono" style={{ color: wrColor }}>{wr}%</span>
                        </div>
                        <div className="h-1 rounded-full bg-white/[0.07] overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${wr}%`, background: wrColor }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Record + demos row */}
                    <div className="flex items-center justify-between">
                      {total > 0 ? (
                        <span className="text-[11px] font-mono text-muted-foreground">
                          <span className="text-foreground font-semibold">{group.wins}W</span>
                          {' – '}
                          <span className="text-foreground font-semibold">{group.losses}L</span>
                          {group.draws > 0 && <>{' – '}<span className="text-foreground font-semibold">{group.draws}D</span></>}
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">No results yet</span>
                      )}
                      <span className="text-[11px] font-semibold" style={{ color: 'var(--signal)' }}>
                        {group.demos.length} demo{group.demos.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
