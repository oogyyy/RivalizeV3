'use client'

import { useEffect, useRef } from 'react'
import type { HeatmapPoint } from '@/types/database'

interface HeatmapCanvasProps {
  points: HeatmapPoint[]
  mapName: string
  width?: number
  height?: number
}

const POINT_COLORS: Record<string, string> = {
  kill: '#00ff87',
  death: '#ff3860',
  bomb: '#ffd700',
  grenade: '#00d4ff',
}

export default function HeatmapCanvas({ points, mapName, width = 512, height = 512 }: HeatmapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Dark background
    ctx.fillStyle = '#0d1117'
    ctx.fillRect(0, 0, width, height)

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'
    ctx.lineWidth = 1
    const gridSize = 64
    for (let x = 0; x <= width; x += gridSize) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }
    for (let y = 0; y <= height; y += gridSize) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }

    // Subtle diagonal pattern for depth
    ctx.strokeStyle = 'rgba(0,255,135,0.02)'
    ctx.lineWidth = 0.5
    for (let i = -height; i < width + height; i += 40) {
      ctx.beginPath()
      ctx.moveTo(i, 0)
      ctx.lineTo(i + height, height)
      ctx.stroke()
    }

    // Map name label
    ctx.fillStyle = 'rgba(255,255,255,0.2)'
    ctx.font = 'bold 13px monospace'
    ctx.fillText(mapName.toUpperCase(), 12, 28)

    // Draw heat clusters first (glow effect)
    points.forEach(point => {
      const x = (point.x / 1024) * width
      const y = (point.y / 1024) * height
      const color = POINT_COLORS[point.type] || '#ffffff'

      const gradient = ctx.createRadialGradient(x, y, 0, x, y, 18)
      gradient.addColorStop(0, color + '30')
      gradient.addColorStop(1, 'transparent')
      ctx.fillStyle = gradient
      ctx.fillRect(x - 18, y - 18, 36, 36)
    })

    // Draw actual points
    points.forEach(point => {
      const x = (point.x / 1024) * width
      const y = (point.y / 1024) * height
      const color = POINT_COLORS[point.type] || '#ffffff'

      // Outer glow ring
      ctx.beginPath()
      ctx.arc(x, y, 6, 0, Math.PI * 2)
      ctx.fillStyle = color + '20'
      ctx.fill()

      // Main dot
      ctx.beginPath()
      ctx.arc(x, y, 3.5, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.globalAlpha = 0.85
      ctx.fill()
      ctx.globalAlpha = 1

      // Center highlight
      ctx.beginPath()
      ctx.arc(x - 1, y - 1, 1, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255,255,255,0.6)'
      ctx.fill()
    })

    // Border frame
    ctx.strokeStyle = 'rgba(0,255,135,0.15)'
    ctx.lineWidth = 1.5
    ctx.strokeRect(0.75, 0.75, width - 1.5, height - 1.5)

  }, [points, mapName, width, height])

  const legendItems = [
    { type: 'kill', color: POINT_COLORS.kill, label: 'Kills' },
    { type: 'death', color: POINT_COLORS.death, label: 'Deaths' },
    { type: 'bomb', color: POINT_COLORS.bomb, label: 'Bomb' },
    { type: 'grenade', color: POINT_COLORS.grenade, label: 'Grenades' },
  ]

  const counts = points.reduce<Record<string, number>>((acc, p) => {
    acc[p.type] = (acc[p.type] || 0) + 1
    return acc
  }, {})

  return (
    <div className="flex flex-col gap-3">
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
              className="w-2.5 h-2.5 rounded-full shadow-sm"
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
