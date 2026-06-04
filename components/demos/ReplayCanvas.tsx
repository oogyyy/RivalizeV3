'use client'

import { useEffect, useRef, useState, useCallback, useMemo, useLayoutEffect } from 'react'
import {
  Play, Pause, RotateCcw, Tag, Video, StopCircle,
  ChevronLeft, ChevronRight, Skull, Wind, Zap, Flame, Circle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useVideoCapture } from '@/hooks/useVideoCapture'
import { MAP_CONFIGS, worldToCanvas, loadMapImage } from '@/lib/map-config'
import type { Round, PlayerStats, PositionFrame } from '@/types/database'

const CANVAS_SIZE = 560
const T1_COLOR    = '#00ff87'
const T2_COLOR    = '#ff4466'
const KILL_FLASH  = 1.4
const TRAIL_SECS  = 1.0

const SMOKE_DUR   = 18
const HE_DUR      = 1.8
const FLASH_DUR   = 0.6
const MOLOTOV_DUR = 7

const GREN_COLORS: Record<string, string> = {
  smoke: '#c0c0d0', flash: '#ffff88', he: '#ff9900', molotov: '#ff4400', decoy: '#8888ff',
}

const WEAPON_ABBR: Record<string, string> = {
  'AK-47': 'AK47', 'M4A4': 'M4A4', 'M4A1-S': 'M4A1', 'AWP': 'AWP',
  'Desert Eagle': 'DEAGLE', 'Glock-18': 'GLOCK', 'USP-S': 'USP',
  'HE Grenade': 'HE', 'Molotov': 'MOLOTOV', 'Knife': 'KNIFE',
  'P250': 'P250', 'Five-SeveN': '5-7', 'Tec-9': 'TEC9',
  'SG 553': 'SG553', 'AUG': 'AUG', 'FAMAS': 'FAMAS', 'Galil AR': 'GALIL',
  'SSG 08': 'SSG08', 'G3SG1': 'G3', 'SCAR-20': 'SCAR', 'M249': 'M249',
  'Negev': 'NEGEV', 'Nova': 'NOVA', 'XM1014': 'XM', 'MAG-7': 'MAG7',
  'Sawed-Off': 'SAWED', 'MAC-10': 'MAC10', 'PP-Bizon': 'BIZON',
  'MP5-SD': 'MP5', 'MP9': 'MP9', 'MP7': 'MP7', 'P90': 'P90',
  'UMP-45': 'UMP', 'CZ75-Auto': 'CZ75', 'R8 Revolver': 'R8',
}

function abbrevWeapon(w: string): string {
  return WEAPON_ABBR[w] ?? w.slice(0, 7)
}

interface Props {
  rounds: Round[]
  players: PlayerStats[]
  team1Name: string
  team2Name: string
  mapName: string
  onPlaybackChange?: (time: number, playing: boolean) => void
}

interface CanvasPlayer {
  x: number; y: number
  alive: boolean
  team: string
  trail: Array<{ x: number; y: number }>
}

// ── Frame interpolation ───────────────────────────────────────────────────────

function getFramePositions(
  frames: PositionFrame[],
  t: number,
  teamOf: Map<string, string>,
  deadAt: Map<string, number>,
  toXY: (wx: number, wy: number) => [number, number],
): Map<string, CanvasPlayer> {
  const out = new Map<string, CanvasPlayer>()
  if (frames.length === 0) return out

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
  const trailStart  = Math.max(0, t - TRAIL_SECS)
  const trailFrames = frames.filter(f => f.t >= trailStart && f.t <= t)

  fA.p.forEach(sA => {
    const sB = bMap.get(sA.n)
    const wx = sA.x + (sB ? (sB.x - sA.x) * alpha : 0)
    const wy = sA.y + (sB ? (sB.y - sA.y) * alpha : 0)
    const [cx, cy] = toXY(wx, wy)

    const diedAt    = deadAt.get(sA.n) ?? Infinity
    const frameAlive = sB ? sB.a : sA.a
    const alive     = diedAt > t && frameAlive

    const trail: Array<{ x: number; y: number }> = []
    if (alive) {
      trailFrames.forEach(tf => {
        const ts = tf.p.find(s => s.n === sA.n)
        if (ts) { const [tx, ty] = toXY(ts.x, ts.y); trail.push({ x: tx, y: ty }) }
      })
    }

    out.set(sA.n, { x: cx, y: cy, alive, team: teamOf.get(sA.n) ?? '', trail })
  })

  return out
}

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

export default function ReplayCanvas({ rounds, players, team1Name, team2Name, mapName, onPlaybackChange }: Props) {
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const rafRef      = useRef<number>(0)
  const lastTsRef   = useRef<number>(0)
  const roundBarRef = useRef<HTMLDivElement>(null)
  const { recordState, toggle: toggleRecord } = useVideoCapture(canvasRef)

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

  // Scroll active round pill into view when roundIdx changes
  useLayoutEffect(() => {
    const bar = roundBarRef.current
    if (!bar) return
    const active = bar.querySelector('[data-active="true"]') as HTMLElement | null
    active?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }, [roundIdx])

  const teamOf = useMemo(() => {
    const m = new Map<string, string>()
    players.forEach(p => m.set(p.name, p.team))
    return m
  }, [players])

  const mapCfg = MAP_CONFIGS[mapName] ?? null

  const toXY = useCallback((wx: number, wy: number): [number, number] => {
    if (mapCfg) return worldToCanvas(wx, wy, mapCfg, CANVAS_SIZE)
    const s = CANVAS_SIZE
    return [((wx + 3500) / 7000) * s, ((3500 - wy) / 7000) * s]
  }, [mapCfg])

  const currentRound   = rounds[roundIdx]
  const kills          = useMemo(() => [...(currentRound?.kills ?? [])].sort((a, b) => a.time - b.time), [currentRound])
  const frames         = useMemo(() => currentRound?.frames ?? [], [currentRound])
  const grenades       = useMemo(() => currentRound?.grenades ?? [], [currentRound])

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

    ctx.fillStyle = '#07080e'
    ctx.fillRect(0, 0, W, H)

    if (bgImage) {
      // Brighter map: 0.78 alpha vs old 0.55
      ctx.globalAlpha = 0.78
      ctx.drawImage(bgImage, 0, 0, W, H)
      // Lighter dark overlay: 0.20 vs old 0.48
      ctx.globalAlpha = 0.20
      ctx.fillStyle = '#07080e'
      ctx.fillRect(0, 0, W, H)
      ctx.globalAlpha = 1
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.04)'
      ctx.lineWidth = 1
      for (let x = 0; x <= W; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }
      for (let y = 0; y <= H; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }
    }

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
        ctx.setLineDash([3, 5]); ctx.strokeStyle = col + '66'; ctx.lineWidth = 1.2
        ctx.beginPath(); ctx.moveTo(tx2, ty2); ctx.lineTo(px, py); ctx.stroke()
        ctx.setLineDash([])
        ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill()
        ctx.beginPath(); ctx.arc(tx2, ty2, 2.5, 0, Math.PI * 2); ctx.fillStyle = col + '80'; ctx.fill()
      } else {
        const age = t - g.land_time
        if (g.type === 'smoke' && age < SMOKE_DUR) {
          const a = Math.min(1, age * 1.5) * Math.max(0, 1 - Math.max(0, age - (SMOKE_DUR - 3)) / 3)
          ctx.globalAlpha = a * 0.52; ctx.fillStyle = '#b8b8cc'
          ctx.beginPath(); ctx.arc(lx, ly, 32, 0, Math.PI * 2); ctx.fill()
          ctx.globalAlpha = a * 0.75; ctx.strokeStyle = '#8888a0'; ctx.lineWidth = 1.5
          ctx.beginPath(); ctx.arc(lx, ly, 32, 0, Math.PI * 2); ctx.stroke()
          ctx.globalAlpha = a * 0.70; ctx.fillStyle = 'rgba(255,255,255,0.60)'; ctx.font = 'bold 7px monospace'
          ctx.fillText('SMOKE', lx - 12, ly + 3); ctx.globalAlpha = 1
        } else if (g.type === 'flash' && age < FLASH_DUR) {
          const a = 1 - age / FLASH_DUR
          ctx.globalAlpha = a * 0.88
          const fg = ctx.createRadialGradient(lx, ly, 0, lx, ly, 24)
          fg.addColorStop(0, '#ffffff'); fg.addColorStop(1, 'transparent')
          ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(lx, ly, 24, 0, Math.PI * 2); ctx.fill()
          ctx.globalAlpha = 1
        } else if (g.type === 'he' && age < HE_DUR) {
          const a = Math.pow(Math.max(0, 1 - age / HE_DUR), 0.6)
          const r = 8 + age * 22
          ctx.globalAlpha = a * 0.85; ctx.strokeStyle = '#ff9900'; ctx.lineWidth = 2.5
          ctx.beginPath(); ctx.arc(lx, ly, r, 0, Math.PI * 2); ctx.stroke()
          const ig = ctx.createRadialGradient(lx, ly, 0, lx, ly, r)
          ig.addColorStop(0, '#ff990055'); ig.addColorStop(1, 'transparent')
          ctx.fillStyle = ig; ctx.beginPath(); ctx.arc(lx, ly, r, 0, Math.PI * 2); ctx.fill()
          ctx.globalAlpha = 1
        } else if (g.type === 'molotov' && age < MOLOTOV_DUR) {
          const a = Math.min(1, age * 2) * Math.max(0, 1 - Math.max(0, age - (MOLOTOV_DUR - 2)) / 2)
          ctx.globalAlpha = a * 0.62; ctx.fillStyle = '#ff4400'
          ctx.beginPath(); ctx.arc(lx, ly, 24, 0, Math.PI * 2); ctx.fill()
          ctx.globalAlpha = a * (Math.sin(t * 9) * 0.4 + 0.6) * 0.82; ctx.fillStyle = '#ffaa00'
          ctx.beginPath(); ctx.arc(lx, ly, 13, 0, Math.PI * 2); ctx.fill()
          ctx.globalAlpha = 1
        }
      }
    })

    // ── Player positions ──────────────────────────────────────────────────────
    const posMap = frames.length > 0
      ? getFramePositions(frames, t, teamOf, deadAt, toXY)
      : getKillPositions(kills, t, teamOf, toXY)

    const active = kills.find(k => k.time <= t && k.time > t - KILL_FLASH)

    // Kill line
    if (active) {
      const [kx, ky] = toXY(active.killer_x, active.killer_y)
      const [vx, vy] = toXY(active.victim_x, active.victim_y)
      const fade = Math.max(0, 1 - (t - active.time) / KILL_FLASH)
      ctx.globalAlpha = fade * 0.70; ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 1.5
      ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(vx, vy); ctx.stroke()
      ctx.setLineDash([]); ctx.globalAlpha = 1
    }

    // Dead players — larger, more visible X markers
    posMap.forEach(p => {
      if (p.alive) return
      const col = p.team === team1Name ? T1_COLOR : T2_COLOR
      ctx.globalAlpha = 0.55; ctx.strokeStyle = col; ctx.lineWidth = 2.2
      ctx.beginPath()
      ctx.moveTo(p.x - 6, p.y - 6); ctx.lineTo(p.x + 6, p.y + 6)
      ctx.moveTo(p.x + 6, p.y - 6); ctx.lineTo(p.x - 6, p.y + 6)
      ctx.stroke(); ctx.globalAlpha = 1
    })

    // Alive players — trail + ring + dot + name
    posMap.forEach((p, name) => {
      if (!p.alive) return
      const col = p.team === team1Name ? T1_COLOR : T2_COLOR

      // Trail
      if (p.trail.length > 1) {
        ctx.beginPath()
        ctx.moveTo(p.trail[0].x, p.trail[0].y)
        for (let i = 1; i < p.trail.length; i++) ctx.lineTo(p.trail[i].x, p.trail[i].y)
        ctx.lineTo(p.x, p.y)
        ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.26; ctx.stroke()
        ctx.globalAlpha = 1
        p.trail.forEach((pt, i) => {
          ctx.beginPath(); ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2)
          ctx.fillStyle = col; ctx.globalAlpha = ((i + 1) / p.trail.length) * 0.30; ctx.fill()
        })
        ctx.globalAlpha = 1
      }

      // Glow
      const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 15)
      glow.addColorStop(0, col + '44'); glow.addColorStop(1, 'transparent')
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(p.x, p.y, 15, 0, Math.PI * 2); ctx.fill()

      // Outer ring
      ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, Math.PI * 2)
      ctx.strokeStyle = col + 'cc'; ctx.lineWidth = 1.5; ctx.stroke()

      // Dot
      ctx.beginPath(); ctx.arc(p.x, p.y, 5.5, 0, Math.PI * 2)
      ctx.fillStyle = col; ctx.globalAlpha = 0.95; ctx.fill(); ctx.globalAlpha = 1

      // Inner highlight
      ctx.beginPath(); ctx.arc(p.x - 1.5, p.y - 1.5, 1.8, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255,255,255,0.60)'; ctx.fill()

      // Death burst on victim
      if (active && name === active.victim_name) {
        const fade = Math.max(0, 1 - (t - active.time) / KILL_FLASH)
        const r = 24 * fade
        const fg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r)
        fg.addColorStop(0, '#ff446688'); fg.addColorStop(1, 'transparent')
        ctx.globalAlpha = fade; ctx.fillStyle = fg
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill()
        ctx.globalAlpha = 1
      }

      // Name label with dark backdrop
      if (showNames) {
        const label = name.length > 11 ? name.slice(0, 10) + '…' : name
        ctx.font = '8px monospace'
        const tw = ctx.measureText(label).width
        const lx = p.x + 9, ly = p.y + 4
        ctx.fillStyle = 'rgba(0,0,0,0.60)'
        ctx.fillRect(lx - 2, ly - 8, tw + 4, 11)
        ctx.fillStyle = col + 'ee'
        ctx.fillText(label, lx, ly)
      }
    })

    // Canvas border
    ctx.strokeStyle = 'rgba(0,255,135,0.10)'; ctx.lineWidth = 1.5
    ctx.strokeRect(0.75, 0.75, W - 1.5, H - 1.5)

  }, [bgImage, deadAt, frames, kills, showNames, teamOf, toXY, visibleGrenades])

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
  useEffect(() => { onPlaybackChange?.(time, isPlaying) }, [time, isPlaying, onPlaybackChange])

  const toggle  = useCallback(() => { if (time >= maxTime) setTime(0); setIsPlaying(p => !p) }, [time, maxTime])
  const restart = () => { setTime(0); setIsPlaying(false) }

  // Keyboard shortcuts: Space = play/pause, ←→ = ±2s
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.code === 'Space') { e.preventDefault(); toggle() }
      if (e.code === 'ArrowLeft')  { e.preventDefault(); setIsPlaying(false); setTime(t => Math.max(0, t - 2)) }
      if (e.code === 'ArrowRight') { e.preventDefault(); setIsPlaying(false); setTime(t => Math.min(maxTime, t + 2)) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggle, maxTime])

  const pastKills = kills.filter(k => k.time <= time)
  const hasFrames = frames.length > 0

  // Player alive status at current time
  const aliveStatus = useMemo(() => {
    const s = new Map<string, boolean>()
    players.forEach(p => s.set(p.name, true))
    kills.filter(k => k.time <= time).forEach(k => s.set(k.victim_name, false))
    return s
  }, [players, kills, time])

  const team1Players = useMemo(() => players.filter(p => p.team === team1Name), [players, team1Name])
  const team2Players = useMemo(() => players.filter(p => p.team === team2Name), [players, team2Name])

  // Cumulative score up to (but not including) current round
  const roundScore = useMemo(() => {
    let t1 = 0, t2 = 0
    rounds.slice(0, roundIdx).forEach(r => { if (r.winner === team1Name) t1++; else t2++ })
    return { t1, t2 }
  }, [rounds, roundIdx, team1Name])

  if (!rounds.length) return <p className="text-muted-foreground text-sm">No replay data available.</p>

  const utilBtn = (
    label: string,
    active: boolean,
    onToggle: () => void,
    color: string,
    icon: React.ReactNode,
  ) => (
    <button
      onClick={onToggle}
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full border transition-all duration-150',
        active
          ? 'border-transparent'
          : 'border-border/30 text-muted-foreground/60 hover:text-muted-foreground',
      )}
      style={active ? {
        background: color + '1a',
        borderColor: color + '50',
        color,
        boxShadow: `0 0 8px ${color}20`,
      } : undefined}
    >
      <span className="flex-shrink-0" style={{ color: active ? color : 'currentColor' }}>{icon}</span>
      {label}
    </button>
  )

  return (
    <div className="flex flex-col gap-3 select-none">

      {/* ── Header: map name · round number · score ───────────────────────────── */}
      <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <span className="text-[10px] font-mono font-bold tracking-widest text-muted-foreground uppercase bg-white/[0.06] px-2 py-0.5 rounded">
            {mapName.replace('de_', '').toUpperCase()}
          </span>
          <span className="text-[11px] text-muted-foreground">Round</span>
          <span className="text-sm font-bold font-mono">{currentRound?.number ?? roundIdx + 1}</span>
          {currentRound?.bomb_planted && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30 font-mono font-bold">
              BOMB
            </span>
          )}
          {!hasFrames && (
            <span className="text-[10px] text-amber-400/60 border border-amber-400/20 px-1.5 py-0.5 rounded font-mono">
              kill-only
            </span>
          )}
        </div>

        <div className="flex-1" />

        {/* Match score */}
        <div className="flex items-center gap-1.5 font-mono font-bold text-sm tabular-nums">
          <span className="truncate max-w-[90px] text-[11px]" style={{ color: T1_COLOR + 'cc' }}>
            {team1Name}
          </span>
          <span style={{ color: T1_COLOR }} className="text-base leading-none">{roundScore.t1}</span>
          <span className="text-muted-foreground/40 text-xs px-0.5">–</span>
          <span style={{ color: T2_COLOR }} className="text-base leading-none">{roundScore.t2}</span>
          <span className="truncate max-w-[90px] text-[11px]" style={{ color: T2_COLOR + 'cc' }}>
            {team2Name}
          </span>
        </div>
      </div>

      {/* ── Round selector: ‹ scrollable pills › ──────────────────────────────── */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => setRoundIdx(i => Math.max(0, i - 1))}
          disabled={roundIdx === 0}
          className="p-1 rounded border border-border/40 text-muted-foreground hover:text-foreground disabled:opacity-25 transition-colors flex-shrink-0"
        >
          <ChevronLeft size={13} />
        </button>

        <div
          ref={roundBarRef}
          className="flex gap-1 overflow-x-auto flex-1 min-w-0"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {rounds.map((r, i) => (
            <button
              key={i}
              data-active={roundIdx === i ? 'true' : 'false'}
              onClick={() => setRoundIdx(i)}
              title={`Round ${r.number} — ${r.winner} won`}
              className={cn(
                'relative flex-shrink-0 w-7 h-7 text-[10px] font-mono rounded transition-all duration-150 border',
                roundIdx === i
                  ? 'border-neon-green/50 bg-neon-green/12 text-neon-green font-bold'
                  : 'border-border/30 text-muted-foreground/60 hover:border-border/60 hover:text-foreground',
              )}
            >
              {r.number}
              {/* Win indicator dot at bottom */}
              <span
                className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-[3px] h-[3px] rounded-full"
                style={{ background: r.winner === team1Name ? T1_COLOR + 'aa' : T2_COLOR + 'aa' }}
              />
            </button>
          ))}
        </div>

        <button
          onClick={() => setRoundIdx(i => Math.min(rounds.length - 1, i + 1))}
          disabled={roundIdx === rounds.length - 1}
          className="p-1 rounded border border-border/40 text-muted-foreground hover:text-foreground disabled:opacity-25 transition-colors flex-shrink-0"
        >
          <ChevronRight size={13} />
        </button>
      </div>

      {/* ── Utility toggles ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">Utility</span>
        {utilBtn('Smokes',   showSmokes,   () => setShowSmokes(v => !v),   '#c0c0d0', <Wind  size={9} />)}
        {utilBtn('Flashes',  showFlashes,  () => setShowFlashes(v => !v),  '#ffff88', <Zap   size={9} />)}
        {utilBtn('Molotovs', showMolotovs, () => setShowMolotovs(v => !v), '#ff4400', <Flame size={9} />)}
        {utilBtn('HE',       showHE,       () => setShowHE(v => !v),       '#ff9900', <Circle size={9} />)}

        <div className="ml-auto">
          <button
            onClick={() => setShowNames(v => !v)}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full border transition-all',
              showNames
                ? 'bg-white/10 border-white/20 text-foreground'
                : 'border-border/30 text-muted-foreground/50',
            )}
          >
            <Tag size={9} />
            Names
          </button>
        </div>
      </div>

      {/* ── Canvas + sidebar ──────────────────────────────────────────────────── */}
      <div className="flex gap-3 flex-col xl:flex-row">

        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          className="rounded-lg border border-white/[0.07] w-full xl:w-[560px] xl:flex-shrink-0 bg-[#07080e]"
        />

        {/* Sidebar: player status + kill feed */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">

          {/* Player alive status */}
          <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2.5">Players</p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
              {/* Team 1 */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: T1_COLOR }} />
                  <span className="text-[10px] font-semibold truncate" style={{ color: T1_COLOR }}>
                    {team1Name}
                  </span>
                  <span className="text-[10px] text-muted-foreground ml-auto tabular-nums">
                    {team1Players.filter(p => aliveStatus.get(p.name) !== false).length}
                    <span className="opacity-40">/{team1Players.length}</span>
                  </span>
                </div>
                {team1Players.map(p => {
                  const alive = aliveStatus.get(p.name) !== false
                  return (
                    <div key={p.name} className={cn('flex items-center gap-1.5 py-0.5 transition-opacity', !alive && 'opacity-25')}>
                      {alive
                        ? <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: T1_COLOR }} />
                        : <Skull size={9} className="text-muted-foreground flex-shrink-0" />
                      }
                      <span className="text-[11px] font-mono truncate" style={{ color: alive ? T1_COLOR + 'bb' : undefined }}>
                        {p.name}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* Team 2 */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: T2_COLOR }} />
                  <span className="text-[10px] font-semibold truncate" style={{ color: T2_COLOR }}>
                    {team2Name}
                  </span>
                  <span className="text-[10px] text-muted-foreground ml-auto tabular-nums">
                    {team2Players.filter(p => aliveStatus.get(p.name) !== false).length}
                    <span className="opacity-40">/{team2Players.length}</span>
                  </span>
                </div>
                {team2Players.map(p => {
                  const alive = aliveStatus.get(p.name) !== false
                  return (
                    <div key={p.name} className={cn('flex items-center gap-1.5 py-0.5 transition-opacity', !alive && 'opacity-25')}>
                      {alive
                        ? <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: T2_COLOR }} />
                        : <Skull size={9} className="text-muted-foreground flex-shrink-0" />
                      }
                      <span className="text-[11px] font-mono truncate" style={{ color: alive ? T2_COLOR + 'bb' : undefined }}>
                        {p.name}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Kill feed */}
          <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-3 flex-1">
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Kill Feed
              </p>
              <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
                {pastKills.length}
                <span className="opacity-40">/{kills.length}</span>
              </span>
            </div>

            <div className="flex flex-col gap-0.5 max-h-[300px] overflow-y-auto"
              style={{ scrollbarWidth: 'thin' }}>
              {kills.length === 0 ? (
                <p className="text-xs text-muted-foreground/50">No kills this round.</p>
              ) : kills.map((k, i) => {
                const past     = k.time <= time
                const isActive = k.time <= time && k.time > time - KILL_FLASH
                const kTeam    = teamOf.get(k.killer_name) === team1Name
                const vTeam    = teamOf.get(k.victim_name) === team1Name
                return (
                  <div
                    key={i}
                    className={cn(
                      'flex items-center gap-1 px-1.5 py-1 rounded text-[11px] font-mono border transition-all',
                      isActive ? 'bg-yellow-500/10 border-yellow-500/20' : 'border-transparent',
                      past ? 'opacity-100' : 'opacity-15',
                    )}
                  >
                    <span className="text-[9px] text-muted-foreground/50 w-6 flex-shrink-0 tabular-nums">
                      {k.time.toFixed(1)}
                    </span>
                    <span className="truncate flex-1 min-w-0"
                      style={{ color: kTeam ? T1_COLOR + 'cc' : T2_COLOR + 'cc' }}>
                      {k.killer_name}
                    </span>
                    <span className="text-muted-foreground/40 flex-shrink-0 text-[9px] px-0.5">
                      {k.headshot ? 'HS' : '→'}
                    </span>
                    <span className="truncate flex-1 min-w-0"
                      style={{ color: vTeam ? T1_COLOR + 'cc' : T2_COLOR + 'cc' }}>
                      {k.victim_name}
                    </span>
                    <span className="ml-1 flex-shrink-0 text-[9px] text-muted-foreground/50 bg-white/[0.06] px-1 py-0.5 rounded">
                      {abbrevWeapon(k.weapon)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

        </div>
      </div>

      {/* ── Timeline with kill + grenade markers ──────────────────────────────── */}
      <div className="space-y-1.5">
        {/* Event markers row */}
        <div className="relative h-3 mx-0.5">
          {kills.map((k, i) => {
            const pct  = (k.time / maxTime) * 100
            const past = k.time <= time
            return (
              <div
                key={i}
                className="absolute top-0 w-0.5 h-2.5 rounded-full transition-opacity"
                style={{
                  left: `${pct}%`,
                  background: past ? '#ff4466' : 'rgba(255,68,102,0.25)',
                  transform: 'translateX(-50%)',
                }}
                title={`${k.killer_name} → ${k.victim_name} (${k.time.toFixed(1)}s)`}
              />
            )
          })}
          {visibleGrenades.filter(g => g.land_time > 0 && g.land_time <= maxTime).map((g, i) => (
            <div
              key={i}
              className="absolute top-1 w-1 h-1 rounded-full"
              style={{
                left: `${(g.land_time / maxTime) * 100}%`,
                background: (GREN_COLORS[g.type] ?? '#fff') + '80',
                transform: 'translateX(-50%)',
              }}
            />
          ))}
        </div>

        <input
          type="range"
          min={0}
          max={maxTime}
          step={0.05}
          value={time}
          onChange={e => { setIsPlaying(false); setTime(parseFloat(e.target.value)) }}
          className="w-full h-1.5 cursor-pointer rounded-full"
          style={{ accentColor: '#00ff87' }}
        />
      </div>

      {/* ── Playback controls ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={restart}
          className="p-1.5 rounded border border-border/40 text-muted-foreground hover:text-foreground transition-colors"
          title="Restart"
        >
          <RotateCcw size={13} />
        </button>

        <button
          onClick={toggle}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-neon-green/30 bg-neon-green/10 text-neon-green text-xs font-medium hover:bg-neon-green/20 transition-colors"
        >
          {isPlaying ? <Pause size={13} /> : <Play size={13} />}
          {isPlaying ? 'Pause' : 'Play'}
        </button>

        <div className="flex border border-border/40 rounded-full overflow-hidden">
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

        <span className="text-xs font-mono text-muted-foreground tabular-nums ml-auto">
          {time.toFixed(1)}s / {maxTime.toFixed(1)}s
        </span>

        <button
          onClick={toggleRecord}
          disabled={recordState === 'processing'}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs transition-colors',
            recordState === 'recording'
              ? 'border-red-400/40 bg-red-400/10 text-red-400 hover:bg-red-400/20'
              : 'border-border/40 text-muted-foreground hover:text-foreground',
          )}
          title={recordState === 'recording' ? 'Stop & save clip' : 'Record clip'}
        >
          {recordState === 'recording'
            ? <><StopCircle size={11} /> Stop</>
            : <><Video size={11} /> Clip</>
          }
        </button>
      </div>

      {/* ── Footer: legend + keyboard hints ───────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground/40">
        <span>
          <kbd className="font-mono bg-white/[0.06] px-1 rounded text-[9px] text-muted-foreground/60">Space</kbd>
          {' '}play/pause
        </span>
        <span>
          <kbd className="font-mono bg-white/[0.06] px-1 rounded text-[9px] text-muted-foreground/60">← →</kbd>
          {' '}±2s
        </span>

        <div className="flex items-center gap-3 ml-auto">
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: T1_COLOR }} />
            <span>{team1Name}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: T2_COLOR }} />
            <span>{team2Name}</span>
          </div>
          <span className="opacity-70">● alive · ✕ dead</span>
          {hasFrames
            ? <span className="text-neon-green/40">{frames.length} frames</span>
            : <span className="text-amber-400/40">kill-only mode · re-parse for movement</span>
          }
        </div>
      </div>

    </div>
  )
}
