'use client'

import { useEffect, useRef, useState, useCallback, useMemo, useLayoutEffect } from 'react'
import type { ReactNode } from 'react'
import {
  Play, Pause, RotateCcw, Video, StopCircle,
  ChevronLeft, ChevronRight, Skull,
  Wind, Zap, Flame, Circle, Activity,
  MousePointer, Pencil, Minus, ArrowRight, Trash2,
  Eye, EyeOff, Tag, Crosshair,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useVideoCapture } from '@/hooks/useVideoCapture'
import { MAP_CONFIGS, worldToCanvas, loadMapImage } from '@/lib/map-config'
import { roundStartOffset } from '@/lib/replay-trim'
import { drawSmoke, smokeCanvasRadius } from '@/lib/replay-smoke'
import { drawFire, fireCanvasRadius, throwerOnCT } from '@/lib/replay-fire'
import { drawExplosion, drawFlashbang, heCanvasRadius, flashCanvasRadius } from '@/lib/replay-explosives'
import type { Round, PlayerStats, PositionFrame } from '@/types/database'

// ── Constants ─────────────────────────────────────────────────────────────────

const CANVAS_SIZE  = 720
const T1_COLOR     = '#22d3ee'   // cyan
const T2_COLOR     = '#fb923c'   // orange
const KILL_FLASH   = 1.4
const TRAIL_SECS   = 1.0
const FOCUS_ZOOM   = 2.2
const SMOKE_DUR    = 18
const HE_DUR       = 1.8
const FLASH_DUR    = 0.6
const MOLOTOV_DUR  = 7

const GREN_COLORS: Record<string, string> = {
  smoke: '#b8b8cc', flash: '#ffee55', he: '#ff8800', molotov: '#ff3300', decoy: '#8888ff',
}

const WEAPON_ABBR: Record<string, string> = {
  'AK-47': 'AK47', 'M4A4': 'M4A4', 'M4A1-S': 'M4A1', 'AWP': 'AWP',
  'Desert Eagle': 'DEagle', 'Glock-18': 'Glock', 'USP-S': 'USP',
  'HE Grenade': 'HE', 'Molotov': 'Molotov', 'Knife': 'Knife',
  'P250': 'P250', 'Five-SeveN': '5-7', 'Tec-9': 'Tec9',
  'SG 553': 'SG553', 'AUG': 'AUG', 'FAMAS': 'FAMAS', 'Galil AR': 'Galil',
  'SSG 08': 'Scout', 'MAC-10': 'MAC10', 'MP5-SD': 'MP5', 'MP9': 'MP9',
  'MP7': 'MP7', 'P90': 'P90', 'UMP-45': 'UMP', 'CZ75-Auto': 'CZ75',
  'R8 Revolver': 'R8', 'M249': 'M249', 'Negev': 'Negev',
}

function abbrevWeapon(w: string) { return WEAPON_ABBR[w] ?? w.slice(0, 8) }

// ── Types ─────────────────────────────────────────────────────────────────────

type AnnotationTool = 'select' | 'pen' | 'line' | 'arrow' | 'circle'
type RoundFilter    = 'all' | 'pistol' | 'eco' | 'force' | 'full'
type SpeedValue     = 0.5 | 1 | 2 | 4

interface Annotation {
  id: string
  type: Exclude<AnnotationTool, 'select'>
  points: { x: number; y: number }[]
  color: string
}

interface CanvasPlayer {
  x: number; y: number
  alive: boolean
  team: string
  trail: { x: number; y: number }[]
  yaw?: number
  health?: number
}

interface Props {
  rounds: Round[]
  players: PlayerStats[]
  team1Name: string
  team2Name: string
  mapName: string
  onPlaybackChange?: (time: number, playing: boolean) => void
}

// ── Frame helpers ─────────────────────────────────────────────────────────────

function getFramePositions(
  frames: PositionFrame[],
  t: number,
  teamOf: Map<string, string>,
  deadAt: Map<string, number>,
  toXY: (wx: number, wy: number) => [number, number],
): Map<string, CanvasPlayer> {
  const out = new Map<string, CanvasPlayer>()
  if (!frames.length) return out

  let lo = 0, hi = frames.length - 1
  if (t <= frames[0].t) { lo = 0; hi = 0 }
  else if (t >= frames[hi].t) { lo = hi }
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
  const trailFrames = frames.filter(f => f.t >= Math.max(0, t - TRAIL_SECS) && f.t <= t)

  fA.p.forEach(sA => {
    const sB = bMap.get(sA.n)
    const wx = sA.x + (sB ? (sB.x - sA.x) * alpha : 0)
    const wy = sA.y + (sB ? (sB.y - sA.y) * alpha : 0)
    const [cx, cy] = toXY(wx, wy)
    const alive = (deadAt.get(sA.n) ?? Infinity) > t && (sB ? sB.a : sA.a)
    const trail: { x: number; y: number }[] = []
    if (alive) {
      trailFrames.forEach(tf => {
        const ts = tf.p.find(s => s.n === sA.n)
        if (ts) { const [tx, ty] = toXY(ts.x, ts.y); trail.push({ x: tx, y: ty }) }
      })
    }
    const yaw = sA.w !== undefined
      ? sA.w + (sB?.w !== undefined ? (sB.w - sA.w) * alpha : 0)
      : undefined
    const health = sA.h !== undefined
      ? sA.h + ((sB?.h ?? sA.h) - sA.h) * alpha
      : undefined
    out.set(sA.n, { x: cx, y: cy, alive, team: teamOf.get(sA.n) ?? '', trail, yaw, health })
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

function getRoundType(r: Round, idx: number): 'pistol' | 'eco' | 'force' | 'full' {
  if (idx === 0 || idx === 12) return 'pistol'
  const minEco = Math.min(r.team1_economy || 0, r.team2_economy || 0)
  if (minEco < 1200) return 'eco'
  if (minEco < 3600) return 'force'
  return 'full'
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ReplayCanvas({ rounds, players, team1Name, team2Name, mapName, onPlaybackChange }: Props) {
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const rafRef       = useRef<number>(0)
  const lastTsRef    = useRef<number>(0)
  const roundBarRef  = useRef<HTMLDivElement>(null)
  const playerPosRef = useRef<Map<string, CanvasPlayer>>(new Map())
  const heatmapRef   = useRef<HTMLCanvasElement | null>(null)
  // in-progress drawing: stored in a ref to avoid re-renders during mouse drag
  const inProgressRef = useRef<{
    type: Exclude<AnnotationTool, 'select'>
    start: { x: number; y: number }
    current: { x: number; y: number }
    path: { x: number; y: number }[]
  } | null>(null)

  const { recordState, toggle: toggleRecord } = useVideoCapture(canvasRef)

  // ── Playback state ────────────────────────────────────────────────────────
  const [roundIdx,  setRoundIdx]  = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [time,      setTime]      = useState(0)
  const [speed,     setSpeed]     = useState<SpeedValue>(1)
  const [bgImage,   setBgImage]   = useState<HTMLImageElement | null>(null)

  // ── Layer toggles ─────────────────────────────────────────────────────────
  const [showSmokes,     setShowSmokes]     = useState(true)
  const [showFlashes,    setShowFlashes]    = useState(true)
  const [showMolotovs,   setShowMolotovs]   = useState(true)
  const [showHE,         setShowHE]         = useState(true)
  const [showTrails,     setShowTrails]     = useState(true)
  const [showNames,      setShowNames]      = useState(true)
  const [showDeaths,     setShowDeaths]     = useState(true)
  const [showDirections, setShowDirections] = useState(true)
  const [showHeatmap,    setShowHeatmap]    = useState(false)

  // ── Tools / annotations ───────────────────────────────────────────────────
  const [activeTool,  setActiveTool]  = useState<AnnotationTool>('select')
  const [annotColor,  setAnnotColor]  = useState('#ff4466')
  const [annotations, setAnnotations] = useState<Record<number, Annotation[]>>({})
  const [focusPlayer, setFocusPlayer] = useState<string | null>(null)
  const [roundFilter, setRoundFilter] = useState<RoundFilter>('all')

  // ── Hover tooltip ─────────────────────────────────────────────────────────
  const [hoveredPlayer, setHoveredPlayer] = useState<string | null>(null)
  const [mousePos,      setMousePos]      = useState({ x: 0, y: 0 })

  // ── Panel visibility ──────────────────────────────────────────────────────
  const [leftOpen,  setLeftOpen]  = useState(true)
  const [rightOpen, setRightOpen] = useState(true)
  const [rightTab,  setRightTab]  = useState<'players' | 'kills'>('players')

  // ── Data loading ──────────────────────────────────────────────────────────
  useEffect(() => {
    setBgImage(null)
    loadMapImage(mapName).then(img => setBgImage(img))
  }, [mapName])

  useLayoutEffect(() => {
    const bar = roundBarRef.current
    if (!bar) return
    const el = bar.querySelector('[data-active="true"]') as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }, [roundIdx])

  const teamOf = useMemo(() => {
    const m = new Map<string, string>()
    players.forEach(p => m.set(p.name, p.team))
    return m
  }, [players])

  const mapCfg = MAP_CONFIGS[mapName] ?? null
  const smokeRadius = mapCfg ? smokeCanvasRadius(mapCfg.scale, CANVAS_SIZE) : 28
  const heRadius    = mapCfg ? heCanvasRadius(mapCfg.scale, CANVAS_SIZE) : 40
  const flashRadius = mapCfg ? flashCanvasRadius(mapCfg.scale, CANVAS_SIZE) : 22
  const toXY = useCallback((wx: number, wy: number): [number, number] => {
    if (mapCfg) return worldToCanvas(wx, wy, mapCfg, CANVAS_SIZE)
    const s = CANVAS_SIZE
    return [((wx + 3500) / 7000) * s, ((3500 - wy) / 7000) * s]
  }, [mapCfg])

  const currentRound = rounds[roundIdx]
  const kills    = useMemo(() => [...(currentRound?.kills    ?? [])].sort((a, b) => a.time - b.time), [currentRound])
  const frames   = useMemo(() => currentRound?.frames   ?? [], [currentRound])
  const grenades = useMemo(() => currentRound?.grenades ?? [], [currentRound])
  const hasFrames = frames.length > 0

  const visibleGrenades = useMemo(() => grenades.filter(g => {
    if (g.type === 'smoke'   && !showSmokes)   return false
    if (g.type === 'flash'   && !showFlashes)  return false
    if (g.type === 'molotov' && !showMolotovs) return false
    if (g.type === 'he'      && !showHE)       return false
    return true
  }), [grenades, showSmokes, showFlashes, showMolotovs, showHE])

  const maxTime = useMemo(() => {
    if (frames.length > 0) return frames[frames.length - 1].t + 1
    if (kills.length  > 0) return kills[kills.length - 1].time + 2
    return currentRound?.duration ?? 90
  }, [frames, kills, currentRound])

  // Skip the dead freeze/buy phase at the start of the round.
  const startOffset = useMemo(
    () => roundStartOffset({ freeze_end_time: currentRound?.freeze_end_time, frames, grenades, kills }),
    [currentRound, frames, grenades, kills],
  )

  const deadAt = useMemo(() => {
    const m = new Map<string, number>()
    kills.forEach(k => { if (!m.has(k.victim_name)) m.set(k.victim_name, k.time) })
    return m
  }, [kills])

  const roundScore = useMemo(() => {
    let t1 = 0, t2 = 0
    rounds.slice(0, roundIdx).forEach(r => { if (r.winner === team1Name) t1++; else t2++ })
    return { t1, t2 }
  }, [rounds, roundIdx, team1Name])

  const aliveStatus = useMemo(() => {
    const m = new Map<string, boolean>()
    players.forEach(p => m.set(p.name, true))
    kills.filter(k => k.time <= time).forEach(k => m.set(k.victim_name, false))
    return m
  }, [players, kills, time])

  const team1Players = useMemo(() => players.filter(p => p.team === team1Name), [players, team1Name])
  const team2Players = useMemo(() => players.filter(p => p.team === team2Name), [players, team2Name])
  const pastKills    = kills.filter(k => k.time <= time)

  const grenadeCount = useMemo(() => ({
    smoke:   grenades.filter(g => g.type === 'smoke').length,
    flash:   grenades.filter(g => g.type === 'flash').length,
    molotov: grenades.filter(g => g.type === 'molotov').length,
    he:      grenades.filter(g => g.type === 'he').length,
  }), [grenades])

  // ── Heatmap precomputation ────────────────────────────────────────────────
  useEffect(() => {
    heatmapRef.current = null
    if (!showHeatmap || !frames.length) return
    const off = document.createElement('canvas')
    off.width = CANVAS_SIZE; off.height = CANVAS_SIZE
    const ctx = off.getContext('2d')!
    const step = Math.max(1, Math.floor(frames.length / 300))
    for (let i = 0; i < frames.length; i += step) {
      frames[i].p.forEach(snap => {
        if (!snap.a) return
        const [cx, cy] = toXY(snap.x, snap.y)
        const col = teamOf.get(snap.n) === team1Name ? T1_COLOR : T2_COLOR
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 14)
        g.addColorStop(0, col + '22'); g.addColorStop(1, 'transparent')
        ctx.fillStyle = g
        ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI * 2); ctx.fill()
      })
    }
    heatmapRef.current = off
  }, [showHeatmap, frames, teamOf, team1Name, toXY])

  // ── Canvas coordinate helper ──────────────────────────────────────────────
  const getCanvasPoint = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) * (CANVAS_SIZE / rect.width),
      y: (e.clientY - rect.top)  * (CANVAS_SIZE / rect.height),
    }
  }, [])

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
      ctx.globalAlpha = 0.82
      ctx.drawImage(bgImage, 0, 0, W, H)
      ctx.globalAlpha = 0.16
      ctx.fillStyle = '#07080e'
      ctx.fillRect(0, 0, W, H)
      ctx.globalAlpha = 1
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.04)'
      ctx.lineWidth = 1
      for (let x = 0; x <= W; x += 64) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke() }
      for (let y = 0; y <= H; y += 64) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke() }
    }

    // Heatmap layer
    if (showHeatmap && heatmapRef.current) {
      ctx.globalAlpha = 0.72
      ctx.drawImage(heatmapRef.current, 0, 0)
      ctx.globalAlpha = 1
    }

    // Compute player positions
    const posMap = frames.length > 0
      ? getFramePositions(frames, t, teamOf, deadAt, toXY)
      : getKillPositions(kills, t, teamOf, toXY)
    playerPosRef.current = posMap

    // ── Focus player transform ────────────────────────────────────────────
    const focusPos = focusPlayer ? posMap.get(focusPlayer) : null
    if (focusPos?.alive) {
      ctx.save()
      ctx.translate(W / 2 - focusPos.x * FOCUS_ZOOM, H / 2 - focusPos.y * FOCUS_ZOOM)
      ctx.scale(FOCUS_ZOOM, FOCUS_ZOOM)
    }

    // ── Grenades ──────────────────────────────────────────────────────────
    visibleGrenades.forEach(g => {
      if (g.time > t) return
      const [tx2, ty2] = toXY(g.throw_x, g.throw_y)
      const [lx, ly]   = toXY(g.land_x, g.land_y)
      const col        = GREN_COLORS[g.type] ?? '#fff'
      const inFlight   = t < g.land_time

      if (inFlight) {
        const prog = Math.min(1, (t - g.time) / Math.max(0.01, g.land_time - g.time))
        const px = tx2 + (lx - tx2) * prog, py = ty2 + (ly - ty2) * prog
        ctx.setLineDash([3, 5]); ctx.strokeStyle = col + '66'; ctx.lineWidth = 1.1
        ctx.beginPath(); ctx.moveTo(tx2, ty2); ctx.lineTo(px, py); ctx.stroke()
        ctx.setLineDash([])
        ctx.beginPath(); ctx.arc(px, py, 3.5, 0, Math.PI * 2)
        ctx.fillStyle = col; ctx.fill()
      } else {
        const age = t - g.land_time
        if (g.type === 'smoke' && age < SMOKE_DUR) {
          drawSmoke(ctx, lx, ly, smokeRadius, age, SMOKE_DUR)
        } else if (g.type === 'flash' && age < FLASH_DUR) {
          drawFlashbang(ctx, lx, ly, flashRadius, age, FLASH_DUR)
        } else if (g.type === 'he' && age < HE_DUR) {
          drawExplosion(ctx, lx, ly, heRadius, age, HE_DUR)
        } else if (g.type === 'molotov' && age < MOLOTOV_DUR) {
          const isCT = throwerOnCT(teamOf.get(g.thrower) === team1Name, currentRound?.number ?? roundIdx + 1)
          const fr   = mapCfg ? fireCanvasRadius(mapCfg.scale, CANVAS_SIZE, isCT) : (isCT ? 26 : 22)
          drawFire(ctx, lx, ly, fr, age, MOLOTOV_DUR, isCT)
        }
      }
    })

    // ── Kill flash line ───────────────────────────────────────────────────
    const active = kills.find(k => k.time <= t && k.time > t - KILL_FLASH)
    if (active) {
      const [kx, ky] = toXY(active.killer_x, active.killer_y)
      const [vx, vy] = toXY(active.victim_x, active.victim_y)
      const fade = Math.max(0, 1 - (t - active.time) / KILL_FLASH)
      ctx.globalAlpha = fade * 0.65; ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 1.5
      ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(vx, vy); ctx.stroke()
      ctx.setLineDash([]); ctx.globalAlpha = 1
    }

    // ── Dead players ──────────────────────────────────────────────────────
    if (showDeaths) {
      posMap.forEach(p => {
        if (p.alive) return
        const col = p.team === team1Name ? T1_COLOR : T2_COLOR
        ctx.globalAlpha = 0.55; ctx.strokeStyle = col; ctx.lineWidth = 2.2
        ctx.beginPath()
        ctx.moveTo(p.x - 6, p.y - 6); ctx.lineTo(p.x + 6, p.y + 6)
        ctx.moveTo(p.x + 6, p.y - 6); ctx.lineTo(p.x - 6, p.y + 6)
        ctx.stroke(); ctx.globalAlpha = 1
      })
    }

    // ── Alive players ─────────────────────────────────────────────────────
    posMap.forEach((p, name) => {
      if (!p.alive) return
      const col      = p.team === team1Name ? T1_COLOR : T2_COLOR
      const isFocused = focusPlayer === name

      // Trail
      if (showTrails && p.trail.length > 1) {
        ctx.beginPath()
        ctx.moveTo(p.trail[0].x, p.trail[0].y)
        for (let i = 1; i < p.trail.length; i++) ctx.lineTo(p.trail[i].x, p.trail[i].y)
        ctx.lineTo(p.x, p.y)
        ctx.strokeStyle = col; ctx.lineWidth = isFocused ? 2 : 1.5
        ctx.globalAlpha = isFocused ? 0.40 : 0.22; ctx.stroke()
        ctx.globalAlpha = 1
        p.trail.forEach((pt, i) => {
          ctx.beginPath(); ctx.arc(pt.x, pt.y, 1.8, 0, Math.PI * 2)
          ctx.fillStyle = col; ctx.globalAlpha = ((i + 1) / p.trail.length) * 0.28; ctx.fill()
        })
        ctx.globalAlpha = 1
      }

      // Glow
      const glowR = isFocused ? 20 : 14
      const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowR)
      glow.addColorStop(0, col + '4a'); glow.addColorStop(1, 'transparent')
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(p.x, p.y, glowR, 0, Math.PI * 2); ctx.fill()

      // Direction arrow (uses yaw from frame data)
      if (showDirections && p.yaw !== undefined) {
        const rad = -(p.yaw * Math.PI / 180) // negate: canvas Y is flipped vs world Y
        const len = 11
        const dx = Math.cos(rad) * len, dy = Math.sin(rad) * len
        const ax = p.x + dx, ay = p.y + dy
        const hl = 5, ha = 0.48
        const ang = Math.atan2(dy, dx)
        ctx.strokeStyle = col + 'bb'; ctx.lineWidth = 1.4; ctx.globalAlpha = 0.80
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(ax, ay); ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(ax, ay)
        ctx.lineTo(ax - hl * Math.cos(ang - ha), ay - hl * Math.sin(ang - ha))
        ctx.lineTo(ax - hl * Math.cos(ang + ha), ay - hl * Math.sin(ang + ha))
        ctx.closePath(); ctx.fillStyle = col + 'bb'; ctx.fill()
        ctx.globalAlpha = 1
      }

      // Focused: extra outer ring
      if (isFocused) {
        ctx.beginPath(); ctx.arc(p.x, p.y, 9.5, 0, Math.PI * 2)
        ctx.strokeStyle = col + '55'; ctx.lineWidth = 1.5; ctx.stroke()
      }

      // Outer ring
      ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, Math.PI * 2)
      ctx.strokeStyle = col + 'cc'; ctx.lineWidth = isFocused ? 2 : 1.5; ctx.stroke()

      // Fill dot
      ctx.beginPath(); ctx.arc(p.x, p.y, 5.5, 0, Math.PI * 2)
      ctx.fillStyle = col; ctx.globalAlpha = 0.95; ctx.fill(); ctx.globalAlpha = 1

      // Inner highlight
      ctx.beginPath(); ctx.arc(p.x - 1.5, p.y - 1.5, 1.8, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255,255,255,0.58)'; ctx.fill()

      // Kill burst on victim
      if (active && name === active.victim_name) {
        const fade = Math.max(0, 1 - (t - active.time) / KILL_FLASH)
        const r = 26 * fade
        const fg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r)
        fg.addColorStop(0, '#ff446680'); fg.addColorStop(1, 'transparent')
        ctx.globalAlpha = fade; ctx.fillStyle = fg
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill()
        ctx.globalAlpha = 1
      }

      // Name label with dark backdrop
      if (showNames) {
        const label = name.length > 11 ? name.slice(0, 10) + '…' : name
        ctx.font = isFocused ? 'bold 9px monospace' : '8px monospace'
        const tw = ctx.measureText(label).width
        const lx = p.x + 9, ly = p.y + 4
        ctx.fillStyle = 'rgba(0,0,0,0.68)'; ctx.fillRect(lx - 2, ly - 9, tw + 4, 12)
        ctx.fillStyle = col + 'ee'; ctx.fillText(label, lx, ly)
      }
    })

    if (focusPos?.alive) ctx.restore()

    // ── Annotations ───────────────────────────────────────────────────────
    const savedAnnotations = annotations[roundIdx] ?? []
    const inProg = inProgressRef.current
    const previewAnnotation: Annotation | null = inProg
      ? {
          id: 'preview',
          type: inProg.type,
          points: inProg.type === 'pen' ? inProg.path : [inProg.start, inProg.current],
          color: annotColor,
        }
      : null
    const allAnns = previewAnnotation
      ? [...savedAnnotations, previewAnnotation]
      : savedAnnotations

    allAnns.forEach(ann => {
      if (!ann || !ann.points?.length) return
      ctx.strokeStyle = ann.color; ctx.fillStyle = ann.color
      ctx.lineWidth = 2.5; ctx.globalAlpha = 0.85; ctx.setLineDash([])
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'

      if (ann.type === 'pen' && ann.points.length > 1) {
        ctx.beginPath(); ctx.moveTo(ann.points[0].x, ann.points[0].y)
        for (let i = 1; i < ann.points.length; i++) ctx.lineTo(ann.points[i].x, ann.points[i].y)
        ctx.stroke()
      } else if (ann.type === 'line' && ann.points.length >= 2) {
        const p1 = ann.points[ann.points.length - 1]
        ctx.beginPath(); ctx.moveTo(ann.points[0].x, ann.points[0].y)
        ctx.lineTo(p1.x, p1.y); ctx.stroke()
      } else if (ann.type === 'circle' && ann.points.length >= 2) {
        const p0 = ann.points[0], p1 = ann.points[ann.points.length - 1]
        const r = Math.hypot(p1.x - p0.x, p1.y - p0.y)
        ctx.beginPath(); ctx.arc(p0.x, p0.y, Math.max(1, r), 0, Math.PI * 2); ctx.stroke()
      } else if (ann.type === 'arrow' && ann.points.length >= 2) {
        const p0 = ann.points[0], p1 = ann.points[ann.points.length - 1]
        ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke()
        const ang = Math.atan2(p1.y - p0.y, p1.x - p0.x)
        const hl = 14
        ctx.beginPath()
        ctx.moveTo(p1.x, p1.y)
        ctx.lineTo(p1.x - hl * Math.cos(ang - 0.4), p1.y - hl * Math.sin(ang - 0.4))
        ctx.lineTo(p1.x - hl * Math.cos(ang + 0.4), p1.y - hl * Math.sin(ang + 0.4))
        ctx.closePath(); ctx.fill()
      }
      ctx.globalAlpha = 1; ctx.lineCap = 'butt'; ctx.lineJoin = 'miter'
    })

    // Canvas border
    ctx.strokeStyle = 'rgba(34,211,238,0.09)'; ctx.lineWidth = 1.5
    ctx.strokeRect(0.75, 0.75, W - 1.5, H - 1.5)
  }, [
    annotations, annotColor, bgImage, deadAt, focusPlayer, frames, kills, roundIdx,
    showDeaths, showDirections, showHeatmap, showNames, showTrails,
    team1Name, teamOf, toXY, visibleGrenades, smokeRadius, heRadius, flashRadius, currentRound, mapCfg,
  ])

  // ── Animation loop ─────────────────────────────────────────────────────
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
  useEffect(() => { setTime(startOffset); setIsPlaying(false); setFocusPlayer(null) }, [roundIdx]) // eslint-disable-line
  useEffect(() => { onPlaybackChange?.(time, isPlaying) }, [time, isPlaying, onPlaybackChange])

  const toggle  = useCallback(() => { if (time >= maxTime) setTime(startOffset); setIsPlaying(p => !p) }, [time, maxTime, startOffset])
  const restart = () => { setTime(startOffset); setIsPlaying(false) }

  // Keyboard shortcuts
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.code === 'Space')      { e.preventDefault(); toggle() }
      if (e.code === 'ArrowLeft')  { e.preventDefault(); setIsPlaying(false); setTime(t => Math.max(startOffset, t - 2)) }
      if (e.code === 'ArrowRight') { e.preventDefault(); setIsPlaying(false); setTime(t => Math.min(maxTime, t + 2)) }
      if (e.code === 'ArrowUp')    { e.preventDefault(); setRoundIdx(i => Math.min(rounds.length - 1, i + 1)) }
      if (e.code === 'ArrowDown')  { e.preventDefault(); setRoundIdx(i => Math.max(0, i - 1)) }
      if (e.key  === 'Escape')     { setFocusPlayer(null); setActiveTool('select') }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [toggle, maxTime, rounds.length, startOffset])

  // ── Canvas mouse handlers ────────────────────────────────────────────────
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const pt = getCanvasPoint(e)
    if (activeTool === 'select') {
      let nearest: string | null = null, minDist = 12
      playerPosRef.current.forEach((p, name) => {
        if (!p.alive) return
        const d = Math.hypot(p.x - pt.x, p.y - pt.y)
        if (d < minDist) { minDist = d; nearest = name }
      })
      setFocusPlayer(nearest)
    } else {
      inProgressRef.current = { type: activeTool, start: pt, current: pt, path: [pt] }
    }
  }, [activeTool, getCanvasPoint])

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const pt = getCanvasPoint(e)
    setMousePos({ x: e.clientX, y: e.clientY })

    if (inProgressRef.current) {
      inProgressRef.current.current = pt
      if (inProgressRef.current.type === 'pen') inProgressRef.current.path.push(pt)
      draw(time)
      return
    }
    if (activeTool === 'select') {
      let nearest: string | null = null, minDist = 12
      playerPosRef.current.forEach((p, name) => {
        if (!p.alive) return
        const d = Math.hypot(p.x - pt.x, p.y - pt.y)
        if (d < minDist) { minDist = d; nearest = name }
      })
      setHoveredPlayer(nearest)
    }
  }, [activeTool, draw, getCanvasPoint, time])

  const handleCanvasMouseUp = useCallback(() => {
    if (!inProgressRef.current) return
    const ip = inProgressRef.current
    const points = ip.type === 'pen' ? ip.path : [ip.start, ip.current]
    if (points.length >= 2 && Math.hypot(ip.current.x - ip.start.x, ip.current.y - ip.start.y) > 3) {
      const ann: Annotation = { id: crypto.randomUUID(), type: ip.type, points, color: annotColor }
      setAnnotations(prev => ({ ...prev, [roundIdx]: [...(prev[roundIdx] ?? []), ann] }))
    }
    inProgressRef.current = null
    draw(time)
  }, [annotColor, draw, roundIdx, time])

  const handleCanvasMouseLeave = useCallback(() => {
    if (inProgressRef.current) handleCanvasMouseUp()
    setHoveredPlayer(null)
  }, [handleCanvasMouseUp])

  // ── Guards ────────────────────────────────────────────────────────────────
  if (!rounds.length) return <p className="text-muted-foreground text-sm">No replay data available.</p>

  const annotCount      = annotations[roundIdx]?.length ?? 0
  const hoverStats      = hoveredPlayer ? players.find(p => p.name === hoveredPlayer) : null
  const hoverRoundKills = hoveredPlayer ? kills.filter(k => k.killer_name === hoveredPlayer && k.time <= time).length : 0

  // ── Tool button helper ────────────────────────────────────────────────────
  const ToolBtn = ({ tool, icon, tip }: { tool: AnnotationTool; icon: ReactNode; tip: string }) => (
    <button
      onClick={() => setActiveTool(tool)}
      title={tip}
      className="flex items-center justify-center h-8 rounded-md transition-all"
      style={{
        border: '1px solid',
        borderColor: activeTool === tool ? 'color-mix(in srgb, var(--accent) 40%, transparent)' : 'var(--border)',
        background: activeTool === tool ? 'color-mix(in srgb, var(--accent) 14%, transparent)' : 'transparent',
        color: activeTool === tool ? 'var(--accent)' : 'var(--faint)',
      }}
    >
      {icon}
    </button>
  )

  return (
    <div
      className="flex flex-col rounded-xl overflow-hidden select-none"
      style={{
        border: '1px solid var(--border)',
        background: 'var(--bg)',
        boxShadow: '0 4px 32px rgba(0,0,0,0.4)',
      }}
    >

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <header
        className="flex items-center gap-3 px-4 py-2.5 flex-shrink-0"
        style={{
          borderBottom: '1px solid var(--border)',
          background: 'color-mix(in srgb, var(--card) 80%, transparent)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        {/* Map badge + round counter */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className="text-[11px] font-black tracking-[0.14em] uppercase px-2.5 py-1 rounded-lg"
            style={{
              fontFamily: 'var(--font-display)',
              background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
              border: '1px solid color-mix(in srgb, var(--accent) 22%, transparent)',
              color: 'var(--accent)',
            }}
          >
            {mapName.replace('de_', '')}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
            R<span>{currentRound?.number ?? roundIdx + 1}</span>
            <span style={{ color: 'var(--faint)', fontSize: 11 }}>/{rounds.length}</span>
          </span>
          {currentRound?.bomb_planted && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md font-mono animate-pulse"
              style={{ background: 'color-mix(in srgb, var(--tside) 15%, transparent)', color: 'var(--tside)', border: '1px solid color-mix(in srgb, var(--tside) 30%, transparent)' }}>
              BOMB
            </span>
          )}
          {!hasFrames && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-md"
              style={{ color: 'var(--muted)', border: '1px solid var(--border)', fontFamily: 'var(--font-mono)' }}>
              kill-only
            </span>
          )}
        </div>

        {/* Round type filter */}
        <div className="flex items-center gap-0.5 rounded-lg p-0.5" style={{ background: 'var(--card-2)' }}>
          {(['all', 'pistol', 'eco', 'force', 'full'] as RoundFilter[]).map(f => (
            <button
              key={f}
              onClick={() => setRoundFilter(f)}
              className="px-2 py-0.5 rounded-md transition-all"
              style={{
                fontSize: 10, fontFamily: 'var(--font-mono)',
                background: roundFilter === f ? 'var(--elevated)' : 'transparent',
                color: roundFilter === f ? 'var(--text)' : 'var(--faint)',
                fontWeight: roundFilter === f ? 700 : 400,
                border: roundFilter === f ? '1px solid var(--border)' : '1px solid transparent',
              }}
            >
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Score */}
        <div className="flex items-center gap-2 tabular-nums">
          <span className="text-[11px] truncate max-w-[90px] font-semibold" style={{ color: T1_COLOR + 'cc', fontFamily: 'var(--font-ui)' }}>{team1Name}</span>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl" style={{ background: 'var(--card-2)', border: '1px solid var(--border)' }}>
            <span className="text-[24px] font-black leading-none" style={{ color: T1_COLOR, fontFamily: 'var(--font-display)' }}>{roundScore.t1}</span>
            <span style={{ color: 'var(--faint)', fontSize: 14 }}>:</span>
            <span className="text-[24px] font-black leading-none" style={{ color: T2_COLOR, fontFamily: 'var(--font-display)' }}>{roundScore.t2}</span>
          </div>
          <span className="text-[11px] truncate max-w-[90px] font-semibold" style={{ color: T2_COLOR + 'cc', fontFamily: 'var(--font-ui)' }}>{team2Name}</span>
        </div>
      </header>

      {/* ── ROUND NAVIGATION ────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-1 px-3 py-1.5 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}
      >
        <button
          onClick={() => setRoundIdx(i => Math.max(0, i - 1))}
          disabled={roundIdx === 0}
          className="flex-shrink-0 disabled:opacity-20 transition-colors"
          style={{ padding: 4, borderRadius: 6, border: '1px solid var(--border)', color: 'var(--muted)', background: 'transparent' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)' }}
        >
          <ChevronLeft size={12} />
        </button>

        <div ref={roundBarRef} className="flex gap-0.5 overflow-x-auto flex-1 min-w-0 py-0.5" style={{ scrollbarWidth: 'none' }}>
          {rounds.map((r, i) => {
            const type    = getRoundType(r, i)
            const hidden  = roundFilter !== 'all' && type !== roundFilter
            const active  = roundIdx === i
            const isPistol = type === 'pistol'
            return (
              <button
                key={i}
                data-active={active ? 'true' : 'false'}
                onClick={() => setRoundIdx(i)}
                title={`R${r.number} (${type}) — ${r.winner}`}
                className="relative flex-shrink-0 w-7 h-7 transition-all duration-100"
                style={{
                  fontSize: 10, fontFamily: 'var(--font-mono)',
                  borderRadius: 6, border: '1px solid',
                  opacity: hidden ? 0.18 : 1,
                  fontWeight: active ? 700 : 400,
                  background: active
                    ? 'color-mix(in srgb, var(--accent) 18%, transparent)'
                    : 'transparent',
                  borderColor: active
                    ? 'color-mix(in srgb, var(--accent) 45%, transparent)'
                    : isPistol && !active
                      ? 'rgba(251,191,36,0.22)'
                      : 'var(--border)',
                  color: active ? 'var(--accent)' : 'var(--faint)',
                  boxShadow: active ? '0 0 8px color-mix(in srgb, var(--accent) 25%, transparent)' : 'none',
                }}
              >
                {r.number}
                <span
                  className="absolute bottom-[2px] left-1/2 -translate-x-1/2 w-[3px] h-[3px] rounded-full"
                  style={{
                    background: isPistol ? '#fbbf24'
                      : r.winner === team1Name ? T1_COLOR + 'aa'
                      : T2_COLOR + 'aa'
                  }}
                />
              </button>
            )
          })}
        </div>

        <button
          onClick={() => setRoundIdx(i => Math.min(rounds.length - 1, i + 1))}
          disabled={roundIdx === rounds.length - 1}
          className="flex-shrink-0 disabled:opacity-20 transition-colors"
          style={{ padding: 4, borderRadius: 6, border: '1px solid var(--border)', color: 'var(--muted)', background: 'transparent' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)' }}
        >
          <ChevronRight size={12} />
        </button>
      </div>

      {/* ── MAIN BODY ───────────────────────────────────────────────────────── */}
      <div className="flex min-h-0" style={{ minHeight: 560 }}>

        {/* Left collapse strip */}
        <button
          onClick={() => setLeftOpen(v => !v)}
          title={leftOpen ? 'Hide controls' : 'Show controls'}
          className="w-5 flex-shrink-0 flex items-center justify-center transition-all"
          style={{ borderRight: '1px solid var(--border)', color: 'var(--faint)', background: 'var(--card)' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'var(--elevated)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--faint)'; e.currentTarget.style.background = 'var(--card)' }}
        >
          <ChevronLeft
            size={11}
            style={{ transform: leftOpen ? 'none' : 'rotate(180deg)', transition: 'transform 0.2s' }}
          />
        </button>

        {/* ── LEFT PANEL ──────────────────────────────────────────────────── */}
        {leftOpen && (
          <aside
            className="w-[192px] flex-shrink-0 flex flex-col overflow-y-auto"
            style={{ borderRight: '1px solid var(--border)', background: 'var(--card)', scrollbarWidth: 'none' }}
          >
            {/* Layers */}
            <div className="px-3 pt-3 pb-2">
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] mb-2" style={{ color: 'var(--faint)' }}>Layers</p>

              {/* Grenades: compact 2×2 grid */}
              <div className="grid grid-cols-2 gap-1 mb-1">
                {([
                  { label: 'Smokes',   active: showSmokes,   toggle: () => setShowSmokes(v=>!v),   color: GREN_COLORS.smoke,   icon: <Wind size={9}/>,   count: grenadeCount.smoke   },
                  { label: 'Flashes',  active: showFlashes,  toggle: () => setShowFlashes(v=>!v),  color: GREN_COLORS.flash,   icon: <Zap size={9}/>,    count: grenadeCount.flash   },
                  { label: 'Molotovs', active: showMolotovs, toggle: () => setShowMolotovs(v=>!v), color: GREN_COLORS.molotov, icon: <Flame size={9}/>,  count: grenadeCount.molotov },
                  { label: 'HE Nades', active: showHE,       toggle: () => setShowHE(v=>!v),       color: GREN_COLORS.he,      icon: <Circle size={9}/>, count: grenadeCount.he      },
                ] as const).map(({ label, active, toggle, color, icon, count }) => (
                  <button
                    key={label}
                    onClick={toggle}
                    className={cn(
                      'flex flex-col items-start gap-0.5 px-2 py-1.5 rounded border text-left transition-all',
                      active ? 'bg-white/[0.07] border-white/[0.12]' : 'border-white/[0.04] hover:border-white/[0.08] hover:bg-white/[0.03]',
                    )}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span style={{ color: active ? color : 'rgba(255,255,255,0.25)' }}>{icon}</span>
                      {count > 0 && (
                        <span className="text-[8px] font-mono tabular-nums" style={{ color: active ? color + 'bb' : 'rgba(255,255,255,0.18)' }}>
                          {count}
                        </span>
                      )}
                    </div>
                    <span className="text-[9px] font-medium leading-none" style={{ color: active ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.28)' }}>
                      {label}
                    </span>
                  </button>
                ))}
              </div>

              {/* Other layer toggles */}
              {([
                { label: 'Trails',     active: showTrails,     toggle: () => setShowTrails(v=>!v),     icon: <Minus size={9}/> },
                { label: 'Names',      active: showNames,       toggle: () => setShowNames(v=>!v),       icon: <Tag size={9}/> },
                { label: 'Deaths',     active: showDeaths,      toggle: () => setShowDeaths(v=>!v),      icon: <Skull size={9}/> },
                { label: 'Directions', active: showDirections,  toggle: () => setShowDirections(v=>!v),  icon: <ArrowRight size={9}/> },
              ] as const).map(({ label, active, toggle, icon }) => (
                <button
                  key={label}
                  onClick={toggle}
                  className="w-full flex items-center gap-2 px-2 py-1 rounded text-[10px] font-medium transition-all"
                  style={{ color: active ? 'var(--text)' : 'var(--faint)' }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--muted)' }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--faint)' }}
                >
                  <span>{icon}</span>
                  <span className="flex-1 text-left">{label}</span>
                  {active
                    ? <Eye size={8} style={{ opacity: 0.35, flexShrink: 0 }} />
                    : <EyeOff size={8} style={{ opacity: 0.18, flexShrink: 0 }} />}
                </button>
              ))}

              {/* Heatmap toggle */}
              <button
                onClick={() => setShowHeatmap(v => !v)}
                className="w-full flex items-center gap-2 px-2 py-1 rounded text-[10px] font-medium transition-all mt-0.5"
                style={{
                  background: showHeatmap ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'transparent',
                  border: showHeatmap ? '1px solid color-mix(in srgb, var(--accent) 22%, transparent)' : '1px solid transparent',
                  color: showHeatmap ? 'var(--accent)' : 'var(--faint)',
                }}
              >
                <Activity size={9} />
                <span className="flex-1 text-left">Heatmap</span>
                {!hasFrames && <span className="text-[8px]" style={{ color: 'var(--muted)' }}>no data</span>}
              </button>
            </div>

            <div className="mx-3" style={{ borderTop: '1px solid var(--border)' }} />

            {/* Draw tools */}
            <div className="px-3 pt-2.5 pb-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] mb-2" style={{ color: 'var(--faint)' }}>Draw</p>
              <div className="grid grid-cols-3 gap-1 mb-2.5">
                <ToolBtn tool="select" icon={<MousePointer size={12}/>} tip="Select / Focus player" />
                <ToolBtn tool="pen"    icon={<Pencil size={12}/>}       tip="Freehand pen" />
                <ToolBtn tool="line"   icon={<Minus size={12}/>}        tip="Straight line" />
                <ToolBtn tool="arrow"  icon={<ArrowRight size={12}/>}   tip="Arrow" />
                <ToolBtn tool="circle" icon={<Circle size={12}/>}       tip="Circle" />
                <button
                  onClick={() => setAnnotations(prev => ({ ...prev, [roundIdx]: [] }))}
                  disabled={annotCount === 0}
                  title="Clear annotations"
                  className="flex items-center justify-center h-8 rounded-md border border-red-500/20 text-red-400/45 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-15 transition-all"
                >
                  <Trash2 size={12} />
                </button>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {['#ff4466', '#22d3ee', '#fbbf24', '#a3e635', '#e879f9', '#ffffff'].map(c => (
                  <button
                    key={c}
                    onClick={() => setAnnotColor(c)}
                    className={cn('w-4 h-4 rounded-full border-2 transition-all', annotColor === c ? 'border-white scale-110' : 'border-transparent opacity-45 hover:opacity-80')}
                    style={{ background: c }}
                  />
                ))}
              </div>
              {annotCount > 0 && (
                <p className="text-[9px] text-muted-foreground/28 mt-1.5 font-mono">{annotCount} annotation{annotCount !== 1 ? 's' : ''}</p>
              )}
            </div>

            {/* Focus player badge */}
            {focusPlayer && (
              <>
                <div className="mx-3" style={{ borderTop: '1px solid var(--border)' }} />
                <div className="px-3 py-2.5">
                  <p className="text-[9px] font-bold uppercase tracking-[0.16em] mb-1.5" style={{ color: 'var(--faint)' }}>Focus</p>
                  <div
                    className="flex items-center gap-1.5 px-2 py-1.5 rounded"
                    style={{ background: 'color-mix(in srgb, var(--signal) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--signal) 22%, transparent)' }}
                  >
                    <Crosshair size={10} style={{ color: 'var(--signal)', flexShrink: 0 }} />
                    <span className="text-[10px] truncate flex-1" style={{ fontFamily: 'var(--font-mono)', color: 'var(--signal)' }}>{focusPlayer}</span>
                    <button onClick={() => setFocusPlayer(null)} className="text-xs leading-none" style={{ color: 'var(--faint)' }}>✕</button>
                  </div>
                </div>
              </>
            )}
          </aside>
        )}

        {/* ── CANVAS AREA ─────────────────────────────────────────────────── */}
        <div className="flex-1 flex items-center justify-center relative overflow-hidden p-3 min-w-0" style={{ background: 'var(--bg)' }}>
          <canvas
            ref={canvasRef}
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            className={cn(activeTool !== 'select' ? 'cursor-crosshair' : 'cursor-default')}
            style={{
              width: '100%', maxWidth: CANVAS_SIZE, aspectRatio: '1 / 1',
              borderRadius: 12,
              border: '1px solid color-mix(in srgb, var(--accent) 15%, var(--border))',
              boxShadow: '0 0 40px color-mix(in srgb, var(--accent) 6%, transparent), 0 4px 24px rgba(0,0,0,0.4)',
            }}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseLeave}
          />

          {/* Hover tooltip */}
          {hoveredPlayer && (
            <div
              className="fixed z-50 bg-[#0d0f1c] border border-white/[0.12] rounded-xl px-3 py-2.5 pointer-events-none shadow-2xl"
              style={{ left: mousePos.x + 14, top: mousePos.y - 64 }}
            >
              <div className="font-bold text-[12px] mb-0.5" style={{ color: hoverStats?.team === team1Name ? T1_COLOR : T2_COLOR }}>
                {hoveredPlayer}
              </div>
              {hoverStats && (
                <div className="text-muted-foreground/60 font-mono text-[10px]">
                  {hoverStats.kills}K / {hoverStats.deaths}D / {hoverStats.assists}A
                  <span className="ml-1.5 text-muted-foreground/35">· {(hoverStats.adr ?? 0).toFixed(0)} ADR</span>
                </div>
              )}
              <div className="text-[10px] mt-0.5 text-muted-foreground/40">
                This round: <span className="font-mono text-foreground/65">{hoverRoundKills} kills</span>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT PANEL ─────────────────────────────────────────────────── */}
        {rightOpen && (
          <aside className="w-[240px] flex-shrink-0 flex flex-col overflow-hidden" style={{ borderLeft: '1px solid var(--border)', background: 'var(--card)' }}>

            {/* Tabs */}
            <div className="flex flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
              <button
                onClick={() => setRightTab('players')}
                className="flex-1 py-2 transition-all"
                style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                  fontFamily: 'var(--font-ui)',
                  color: rightTab === 'players' ? 'var(--text)' : 'var(--faint)',
                  borderBottom: rightTab === 'players' ? '2px solid var(--signal)' : '2px solid transparent',
                  marginBottom: -1,
                }}
              >
                Players
              </button>
              <button
                onClick={() => setRightTab('kills')}
                className="flex-1 py-2 transition-all flex items-center justify-center gap-1.5"
                style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                  fontFamily: 'var(--font-ui)',
                  color: rightTab === 'kills' ? 'var(--text)' : 'var(--faint)',
                  borderBottom: rightTab === 'kills' ? '2px solid var(--loss)' : '2px solid transparent',
                  marginBottom: -1,
                }}
              >
                Kill Feed
                {kills.length > 0 && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, opacity: 0.55 }}>
                    {pastKills.length}/{kills.length}
                  </span>
                )}
              </button>
            </div>

            {/* Players tab */}
            {rightTab === 'players' && (
              <div className="flex-1 overflow-y-auto p-3" style={{ scrollbarWidth: 'none' }}>
                <div className="grid grid-cols-2 gap-x-3">
                  {[
                    { list: team1Players, color: T1_COLOR, teamName: team1Name },
                    { list: team2Players, color: T2_COLOR, teamName: team2Name },
                  ].map(({ list, color, teamName }) => (
                    <div key={teamName}>
                      <div className="flex items-center gap-1 mb-2">
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
                        <span className="text-[9px] font-semibold truncate flex-1" style={{ color: color + 'bb' }}>{teamName}</span>
                        <span className="text-[9px] tabular-nums font-bold" style={{ color }}>
                          {list.filter(p => aliveStatus.get(p.name) !== false).length}
                          <span className="text-muted-foreground/30 font-normal">/{list.length}</span>
                        </span>
                      </div>
                      {list.map(p => {
                        const alive   = aliveStatus.get(p.name) !== false
                        const focused = focusPlayer === p.name
                        const hp      = playerPosRef.current.get(p.name)?.health
                        const hpPct   = hp !== undefined ? Math.max(0, Math.min(100, hp)) : alive ? 100 : 0
                        const hpCol   = hpPct > 60 ? '#4ade80' : hpPct > 30 ? '#fbbf24' : '#f87171'
                        return (
                          <button
                            key={p.name}
                            onClick={() => setFocusPlayer(focused ? null : p.name)}
                            className={cn(
                              'w-full flex flex-col gap-0.5 py-1 px-1.5 rounded text-left transition-all mb-0.5 border',
                              !alive && 'opacity-22',
                              focused ? 'bg-cyan-500/10 border-cyan-500/20' : 'border-transparent hover:bg-white/[0.04]',
                            )}
                          >
                            <div className="flex items-center gap-1">
                              {alive
                                ? <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
                                : <Skull size={8} className="text-muted-foreground/40 flex-shrink-0" />
                              }
                              <span className="text-[10px] font-mono truncate flex-1 min-w-0" style={{ color: alive ? color + 'bb' : undefined }}>
                                {p.name}
                              </span>
                            </div>
                            {hasFrames && (
                              <div className="w-full h-[3px] rounded-full bg-white/[0.07] overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-300"
                                  style={{ width: `${hpPct}%`, background: alive ? hpCol : 'transparent' }} />
                              </div>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Kill Feed tab */}
            {rightTab === 'kills' && (
              <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-0.5" style={{ scrollbarWidth: 'thin' }}>
                {kills.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground/35 p-2">No kills this round.</p>
                ) : kills.map((k, i) => {
                  const past     = k.time <= time
                  const isActive = k.time <= time && k.time > time - KILL_FLASH
                  const kT1      = teamOf.get(k.killer_name) === team1Name
                  const vT1      = teamOf.get(k.victim_name) === team1Name
                  return (
                    <button
                      key={i}
                      onClick={() => { setIsPlaying(false); setTime(k.time) }}
                      className={cn(
                        'w-full flex items-center gap-1 px-2 py-1.5 rounded text-left border transition-all',
                        isActive ? 'bg-yellow-500/10 border-yellow-400/20' : 'border-transparent hover:bg-white/[0.04]',
                        past ? 'opacity-100' : 'opacity-15',
                      )}
                    >
                      <span className="text-[8px] text-muted-foreground/35 w-6 flex-shrink-0 tabular-nums font-mono">{k.time.toFixed(0)}s</span>
                      <span className="truncate text-[10px] font-mono min-w-0" style={{ color: kT1 ? T1_COLOR + 'cc' : T2_COLOR + 'cc', flex: '1 1 0' }}>
                        {k.killer_name}
                      </span>
                      <span className="flex-shrink-0 text-[8px] text-muted-foreground/30">{k.headshot ? '⦿' : '›'}</span>
                      <span className="truncate text-[10px] font-mono min-w-0" style={{ color: vT1 ? T1_COLOR + 'cc' : T2_COLOR + 'cc', flex: '1 1 0' }}>
                        {k.victim_name}
                      </span>
                      <span className="flex-shrink-0 text-[8px] text-muted-foreground/35 bg-white/[0.05] px-1 rounded font-mono">
                        {abbrevWeapon(k.weapon)}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </aside>
        )}

        {/* Right collapse strip */}
        <button
          onClick={() => setRightOpen(v => !v)}
          title={rightOpen ? 'Hide stats' : 'Show stats'}
          className="w-5 flex-shrink-0 flex items-center justify-center transition-all"
          style={{ borderLeft: '1px solid var(--border)', color: 'var(--faint)', background: 'var(--card)' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'var(--elevated)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--faint)'; e.currentTarget.style.background = 'var(--card)' }}
        >
          <ChevronRight
            size={11}
            style={{ transform: rightOpen ? 'none' : 'rotate(180deg)', transition: 'transform 0.2s' }}
          />
        </button>
      </div>

      {/* ── CONTROLS ────────────────────────────────────────────────────────── */}
      <div
        className="px-4 pt-2.5 pb-3 space-y-2 flex-shrink-0"
        style={{ borderTop: '1px solid var(--border)', background: 'var(--card)' }}
      >

        {/* Event marker track */}
        <div className="relative h-3.5 mx-0.5">
          {kills.map((k, i) => (
            <button
              key={i}
              onClick={() => { setIsPlaying(false); setTime(k.time) }}
              title={`${k.killer_name} → ${k.victim_name} (${k.time.toFixed(1)}s)`}
              className="absolute top-0.5 h-2.5 w-0.5 rounded-full cursor-pointer hover:scale-x-[3] transition-transform"
              style={{
                left: `${(k.time / maxTime) * 100}%`,
                transform: 'translateX(-50%)',
                background: k.time <= time ? '#ff4466' : 'rgba(255,68,102,0.18)',
              }}
            />
          ))}
          {visibleGrenades.filter(g => g.land_time > 0 && g.land_time <= maxTime).map((g, i) => (
            <div
              key={i}
              className="absolute top-1.5 w-1 h-1 rounded-full pointer-events-none"
              style={{
                left: `${(g.land_time / maxTime) * 100}%`,
                transform: 'translateX(-50%)',
                background: (GREN_COLORS[g.type] ?? '#fff') + '66',
              }}
            />
          ))}
        </div>

        {/* Scrubber */}
        <input
          type="range"
          min={startOffset}
          max={maxTime}
          step={0.05}
          value={time}
          onChange={e => { setIsPlaying(false); setTime(parseFloat(e.target.value)) }}
          className="w-full h-1.5 cursor-pointer rounded-full"
          style={{ accentColor: T1_COLOR }}
        />

        {/* Controls row */}
        <div className="flex items-center gap-2">
          <button
            onClick={restart}
            title="Restart"
            className="flex-shrink-0 transition-all"
            style={{ padding: '6px', borderRadius: 8, border: '1px solid var(--border)', color: 'var(--muted)', background: 'transparent' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--border-2)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.borderColor = 'var(--border)' }}
          >
            <RotateCcw size={13} />
          </button>

          <button
            onClick={toggle}
            className="flex items-center gap-2 rounded-full font-semibold border-none flex-shrink-0 transition-all"
            style={{
              padding: '7px 20px', fontSize: 13,
              background: 'linear-gradient(180deg, var(--accent), var(--accent-deep))',
              color: '#fff',
              boxShadow: '0 2px 12px color-mix(in srgb, var(--accent) 35%, transparent)',
            }}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            {isPlaying ? 'Pause' : 'Play'}
          </button>

          <div className="flex rounded-full overflow-hidden flex-shrink-0" style={{ border: '1px solid var(--border)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
            {([0.5, 1, 2, 4] as SpeedValue[]).map(s => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className="transition-colors"
                style={{
                  padding: '4px 10px',
                  background: speed === s ? 'color-mix(in srgb, var(--accent) 18%, transparent)' : 'transparent',
                  color: speed === s ? 'var(--accent)' : 'var(--faint)',
                  fontWeight: speed === s ? 700 : 400,
                }}
              >
                {s}×
              </button>
            ))}
          </div>

          <span className="tabular-nums" style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>
            {time.toFixed(1)}<span style={{ opacity: 0.4 }}>s / </span>{maxTime.toFixed(1)}<span style={{ opacity: 0.4 }}>s</span>
          </span>

          <div className="flex-1" />

          <button
            onClick={toggleRecord}
            disabled={recordState === 'processing'}
            className="flex items-center gap-1.5 rounded-full transition-all flex-shrink-0"
            style={{
              padding: '6px 12px', fontSize: 11,
              background: recordState === 'recording' ? 'color-mix(in srgb, var(--loss) 12%, transparent)' : 'var(--elevated)',
              border: `1px solid ${recordState === 'recording' ? 'color-mix(in srgb, var(--loss) 30%, transparent)' : 'var(--border)'}`,
              color: recordState === 'recording' ? 'var(--loss)' : 'var(--muted)',
            }}
          >
            {recordState === 'recording' ? <><StopCircle size={12}/>Stop</> : <><Video size={12}/>Clip</>}
          </button>
        </div>

        {/* Keyboard hints + legend */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5" style={{ fontSize: 9, color: 'var(--faint)' }}>
          {[['Space','play/pause'],['← →','±2s'],['↑ ↓','rounds'],['Esc','reset']].map(([k,v]) => (
            <span key={k}>
              <kbd style={{ background: 'var(--card-2)', border: '1px solid var(--border)', padding: '1px 4px', borderRadius: 4, fontSize: 8, color: 'var(--muted)' }}>{k}</kbd> {v}
            </span>
          ))}
          <div className="flex items-center gap-3 ml-auto">
            <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full" style={{ background: T1_COLOR }}/><span style={{ color: T1_COLOR + '66' }}>{team1Name}</span></div>
            <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full" style={{ background: T2_COLOR }}/><span style={{ color: T2_COLOR + '66' }}>{team2Name}</span></div>
            {hasFrames
              ? <span style={{ color: 'var(--faint)' }}>{frames.length} frames</span>
              : <span style={{ color: 'var(--faint)' }}>kill-only replay</span>
            }
          </div>
        </div>
      </div>

    </div>
  )
}
