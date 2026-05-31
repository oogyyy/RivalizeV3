'use client'

import React from 'react'

export interface PlayerDot {
  id: number | string
  team: 'ct' | 't'
  x: number // 0-100 %
  y: number // 0-100 %
  label?: string
}

interface TacticalMapProps {
  className?: string
  dots?: PlayerDot[]
  round?: number
  mapName?: string
  onDotClick?: (dot: PlayerDot) => void
  selectedDotId?: number | string | null
  height?: number | string
}

const DEFAULT_DOTS: PlayerDot[] = [
  // CT side (cyan)
  { id: 1, team: 'ct', x: 22, y: 22, label: '1' },
  { id: 2, team: 'ct', x: 70, y: 20, label: '2' },
  { id: 3, team: 'ct', x: 48, y: 32, label: '3' },
  { id: 4, team: 'ct', x: 62, y: 42, label: '4' },
  { id: 5, team: 'ct', x: 38, y: 18, label: '5' },
  // T side (red)
  { id: 6, team: 't', x: 80, y: 62, label: '6' },
  { id: 7, team: 't', x: 84, y: 68, label: '7' },
  { id: 8, team: 't', x: 76, y: 72, label: '8' },
  { id: 9, team: 't', x: 82, y: 58, label: '9' },
  { id: 10, team: 't', x: 72, y: 65, label: '10' },
]

const ZONES = [
  { area: 'ct', label: 'CT SPAWN', cls: 'rv-tac-zone--spawn' },
  { area: 'a', label: 'A SITE', cls: '' },
  { area: 'mid', label: 'MID', cls: '' },
  { area: 'b', label: 'B SITE', cls: '' },
  { area: 'long', label: 'LONG', cls: '' },
  { area: 'cat', label: 'CATWALK', cls: '' },
  { area: 'ban', label: 'BANANA', cls: '' },
  { area: 'ts', label: 'T SPAWN', cls: 'rv-tac-zone--spawn' },
]

export default function TacticalMap({
  className = '',
  dots = DEFAULT_DOTS,
  round = 7,
  mapName = 'INFERNO',
  onDotClick,
  selectedDotId = null,
  height = 420,
}: TacticalMapProps) {
  const gridStyle: React.CSSProperties = {
    gridTemplateAreas: '"ct ct ct" "a mid b" "long cat ban" "ts ts ts"',
    gridTemplateRows: '56px 1fr 1fr 56px',
    gridTemplateColumns: '1fr 1fr 1fr',
  }

  return (
    <div
      className={`rv-tac-map relative ${className}`}
      style={{ height: typeof height === 'number' ? `${height}px` : height, ...gridStyle }}
      aria-label={`Tactical map of ${mapName} round ${round}`}
    >
      {/* Zone labels */}
      {ZONES.map((z) => (
        <div
          key={z.area}
          className={`rv-tac-zone ${z.cls}`}
          style={{ gridArea: z.area }}
        >
          {z.label}
        </div>
      ))}

      {/* Player dots */}
      {dots.map((dot) => {
        const isSel = selectedDotId === dot.id
        return (
          <div
            key={dot.id}
            className={`rv-tac-dot ${dot.team === 'ct' ? 'rv-tac-dot--ct' : 'rv-tac-dot--t'} ${isSel ? 'rv-tac-dot--sel' : ''}`}
            style={{ left: `${dot.x}%`, top: `${dot.y}%` }}
            onClick={() => onDotClick?.(dot)}
            role={onDotClick ? 'button' : undefined}
            tabIndex={onDotClick ? 0 : -1}
            title={`${dot.team.toUpperCase()} player ${dot.label ?? dot.id}`}
          >
            {dot.label ?? (dot.team === 'ct' ? 'C' : 'T')}
          </div>
        )
      })}

      {/* Subtle map name overlay */}
      <div className="absolute top-3 right-3 z-10 px-2 py-0.5 text-[10px] font-mono tracking-[0.12em] bg-black/40 text-white/50 rounded">
        {mapName} · RND {String(round).padStart(2, '0')}
      </div>
    </div>
  )
}
