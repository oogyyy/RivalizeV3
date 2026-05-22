'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { Play, Pause, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MAP_CONFIGS, worldToCanvas, loadMapImage } from '@/lib/map-config'
import type { Round, PlayerStats } from '@/types/database'

const CANVAS_SIZE = 512
const PAD = 56
const INNER = CANVAS_SIZE - PAD * 2
const T1_COLOR = '#00ff87'
const T2_COLOR = '#ff3860'
const FLASH_DUR = 1.4   // seconds a kill flash is visible
const MAX_TRAIL = 5     // positions to keep per player

interface Bounds { minX: number; maxX: number; minY: number; maxY: number }

function getBounds(rounds: Round[]): Bounds | null {
  const all = rounds.flatMap(r => r.kills ?? [])
  if (!all.length) return null
  const xs = all.flatMap(k => [k.killer_x, k.victim_x])
  const ys = all.flatMap(k => [k.killer_y, k.victim_y])
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }
}

// Fallback normalised coordinates (when no map calibration is available)
function cx(v: number, b: Bounds) {
  const r = b.maxX - b.minX
  return PAD + (r === 0 ? 0.5 : (v - b.minX) / r) * INNER
}
function cy(v: number, b: Bounds) {
  const r = b.maxY - b.minY
  return PAD + (r === 0 ? 0.5 : 1 - (v - b.minY) / r) * INNER
}

interface Props {
  rounds: Round[]
  players: PlayerStats[]
  team1Name: string
  team2Name: string
  mapName: string
}

type Trail = { x: number; y: number }[]
type PlayerState = {
  x: number; y: number
  alive: boolean
  team: string
  known: boolean
  trail: Trail
}

export default function ReplayCanvas({ rounds, players, team1Name, team2Name, mapName }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef<number>(0)
  const lastTsRef = useRef<number>(0)

  const [roundIdx,  setRoundIdx]  = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [time,      setTime]      = useState(0)
  const [speed,     setSpeed]     = useState<1 | 2 | 4>(1)
  const [bgImage,   setBgImage]   = useState<HTMLImageElement | null>(null)

  // Load map background image
  useEffect(() => {
    setBgImage(null)
    loadMapImage(mapName).then(img => setBgImage(img))
  }, [mapName])

  const teamOf = useMemo(() => {
    const m = new Map<string, string>()
    players.forEach(p => m.set(p.name, p.team))
    return m
  }, [players])

  const bounds = useMemo(() => getBounds(rounds), [rounds])
  const mapCfg = MAP_CONFIGS[mapName] ?? null

  // Convert world coordinates to canvas coordinates, preferring radar calibration
  const toXY = useCallback((wx: number, wy: number): [number, number] => {
    if (mapCfg) return worldToCanvas(wx, wy, mapCfg, CANVAS_SIZE)
    if (!bounds) return [CANVAS_SIZE / 2, CANVAS_SIZE / 2]
    return [cx(wx, bounds), cy(wy, bounds)]
  }, [mapCfg, bounds])

  const kills = useMemo(() => {
    const rnd = rounds[roundIdx]
    if (!rnd) return []
    return [...(rnd.kills ?? [])].sort((a, b) => a.time - b.time)
  }, [rounds, roundIdx])

  const maxTime = kills.length ? kills[kills.length - 1].time + 2 : rounds[roundIdx]?.duration ?? 30

  // ── Canvas draw ──────────────────────────────────────────────────────────────
  const draw = useCallback((t: number) => {
    const canvas = canvasRef.current
    if (!canvas || !bounds) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const W = CANVAS_SIZE, H = CANVAS_SIZE

    // Background
    ctx.fillStyle = '#080c18'
    ctx.fillRect(0, 0, W, H)

    if (bgImage) {
      ctx.globalAlpha = 0.55
      ctx.drawImage(bgImage, 0, 0, W, H)
      // Dark scrim for readability
      ctx.globalAlpha = 0.50
      ctx.fillStyle = '#080c18'
      ctx.fillRect(0, 0, W, H)
      ctx.globalAlpha = 1
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.035)'
      ctx.lineWidth = 1
      for (let x = 0; x <= W; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }
      for (let y = 0; y <= H; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }
    }

    // Header label
    ctx.fillStyle = 'rgba(255,255,255,0.45)'
    ctx.font = 'bold 11px monospace'
    ctx.fillText(`${mapName.toUpperCase()} · ROUND ${rounds[roundIdx]?.number ?? roundIdx + 1}`, 12, 22)

    // Build player states up to t
    const pos = new Map<string, PlayerState>()
    players.forEach(p => pos.set(p.name, { x: 0, y: 0, alive: true, team: p.team, known: false, trail: [] }))

    const pastKills = kills.filter(k => k.time <= t)
    pastKills.forEach(k => {
      const kt = teamOf.get(k.killer_name) ?? ''
      const vt = teamOf.get(k.victim_name) ?? ''
      const [kx, ky] = toXY(k.killer_x, k.killer_y)
      const [vx, vy] = toXY(k.victim_x, k.victim_y)

      // Append old position to trail before moving
      const prevKiller = pos.get(k.killer_name)
      const killerTrail: Trail = prevKiller?.known
        ? [...prevKiller.trail.slice(-(MAX_TRAIL - 1)), { x: prevKiller.x, y: prevKiller.y }]
        : []
      const prevVictim = pos.get(k.victim_name)
      const victimTrail: Trail = prevVictim?.known
        ? [...prevVictim.trail.slice(-(MAX_TRAIL - 1)), { x: prevVictim.x, y: prevVictim.y }]
        : []

      pos.set(k.killer_name, { x: kx, y: ky, alive: true,  team: kt, known: true, trail: killerTrail })
      pos.set(k.victim_name, { x: vx, y: vy, alive: false, team: vt, known: true, trail: victimTrail })
    })

    // Active kill for flash animation
    const active = kills.find(k => k.time <= t && k.time > t - FLASH_DUR)

    // Kill line
    if (active) {
      const [kx, ky] = toXY(active.killer_x, active.killer_y)
      const [vx, vy] = toXY(active.victim_x, active.victim_y)
      const fade = Math.max(0, 1 - (t - active.time) / FLASH_DUR)
      ctx.globalAlpha = fade * 0.65
      ctx.strokeStyle = '#ffd700'
      ctx.lineWidth = 1.5
      ctx.setLineDash([4, 4])
      ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(vx, vy); ctx.stroke()
      ctx.setLineDash([])
      ctx.globalAlpha = 1
    }

    // Dead players (X marks)
    pos.forEach(p => {
      if (!p.known || p.alive) return
      const col = p.team === team1Name ? T1_COLOR : T2_COLOR
      ctx.globalAlpha = 0.35
      ctx.strokeStyle = col
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(p.x - 5, p.y - 5); ctx.lineTo(p.x + 5, p.y + 5)
      ctx.moveTo(p.x + 5, p.y - 5); ctx.lineTo(p.x - 5, p.y + 5)
      ctx.stroke()
      ctx.globalAlpha = 1
    })

    // Alive players — trails, glow, dot, name
    pos.forEach((p, name) => {
      if (!p.known || !p.alive) return
      const col = p.team === team1Name ? T1_COLOR : T2_COLOR

      // Movement trail (faded line)
      if (p.trail.length > 0) {
        ctx.beginPath()
        ctx.moveTo(p.trail[0].x, p.trail[0].y)
        for (let i = 1; i < p.trail.length; i++) ctx.lineTo(p.trail[i].x, p.trail[i].y)
        ctx.lineTo(p.x, p.y)
        ctx.strokeStyle = col
        ctx.lineWidth = 1.5
        ctx.globalAlpha = 0.25
        ctx.stroke()
        ctx.globalAlpha = 1

        // Ghost dots along trail, fading out
        p.trail.forEach((pt, i) => {
          ctx.beginPath()
          ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2)
          ctx.fillStyle = col
          ctx.globalAlpha = ((i + 1) / p.trail.length) * 0.32
          ctx.fill()
        })
        ctx.globalAlpha = 1
      }

      // Glow
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 14)
      g.addColorStop(0, col + '45')
      g.addColorStop(1, 'transparent')
      ctx.fillStyle = g
      ctx.beginPath(); ctx.arc(p.x, p.y, 14, 0, Math.PI * 2); ctx.fill()

      // Dot
      ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2)
      ctx.fillStyle = col; ctx.fill()

      // Kill flash on victim
      if (active && name === active.victim_name) {
        const fade = Math.max(0, 1 - (t - active.time) / FLASH_DUR)
        const r = 22 * fade
        const fg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r)
        fg.addColorStop(0, '#ff386088'); fg.addColorStop(1, 'transparent')
        ctx.globalAlpha = fade
        ctx.fillStyle = fg
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill()
        ctx.globalAlpha = 1
      }

      // Name label
      ctx.fillStyle = 'rgba(255,255,255,0.55)'
      ctx.font = '8px monospace'
      ctx.fillText(name.slice(0, 12), p.x + 7, p.y + 3)
    })

    // Progress bar
    const bx = 12, by = H - 16, bw = W - 24, bh = 7
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillRect(bx, by, bw, bh)
    ctx.fillStyle = '#00ff87'
    ctx.fillRect(bx, by, bw * Math.min(1, t / maxTime), bh)
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'
    ctx.lineWidth = 1
    ctx.strokeRect(bx, by, bw, bh)
    kills.forEach(k => {
      const kx2 = bx + (k.time / maxTime) * bw
      ctx.fillStyle = '#ff3860'
      ctx.fillRect(kx2 - 0.5, by, 1.5, bh)
    })

    // Border
    ctx.strokeStyle = 'rgba(0,255,135,0.14)'
    ctx.lineWidth = 1.5
    ctx.strokeRect(0.75, 0.75, W - 1.5, H - 1.5)
  }, [bgImage, bounds, kills, mapCfg, mapName, maxTime, players, rounds, roundIdx, team1Name, teamOf, toXY])

  // Animation loop
  useEffect(() => {
    if (!isPlaying) return
    lastTsRef.current = 0
    const tick = (ts: number) => {
      if (!lastTsRef.current) lastTsRef.current = ts
      const delta = (ts - lastTsRef.current) / 1000
      lastTsRef.current = ts
      setTime(prev => {
        const next = prev + delta * speed
        if (next >= maxTime) { setIsPlaying(false); return maxTime }
        return next
      })
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [isPlaying, speed, maxTime])

  // Redraw when time or background changes
  useEffect(() => { draw(time) }, [time, draw])

  // Reset when round changes
  useEffect(() => {
    setTime(0); setIsPlaying(false); draw(0)
  }, [roundIdx]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggle  = () => { if (time >= maxTime) setTime(0); setIsPlaying(p => !p) }
  const restart = () => { setTime(0); setIsPlaying(false) }

  const pastKills = kills.filter(k => k.time <= time)

  if (!rounds.length) {
    return <p className="text-muted-foreground text-sm">No replay data available.</p>
  }
  if (!bounds) {
    return <p className="text-muted-foreground text-sm">No position data in this demo.</p>
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Round selector */}
      <div className="flex flex-wrap gap-1.5">
        {rounds.map((r, i) => (
          <button
            key={i}
            onClick={() => setRoundIdx(i)}
            className={cn(
              'px-2 py-0.5 text-xs font-mono rounded border transition-colors',
              roundIdx === i
                ? 'bg-neon-green/10 border-neon-green/40 text-neon-green'
                : 'border-border/50 text-muted-foreground hover:text-foreground hover:border-border',
            )}
          >
            R{r.number}
          </button>
        ))}
      </div>

      {/* Canvas + kill feed */}
      <div className="flex gap-4 flex-col lg:flex-row">
        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          className="rounded-lg border border-border w-full lg:w-[512px] lg:flex-shrink-0"
        />

        {/* Kill feed */}
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            Kill Feed — Round {rounds[roundIdx]?.number}
          </p>
          <div className="flex flex-col gap-0.5 max-h-[460px] overflow-y-auto pr-1">
            {kills.length === 0 ? (
              <p className="text-xs text-muted-foreground">No kills recorded this round.</p>
            ) : kills.map((k, i) => {
              const past     = k.time <= time
              const isActive = k.time <= time && k.time > time - FLASH_DUR
              const kTeam    = teamOf.get(k.killer_name) === team1Name
              const vTeam    = teamOf.get(k.victim_name) === team1Name
              return (
                <div
                  key={i}
                  className={cn(
                    'flex items-center gap-1.5 px-2 py-1 rounded text-xs font-mono border transition-all',
                    isActive ? 'bg-yellow-500/10 border-yellow-500/25' : 'border-transparent',
                    past ? 'opacity-100' : 'opacity-20',
                  )}
                >
                  <span className="text-[10px] text-muted-foreground w-7 flex-shrink-0">
                    {k.time.toFixed(1)}s
                  </span>
                  <span className={kTeam ? 'text-neon-green' : 'text-red-400'}>{k.killer_name}</span>
                  <span className="text-muted-foreground">{k.headshot ? '⊕' : '→'}</span>
                  <span className={vTeam ? 'text-neon-green' : 'text-red-400'}>{k.victim_name}</span>
                  <span className="text-[10px] text-muted-foreground ml-auto">{k.weapon}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={restart}
          className="p-1.5 rounded border border-border/50 text-muted-foreground hover:text-foreground transition-colors"
          title="Restart"
        >
          <RotateCcw size={14} />
        </button>
        <button
          onClick={toggle}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-neon-green/30 bg-neon-green/10 text-neon-green text-sm hover:bg-neon-green/20 transition-colors"
        >
          {isPlaying ? <Pause size={14} /> : <Play size={14} />}
          <span>{isPlaying ? 'Pause' : 'Play'}</span>
        </button>

        {/* Speed */}
        <div className="flex border border-border/50 rounded overflow-hidden">
          {([1, 2, 4] as const).map(s => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={cn(
                'px-2.5 py-1 text-xs font-mono transition-colors',
                speed === s ? 'bg-neon-green/20 text-neon-green' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {s}×
            </button>
          ))}
        </div>

        <span className="text-xs font-mono text-muted-foreground ml-auto">
          {time.toFixed(1)}s · {pastKills.length}/{kills.length} kills
        </span>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-neon-green" />
          <span>{team1Name}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <span>{team2Name}</span>
        </div>
        <span>● alive &nbsp; ✕ dead &nbsp; — kill line &nbsp; ∼ trail</span>
        {!mapCfg && (
          <span className="opacity-60">· positions normalised (no radar data for {mapName})</span>
        )}
      </div>
    </div>
  )
}
