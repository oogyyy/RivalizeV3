'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Play, Pause, RotateCcw } from 'lucide-react'
import { MAP_CONFIGS, worldToCanvas, loadMapImage } from '@/lib/map-config'
import { roundStartOffset } from '@/lib/replay-trim'
import { drawSmoke, smokeCanvasRadius } from '@/lib/replay-smoke'
import { drawFire, fireCanvasRadius, throwerOnCT } from '@/lib/replay-fire'
import { drawExplosion, drawFlashbang, heCanvasRadius, flashCanvasRadius } from '@/lib/replay-explosives'
import { drawGrenadeArc } from '@/lib/replay-arc'
import { drawBomb, bombStateFromRound } from '@/lib/replay-bomb'
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
  win_reason?: string
  duration: number
  freeze_end_time?: number
  kills: Kill[]
  grenades?: GrenadeEvent[]
  bomb_planted?: boolean
  plant_time?: number
  plant_x?: number
  plant_y?: number
  defuse_time?: number
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
  const smokeRadius = cfg ? smokeCanvasRadius(cfg.scale, CANVAS_SIZE) : 18
  const heRadius    = cfg ? heCanvasRadius(cfg.scale, CANVAS_SIZE) : 30
  const flashRadius = cfg ? flashCanvasRadius(cfg.scale, CANVAS_SIZE) : 16

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
      if (g.time > t) return

      const color = GREN_COLORS[g.type] ?? '#fff'
      const [lx, ly]   = toXY(g.land_x, g.land_y)
      const [tx2, ty2] = toXY(g.throw_x, g.throw_y)

      // In flight — animated arc from thrower to landing spot.
      if (t < g.land_time) {
        const prog = Math.min(1, (t - g.time) / Math.max(0.01, g.land_time - g.time))
        drawGrenadeArc(ctx, tx2, ty2, lx, ly, prog, color)
        return
      }

      const age = t - g.land_time

      let maxDur: number
      switch (g.type) {
        case 'smoke':   maxDur = SMOKE_DUR; break
        case 'flash':   maxDur = FLASH_DUR; break
        case 'he':      maxDur = HE_DUR; break
        case 'molotov': maxDur = MOLOTOV_DUR; break
        default:        maxDur = 3
      }
      if (age > maxDur) return

      const fade = Math.max(0, 1 - age / maxDur)

      if (g.type === 'smoke') {
        drawSmoke(ctx, lx, ly, smokeRadius, age, SMOKE_DUR)
      } else if (g.type === 'flash') {
        drawFlashbang(ctx, lx, ly, flashRadius, age, FLASH_DUR)
      } else if (g.type === 'he') {
        drawExplosion(ctx, lx, ly, heRadius, age, HE_DUR)
      } else if (g.type === 'molotov') {
        const isCT = throwerOnCT(teamOf.get(g.thrower) === 1, round.number)
        const fr   = cfg ? fireCanvasRadius(cfg.scale, CANVAS_SIZE, isCT) : (isCT ? 16 : 14)
        drawFire(ctx, lx, ly, fr, age, MOLOTOV_DUR, isCT)
      } else {
        ctx.fillStyle = `rgba(${color},${fade})`
        ctx.beginPath(); ctx.arc(lx, ly, 4, 0, Math.PI * 2); ctx.fill()
      }

      // Throw-origin line lingers briefly after landing, then clears.
      if (age < 1.5) {
        ctx.strokeStyle = `rgba(255,255,255,${0.25 * (1 - age / 1.5)})`
        ctx.lineWidth = 0.5
        ctx.setLineDash([2, 3])
        ctx.beginPath(); ctx.moveTo(tx2, ty2); ctx.lineTo(lx, ly); ctx.stroke()
        ctx.setLineDash([])
      }
    })

    // ── Bomb plant / timer / defuse / detonation ──
    const bomb = bombStateFromRound(round, toXY)
    if (bomb) drawBomb(ctx, bomb, t, heRadius * 2.1)

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
    ctx.fillStyle = '#2DE3CE'
    ctx.fillRect(0, barY, CANVAS_SIZE * (t / duration), 4)

    // Kill tick marks on timeline
    round.kills.forEach((k: Kill) => {
      const tx = CANVAS_SIZE * (k.time / duration)
      ctx.fillStyle = 'rgba(255,215,0,0.7)'
      ctx.fillRect(tx - 0.5, barY, 1, 4)
    })
  }, [round, cfg, duration, teamOf, smokeRadius, heRadius, flashRadius]) // eslint-disable-line react-hooks/exhaustive-deps

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
      <div className="px-3 py-2 bg-[rgba(45,227,206,0.06)] border-b border-border flex items-center justify-between">
        <div>
          <span className="text-[10px] font-mono text-[#2DE3CE]">{mapName}</span>
          <span className="text-[10px] text-muted-foreground mx-1.5">·</span>
          <span className="text-[10px] text-muted-foreground">Round {roundNumber}</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="text-[#2DE3CE]">{team1Name}</span>
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
          className="p-1.5 rounded-full bg-[rgba(45,227,206,0.15)] border border-[rgba(45,227,206,0.3)] text-[#2DE3CE] hover:bg-[rgba(45,227,206,0.25)] transition-colors"
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
          { color: '#ff7733',   label: 'Molotov (T)' },
          { color: '#4488ff',   label: 'Incendiary (CT)' },
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
