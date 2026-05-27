'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, MapPin } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { MAP_THUMBS } from '@/lib/map-config'
import DemoListMultiSelect, { type DemoRowData } from '@/components/teams/DemoListMultiSelect'

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
}

function mapDisplayName(map: string): string {
  return map
    .replace(/^(de_|cs_|ar_)/, '')
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function RecordBadge({ wins, losses, draws }: { wins: number; losses: number; draws: number }) {
  const total = wins + losses + draws
  if (total === 0) return null
  const wr = Math.round((wins / total) * 100)
  return (
    <span className="flex items-center gap-1.5 text-xs font-mono">
      <span className="text-neon-green">{wins}W</span>
      <span className="text-muted-foreground">–</span>
      <span className="text-red-400">{losses}L</span>
      {draws > 0 && <>
        <span className="text-muted-foreground">–</span>
        <span className="text-yellow-400">{draws}D</span>
      </>}
      <span className="text-muted-foreground text-[10px]">({wr}%)</span>
    </span>
  )
}

export default function MapFolderList({ mapGroups }: Props) {
  // Auto-expand the first group
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(mapGroups.length > 0 ? [mapGroups[0].map] : []),
  )

  const toggle = (map: string) =>
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(map) ? next.delete(map) : next.add(map)
      return next
    })

  if (mapGroups.length === 0) return null

  return (
    <div className="space-y-2">
      {mapGroups.map(group => {
        const isOpen  = expanded.has(group.map)
        const thumb   = MAP_THUMBS[group.map]
        const name    = mapDisplayName(group.map)
        const total   = group.wins + group.losses + group.draws
        const pending = group.demos.filter(d => d.status !== 'completed').length

        return (
          <div
            key={group.map}
            className={cn(
              'border border-border rounded-xl overflow-hidden transition-all',
              isOpen ? 'bg-card' : 'bg-card/60',
            )}
          >
            {/* ── Folder header ── */}
            <button
              onClick={() => toggle(group.map)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/30 transition-colors text-left"
            >
              {/* Map thumbnail */}
              <div className="w-14 h-10 rounded-md overflow-hidden shrink-0 bg-accent border border-border relative">
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumb}
                    alt={group.map}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <MapPin size={14} className="text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-foreground">{name}</span>
                  <span className="text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded font-mono">
                    {group.demos.length} demo{group.demos.length !== 1 ? 's' : ''}
                  </span>
                  {pending > 0 && (
                    <span className="text-[10px] text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 px-1.5 py-0.5 rounded font-mono">
                      {pending} parsing
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {total > 0 ? (
                    <RecordBadge wins={group.wins} losses={group.losses} draws={group.draws} />
                  ) : (
                    <span className="text-[11px] text-muted-foreground">No results yet</span>
                  )}
                  <span className="text-[10px] text-muted-foreground">
                    · Last played {formatDate(group.lastActivity)}
                  </span>
                </div>
              </div>

              {/* Chevron */}
              {isOpen
                ? <ChevronDown size={14} className="text-muted-foreground shrink-0" />
                : <ChevronRight size={14} className="text-muted-foreground shrink-0" />}
            </button>

            {/* ── Expanded demo list ── */}
            {isOpen && (
              <div className="border-t border-border px-4 py-3">
                <DemoListMultiSelect
                  demos={group.demos}
                  demoHrefPrefix="/my-team/demos"
                  showSideSelector
                  showReparse
                  canDelete
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
