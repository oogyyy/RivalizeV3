'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { Play, Pause, RotateCcw, Tag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MAP_CONFIGS, worldToCanvas, loadMapImage } from '@/lib/map-config'
import type { Round, PlayerStats, PositionFrame } from '@/types/database'

const CANVAS_SIZE = 512
const T1_COLOR    = '#00ff87'
const T2_COLOR    = '#ff3860'
const KILL_FLASH  = 1.4
const TRAIL_SECS  = 1.0

const SMOKE_DUR   = 18
const HE_DUR      = 1.8
const FLASH_DUR   = 0.6
const MOLOTOV_DUR = 7

const GREN_COLORS: Record<string, string> = {
  smoke: '#c0c0d0', flash: '#ffff88', he: '#ff9900', molotov: '#ff4400', decoy: '#8888ff',
}

interface Props {
  rounds: Round[]
  players: PlayerStats[]
  team1Name: string
  team2Name: string
  mapName: string
}

// ── Frame interpolation ───────────────────────────────────────────────────────

interface CanvasPlayer {
  x: number; y: number
  alive: boolean
  team: string
  trail: Array<{ x: number; y: number }>
}

function getFramePositions(
  frames: PositionFrame[],
  t: number,
  teamOf: Map<string, string>,
  deadAt: Map<string, number>,
  toXY: (wx: number, wy: number) => [number, number],
): Map<string, CanvasPlayer> {
  const out = new Map<string, CanvasPlayer>()
  if (frames.length === 0) return out

  // Binary search for the frame bracket surrounding t
  let lo = 0, hi = frames.length - 1
  if (t <= frames[0].t) { lo = 0; hi = 0 }
  else if (t >= frames[hi].t) { lo = hi; hi = hi }
  else {
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1
      if (frames[mid].t <= t) lo = mid; else hi = mid
    }
  }

  const fA = frames[lo]
  const fB = frames[Math.min(hi, frames.length - 1)]
  const alpha = (fA === fB || fB.t === fA.t) ? 0 : Math.min(1, (t - fA.t) / (fB.t - fA.t))

  const bMap = new Map(fB.p.map(s => [s.n, s]))

  // Trail: collect positions from recent frames
  const trailStart = Math.max(0, t - TRAIL_SECS)
  const trailFrames = frames.filter(f => f.t >= trailStart && f.t <= t)

  fA.p.forEach(sA => {
    const sB = bMap.get(sA.n)
    const wx = sA.x + (sB ? (sB.x - sA.x) * alpha : 0)
    const wy = sA.y + (sB ? (sB.y - sA.y) * alpha : 0)
    const [cx, cy] = toXY(wx, wy)

    const diedAt = deadAt.get(sA.n) ?? Infinity
    const frameAlive = sB ? sB.a : sA.a
    const alive = diedAt > t && frameAlive

    const trail: Array<{ x: number; y: number }> = []
    if (alive) {
      trailFrames.forEach(tf => {
        const ts = tf.p.find(s => s.n === sA.n)
        if (ts) {
          const [tx, ty] = toXY(ts.x, ts.y)
          trail.push({ x: tx, y: ty })
        }
      })
    }

    out.set(sA.n, { x: cx, y: cy, alive, team: teamOf.get(sA.n) ?? '', trail })
  })

  return out
}

// Fallback: build positions from kills only when no frame data is available
function getKillPositions(
  kills: Round['kills'],
  t: number,
  teamOf: Map<string, string>,
  toXY: (wx: number, wy: number) => [number, number],
): Map<string, CanvasPlayer> {
  const out = new Map<string, CanvasPlayer>()
  ;(kills ?? []).filter(k => k.time <= t).forEach(k => {
    const [kx, ky] = toXY(k.killer_x, k.killer_y)
    const [vx, vy] = toXY(k.victim_x, k.victim_y)
    out.set(k.killer_name, { x: kx, y: ky, alive: true,  team: teamOf.get(k.killer_name) ?? '', trail: [] })
    out.set(k.victim_name,  { x: vx, y: vy, alive: false, team: teamOf.get(k.victim_name)  ?? '', trail: [] })
  })
  return out
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ReplayCanvas({ rounds, players, team1Name, team2Name, mapName }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef<number>(0)
  const lastTsRef = useRef<number>(0)

  const [roundIdx,     setRoundIdx]     = useState(0)
  const [isPlaying,    setIsPlaying]    = useState(false)
  const [time,         setTime]         = useState(0)
  const [speed,        setSpeed]        = useState<1 | 2 | 4>(1)
  const [bgImage,      setBgImage]      = useState<HTMLImageElement | null>(null)
  const [showSmokes,   setShowSmokes]   = useState(true)
  const [showFlashes,  setShowFlashes]  = useState(true)
  const [showMolotovs, setShowMolotovs] = useState(true)
  const [showHE,       setShowHE]       = useState(true)
  const [showNames,    setShowNames]    = useState(true)

  useEffect(() => {
    setBgImage(null)
    loadMapImage(mapName).then(img => setBgImage(img))
  }, [mapName])

  const teamOf = useMemo(() => {
    const m = new Map<string, string>()
    players.forEach(p => m.set(p.name, p.team))
    return m
  }, [players])

  const mapCfg = MAP_CONFIGS[mapName] ?? null

  const toXY = useCallback((wx: number, wy: number): [number, number] => {
    if (mapCfg) return worldToCanvas(wx, wy, mapCfg, CANVAS_SIZE)
    // fallback for unmapped maps
    const s = CANVAS_SIZE
    return [((wx + 3500) / 7000) * s, ((3500 - wy) / 7000) * s]
  }, [mapCfg])

  const currentRound = rounds[roundIdx]
  const kills  = useMemo(() => [...(currentRound?.kills ?? [])].sort((a, b) => a.time - b.time), [currentRound])
  const frames = useMemo(() => currentRound?.frames ?? [], [currentRound])
  const grenades = useMemo(() => currentRound?.grenades ?? [], [currentRound])

  const visibleGrenades = useMemo(() => grenades.filter(g => {
    if (g.type === 'smoke'   && !showSmokes)   return false
    if (g.type === 'flash'   && !showFlashes)  return false
    if (g.type === 'molotov' && !showMolotovs) return false
    if (g.type === 'he'      && !showHE)       return false
    return true
  }), [grenades, showSmokes, showFlashes, showMolotovs, showHE])

  const maxTime = useMemo(() => {
    if (frames.length > 0) return frames[frames.length - 1].t + 1
    if (kills.length > 0)  return kills[kills.length - 1].time + 2
    return currentRound?.duration ?? 90
  }, [frames, kills, currentRound])

  // Build death-time map so frame renderer knows when each player died
  const deadAt = useMemo(() => {
    const m = new Map<string, number>()
    kills.forEach(k => { if (!m.has(k.victim_name)) m.set(k.victim_name, k.time) })
    return m
  }, [kills])

  // ── Draw ──────────────────────────────────────────────────────────────────
  const draw = useCallback((t: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const W = CANVAS_SIZE, H = CANVAS_SIZE

    // Background
    ctx.fillStyle = '#080c18'
    ctx.fillRect(0, 0, W, H)

    if (bgImage) {
      ctx.globalAlpha = 0.55
      ctx.drawImage(bgImage, 0, 0, W, H)
      ctx.globalAlpha = 0.48
      ctx.fillStyle = '#080c18'
      ctx.fillRect(0, 0, W, H)
      ctx.globalAlpha = 1
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.035)'
      ctx.lineWidth = 1
      for (let x = 0; x <= W; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }
      for (let y = 0; y <= H; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }
    }

    ctx.fillStyle = 'rgba(255,255,255,0.45)'
    ctx.font = 'bold 11px monospace'
    ctx.fillText(`${mapName.toUpperCase()} · R${currentRound?.number ?? roundIdx + 1}`, 12, 22)

    // ── Grenade effects ──────────────────────────────────────────────────────
    visibleGrenades.forEach(g => {
      if (g.time > t) return
      const [tx2, ty2] = toXY(g.throw_x, g.throw_y)
      const [lx, ly]   = toXY(g.land_x,  g.land_y)
      const col        = GREN_COLORS[g.type] ?? '#ffffff'
      const inFlight   = t < g.land_time

      if (inFlight) {
        const progress = Math.min(1, (t - g.time) / Math.max(0.01, g.land_time - g.time))
        const px = tx2 + (lx - tx2) * progress
        const py = ty2 + (ly - ty2) * progress
        ctx.setLineDash([3, 5]); ctx.strokeStyle = col + '55'; ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(tx2, ty2); ctx.lineTo(px, py); ctx.stroke()
        ctx.setLineDash([])
        ctx.beginPath(); ctx.arc(px, py, 3.5, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill()
        ctx.beginPath(); ctx.arc(tx2, ty2, 2, 0, Math.PI * 2); ctx.fillStyle = col + '80'; ctx.fill()
      } else {
        const age = t - g.land_time
        if (g.type === 'smoke' && age < SMOKE_DUR) {
          const a = Math.min(1, age * 1.5) * Math.max(0, 1 - Math.max(0, age - (SMOKE_DUR - 3)) / 3)
          ctx.globalAlpha = a * 0.50; ctx.fillStyle = '#c0c0d8'
          ctx.beginPath(); ctx.arc(lx, ly, 30, 0, Math.PI * 2); ctx.fill()
          ctx.globalAlpha = a * 0.70; ctx.strokeStyle = '#9090a8'; ctx.lineWidth = 1.5
          ctx.beginPath(); ctx.arc(lx, ly, 30, 0, Math.PI * 2); ctx.stroke()
          ctx.globalAlpha = a * 0.65; ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = 'bold 7px monospace'
          ctx.fillText('SMOKE', lx - 11, ly + 2); ctx.globalAlpha = 1
        } else if (g.type === 'flash' && age < FLASH_DUR) {
          const a = 1 - age / FLASH_DUR
          ctx.globalAlpha = a * 0.85
          const fg = ctx.createRadialGradient(lx, ly, 0, lx, ly, 22)
          fg.addColorStop(0, '#ffffff'); fg.addColorStop(1, 'transparent')
          ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(lx, ly, 22, 0, Math.PI * 2); ctx.fill()
          ctx.globalAlpha = 1
        } else if (g.type === 'he' && age < HE_DUR) {
          const a = Math.pow(Math.max(0, 1 - age / HE_DUR), 0.6)
          const r = 8 + age * 20
          ctx.globalAlpha = a * 0.80; ctx.strokeStyle = '#ff9900'; ctx.lineWidth = 2.5
          ctx.beginPath(); ctx.arc(lx, ly, r, 0, Math.PI * 2); ctx.stroke()
          const ig = ctx.createRadialGradient(lx, ly, 0, lx, ly, r)
          ig.addColorStop(0, '#ff990050'); ig.addColorStop(1, 'transparent')
          ctx.fillStyle = ig; ctx.beginPath(); ctx.arc(lx, ly, r, 0, Math.PI * 2); ctx.fill()
          ctx.globalAlpha = 1
        } else if (g.type === 'molotov' && age < MOLOTOV_DUR) {
          const a = Math.min(1, age * 2) * Math.max(0, 1 - Math.max(0, age - (MOLOTOV_DUR - 2)) / 2)
          ctx.globalAlpha = a * 0.60; ctx.fillStyle = '#ff4400'
          ctx.beginPath(); ctx.arc(lx, ly, 22, 0, Math.PI * 2); ctx.fill()
          ctx.globalAlpha = a * (Math.sin(t * 9) * 0.4 + 0.6) * 0.80; ctx.fillStyle = '#ffaa00'
          ctx.beginPath(); ctx.arc(lx, ly, 12, 0, Math.PI * 2); ctx.fill()
          ctx.globalAlpha = 1
        }
      }
    })

    // ── Player positions ──────────────────────────────────────────────────────
    const posMap = frames.length > 0
      ? getFramePositions(frames, t, teamOf, deadAt, toXY)
      : getKillPositions(kills, t, teamOf, toXY)

    // Active kill for flash animation
    const active = kills.find(k => k.time <= t && k.time > t - KILL_FLASH)

    // Kill line
    if (active) {
      const [kx, ky] = toXY(active.killer_x, active.killer_y)
      const [vx, vy] = toXY(active.victim_x, active.victim_y)
      const fade = Math.max(0, 1 - (t - active.time) / KILL_FLASH)
      ctx.globalAlpha = fade * 0.65; ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 1.5
      ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(vx, vy); ctx.stroke()
      ctx.setLineDash([]); ctx.globalAlpha = 1
    }

    // Dead players — X markers
    posMap.forEach(p => {
      if (p.alive) return
      const col = p.team === team1Name ? T1_COLOR : T2_COLOR
      ctx.globalAlpha = 0.38; ctx.strokeStyle = col; ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(p.x - 5, p.y - 5); ctx.lineTo(p.x + 5, p.y + 5)
      ctx.moveTo(p.x + 5, p.y - 5); ctx.lineTo(p.x - 5, p.y + 5)
      ctx.stroke(); ctx.globalAlpha = 1
    })

    // Alive players — trails + glow + dot + name
    posMap.forEach((p, name) => {
      if (!p.alive) return
      const col = p.team === team1Name ? T1_COLOR : T2_COLOR

      // Trail
      if (p.trail.length > 1) {
        ctx.beginPath()
        ctx.moveTo(p.trail[0].x, p.trail[0].y)
        for (let i = 1; i < p.trail.length; i++) ctx.lineTo(p.trail[i].x, p.trail[i].y)
        ctx.lineTo(p.x, p.y)
        ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.22; ctx.stroke()
        ctx.globalAlpha = 1
        p.trail.forEach((pt, i) => {
          ctx.beginPath(); ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2)
          ctx.fillStyle = col; ctx.globalAlpha = ((i + 1) / p.trail.length) * 0.28; ctx.fill()
        })
        ctx.globalAlpha = 1
      }

      // Glow
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 13)
      g.addColorStop(0, col + '40'); g.addColorStop(1, 'transparent')
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, 13, 0, Math.PI * 2); ctx.fill()

      // Dot
      ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2)
      ctx.fillStyle = col; ctx.globalAlpha = 0.92; ctx.fill(); ctx.globalAlpha = 1

      // Inner highlight
      ctx.beginPath(); ctx.arc(p.x - 1.2, p.y - 1.2, 1.5, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill()

      // Death burst on victim
      if (active && name === active.victim_name) {
        const fade = Math.max(0, 1 - (t - active.time) / KILL_FLASH)
        const r = 22 * fade
        const fg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r)
        fg.addColorStop(0, '#ff386088'); fg.addColorStop(1, 'transparent')
        ctx.globalAlpha = fade; ctx.fillStyle = fg
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill()
        ctx.globalAlpha = 1
      }

      // Name label
      if (showNames) {
        ctx.fillStyle = col + 'cc'
        ctx.font = '7.5px monospace'
        const label = name.length > 12 ? name.slice(0, 11) + '…' : name
        ctx.fillText(label, p.x + 6, p.y + 3)
      }
    })

    // ── Timeline bar ──────────────────────────────────────────────────────────
    const bx = 12, by = H - 18, bw = W - 24, bh = 6
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(bx, by, bw, bh)
    ctx.fillStyle = '#00ff87'; ctx.fillRect(bx, by, bw * Math.min(1, t / maxTime), bh)
    ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 1; ctx.strokeRect(bx, by, bw, bh)

    kills.forEach(k => {
      const kx = bx + (k.time / maxTime) * bw
      ctx.fillStyle = '#ff3860'; ctx.fillRect(kx - 0.5, by, 1.5, bh)
    })
    visibleGrenades.forEach(g => {
      if (g.land_time > 0 && g.land_time <= maxTime) {
        const gx = bx + (g.land_time / maxTime) * bw
        ctx.fillStyle = (GREN_COLORS[g.type] ?? '#fff') + 'aa'; ctx.fillRect(gx - 0.5, by, 1, bh)
      }
    })

    // Border
    ctx.strokeStyle = 'rgba(0,255,135,0.14)'; ctx.lineWidth = 1.5
    ctx.strokeRect(0.75, 0.75, W - 1.5, H - 1.5)

  }, [bgImage, currentRound, deadAt, frames, kills, mapName, maxTime, roundIdx, showNames, teamOf, toXY, visibleGrenades])

  // ── Animation loop ─────────────────────────────────────────────────────────
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

  useEffect(() => { draw(time) }, [time, draw])
  useEffect(() => { setTime(0); setIsPlaying(false) }, [roundIdx]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggle  = () => { if (time >= maxTime) setTime(0); setIsPlaying(p => !p) }
  const restart = () => { setTime(0); setIsPlaying(false) }

  const pastKills = kills.filter(k => k.time <= time)
  const hasFrames = frames.length > 0

  if (!rounds.length) return <p className="text-muted-foreground text-sm">No replay data available.</p>

  const utilBtn = (label: string, active: boolean, onToggle: () => void, color: string) => (
    <button
      onClick={onToggle}
      className={cn(
        'flex items-center gap-1 px-2 py-0.5 text-xs rounded border transition-colors',
        active ? 'border-transparent text-foreground' : 'border-border/40 text-muted-foreground opacity-50',
      )}
      style={active ? { background: color + '22', borderColor: color + '55', color } : undefined}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: active ? color : 'currentColor' }} />
      {label}
    </button>
  )

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

      {/* Toggles row */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-muted-foreground uppercase tracking-wider">Utility:</span>
        {utilBtn('Smokes',   showSmokes,   () => setShowSmokes(v => !v),   '#c0c0d0')}
        {utilBtn('Flashes',  showFlashes,  () => setShowFlashes(v => !v),  '#ffff88')}
        {utilBtn('Molotovs', showMolotovs, () => setShowMolotovs(v => !v), '#ff4400')}
        {utilBtn('HE',       showHE,       () => setShowHE(v => !v),       '#ff9900')}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setShowNames(v => !v)}
            className={cn(
              'flex items-center gap-1.5 px-2 py-0.5 text-xs rounded border transition-colors',
              showNames
                ? 'bg-white/10 border-white/30 text-foreground'
                : 'border-border/40 text-muted-foreground opacity-50',
            )}
          >
            <Tag size={10} />
            Names
          </button>
          {!hasFrames && (
            <span className="text-[10px] text-amber-400/70">
              Re-parse demo for live movement
            </span>
          )}
        </div>
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
            Kill Feed — Round {currentRound?.number}
          </p>
          <div className="flex flex-col gap-0.5 max-h-[460px] overflow-y-auto pr-1">
            {kills.length === 0 ? (
              <p className="text-xs text-muted-foreground">No kills recorded this round.</p>
            ) : kills.map((k, i) => {
              const past     = k.time <= time
              const isActive = k.time <= time && k.time > time - KILL_FLASH
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
                  <span className="text-[10px] text-muted-foreground w-7 flex-shrink-0">{k.time.toFixed(1)}s</span>
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

      {/* Scrubber */}
      <input
        type="range"
        min={0}
        max={maxTime}
        step={0.05}
        value={time}
        onChange={e => { setIsPlaying(false); setTime(parseFloat(e.target.value)) }}
        className="w-full accent-neon-green h-1 cursor-pointer"
        style={{ accentColor: '#00ff87' }}
      />

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
          {time.toFixed(1)}s / {maxTime.toFixed(1)}s · {pastKills.length}/{kills.length} kills
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
        <span>● alive &nbsp; ✕ dead &nbsp; ∼ trail</span>
        {hasFrames
          ? <span className="text-neon-green/60">● live positions ({frames.length} frames this round)</span>
          : <span className="opacity-50">· kill-only mode (re-parse for smooth movement)</span>
        }
      </div>
    </div>
  )
}
