'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Play, Pause, RotateCcw } from 'lucide-react'
import { MAP_CONFIGS, worldToCanvas, loadMapImage } from '@/lib/map-config'
import { roundStartOffset } from '@/lib/replay-trim'
import type { Kill, GrenadeEvent, PlayerStats } from '@/types/database'

const CANVAS_SIZE = 420
const T1_COLOR    = '#00ff87'
const T2_COLOR    = '#ff4466'
const KILL_FLASH  = 1.3   // seconds kill line stays visible

const SMOKE_DUR   = 18
const HE_DUR      = 1.8
const FLASH_DUR   = 0.55
const MOLOTOV_DUR = 7

const GREN_COLORS: Record<string, string> = {
  smoke: '#c0c0d0', flash: '#ffff88', he: '#ff9900', molotov: '#ff4400', decoy: '#8888ff',
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type ChatRoundData = {
  number: number
  winner: string
  duration: number
  freeze_end_time?: number
  kills: Kill[]
  grenades?: GrenadeEvent[]
  bomb_planted?: boolean
}

interface Props {
  round: ChatRoundData
  players: PlayerStats[]
  team1Name: string
  team2Name: string
  mapName: string
  roundNumber: number
  description: string
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ChatRoundReplay({
  round, players, team1Name, team2Name, mapName, roundNumber, description,
}: Props) {
  const duration = Math.max(round.duration || 120, 10)
  // Skip the dead freeze/buy phase so the replay opens on the action.
  const startOffset = roundStartOffset({
    freeze_end_time: round.freeze_end_time,
    grenades: round.grenades,
    kills: round.kills,
  })

  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const rafRef     = useRef<number>(0)
  const mapImgRef  = useRef<HTMLImageElement | null>(null)
  const startRef   = useRef<number>(0)       // real-time start for animation
  const pauseAtRef = useRef<number>(startOffset) // time paused at

  const [playing,    setPlaying]    = useState(false)
  const [speed,      setSpeed]      = useState(1)
  const [currentT,   setCurrentT]   = useState(startOffset)
  const [mapLoaded,  setMapLoaded]  = useState(false)

  // Build player→team map
  const teamOf = new Map<string, 1 | 2>()
  players.forEach(p => {
    if (p.team === team1Name) teamOf.set(p.name, 1)
    else if (p.team === team2Name) teamOf.set(p.name, 2)
  })
  const colorOf = (name: string) => teamOf.get(name) === 1 ? T1_COLOR : T2_COLOR

  const cfg = MAP_CONFIGS[mapName]

  // ── Canvas draw ──────────────────────────────────────────────────────────────
  const draw = useCallback((t: number) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || !cfg) return

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

    // Map background
    if (mapImgRef.current) {
      ctx.globalAlpha = 1
      ctx.drawImage(mapImgRef.current, 0, 0, CANVAS_SIZE, CANVAS_SIZE)
      ctx.fillStyle = 'rgba(0,0,0,0.45)'
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
    } else {
      ctx.fillStyle = '#111'
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
    }

    const toXY = (wx: number, wy: number): [number, number] =>
      worldToCanvas(wx, wy, cfg, CANVAS_SIZE)

    // ── Grenades ──
    ;(round.grenades ?? []).forEach((g: GrenadeEvent) => {
      if (g.land_time > t) return

      const age  = t - g.land_time
      const color = GREN_COLORS[g.type] ?? '#fff'

      let maxDur: number
      switch (g.type) {
        case 'smoke':   maxDur = SMOKE_DUR; break
        case 'flash':   maxDur = FLASH_DUR; break
        case 'he':      maxDur = HE_DUR; break
        case 'molotov': maxDur = MOLOTOV_DUR; break
        default:        maxDur = 3
      }
      if (age > maxDur) return

      const fade   = Math.max(0, 1 - age / maxDur)
      const [lx, ly] = toXY(g.land_x, g.land_y)

      if (g.type === 'smoke') {
        const radius = 20 + age * 1.2
        const grad = ctx.createRadialGradient(lx, ly, 0, lx, ly, radius)
        grad.addColorStop(0, `rgba(192,192,208,${fade * 0.7})`)
        grad.addColorStop(1, `rgba(192,192,208,0)`)
        ctx.fillStyle = grad
        ctx.beginPath(); ctx.arc(lx, ly, radius, 0, Math.PI * 2); ctx.fill()
        // label
        ctx.fillStyle = `rgba(255,255,255,${fade * 0.8})`
        ctx.font = `bold 9px monospace`
        ctx.textAlign = 'center'
        ctx.fillText('SMOKE', lx, ly + 4)
      } else if (g.type === 'flash') {
        const radius = 12 + age * 30
        const grad = ctx.createRadialGradient(lx, ly, 0, lx, ly, radius)
        grad.addColorStop(0, `rgba(255,255,150,${fade})`)
        grad.addColorStop(1, `rgba(255,255,150,0)`)
        ctx.fillStyle = grad
        ctx.beginPath(); ctx.arc(lx, ly, radius, 0, Math.PI * 2); ctx.fill()
      } else if (g.type === 'he') {
        const radius = 6 + age * 15
        const grad = ctx.createRadialGradient(lx, ly, 0, lx, ly, radius)
        grad.addColorStop(0, `rgba(255,153,0,${fade})`)
        grad.addColorStop(1, `rgba(255,80,0,0)`)
        ctx.fillStyle = grad
        ctx.beginPath(); ctx.arc(lx, ly, radius, 0, Math.PI * 2); ctx.fill()
      } else if (g.type === 'molotov') {
        const pulse = 0.5 + 0.5 * Math.sin(age * 8)
        const radius = 14 + pulse * 5
        ctx.fillStyle = `rgba(255,68,0,${fade * 0.6})`
        ctx.beginPath(); ctx.arc(lx, ly, radius, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = `rgba(255,180,0,${fade})`
        ctx.lineWidth = 1
        ctx.stroke()
      } else {
        ctx.fillStyle = `rgba(${color},${fade})`
        ctx.beginPath(); ctx.arc(lx, ly, 4, 0, Math.PI * 2); ctx.fill()
      }

      // Throw origin dot
      const [tx2, ty2] = toXY(g.throw_x, g.throw_y)
      ctx.strokeStyle = `rgba(255,255,255,0.25)`
      ctx.lineWidth = 0.5
      ctx.setLineDash([2, 3])
      ctx.beginPath(); ctx.moveTo(tx2, ty2); ctx.lineTo(lx, ly); ctx.stroke()
      ctx.setLineDash([])
    })

    // ── Kills ──
    const pastKills = round.kills.filter((k: Kill) => k.time <= t)
    pastKills.forEach((k: Kill) => {
      const age = t - k.time
      const [kx, ky] = toXY(k.killer_x, k.killer_y)
      const [vx, vy] = toXY(k.victim_x, k.victim_y)

      // Kill line (fades after KILL_FLASH seconds)
      if (age < KILL_FLASH) {
        const fade = 1 - age / KILL_FLASH
        ctx.strokeStyle = `rgba(255,215,0,${fade * 0.7})`
        ctx.lineWidth = 1
        ctx.setLineDash([3, 3])
        ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(vx, vy); ctx.stroke()
        ctx.setLineDash([])
      }

      // Victim death X
      const vColor = colorOf(k.victim_name)
      ctx.strokeStyle = age < KILL_FLASH ? vColor : `${vColor}55`
      ctx.lineWidth = age < KILL_FLASH ? 2 : 1
      const xs = 4
      ctx.beginPath(); ctx.moveTo(vx - xs, vy - xs); ctx.lineTo(vx + xs, vy + xs); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(vx + xs, vy - xs); ctx.lineTo(vx - xs, vy + xs); ctx.stroke()

      // Killer dot (show for KILL_FLASH duration then fade to small)
      if (age < KILL_FLASH) {
        const kColor = colorOf(k.killer_name)
        const fade = 1 - age / KILL_FLASH
        const grad = ctx.createRadialGradient(kx, ky, 0, kx, ky, 12)
        grad.addColorStop(0, `${kColor}${Math.round(fade * 0.5 * 255).toString(16).padStart(2,'0')}`)
        grad.addColorStop(1, `${kColor}00`)
        ctx.fillStyle = grad
        ctx.beginPath(); ctx.arc(kx, ky, 12, 0, Math.PI * 2); ctx.fill()

        ctx.fillStyle = kColor
        ctx.beginPath(); ctx.arc(kx, ky, 4, 0, Math.PI * 2); ctx.fill()

        // victim name above X
        ctx.fillStyle = `rgba(255,255,255,${fade * 0.85})`
        ctx.font = '8px monospace'
        ctx.textAlign = 'center'
        ctx.fillText(k.victim_name, vx, vy - 7)
      }
    })

    // ── Timeline progress ──
    const barY = CANVAS_SIZE - 4
    ctx.fillStyle = 'rgba(255,255,255,0.1)'
    ctx.fillRect(0, barY, CANVAS_SIZE, 4)
    ctx.fillStyle = '#00ffc8'
    ctx.fillRect(0, barY, CANVAS_SIZE * (t / duration), 4)

    // Kill tick marks on timeline
    round.kills.forEach((k: Kill) => {
      const tx = CANVAS_SIZE * (k.time / duration)
      ctx.fillStyle = 'rgba(255,215,0,0.7)'
      ctx.fillRect(tx - 0.5, barY, 1, 4)
    })
  }, [round, cfg, duration, teamOf]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Animation loop ───────────────────────────────────────────────────────────
  const tick = useCallback(() => {
    const elapsed = (performance.now() - startRef.current) / 1000 * speed
    const t = Math.min(elapsed + pauseAtRef.current, duration)
    setCurrentT(t)
    draw(t)
    if (t < duration) {
      rafRef.current = requestAnimationFrame(tick)
    } else {
      setPlaying(false)
    }
  }, [draw, duration, speed])

  useEffect(() => {
    if (playing) {
      startRef.current = performance.now()
      rafRef.current = requestAnimationFrame(tick)
    } else {
      cancelAnimationFrame(rafRef.current)
    }
    return () => cancelAnimationFrame(rafRef.current)
  }, [playing, tick])

  // Draw static frame when not playing
  useEffect(() => {
    if (!playing) draw(currentT)
  }, [playing, currentT, draw, mapLoaded])

  // Load map image
  useEffect(() => {
    loadMapImage(mapName).then(img => {
      mapImgRef.current = img
      setMapLoaded(true)
    })
  }, [mapName])

  const restart = () => {
    cancelAnimationFrame(rafRef.current)
    pauseAtRef.current = startOffset
    setCurrentT(startOffset)
    setPlaying(false)
    draw(startOffset)
  }

  const togglePlay = () => {
    if (playing) {
      pauseAtRef.current = currentT
      setPlaying(false)
    } else {
      if (currentT >= duration) {
        pauseAtRef.current = startOffset
        setCurrentT(startOffset)
      }
      startRef.current = performance.now()
      setPlaying(true)
    }
  }

  const fmtTime = (s: number) => `${Math.floor(s)}s`

  const cycleSpeed = () => setSpeed(s => s === 1 ? 2 : s === 2 ? 4 : 1)

  if (!cfg) {
    return (
      <div className="rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground">
        No map data for {mapName}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden" style={{ maxWidth: CANVAS_SIZE }}>
      {/* Header */}
      <div className="px-3 py-2 bg-[rgba(0,255,200,0.06)] border-b border-border flex items-center justify-between">
        <div>
          <span className="text-[10px] font-mono text-[#00ffc8]">{mapName}</span>
          <span className="text-[10px] text-muted-foreground mx-1.5">·</span>
          <span className="text-[10px] text-muted-foreground">Round {roundNumber}</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="text-[#00ffc8]">{team1Name}</span>
          <span>vs</span>
          <span className="text-[#ff4466]">{team2Name}</span>
        </div>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        className="block"
        style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}
      />

      {/* Controls */}
      <div className="px-3 py-2 border-t border-border bg-[rgba(0,0,0,0.3)] flex items-center gap-2">
        <button
          onClick={restart}
          className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
        >
          <RotateCcw size={12} />
        </button>
        <button
          onClick={togglePlay}
          className="p-1.5 rounded-full bg-[rgba(0,255,200,0.15)] border border-[rgba(0,255,200,0.3)] text-[#00ffc8] hover:bg-[rgba(0,255,200,0.25)] transition-colors"
        >
          {playing ? <Pause size={12} /> : <Play size={12} />}
        </button>
        <div className="flex-1 text-[10px] text-muted-foreground font-mono">
          {fmtTime(currentT)} / {fmtTime(duration)}
        </div>
        <button
          onClick={cycleSpeed}
          className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground transition-colors"
        >
          {speed}×
        </button>
      </div>

      {/* Description / legend */}
      {description && (
        <div className="px-3 py-2 border-t border-border text-[10px] text-muted-foreground leading-relaxed">
          {description}
        </div>
      )}

      {/* Legend */}
      <div className="px-3 pb-2 flex flex-wrap gap-x-3 gap-y-1">
        {[
          { color: T1_COLOR,    label: team1Name },
          { color: T2_COLOR,    label: team2Name },
          { color: '#ffd700',   label: 'Kill' },
          { color: '#c0c0d0',   label: 'Smoke' },
          { color: '#ff9900',   label: 'HE' },
          { color: '#ff4400',   label: 'Molotov' },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1 text-[9px] text-muted-foreground">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}
