'use client'

import React, { useEffect, useRef } from 'react'

interface TacticalCanvasProps {
  motionFull?: boolean
  className?: string
  accent?: string
}

export default function TacticalCanvas({ motionFull = true, className = '', accent }: TacticalCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    let t = 0
    const nodes = Array.from({ length: 32 }, () => ({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * (motionFull ? 0.00013 : 0),
      vy: (Math.random() - 0.5) * (motionFull ? 0.00013 : 0),
      p: Math.random() * Math.PI * 2,
    }))

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.floor(rect.width * dpr)
      canvas.height = Math.floor(rect.height * dpr)
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
      ctx.scale(dpr, dpr)
    }

    const getAccent = () => {
      if (accent) return accent
      try {
        const cssAcc = getComputedStyle(document.documentElement).getPropertyValue('--rv-acc').trim()
        return cssAcc || '#dc2626'
      } catch {
        return '#dc2626'
      }
    }

    const draw = () => {
      t += motionFull ? 0.007 : 0
      const W = canvas.width / (window.devicePixelRatio || 1)
      const H = canvas.height / (window.devicePixelRatio || 1)

      ctx.clearRect(0, 0, W, H)

      const acc = getAccent()
      const r = parseInt(acc.slice(1, 3), 16)
      const g = parseInt(acc.slice(3, 5), 16)
      const b = parseInt(acc.slice(5, 7), 16)

      // Subtle tactical grid
      ctx.strokeStyle = `rgba(${r},${g},${b},0.035)`
      ctx.lineWidth = 1
      for (let x = 0; x < W + 60; x += 60) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, H)
        ctx.stroke()
      }
      for (let y = 0; y < H + 60; y += 60) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(W, y)
        ctx.stroke()
      }

      // Update + connect nodes
      nodes.forEach((n) => {
        n.x = ((n.x + n.vx) + 1) % 1
        n.y = ((n.y + n.vy) + 1) % 1
      })

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i]
          const b2 = nodes[j]
          const dx = (a.x - b2.x) * W
          const dy = (a.y - b2.y) * H
          const d = Math.sqrt(dx * dx + dy * dy)
          if (d < 140) {
            ctx.strokeStyle = `rgba(${r},${g},${b},${(1 - d / 140) * 0.09})`
            ctx.lineWidth = 0.6
            ctx.beginPath()
            ctx.moveTo(a.x * W, a.y * H)
            ctx.lineTo(b2.x * W, b2.y * H)
            ctx.stroke()
          }
        }
      }

      // Pulsing nodes
      nodes.forEach((n) => {
        const pulse = (Math.sin(t * 1.8 + n.p) + 1) / 2
        ctx.fillStyle = `rgba(${r},${g},${b},${0.16 + pulse * 0.5})`
        ctx.beginPath()
        ctx.arc(n.x * W, n.y * H, 1.6 + pulse * 2.1, 0, Math.PI * 2)
        ctx.fill()
      })

      // Moving scanline glow (cinematic)
      if (motionFull) {
        const sy = ((t * 0.085) % 1) * H
        const sg = ctx.createLinearGradient(0, sy - 90, 0, sy + 90)
        sg.addColorStop(0, `rgba(${r},${g},${b},0)`)
        sg.addColorStop(0.5, `rgba(${r},${g},${b},0.055)`)
        sg.addColorStop(1, `rgba(${r},${g},${b},0)`)
        ctx.fillStyle = sg
        ctx.fillRect(0, sy - 90, W, 180)
      }

      animRef.current = requestAnimationFrame(draw)
    }

    resize()
    window.addEventListener('resize', resize)
    draw()

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [motionFull, accent])

  return (
    <canvas
      ref={canvasRef}
      className={`rv-hero__canvas ${className}`}
      style={{ display: 'block', width: '100%', height: '100%' }}
    />
  )
}
