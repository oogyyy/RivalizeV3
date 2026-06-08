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

function RecordBadge({ wins, losses, draws }: { wins: number; losses: number; draws: number }) {
  const total = wins + losses + draws
  if (total === 0) return null
  const wr = Math.round((wins / total) * 100)
  return (
    <span className="flex items-center gap-1 text-xs font-mono text-muted-foreground">
      <span className="text-foreground font-semibold">{wins}W</span>
      <span>-</span>
      <span className="text-foreground font-semibold">{losses}L</span>
      {draws > 0 && <>
        <span>-</span>
        <span className="text-foreground font-semibold">{draws}D</span>
      </>}
      <span className="ml-1">({wr}%)</span>
    </span>
  )
}

export default function MapFolderList({ mapGroups, onSideChange, demoHrefPrefix = '/my-team/demos' }: Props) {
  // Auto-expand the first folder that actually has demos
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const first = mapGroups.find(g => g.demos.length > 0)
    return new Set(first ? [first.map] : [])
  })

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

        const isEmpty = group.demos.length === 0

        return (
          <div
            key={group.map}
            className={cn(
              'border border-border rounded-xl overflow-hidden transition-all',
              isOpen ? 'bg-card' : 'bg-card/70',
              isEmpty && 'opacity-60',
            )}
          >
            {/* ── Folder header ── */}
            <button
              onClick={() => toggle(group.map)}
              className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-white/[0.03] transition-colors text-left"
            >
              {/* Map thumbnail */}
              <div className="w-16 h-11 rounded-lg overflow-hidden shrink-0 border border-border/60 relative bg-muted/40">
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumb} alt={group.map} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <MapPin size={14} className="text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-foreground">{name}</span>
                  {pending > 0 && (
                    <span className="text-[10px] text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 px-1.5 py-0.5 rounded font-mono">
                      {pending} parsing
                    </span>
                  )}
                </div>
                <div className="mt-0.5">
                  {isEmpty ? (
                    <span className="text-[11px] text-muted-foreground">No demos yet</span>
                  ) : total > 0 ? (
                    <>
                      <RecordBadge wins={group.wins} losses={group.losses} draws={group.draws} />
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Last played {formatDate(group.lastActivity)}
                      </p>
                    </>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">No results yet</span>
                  )}
                </div>
              </div>

              {/* Demo count + chevron */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-semibold" style={{ color: 'var(--signal)' }}>
                  {group.demos.length}&nbsp;demo{group.demos.length !== 1 ? 's' : ''}
                </span>
                {isOpen
                  ? <ChevronDown size={14} className="text-muted-foreground" />
                  : <ChevronRight size={14} className="text-muted-foreground" />}
              </div>
            </button>

            {/* ── Expanded content ── */}
            {isOpen && (
              <div className="border-t border-border px-4 py-3">
                {isEmpty ? (
                  <p className="text-[12px] text-muted-foreground py-2 text-center">
                    No demos uploaded for this map yet.
                  </p>
                ) : (
                  <DemoListMultiSelect
                    demos={group.demos}
                    demoHrefPrefix={demoHrefPrefix}
                    showSideSelector
                    showReparse
                    canDelete
                    onSideChange={onSideChange}
                  />
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
