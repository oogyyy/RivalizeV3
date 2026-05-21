'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { HeatmapPoint } from '@/types/database'

interface HeatmapCanvasProps {
  points: HeatmapPoint[]
  mapName: string
  team1Name?: string
  team2Name?: string
  width?: number
  height?: number
}

const POINT_COLORS: Record<string, string> = {
  kill:    '#00ff87',
  death:   '#ff3860',
  bomb:    '#ffd700',
  grenade: '#00d4ff',
}

export default function HeatmapCanvas({
  points,
  mapName,
  team1Name,
  team2Name,
  width = 512,
  height = 512,
}: HeatmapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [teamFilter, setTeamFilter] = useState<'all' | 'team1' | 'team2'>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | 'kill' | 'death'>('all')

  const filtered = points.filter(p => {
    if (teamFilter === 'team1' && team1Name && p.team !== team1Name) return false
    if (teamFilter === 'team2' && team2Name && p.team !== team2Name) return false
    if (typeFilter !== 'all' && p.type !== typeFilter) return false
    return true
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = '#080c18'
    ctx.fillRect(0, 0, width, height)

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'
    ctx.lineWidth = 1
    const gridSize = 64
    for (let x = 0; x <= width; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke()
    }
    for (let y = 0; y <= height; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke()
    }

    // Diagonal depth texture
    ctx.strokeStyle = 'rgba(0,255,135,0.015)'
    ctx.lineWidth = 0.5
    for (let i = -height; i < width + height; i += 40) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + height, height); ctx.stroke()
    }

    // Map label
    ctx.fillStyle = 'rgba(255,255,255,0.18)'
    ctx.font = 'bold 12px monospace'
    ctx.fillText(mapName.toUpperCase(), 12, 26)

    // Heat clusters (glow layer)
    filtered.forEach(point => {
      const x = (point.x / 1024) * width
      const y = (point.y / 1024) * height
      const color = POINT_COLORS[point.type] || '#ffffff'
      const g = ctx.createRadialGradient(x, y, 0, x, y, 20)
      g.addColorStop(0, color + '35')
      g.addColorStop(1, 'transparent')
      ctx.fillStyle = g
      ctx.fillRect(x - 20, y - 20, 40, 40)
    })

    // Points
    filtered.forEach(point => {
      const x = (point.x / 1024) * width
      const y = (point.y / 1024) * height
      const color = POINT_COLORS[point.type] || '#ffffff'

      ctx.beginPath()
      ctx.arc(x, y, 7, 0, Math.PI * 2)
      ctx.fillStyle = color + '18'
      ctx.fill()

      ctx.beginPath()
      ctx.arc(x, y, 3.5, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.globalAlpha = 0.88
      ctx.fill()
      ctx.globalAlpha = 1

      ctx.beginPath()
      ctx.arc(x - 1, y - 1, 1, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255,255,255,0.55)'
      ctx.fill()
    })

    // Border
    ctx.strokeStyle = 'rgba(0,255,135,0.14)'
    ctx.lineWidth = 1.5
    ctx.strokeRect(0.75, 0.75, width - 1.5, height - 1.5)

    // Point count
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    ctx.font = '10px monospace'
    ctx.fillText(`${filtered.length} events`, width - 80, height - 10)

  }, [filtered, mapName, width, height])

  const counts = filtered.reduce<Record<string, number>>((acc, p) => {
    acc[p.type] = (acc[p.type] || 0) + 1
    return acc
  }, {})

  const legendItems = [
    { type: 'kill',    color: POINT_COLORS.kill,    label: 'Kills' },
    { type: 'death',   color: POINT_COLORS.death,   label: 'Deaths' },
    { type: 'bomb',    color: POINT_COLORS.bomb,     label: 'Bomb' },
    { type: 'grenade', color: POINT_COLORS.grenade,  label: 'Grenades' },
  ]

  const teamButtons = [
    { id: 'all'   as const, label: 'All' },
    { id: 'team1' as const, label: team1Name ?? 'Team 1' },
    { id: 'team2' as const, label: team2Name ?? 'Team 2' },
  ]
  const typeButtons = [
    { id: 'all'   as const, label: 'All' },
    { id: 'kill'  as const, label: 'Kills' },
    { id: 'death' as const, label: 'Deaths' },
  ]

  return (
    <div className="flex flex-col gap-3">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground mr-1">Team:</span>
          {teamButtons.map(b => (
            <button
              key={b.id}
              onClick={() => setTeamFilter(b.id)}
              className={cn(
                'px-2 py-0.5 text-xs rounded border transition-colors',
                teamFilter === b.id
                  ? 'bg-neon-green/15 border-neon-green/40 text-neon-green'
                  : 'border-border/50 text-muted-foreground hover:text-foreground hover:border-border'
              )}
            >
              {b.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground mr-1">Show:</span>
          {typeButtons.map(b => (
            <button
              key={b.id}
              onClick={() => setTypeFilter(b.id)}
              className={cn(
                'px-2 py-0.5 text-xs rounded border transition-colors',
                typeFilter === b.id
                  ? 'bg-neon-green/15 border-neon-green/40 text-neon-green'
                  : 'border-border/50 text-muted-foreground hover:text-foreground hover:border-border'
              )}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="rounded-lg border border-border w-full max-w-full"
        style={{ imageRendering: 'pixelated' }}
      />

      <div className="flex flex-wrap gap-4">
        {legendItems.map(item => (
          <div key={item.type} className="flex items-center gap-2 text-xs">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ background: item.color, boxShadow: `0 0 6px ${item.color}60` }}
            />
            <span className="text-muted-foreground">
              {item.label}
              <span className="ml-1 text-foreground font-mono">({counts[item.type] || 0})</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
