'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Loader2, RotateCcw, Play, Pause, Volume2, VolumeX } from 'lucide-react'
import { MAP_CONFIGS, loadMapImage, worldToCanvas, type MapConfig } from '@/lib/map-config'
import type { ParsedDemoData, PositionFrame, Round, GrenadeEvent, GameEvent, Json } from '@/types/database'
import { cn } from '@/lib/utils'

// ── Constants ──────────────────────────────────────────────────────────────────
const MAP_PLANE      = 20
const NEON           = 0x00ff87
const RED            = 0xff3355
const DEAD_COLOR     = 0x3a3a4a
const P_RADIUS       = 0.22
const P_LENGTH       = 0.40
const P_TOTAL_H      = P_LENGTH + 2 * P_RADIUS

const TRAIL_SECS     = 2.5
const TRAIL_STEP     = 0.06
const MAX_TRAIL      = 80

const SMOKE_COL      = 0x7799dd
const FLASH_COL      = 0xffff88
const HE_COL         = 0xff8822
const MOLOTOV_COL    = 0xff4411
const KILL_COL       = 0xff2244
const BOMB_COL       = 0xff5500
const BOMB_DEFUSE_COL = 0x00dd88

const SMOKE_DUR      = 18
const FLASH_DUR      = 2.5
const HE_DUR         = 1.8
const MOLOTOV_DUR    = 7
const KILL_SECS      = 2.5
const BOMB_TIMER     = 40   // CS2 default bomb timer
const GRENADE_LIFT   = 1.5  // parabola peak height multiplier

// ── 3D Map Geometry ────────────────────────────────────────────────────────────
// Regions defined in normalised UV coords [0–1] matching the radar image.
// u/v (0,0) = top-left, (1,1) = bottom-right.
// y  = floor surface height in scene units (players walk here).
// h  = visual height of the geometry box in scene units.
// 'platform' boxes extend downward from y; 'wall' boxes extend upward from y.

interface GeoRegion {
  u0: number; v0: number; u1: number; v1: number
  y:  number   // floor surface height (scene units)
  h:  number   // box visual height (scene units)
  type: 'platform' | 'wall'
}

const MAP_3D_GEO: Record<string, GeoRegion[]> = {
  de_dust2: [
    // platforms
    { u0: 0.50, v0: 0.26, u1: 0.66, v1: 0.52, y: 0.55, h: 0.10, type: 'platform' }, // catwalk / short-A
    { u0: 0.60, v0: 0.05, u1: 0.85, v1: 0.44, y: 0.32, h: 0.10, type: 'platform' }, // A site
    { u0: 0.72, v0: 0.42, u1: 0.96, v1: 0.66, y: 0.30, h: 0.10, type: 'platform' }, // CT spawn
    { u0: 0.38, v0: 0.32, u1: 0.56, v1: 0.58, y: 0.14, h: 0.08, type: 'platform' }, // mid lower
    { u0: 0.06, v0: 0.42, u1: 0.36, v1: 0.70, y: 0.18, h: 0.08, type: 'platform' }, // B site
    // walls
    { u0: 0.10, v0: 0.04, u1: 0.58, v1: 0.13, y: 0,    h: 1.40, type: 'wall' }, // long-A top wall
    { u0: 0.82, v0: 0.04, u1: 0.90, v1: 0.45, y: 0,    h: 1.40, type: 'wall' }, // A-site right wall
    { u0: 0.44, v0: 0.40, u1: 0.55, v1: 0.50, y: 0.14, h: 0.75, type: 'wall' }, // mid box
    { u0: 0.28, v0: 0.60, u1: 0.44, v1: 0.69, y: 0,    h: 0.95, type: 'wall' }, // B-tunnels passage
  ],
  de_mirage: [
    { u0: 0.04, v0: 0.25, u1: 0.34, v1: 0.60, y: 0.38, h: 0.10, type: 'platform' }, // A site
    { u0: 0.04, v0: 0.58, u1: 0.28, v1: 0.80, y: 0.26, h: 0.10, type: 'platform' }, // ramp / palace
    { u0: 0.30, v0: 0.36, u1: 0.60, v1: 0.56, y: 0.14, h: 0.08, type: 'platform' }, // mid connector
    { u0: 0.65, v0: 0.45, u1: 0.90, v1: 0.74, y: 0.08, h: 0.08, type: 'platform' }, // B site
    { u0: 0.46, v0: 0.60, u1: 0.67, v1: 0.82, y: 0.22, h: 0.08, type: 'platform' }, // CT spawn
    { u0: 0.03, v0: 0.24, u1: 0.10, v1: 0.62, y: 0,    h: 1.80, type: 'wall' }, // A-site left building
    { u0: 0.28, v0: 0.40, u1: 0.37, v1: 0.54, y: 0,    h: 1.20, type: 'wall' }, // jungle / connector wall
    { u0: 0.64, v0: 0.74, u1: 0.90, v1: 0.80, y: 0,    h: 1.50, type: 'wall' }, // B-site building
  ],
  de_inferno: [
    { u0: 0.60, v0: 0.10, u1: 0.88, v1: 0.46, y: 0.42, h: 0.10, type: 'platform' }, // A site
    { u0: 0.24, v0: 0.55, u1: 0.64, v1: 0.76, y: 0.05, h: 0.08, type: 'platform' }, // banana
    { u0: 0.10, v0: 0.34, u1: 0.38, v1: 0.60, y: 0.22, h: 0.08, type: 'platform' }, // B site
    { u0: 0.44, v0: 0.20, u1: 0.64, v1: 0.46, y: 0.28, h: 0.08, type: 'platform' }, // CT spawn / arch
    { u0: 0.12, v0: 0.70, u1: 0.50, v1: 0.92, y: 0.10, h: 0.08, type: 'platform' }, // T spawn
    { u0: 0.72, v0: 0.10, u1: 0.88, v1: 0.20, y: 0,    h: 2.00, type: 'wall' }, // A construction building
    { u0: 0.58, v0: 0.40, u1: 0.68, v1: 0.50, y: 0.42, h: 1.00, type: 'wall' }, // A balcony
    { u0: 0.10, v0: 0.34, u1: 0.20, v1: 0.48, y: 0,    h: 1.80, type: 'wall' }, // B-site building
  ],
  de_nuke: [
    { u0: 0.16, v0: 0.12, u1: 0.50, v1: 0.44, y:  0.65,  h: 0.10, type: 'platform' }, // upper / outer
    { u0: 0.16, v0: 0.44, u1: 0.50, v1: 0.75, y: -0.38,  h: 0.10, type: 'platform' }, // lower site
    { u0: 0.50, v0: 0.15, u1: 0.86, v1: 0.60, y:  0.22,  h: 0.08, type: 'platform' }, // outside / lobby
    { u0: 0.52, v0: 0.60, u1: 0.82, v1: 0.82, y:  0.42,  h: 0.08, type: 'platform' }, // CT / ramp
    { u0: 0.38, v0: 0.10, u1: 0.60, v1: 0.52, y:  0,     h: 2.50, type: 'wall' }, // silo
    { u0: 0.15, v0: 0.10, u1: 0.20, v1: 0.78, y:  0,     h: 1.80, type: 'wall' }, // reactor left wall
  ],
  de_ancient: [
    { u0: 0.60, v0: 0.15, u1: 0.85, v1: 0.46, y: 0.32, h: 0.10, type: 'platform' }, // A site
    { u0: 0.10, v0: 0.46, u1: 0.40, v1: 0.72, y: 0.26, h: 0.10, type: 'platform' }, // B site
    { u0: 0.35, v0: 0.30, u1: 0.62, v1: 0.54, y: 0.12, h: 0.08, type: 'platform' }, // mid
    { u0: 0.48, v0: 0.50, u1: 0.72, v1: 0.76, y: 0.22, h: 0.08, type: 'platform' }, // CT spawn
    { u0: 0.58, v0: 0.12, u1: 0.68, v1: 0.48, y: 0,    h: 1.50, type: 'wall' }, // A-site ruins wall
    { u0: 0.30, v0: 0.32, u1: 0.42, v1: 0.50, y: 0,    h: 1.20, type: 'wall' }, // mid ruins
  ],
  de_anubis: [
    { u0: 0.58, v0: 0.10, u1: 0.85, v1: 0.46, y:  0.32,  h: 0.10, type: 'platform' }, // A site
    { u0: 0.12, v0: 0.50, u1: 0.40, v1: 0.78, y:  0.22,  h: 0.10, type: 'platform' }, // B site
    { u0: 0.35, v0: 0.32, u1: 0.60, v1: 0.54, y:  0.10,  h: 0.08, type: 'platform' }, // mid
    { u0: 0.38, v0: 0.52, u1: 0.62, v1: 0.70, y: -0.18,  h: 0.08, type: 'platform' }, // water crossing
    { u0: 0.55, v0: 0.08, u1: 0.65, v1: 0.48, y:  0,     h: 1.40, type: 'wall' }, // temple walls
  ],
  de_overpass: [
    { u0: 0.14, v0: 0.56, u1: 0.44, v1: 0.82, y: -0.24, h: 0.10, type: 'platform' }, // A site (under bridge)
    { u0: 0.56, v0: 0.14, u1: 0.86, v1: 0.48, y:  0.62, h: 0.10, type: 'platform' }, // B site elevated
    { u0: 0.28, v0: 0.25, u1: 0.58, v1: 0.55, y: -0.14, h: 0.08, type: 'platform' }, // mid / water
    { u0: 0.12, v0: 0.08, u1: 0.50, v1: 0.28, y:  0.42, h: 0.08, type: 'platform' }, // T spawn upper
    { u0: 0.35, v0: 0.40, u1: 0.54, v1: 0.62, y:  0,    h: 2.00, type: 'wall' }, // bridge support
    { u0: 0.12, v0: 0.28, u1: 0.20, v1: 0.60, y:  0,    h: 1.60, type: 'wall' }, // A-site wall
  ],
  de_vertigo: [
    { u0: 0.55, v0: 0.14, u1: 0.88, v1: 0.50, y: 0.82, h: 0.10, type: 'platform' }, // A site
    { u0: 0.10, v0: 0.46, u1: 0.44, v1: 0.78, y: 0.80, h: 0.10, type: 'platform' }, // B site
    { u0: 0.38, v0: 0.32, u1: 0.60, v1: 0.52, y: 0.65, h: 0.08, type: 'platform' }, // mid scaffold
    { u0: 0.52, v0: 0.52, u1: 0.72, v1: 0.70, y: 0.52, h: 0.08, type: 'platform' }, // CT stairs
    { u0: 0.05, v0: 0.42, u1: 0.12, v1: 0.82, y: 0,    h: 2.00, type: 'wall' }, // left edge
    { u0: 0.86, v0: 0.12, u1: 0.96, v1: 0.54, y: 0,    h: 2.00, type: 'wall' }, // right edge
  ],
  de_train: [
    { u0: 0.55, v0: 0.10, u1: 0.85, v1: 0.45, y: 0.28, h: 0.10, type: 'platform' }, // A site
    { u0: 0.12, v0: 0.48, u1: 0.42, v1: 0.75, y: 0.22, h: 0.10, type: 'platform' }, // B site
    { u0: 0.35, v0: 0.28, u1: 0.60, v1: 0.52, y: 0.10, h: 0.08, type: 'platform' }, // mid / train yard
    { u0: 0.48, v0: 0.50, u1: 0.68, v1: 0.72, y: 0.20, h: 0.08, type: 'platform' }, // CT approach
    { u0: 0.10, v0: 0.28, u1: 0.38, v1: 0.40, y: 0,    h: 1.60, type: 'wall' }, // train cars row 1
    { u0: 0.55, v0: 0.48, u1: 0.82, v1: 0.58, y: 0,    h: 1.60, type: 'wall' }, // train cars row 2
  ],
}

// Returns the approximate floor height (scene Y) for a given 3D map position.
// Falls back to 0 for unmapped maps or positions outside any defined region.
function getMapFloorHeight(x3d: number, z3d: number, mapName: string): number {
  const regions = MAP_3D_GEO[mapName]
  if (!regions) return 0
  const u = x3d / MAP_PLANE + 0.5
  const v = z3d / MAP_PLANE + 0.5
  // Pick the smallest (most specific) platform region that contains this UV point
  let bestY = 0, bestArea = Infinity
  for (const r of regions) {
    if (r.type === 'wall') continue
    if (u >= r.u0 && u <= r.u1 && v >= r.v0 && v <= r.v1) {
      const area = (r.u1 - r.u0) * (r.v1 - r.v0)
      if (area < bestArea) { bestArea = area; bestY = r.y }
    }
  }
  return bestY
}

// Builds simplified 3D map structures into the scene.
// Returns all created objects so they can be disposed on cleanup.
function buildMapGeometry(mapName: string, scene: THREE.Scene): THREE.Object3D[] {
  const regions = MAP_3D_GEO[mapName] ?? []
  const objs: THREE.Object3D[] = []

  const platMat = new THREE.MeshStandardMaterial({
    color: 0x1c3d5e, emissive: new THREE.Color(0x0a1a2e), emissiveIntensity: 0.28,
    roughness: 0.88, transparent: true, opacity: 0.38,
    side: THREE.DoubleSide,
  })
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x0a1520, emissive: new THREE.Color(NEON), emissiveIntensity: 0.035,
    roughness: 0.92, transparent: true, opacity: 0.15,
    side: THREE.DoubleSide, depthWrite: false,
  })
  const platEdgeMat = new THREE.LineBasicMaterial({ color: NEON, transparent: true, opacity: 0.42 })
  const wallEdgeMat = new THREE.LineBasicMaterial({ color: NEON, transparent: true, opacity: 0.18 })

  for (const r of regions) {
    const sx0 = (r.u0 - 0.5) * MAP_PLANE
    const sz0 = (r.v0 - 0.5) * MAP_PLANE
    const sx1 = (r.u1 - 0.5) * MAP_PLANE
    const sz1 = (r.v1 - 0.5) * MAP_PLANE
    const cx  = (sx0 + sx1) / 2
    const cz  = (sz0 + sz1) / 2
    const w   = sx1 - sx0
    const d   = sz1 - sz0

    const geo = new THREE.BoxGeometry(w, r.h, d)

    if (r.type === 'platform') {
      // Box top face sits at y; center is at y - h/2
      const mat  = platMat.clone()
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(cx, r.y - r.h / 2, cz)
      mesh.receiveShadow = true
      scene.add(mesh); objs.push(mesh)
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), platEdgeMat.clone())
      edges.position.copy(mesh.position)
      scene.add(edges); objs.push(edges)
    } else {
      // Box bottom at y, top at y + h; center at y + h/2
      const mat  = wallMat.clone()
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(cx, r.y + r.h / 2, cz)
      scene.add(mesh); objs.push(mesh)
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), wallEdgeMat.clone())
      edges.position.copy(mesh.position)
      scene.add(edges); objs.push(edges)
    }
  }
  return objs
}

// ── Types ──────────────────────────────────────────────────────────────────────
export interface Replay3DProps {
  mapName: string
  parsed: ParsedDemoData | null
  team1?: string
  team2?: string
}

type UtilKey = 'smoke' | 'flash' | 'he' | 'molotov'
type UtilToggle = Record<UtilKey, boolean>

interface PlayerObj {
  group:        THREE.Group
  sprite:       THREE.Sprite
  bodyMat:      THREE.MeshStandardMaterial
  ringMat:      THREE.MeshStandardMaterial
  spriteMat:    THREE.SpriteMaterial
  trailLine:    THREE.Line
  trailGeo:     THREE.BufferGeometry
  trailPosArr:  Float32Array
  trailColArr:  Float32Array
  trailHistory: { t: number; x: number; y: number; z: number }[]
  teamR: number; teamG: number; teamB: number
  isMyTeam: boolean; alive: boolean
  dirArrow:    THREE.Mesh
  hpBarFg:     THREE.Mesh
  hpBarBg:     THREE.Mesh
  hpBarMat:    THREE.MeshBasicMaterial
  hpBarBgMat:  THREE.MeshBasicMaterial
}

interface UtilObj {
  group:      THREE.Group
  mainMat:    THREE.MeshStandardMaterial
  grenadeMat: THREE.MeshStandardMaterial
  type:       UtilKey
  throwT:     number
  landT:      number
  duration:   number
  tx: number; tz: number   // throw 3D coords
  lx: number; lz: number   // land 3D coords
}

interface KillObj {
  group:   THREE.Group
  mat:     THREE.LineBasicMaterial
  ringMat: THREE.MeshStandardMaterial
  killT:   number
}

interface BombObj {
  group:     THREE.Group
  mat:       THREE.MeshStandardMaterial
  ringMat:   THREE.MeshStandardMaterial
  plantTime: number
  defuseTime: number | null
  defused:   boolean
}

interface RoundOutcome {
  result:   'win' | 'loss' | 'draw'
  reason:   string
  roundNum: number
}

interface PB {
  playing: boolean; speed: number
  time: number; duration: number; roundIdx: number
}

type SoundEventType = 'kill' | 'he' | 'smoke' | 'flash' | 'molotov' | 'bomb_plant' | 'bomb_defuse' | 'round_end_win' | 'round_end_loss'
interface SoundEvent { time: number; type: SoundEventType; fired: boolean }

// ── Pure helpers ───────────────────────────────────────────────────────────────

function hexToRgb(hex: number): [number, number, number] {
  return [(hex >> 16) / 255, ((hex >> 8) & 0xff) / 255, (hex & 0xff) / 255]
}

function worldTo3D(wx: number, wy: number, cfg: MapConfig): [number, number] {
  const [px, py] = worldToCanvas(wx, wy, cfg, 1024)
  return [(px / 1024 - 0.5) * MAP_PLANE, (py / 1024 - 0.5) * MAP_PLANE]
}

function getPositions(frames: PositionFrame[], t: number) {
  if (!frames.length) return null
  if (t <= frames[0].t) return frames[0].p
  if (t >= frames[frames.length - 1].t) return frames[frames.length - 1].p
  let lo = 0, hi = frames.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (frames[mid].t <= t) lo = mid; else hi = mid
  }
  const a = frames[lo], b = frames[hi]
  const alpha = (t - a.t) / (b.t - a.t)
  return a.p.map(ap => {
    const bp = b.p.find(s => s.n === ap.n)
    if (!bp) return ap
    // Circular interpolation for yaw to avoid spinning through 360°
    const aw = ap.w ?? 0
    const bw = bp.w ?? aw
    let dw = bw - aw
    if (dw > 180) dw -= 360
    if (dw < -180) dw += 360
    return {
      n: ap.n,
      x: ap.x + (bp.x - ap.x) * alpha,
      y: ap.y + (bp.y - ap.y) * alpha,
      a: alpha < 0.5 ? ap.a : bp.a,
      h: Math.round((ap.h ?? 100) * (1 - alpha) + (bp.h ?? 100) * alpha),
      w: aw + dw * alpha,
    }
  })
}

function buildDeadAt(round: Round): Record<string, number> {
  const m: Record<string, number> = {}
  for (const k of round.kills) m[k.victim_name] = k.time
  return m
}

function fmtTime(s: number) {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function utilDuration(type: UtilKey): number {
  if (type === 'smoke') return SMOKE_DUR; if (type === 'flash') return FLASH_DUR
  if (type === 'he') return HE_DUR; return MOLOTOV_DUR
}

function utilHexColor(type: UtilKey): number {
  if (type === 'smoke') return SMOKE_COL; if (type === 'flash') return FLASH_COL
  if (type === 'he') return HE_COL; return MOLOTOV_COL
}

function formatWinReason(r: string): string {
  return ({
    bomb_exploded: 'Bomb exploded', bomb_defused: 'Bomb defused',
    ct_win: 'All eliminated', t_win: 'All eliminated',
    terrorists_win: 'All eliminated', round_draw: 'Draw',
  } as Record<string, string>)[r] ?? r.replace(/_/g, ' ')
}

function extractJsonCoords(data: Json): { x: number; y: number } | null {
  if (typeof data !== 'object' || !data || Array.isArray(data)) return null
  const d = data as Record<string, Json>
  return typeof d.x === 'number' && typeof d.y === 'number' ? { x: d.x, y: d.y } : null
}

function getBombCoords(
  events: GameEvent[], rounds: Round[], roundIdx: number,
): { x: number; y: number } | null {
  // Count how many previous rounds had a bomb plant to find the matching event
  const plantsBefore = rounds.slice(0, roundIdx).filter(r => r.bomb_planted).length
  const plantEvents  = events.filter(e => e.type === 'bomb_planted')
  const ev = plantEvents[plantsBefore] ?? null
  return ev ? extractJsonCoords(ev.data) : null
}

// ── Three.js object helpers ────────────────────────────────────────────────────

function disposeGroup(group: THREE.Group) {
  group.traverse(o => {
    const m = o as THREE.Mesh
    if (m.geometry) m.geometry.dispose()
    if (m.material) {
      Array.isArray(m.material)
        ? m.material.forEach(mat => mat.dispose())
        : m.material.dispose()
    }
  })
}

function makeNameSprite(name: string, teamColor: number): THREE.Sprite {
  const W = 256, H = 46
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')!
  const r = 10
  ctx.fillStyle = 'rgba(10,14,26,0.82)'
  ctx.beginPath()
  ctx.moveTo(r, 0); ctx.lineTo(W - r, 0); ctx.quadraticCurveTo(W, 0, W, r)
  ctx.lineTo(W, H - r); ctx.quadraticCurveTo(W, H, W - r, H)
  ctx.lineTo(r, H); ctx.quadraticCurveTo(0, H, 0, H - r)
  ctx.lineTo(0, r); ctx.quadraticCurveTo(0, 0, r, 0)
  ctx.closePath(); ctx.fill()
  ctx.fillStyle = `#${teamColor.toString(16).padStart(6, '0')}`
  ctx.fillRect(0, 0, 4, H)
  ctx.fillStyle = '#e8eaf0'
  ctx.font = 'bold 20px monospace'
  ctx.textBaseline = 'middle'
  ctx.fillText(name.slice(0, 16), 12, H / 2)
  const tex = new THREE.CanvasTexture(canvas)
  const mat = new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true })
  const sprite = new THREE.Sprite(mat)
  sprite.scale.set(2.1, 0.38, 1)
  return sprite
}

function makePlayer(
  name: string, isMyTeam: boolean,
  scene: THREE.Scene,
): PlayerObj {
  const teamHex = isMyTeam ? NEON : RED
  const [rC, gC, bC] = hexToRgb(teamHex)

  const bodyMat = new THREE.MeshStandardMaterial({
    color: teamHex, roughness: 0.35, metalness: 0.3,
    emissive: new THREE.Color(teamHex), emissiveIntensity: 0.25,
  })

  // Low-poly character: head, shoulders, torso, hips, two legs — all share bodyMat
  const part = (geo: THREE.BufferGeometry, y: number, x = 0, z = 0) => {
    const m = new THREE.Mesh(geo, bodyMat)
    m.position.set(x, y, z); m.castShadow = true; return m
  }
  const head      = part(new THREE.SphereGeometry(0.135, 6, 5),             0.88)
  const shoulders = part(new THREE.BoxGeometry(0.44, 0.09, 0.24),           0.73)
  const torso     = part(new THREE.CylinderGeometry(0.17, 0.14, 0.42, 6),   0.50)
  const hips      = part(new THREE.CylinderGeometry(0.14, 0.11, 0.16, 5),   0.27)
  const legL      = part(new THREE.CylinderGeometry(0.075, 0.065, 0.24, 4), 0.12, -0.08)
  const legR      = part(new THREE.CylinderGeometry(0.075, 0.065, 0.24, 4), 0.12,  0.08)

  const ringMat = new THREE.MeshStandardMaterial({
    color: teamHex, roughness: 0.3, metalness: 0.5,
    emissive: new THREE.Color(teamHex), emissiveIntensity: 0.6,
    transparent: true, opacity: 0.85,
  })
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.40, 0.035, 8, 24), ringMat)
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.04

  const sprite = makeNameSprite(name, teamHex)
  sprite.position.y = 1.28  // above model top (~1.015)

  // Facing arrow — cone pointing +Z (rotated from default +Y)
  const arrowMat = new THREE.MeshBasicMaterial({ color: teamHex, transparent: true, opacity: 0.72 })
  const dirArrow = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.18, 5), arrowMat)
  dirArrow.rotation.x = Math.PI / 2
  dirArrow.position.set(0, 0.50, 0.30)

  // Health bar — floats above head, lies flat in XZ plane
  const HP_W = 0.62
  const hpBarBgMat = new THREE.MeshBasicMaterial({ color: 0x0c0e1c })
  const hpBarBg = new THREE.Mesh(new THREE.BoxGeometry(HP_W + 0.06, 0.025, 0.092), hpBarBgMat)
  hpBarBg.position.set(0, 1.08, 0)

  const hpBarMat = new THREE.MeshBasicMaterial({ color: 0x00dd66 })
  const hpBarFg = new THREE.Mesh(new THREE.BoxGeometry(HP_W, 0.032, 0.072), hpBarMat)
  hpBarFg.position.set(0, 1.085, 0)

  const group = new THREE.Group()
  group.add(head, shoulders, torso, hips, legL, legR, ring, sprite, dirArrow, hpBarBg, hpBarFg)
  scene.add(group)

  const trailPosArr = new Float32Array(MAX_TRAIL * 3)
  const trailColArr = new Float32Array(MAX_TRAIL * 3)
  const trailGeo = new THREE.BufferGeometry()
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPosArr, 3))
  trailGeo.setAttribute('color',    new THREE.BufferAttribute(trailColArr, 3))
  trailGeo.setDrawRange(0, 0)
  const trailLine = new THREE.Line(trailGeo,
    new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.7, depthWrite: false }))
  scene.add(trailLine)

  return {
    group, sprite, bodyMat, ringMat,
    spriteMat: sprite.material as THREE.SpriteMaterial,
    trailLine, trailGeo, trailPosArr, trailColArr,
    trailHistory: [], teamR: rC, teamG: gC, teamB: bC,
    isMyTeam, alive: true,
    dirArrow, hpBarFg, hpBarBg, hpBarMat, hpBarBgMat,
  }
}

function setAlive(p: PlayerObj, alive: boolean) {
  if (p.alive === alive) return
  p.alive = alive
  const c = alive ? (p.isMyTeam ? NEON : RED) : DEAD_COLOR
  p.bodyMat.color.setHex(c);  p.bodyMat.emissive.setHex(alive ? c : 0x000000)
  p.bodyMat.emissiveIntensity = alive ? 0.25 : 0
  p.ringMat.color.setHex(c);  p.ringMat.emissive.setHex(alive ? c : 0x000000)
  p.ringMat.emissiveIntensity = alive ? 0.6 : 0
  p.ringMat.opacity = alive ? 0.85 : 0.3
  p.spriteMat.opacity = alive ? 1 : 0.35
  p.group.scale.setScalar(alive ? 1 : 0.82)
  p.hpBarFg.visible = alive
  p.hpBarBg.visible = alive
  p.dirArrow.visible = alive
}

function updateTrail(p: PlayerObj, t: number, x3d: number, y3d: number, z3d: number, alive: boolean) {
  const hist = p.trailHistory
  if (alive && (!hist.length || t - hist[hist.length - 1].t >= TRAIL_STEP)) {
    hist.push({ t, x: x3d, y: y3d, z: z3d })
  }
  const cutoff = t - TRAIL_SECS
  while (hist.length && hist[0].t < cutoff) hist.shift()
  const n = Math.min(hist.length, MAX_TRAIL)
  if (n < 2) { p.trailGeo.setDrawRange(0, 0); return }
  const start = hist.length - n
  for (let i = 0; i < n; i++) {
    const e = hist[start + i], base = i * 3, fade = i / (n - 1)
    p.trailPosArr[base]     = e.x
    p.trailPosArr[base + 1] = e.y + 0.08
    p.trailPosArr[base + 2] = e.z
    p.trailColArr[base]     = p.teamR * fade
    p.trailColArr[base + 1] = p.teamG * fade
    p.trailColArr[base + 2] = p.teamB * fade
  }
  p.trailGeo.attributes.position.needsUpdate = true
  p.trailGeo.attributes.color.needsUpdate    = true
  p.trailGeo.setDrawRange(0, n)
}

function clearTrails(players: Map<string, PlayerObj>) {
  for (const p of players.values()) {
    p.trailHistory = []; p.trailGeo.setDrawRange(0, 0)
  }
}

// ── Grenade arc (parabolic bezier) ─────────────────────────────────────────────

function makeGrenadeArc(
  tx: number, tz: number, lx: number, lz: number, col: number,
): THREE.Line {
  const SEGS = 14
  const pts: THREE.Vector3[] = []
  for (let i = 0; i <= SEGS; i++) {
    const u = i / SEGS
    pts.push(new THREE.Vector3(
      tx + (lx - tx) * u,
      0.12 + GRENADE_LIFT * 4 * u * (1 - u),
      tz + (lz - tz) * u,
    ))
  }
  return new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.28 }),
  )
}

// ── Utility objects ────────────────────────────────────────────────────────────

function makeUtilObj(g: GrenadeEvent, cfg: MapConfig, scene: THREE.Scene): UtilObj | null {
  if (g.type === 'decoy') return null
  if (!isFinite(g.throw_x) || !isFinite(g.land_x)) return null

  const type = g.type  // narrowed: 'smoke' | 'flash' | 'he' | 'molotov'
  const col  = utilHexColor(type)
  const dur  = utilDuration(type)
  const [tx, tz] = worldTo3D(g.throw_x, g.throw_y, cfg)
  const [lx, lz] = worldTo3D(g.land_x,  g.land_y,  cfg)

  const group = new THREE.Group()
  group.visible = false

  // child[0]: grenade mesh — moves along arc during flight
  const grenadeMat = new THREE.MeshStandardMaterial({
    color: col, emissive: new THREE.Color(col), emissiveIntensity: 1.4,
    roughness: 0.35, metalness: 0.55, transparent: true, opacity: 0.95,
  })
  const grenadeMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.075, 0), grenadeMat)
  grenadeMesh.position.set(tx, 0.12, tz)
  group.add(grenadeMesh)

  // child[1]: parabolic arc
  group.add(makeGrenadeArc(tx, tz, lx, lz, col))

  // child[2]: landing effect
  let mainMat: THREE.MeshStandardMaterial
  let mainMesh: THREE.Mesh

  if (type === 'smoke') {
    mainMat  = new THREE.MeshStandardMaterial({ color: col, transparent: true, opacity: 0.3, roughness: 0.95, side: THREE.DoubleSide })
    mainMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.6, 0.65, 14, 1, true), mainMat)
    mainMesh.position.set(lx, 0.32, lz)
  } else if (type === 'flash') {
    mainMat  = new THREE.MeshStandardMaterial({ color: col, emissive: new THREE.Color(col), emissiveIntensity: 2.5, transparent: true, opacity: 0.8 })
    mainMesh = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), mainMat)
    mainMesh.position.set(lx, 0.3, lz)
  } else if (type === 'he') {
    mainMat  = new THREE.MeshStandardMaterial({ color: col, emissive: new THREE.Color(col), emissiveIntensity: 2.0, transparent: true, opacity: 0.85 })
    mainMesh = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.07, 6, 14), mainMat)
    mainMesh.rotation.x = Math.PI / 2; mainMesh.position.set(lx, 0.12, lz)
  } else {
    mainMat  = new THREE.MeshStandardMaterial({ color: col, emissive: new THREE.Color(col), emissiveIntensity: 0.9, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
    mainMesh = new THREE.Mesh(new THREE.CircleGeometry(0.68, 14), mainMat)
    mainMesh.rotation.x = -Math.PI / 2; mainMesh.position.set(lx, 0.04, lz)
  }
  group.add(mainMesh)
  scene.add(group)

  return { group, mainMat, grenadeMat, type, throwT: g.time, landT: g.land_time, duration: dur, tx, tz, lx, lz }
}

function updateUtilAnim(u: UtilObj, t: number) {
  const grenade  = u.group.children[0] as THREE.Mesh
  const arcLine  = u.group.children[1]
  const mainMesh = u.group.children[2]
  const inFlight = t >= u.throwT && t < u.landT
  const age      = t - u.landT

  // Animate grenade object along parabolic arc
  if (inFlight) {
    const frac = Math.max(0, Math.min(1, (t - u.throwT) / Math.max(0.001, u.landT - u.throwT)))
    grenade.position.set(
      u.tx + (u.lx - u.tx) * frac,
      0.12 + GRENADE_LIFT * 4 * frac * (1 - frac),
      u.tz + (u.lz - u.tz) * frac,
    )
    grenade.rotation.y = t * 7
    grenade.rotation.x = t * 4
  }
  grenade.visible  = inFlight
  arcLine.visible  = inFlight
  mainMesh.visible = age >= 0 && age < u.duration

  if (!mainMesh.visible) return

  if (u.type === 'smoke') {
    const grow    = Math.min(age / 1.5, 1)
    const fadeEnd = Math.max(0, (age - (u.duration - 2)) / 2)
    mainMesh.scale.setScalar(grow)
    u.mainMat.opacity = 0.3 * grow * (1 - fadeEnd)
  } else if (u.type === 'flash') {
    mainMesh.scale.setScalar(1 + Math.min(age / 0.35, 1) * 5)
    u.mainMat.opacity           = 0.8 * (1 - age / u.duration)
    u.mainMat.emissiveIntensity = 2.5 * (1 - age / u.duration)
  } else if (u.type === 'he') {
    mainMesh.scale.setScalar(1 + Math.min(age / 0.4, 1) * 7)
    u.mainMat.opacity           = 0.85 * (1 - age / u.duration)
    u.mainMat.emissiveIntensity = 2.0 * (1 - age / u.duration)
  } else {
    mainMesh.scale.setScalar(1 + Math.sin(age * 4) * 0.05)
    u.mainMat.opacity = 0.5 * (1 - Math.max(0, (age - (u.duration - 1))))
  }
}

// ── Kill markers ───────────────────────────────────────────────────────────────

function makeKillMarker(x3d: number, z3d: number, killT: number, scene: THREE.Scene): KillObj {
  const group = new THREE.Group()
  group.position.set(x3d, 0, z3d); group.visible = false

  const mat = new THREE.LineBasicMaterial({ color: KILL_COL, transparent: true, opacity: 1 })
  const s   = 0.26
  const xSeg = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-s, 0.1, -s), new THREE.Vector3(s, 0.1, s),
      new THREE.Vector3( s, 0.1, -s), new THREE.Vector3(-s, 0.1, s),
    ]),
    mat,
  )
  group.add(xSeg)

  const ringMat = new THREE.MeshStandardMaterial({
    color: KILL_COL, emissive: new THREE.Color(KILL_COL), emissiveIntensity: 2,
    transparent: true, opacity: 0.7,
  })
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.04, 6, 16), ringMat)
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.08
  group.add(ring)

  scene.add(group)
  return { group, mat, ringMat, killT }
}

function updateKillMarker(km: KillObj, t: number) {
  const age = t - km.killT
  if (age < 0 || age >= KILL_SECS) { km.group.visible = false; return }
  km.group.visible = true
  const fade = 1 - age / KILL_SECS
  km.mat.opacity              = fade
  km.ringMat.opacity          = 0.7 * fade
  km.ringMat.emissiveIntensity = 2 * fade
  km.group.scale.setScalar(age < 0.25 ? 1 + (1 - age / 0.25) * 0.8 : 1)
}

// ── Bomb marker ────────────────────────────────────────────────────────────────

function makeBombObj(x3d: number, z3d: number, scene: THREE.Scene): BombObj {
  const group = new THREE.Group()
  group.position.set(x3d, 0, z3d); group.visible = false

  const mat = new THREE.MeshStandardMaterial({
    color: BOMB_COL, emissive: new THREE.Color(BOMB_COL), emissiveIntensity: 1.8,
    transparent: true, opacity: 0.9,
  })
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.14, 8), mat)
  body.position.y = 0.1; group.add(body)

  const ringMat = new THREE.MeshStandardMaterial({
    color: BOMB_COL, emissive: new THREE.Color(BOMB_COL), emissiveIntensity: 2.2,
    transparent: true, opacity: 0.65,
  })
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.045, 6, 20), ringMat)
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.08; group.add(ring)

  scene.add(group)
  return { group, mat, ringMat, plantTime: 0, defuseTime: null, defused: false }
}

function updateBombObj(bomb: BombObj, t: number) {
  bomb.group.visible = t >= bomb.plantTime
  if (!bomb.group.visible) return

  const isDefused = bomb.defused && bomb.defuseTime !== null && t >= bomb.defuseTime
  if (isDefused) {
    bomb.mat.color.setHex(BOMB_DEFUSE_COL);  bomb.mat.emissive.setHex(BOMB_DEFUSE_COL)
    bomb.ringMat.color.setHex(BOMB_DEFUSE_COL); bomb.ringMat.emissive.setHex(BOMB_DEFUSE_COL)
    bomb.mat.emissiveIntensity = 0.8; bomb.ringMat.emissiveIntensity = 1.2
    bomb.group.scale.setScalar(1)
  } else {
    const age   = t - bomb.plantTime
    const pulse = 1 + Math.sin(age * Math.PI * 1.5) * 0.09
    bomb.group.scale.setScalar(pulse)
    bomb.mat.color.setHex(BOMB_COL);  bomb.mat.emissive.setHex(BOMB_COL)
    bomb.ringMat.color.setHex(BOMB_COL); bomb.ringMat.emissive.setHex(BOMB_COL)
    bomb.mat.emissiveIntensity = 1.8; bomb.ringMat.emissiveIntensity = 2.2
  }
}

// ── Bomb site detection (k-means, 3 iters) ────────────────────────────────────

function detectBombSites(
  events: GameEvent[], rounds: Round[], cfg: MapConfig,
): { x3d: number; z3d: number; label: string }[] {
  const plants: { x: number; y: number }[] = []
  rounds.forEach((rnd, idx) => {
    if (!rnd.bomb_planted) return
    const c = getBombCoords(events, rounds, idx)
    if (c && isFinite(c.x) && isFinite(c.y)) plants.push(c)
  })
  if (!plants.length) return []

  // Find the two most-distant plants to seed clusters
  let maxD = 0, sA = plants[0], sB = plants[0]
  for (let i = 0; i < plants.length; i++)
    for (let j = i + 1; j < plants.length; j++) {
      const d = Math.hypot(plants[i].x - plants[j].x, plants[i].y - plants[j].y)
      if (d > maxD) { maxD = d; sA = plants[i]; sB = plants[j] }
    }

  if (maxD < 300) {
    // Only one site planted in this demo
    const cx = plants.reduce((s, p) => s + p.x, 0) / plants.length
    const cy = plants.reduce((s, p) => s + p.y, 0) / plants.length
    const [x3d, z3d] = worldTo3D(cx, cy, cfg)
    return [{ x3d, z3d, label: 'SITE' }]
  }

  let cA = sA, cB = sB
  for (let iter = 0; iter < 3; iter++) {
    const gA: typeof plants = [], gB: typeof plants = []
    for (const p of plants)
      (Math.hypot(p.x-cA.x, p.y-cA.y) <= Math.hypot(p.x-cB.x, p.y-cB.y) ? gA : gB).push(p)
    if (gA.length) cA = { x: gA.reduce((s,p)=>s+p.x,0)/gA.length, y: gA.reduce((s,p)=>s+p.y,0)/gA.length }
    if (gB.length) cB = { x: gB.reduce((s,p)=>s+p.x,0)/gB.length, y: gB.reduce((s,p)=>s+p.y,0)/gB.length }
  }

  const [ax, az] = worldTo3D(cA.x, cA.y, cfg)
  const [bx, bz] = worldTo3D(cB.x, cB.y, cfg)
  // Assign A to whichever cluster is further right (higher 3D X) — consistent heuristic
  const aFirst = ax >= bx
  return [
    { x3d: ax, z3d: az, label: aFirst ? 'A' : 'B' },
    { x3d: bx, z3d: bz, label: aFirst ? 'B' : 'A' },
  ]
}

function makeSiteMarker(x3d: number, z3d: number, label: string, scene: THREE.Scene) {
  const SITE_COL = 0xffaa22

  // Soft fill disc
  const fillMat = new THREE.MeshBasicMaterial({ color: SITE_COL, transparent: true, opacity: 0.06, depthWrite: false })
  const fill = new THREE.Mesh(new THREE.CircleGeometry(1.5, 20), fillMat)
  fill.rotation.x = -Math.PI / 2; fill.position.set(x3d, 0.012, z3d)
  scene.add(fill)

  // Outer ring
  const ringPts: THREE.Vector3[] = []
  for (let i = 0; i <= 40; i++) {
    const a = (i / 40) * Math.PI * 2
    ringPts.push(new THREE.Vector3(x3d + Math.cos(a) * 1.5, 0.02, z3d + Math.sin(a) * 1.5))
  }
  scene.add(new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(ringPts),
    new THREE.LineBasicMaterial({ color: SITE_COL, transparent: true, opacity: 0.38 }),
  ))

  // Floating site label sprite
  const W = 80, H = 48
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H
  const ctx = cv.getContext('2d')!
  ctx.clearRect(0, 0, W, H)
  ctx.font = `bold ${label.length === 1 ? 36 : 20}px monospace`
  ctx.fillStyle = `#${SITE_COL.toString(16)}`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(label, W / 2, H / 2)
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthWrite: false, transparent: true, opacity: 0.75 }))
  sprite.scale.set(1.1, 0.66, 1)
  sprite.position.set(x3d, 0.8, z3d)
  scene.add(sprite)
}

// ── Web Audio synthesis ────────────────────────────────────────────────────────

function sndKill(ctx: AudioContext) {
  const dur = 0.12
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (d.length * 0.25))
  const src = ctx.createBufferSource(); src.buffer = buf
  const filt = ctx.createBiquadFilter(); filt.type = 'bandpass'; filt.frequency.value = 2400; filt.Q.value = 0.8
  const gain = ctx.createGain(); gain.gain.value = 0.18
  src.connect(filt); filt.connect(gain); gain.connect(ctx.destination)
  src.start(); src.stop(ctx.currentTime + dur)
}

function sndExplosion(ctx: AudioContext) {
  const dur = 0.45
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (d.length * 0.35))
  const src = ctx.createBufferSource(); src.buffer = buf
  const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 220
  const gain = ctx.createGain(); gain.gain.value = 0.28
  src.connect(filt); filt.connect(gain); gain.connect(ctx.destination)
  src.start(); src.stop(ctx.currentTime + dur)
}

function sndSmoke(ctx: AudioContext) {
  const dur = 0.18
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (d.length * 0.4))
  const src = ctx.createBufferSource(); src.buffer = buf
  const filt = ctx.createBiquadFilter(); filt.type = 'bandpass'; filt.frequency.value = 2800; filt.Q.value = 1.2
  const gain = ctx.createGain(); gain.gain.value = 0.10
  src.connect(filt); filt.connect(gain); gain.connect(ctx.destination)
  src.start(); src.stop(ctx.currentTime + dur)
}

function sndFlash(ctx: AudioContext) {
  const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 1900
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.14, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15)
  osc.connect(gain); gain.connect(ctx.destination)
  osc.start(); osc.stop(ctx.currentTime + 0.15)
}

function sndBombBeep(ctx: AudioContext) {
  const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = 880
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.10, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.10)
  osc.connect(gain); gain.connect(ctx.destination)
  osc.start(); osc.stop(ctx.currentTime + 0.10)
}

function sndBombDefuse(ctx: AudioContext) {
  for (let i = 0; i < 3; i++) {
    const osc = ctx.createOscillator(); osc.type = 'sine'
    osc.frequency.value = [660, 880, 1100][i]
    const gain = ctx.createGain()
    const t = ctx.currentTime + i * 0.12
    gain.gain.setValueAtTime(0.12, t)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.10)
    osc.connect(gain); gain.connect(ctx.destination)
    osc.start(t); osc.stop(t + 0.10)
  }
}

function sndRoundEnd(ctx: AudioContext, win: boolean) {
  const freqs = win ? [523, 659, 784, 1047] : [523, 440, 392, 330]
  for (let i = 0; i < 4; i++) {
    const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = freqs[i]
    const gain = ctx.createGain()
    const t = ctx.currentTime + i * 0.15
    gain.gain.setValueAtTime(0.13, t)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.13)
    osc.connect(gain); gain.connect(ctx.destination)
    osc.start(t); osc.stop(t + 0.13)
  }
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function Replay3DCanvas({ mapName, parsed, team1, team2 }: Replay3DProps) {
  const mountRef    = useRef<HTMLDivElement>(null)
  const cameraRef   = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)

  const pbRef            = useRef<PB>({ playing: false, speed: 1, time: 0, duration: 0, roundIdx: 0 })
  const playersRef       = useRef<Map<string, PlayerObj>>(new Map())
  const framesRef        = useRef<PositionFrame[]>([])
  const deadAtRef        = useRef<Record<string, number>>({})
  const pendingRoundRef  = useRef<number | null>(null)
  const roundsRef        = useRef<Round[]>([])
  const utilObjsRef      = useRef<UtilObj[]>([])
  const killObjsRef      = useRef<KillObj[]>([])
  const bombObjRef       = useRef<BombObj | null>(null)
  const utilTogglesRef   = useRef<UtilToggle>({ smoke: true, flash: true, he: true, molotov: true })
  const roundEndShownRef = useRef(false)
  const followPlayerRef  = useRef<string | null>(null)
  const soundCtxRef      = useRef<AudioContext | null>(null)
  const soundEnabledRef  = useRef(true)
  const soundEventsRef   = useRef<SoundEvent[]>([])

  const [loaded,       setLoaded]       = useState(false)
  const [uiPlaying,    setUiPlaying]    = useState(false)
  const [uiSpeed,      setUiSpeed]      = useState<1 | 2 | 4>(1)
  const [uiTime,       setUiTime]       = useState(0)
  const [uiDuration,   setUiDuration]   = useState(0)
  const [uiRound,      setUiRound]      = useState(0)
  const [killFeed,     setKillFeed]     = useState<{ killer: string; victim: string; weapon: string; hs: boolean }[]>([])
  const [utilToggles,  setUtilToggles]  = useState<UtilToggle>({ smoke: true, flash: true, he: true, molotov: true })
  const [roundOutcome,    setRoundOutcome]    = useState<RoundOutcome | null>(null)
  const [bombStatus,      setBombStatus]      = useState<'planted' | 'defused' | null>(null)
  const [followingPlayer, setFollowingPlayer] = useState<string | null>(null)
  const [soundEnabled,    setSoundEnabled]    = useState(true)

  const togglePlay = useCallback(() => {
    const pb = pbRef.current
    if (!pb.playing && pb.duration > 0 && pb.time >= pb.duration) pb.time = 0
    pb.playing = !pb.playing; setUiPlaying(pb.playing)
    if (pb.playing) {
      if (!soundCtxRef.current) {
        soundCtxRef.current = new AudioContext()
      } else if (soundCtxRef.current.state === 'suspended') {
        soundCtxRef.current.resume()
      }
    }
  }, [])

  const handleSpeed = useCallback((s: 1 | 2 | 4) => {
    pbRef.current.speed = s; setUiSpeed(s)
  }, [])

  const handleScrub = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const t = parseFloat(e.target.value)
    pbRef.current.time = t; setUiTime(t)
    for (const ev of soundEventsRef.current) { if (ev.time > t) ev.fired = false }
  }, [])

  const selectRound = useCallback((idx: number) => {
    pendingRoundRef.current = idx
  }, [])

  const handleToggleUtil = useCallback((key: UtilKey) => {
    setUtilToggles(prev => {
      const next = { ...prev, [key]: !prev[key] }
      utilTogglesRef.current = next
      return next
    })
  }, [])

  const exitFollow = useCallback(() => {
    followPlayerRef.current = null
    setFollowingPlayer(null)
    const ctrl = controlsRef.current, cam = cameraRef.current
    if (ctrl && cam) {
      cam.position.set(0, 22, 13)
      ctrl.target.set(0, 0, 0)
      ctrl.enabled = true
      ctrl.update()
    }
  }, [])

  const handleSoundToggle = useCallback(() => {
    soundEnabledRef.current = !soundEnabledRef.current
    setSoundEnabled(soundEnabledRef.current)
  }, [])

  useEffect(() => {
    const el = mountRef.current
    if (!el) return

    let cancelled = false, animId: number, lastTS = 0, uiAccum = 0
    let lodAccum = 0, lastCamY = -1, totalTime = 0

    const W = el.clientWidth, H = el.clientHeight || 460
    const myTeamName = team1 ?? parsed?.header.team1 ?? ''

    // ── Scene ─────────────────────────────────────────────────────────────────
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x070a16)
    scene.fog = new THREE.FogExp2(0x070a16, 0.013)

    const cam = new THREE.PerspectiveCamera(45, W / H, 0.1, 200)
    cam.position.set(0, 22, 13); cam.lookAt(0, 0, 0)
    cameraRef.current = cam

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(W, H); renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15
    el.appendChild(renderer.domElement)

    // ── Lighting ──────────────────────────────────────────────────────────────
    scene.add(new THREE.HemisphereLight(0x1e2b50, 0x040508, 0.7))
    const sun = new THREE.DirectionalLight(0xffffff, 1.8)
    sun.position.set(8, 25, 10); sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.001
    const sc = sun.shadow.camera as THREE.OrthographicCamera
    sc.near = 1; sc.far = 80; sc.left = -18; sc.right = 18; sc.top = 18; sc.bottom = -18
    scene.add(sun)
    const fillLight = new THREE.DirectionalLight(0x1a2a44, 0.55)
    fillLight.position.set(-6, 8, -8)
    scene.add(fillLight)

    for (const [cx, cz] of [[-MAP_PLANE/2,-MAP_PLANE/2],[MAP_PLANE/2,-MAP_PLANE/2],[-MAP_PLANE/2,MAP_PLANE/2],[MAP_PLANE/2,MAP_PLANE/2]] as [number,number][]) {
      const pt = new THREE.PointLight(NEON, 0.55, MAP_PLANE * 1.5, 2)
      pt.position.set(cx, 0.5, cz); scene.add(pt)
    }

    // ── Map plane ─────────────────────────────────────────────────────────────
    const tableMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.MeshStandardMaterial({ color: 0x040710, roughness: 1, metalness: 0 }),
    )
    tableMesh.rotation.x = -Math.PI / 2; tableMesh.position.y = -0.03
    tableMesh.receiveShadow = true; scene.add(tableMesh)

    const mapMat = new THREE.MeshStandardMaterial({
      color: 0x1a2a3a, roughness: 0.72, metalness: 0.04,
      emissive: new THREE.Color(0x0a1825), emissiveIntensity: 0.28,
    })
    const mapMesh = new THREE.Mesh(new THREE.PlaneGeometry(MAP_PLANE, MAP_PLANE), mapMat)
    mapMesh.rotation.x = -Math.PI / 2; mapMesh.receiveShadow = true; scene.add(mapMesh)

    loadMapImage(mapName).then(img => {
      if (cancelled) return
      if (img) {
        const tex = new THREE.Texture(img)
        tex.colorSpace = THREE.SRGBColorSpace; tex.needsUpdate = true
        mapMat.map = tex; mapMat.color.set(0xffffff)
        mapMat.emissive.set(0x0d1c2c); mapMat.emissiveIntensity = 0.18; mapMat.needsUpdate = true
      }
      if (!cancelled) setLoaded(true)
    })

    // ── 3D map geometry (platforms + walls) ───────────────────────────────────
    const mapGeoObjs = buildMapGeometry(mapName, scene)

    // ── Border ────────────────────────────────────────────────────────────────
    const half = MAP_PLANE / 2, bY = 0.06
    const makeBorder = (h: number, inset: number, opacity: number) => {
      const i = inset
      scene.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(-h+i,bY,-h+i), new THREE.Vector3(h-i,bY,-h+i),
          new THREE.Vector3(h-i,bY,h-i),   new THREE.Vector3(-h+i,bY,h-i),
          new THREE.Vector3(-h+i,bY,-h+i),
        ]),
        new THREE.LineBasicMaterial({ color: NEON, transparent: opacity < 1, opacity }),
      ))
    }
    makeBorder(half, 0, 1.0); makeBorder(half, 0.18, 0.28)

    const tY = bY + 0.005, tl = 0.5
    for (const [a, b] of [
      [new THREE.Vector3(-tl/2,tY,-half), new THREE.Vector3(tl/2,tY,-half)],
      [new THREE.Vector3(-tl/2,tY, half), new THREE.Vector3(tl/2,tY, half)],
      [new THREE.Vector3(-half,tY,-tl/2), new THREE.Vector3(-half,tY, tl/2)],
      [new THREE.Vector3( half,tY,-tl/2), new THREE.Vector3( half,tY, tl/2)],
    ] as [THREE.Vector3, THREE.Vector3][]) {
      scene.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([a, b]),
        new THREE.LineBasicMaterial({ color: NEON, opacity: 0.55, transparent: true }),
      ))
    }

    // ── Perimeter walls ───────────────────────────────────────────────────────
    const WALL_H = 1.8
    const wallPanelMat = new THREE.MeshStandardMaterial({
      color: 0x0a1520, emissive: new THREE.Color(NEON), emissiveIntensity: 0.05,
      roughness: 0.95, transparent: true, opacity: 0.20, side: THREE.DoubleSide,
    })
    const makeWall = (cx: number, cz: number, w: number, d: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, WALL_H, d), wallPanelMat)
      m.position.set(cx, WALL_H / 2, cz); scene.add(m)
    }
    makeWall(0, -half, MAP_PLANE, 0.05)   // north
    makeWall(0,  half, MAP_PLANE, 0.05)   // south
    makeWall(-half, 0, 0.05, MAP_PLANE)   // west
    makeWall( half, 0, 0.05, MAP_PLANE)   // east

    // Neon glow line along the top of each wall
    const wallTopMat = new THREE.LineBasicMaterial({ color: NEON, transparent: true, opacity: 0.55 })
    for (const [ax, az, bx, bz] of [
      [-half, -half,  half, -half],  // north top
      [-half,  half,  half,  half],  // south top
      [-half, -half, -half,  half],  // west top
      [ half, -half,  half,  half],  // east top
    ] as [number,number,number,number][]) {
      scene.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(ax, WALL_H, az), new THREE.Vector3(bx, WALL_H, bz),
        ]),
        wallTopMat,
      ))
    }

    // ── Atmospheric particles ──────────────────────────────────────────────────
    const PARTICLE_COUNT = 320
    const pPositions = new Float32Array(PARTICLE_COUNT * 3)
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      pPositions[i*3]     = (Math.random() - 0.5) * MAP_PLANE
      pPositions[i*3 + 1] = Math.random() * 5.5 + 0.4
      pPositions[i*3 + 2] = (Math.random() - 0.5) * MAP_PLANE
    }
    const pGeo = new THREE.BufferGeometry()
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3))
    const particleSystem = new THREE.Points(pGeo, new THREE.PointsMaterial({
      color: NEON, size: 0.032, transparent: true, opacity: 0.22, depthWrite: false,
    }))
    scene.add(particleSystem)

    // ── Players ────────────────────────────────────────────────────────────────
    const rounds = parsed?.rounds ?? []
    roundsRef.current = rounds

    const myTeamSet = new Set((parsed?.players ?? []).filter(p => p.team === myTeamName).map(p => p.name))

    const allNames = new Set<string>()
    outer: for (const rnd of rounds) {
      for (const fr of (rnd.frames ?? [])) {
        for (const sn of fr.p) allNames.add(sn.n)
        if (allNames.size >= 10) break outer
      }
    }
    if (!allNames.size) for (const p of (parsed?.players ?? [])) allNames.add(p.name)

    const cfg = MAP_CONFIGS[mapName]
    const players = playersRef.current
    players.clear()

    for (const name of allNames) {
      const isMyTeam = myTeamSet.size > 0 ? myTeamSet.has(name) : true
      const po = makePlayer(name, isMyTeam, scene)
      po.group.traverse(o => { o.userData.playerName = name })
      po.group.visible = false
      players.set(name, po)
    }

    // ── Bomb site markers (derived from demo data) ────────────────────────────
    if (cfg) {
      const sites = detectBombSites(parsed?.events ?? [], rounds, cfg)
      for (const s of sites) makeSiteMarker(s.x3d, s.z3d, s.label, scene)
    }

    // ── Round init ─────────────────────────────────────────────────────────────
    function initRound(idx: number) {
      const rnd = rounds[idx]

      // Dispose previous overlays
      for (const u of utilObjsRef.current) { scene.remove(u.group); disposeGroup(u.group) }
      for (const km of killObjsRef.current) { scene.remove(km.group); disposeGroup(km.group) }
      if (bombObjRef.current) { scene.remove(bombObjRef.current.group); disposeGroup(bombObjRef.current.group) }
      utilObjsRef.current = []; killObjsRef.current = []; bombObjRef.current = null

      framesRef.current = rnd?.frames ?? []
      deadAtRef.current = rnd ? buildDeadAt(rnd) : {}
      clearTrails(players)

      const dur = rnd?.duration ?? 0
      pbRef.current.time = 0; pbRef.current.duration = dur
      pbRef.current.roundIdx = idx; pbRef.current.playing = false
      for (const p of players.values()) {
        p.alive = false  // force setAlive to run fully on next state change
        setAlive(p, true)
        p.group.visible = false
        // Reset HP bar to full health
        p.hpBarFg.scale.x = 1; p.hpBarFg.position.x = 0
        p.hpBarMat.color.setHex(0x00dd66)
      }

      roundEndShownRef.current = false

      // Build sound event timeline for this round
      const soundEvs: SoundEvent[] = []
      if (rnd) {
        for (const k of rnd.kills)
          soundEvs.push({ time: k.time, type: 'kill', fired: false })
        for (const g of (rnd.grenades ?? [])) {
          if (g.type === 'decoy') continue
          const sType: SoundEventType = g.type === 'he' ? 'he' : g.type === 'smoke' ? 'smoke' : g.type === 'flash' ? 'flash' : 'molotov'
          soundEvs.push({ time: g.land_time, type: sType, fired: false })
        }
        if (rnd.bomb_planted) {
          soundEvs.push({ time: Math.max(0, (rnd.duration ?? 0) - BOMB_TIMER), type: 'bomb_plant', fired: false })
          if (rnd.bomb_defused) soundEvs.push({ time: rnd.duration ?? 0, type: 'bomb_defuse', fired: false })
        }
        soundEvs.push({ time: rnd.duration ?? 0, type: rnd.winner === myTeamName ? 'round_end_win' : 'round_end_loss', fired: false })
      }
      soundEventsRef.current = soundEvs

      setUiTime(0); setUiDuration(dur); setUiRound(idx); setUiPlaying(false)
      setKillFeed([]); setRoundOutcome(null); setBombStatus(null)

      if (!cfg) return

      // Utilities
      for (const g of (rnd?.grenades ?? [])) {
        const u = makeUtilObj(g, cfg, scene)
        if (u) utilObjsRef.current.push(u)
      }

      // Kill markers
      for (const k of (rnd?.kills ?? [])) {
        if (!isFinite(k.victim_x) || !isFinite(k.victim_y)) continue
        const [x3d, z3d] = worldTo3D(k.victim_x, k.victim_y, cfg)
        killObjsRef.current.push(makeKillMarker(x3d, z3d, k.time, scene))
      }

      // Bomb marker
      if (rnd?.bomb_planted) {
        const coords = getBombCoords(parsed?.events ?? [], rounds, idx)
        if (coords) {
          const [bx, bz] = worldTo3D(coords.x, coords.y, cfg)
          const bomb = makeBombObj(bx, bz, scene)
          bomb.plantTime = Math.max(0, dur - BOMB_TIMER)
          bomb.defused   = !!rnd.bomb_defused
          bomb.defuseTime = rnd.bomb_defused ? dur : null
          bombObjRef.current = bomb
        }
      }
    }

    const firstWithFrames = rounds.findIndex(r => r.frames && r.frames.length > 0)
    initRound(Math.max(0, firstWithFrames))

    // ── OrbitControls ──────────────────────────────────────────────────────────
    const controls = new OrbitControls(cam, renderer.domElement)
    controls.target.set(0, 0, 0); controls.enableDamping = true; controls.dampingFactor = 0.05
    controls.minDistance = 4; controls.maxDistance = 48
    controls.minPolarAngle = 0; controls.maxPolarAngle = Math.PI * 0.47
    controls.rotateSpeed = 0.55; controls.panSpeed = 0.6; controls.zoomSpeed = 1.2
    controls.update(); controlsRef.current = controls

    // ── Click-to-follow raycasting ─────────────────────────────────────────────
    const raycaster = new THREE.Raycaster()
    const mouse     = new THREE.Vector2()
    const onCanvasClick = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      mouse.x = ((e.clientX - rect.left) / rect.width)  * 2 - 1
      mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1
      raycaster.setFromCamera(mouse, cam)
      const meshes: THREE.Object3D[] = []
      for (const po of players.values()) {
        if (po.group.visible && po.alive) po.group.traverse(o => { if ((o as THREE.Mesh).isMesh) meshes.push(o) })
      }
      const hit = raycaster.intersectObjects(meshes, false)[0]
      const name = hit?.object.userData.playerName as string | undefined
      if (name) {
        if (followPlayerRef.current === name) {
          // Click same player → exit follow
          followPlayerRef.current = null; setFollowingPlayer(null)
          controls.enabled = true; controls.update()
        } else {
          followPlayerRef.current = name; setFollowingPlayer(name)
          controls.enabled = false
        }
      }
    }
    renderer.domElement.addEventListener('click', onCanvasClick)

    // ── rAF loop ───────────────────────────────────────────────────────────────
    const followCamPos = new THREE.Vector3()
    const tick = (ts: number) => {
      animId = requestAnimationFrame(tick)
      const delta = Math.min((ts - lastTS) / 1000, 0.1)
      lastTS = ts; totalTime += delta
      const pb = pbRef.current

      // Slowly drift particles — barely perceptible, gives depth
      particleSystem.rotation.y = totalTime * 0.006

      if (pendingRoundRef.current !== null) {
        initRound(pendingRoundRef.current)
        pendingRoundRef.current = null
      }

      if (pb.playing && pb.duration > 0) {
        pb.time = Math.min(pb.time + delta * pb.speed, pb.duration)
        if (pb.time >= pb.duration) pb.playing = false
      }

      // LOD: suppress name labels when camera is zoomed far out
      lodAccum += delta
      if (lodAccum >= 0.1) {
        lodAccum = 0
        const camY = cam.position.y
        if (Math.abs(camY - lastCamY) > 0.5) {
          lastCamY = camY
          const showLabels = camY < 26
          for (const p of players.values()) {
            if (p.group.visible) p.sprite.visible = showLabels
          }
        }
      }

      // Players
      if (cfg && framesRef.current.length > 0) {
        const snaps = getPositions(framesRef.current, pb.time)
        if (snaps) {
          for (const sn of snaps) {
            const po = players.get(sn.n); if (!po) continue
            const [x3d, z3d] = worldTo3D(sn.x, sn.y, cfg)
            po.group.visible = true
            // Use actual Z from parser when available, else infer from map geometry regions
            const floorY = sn.z !== undefined
              ? (sn.z / (1024 * cfg.scale)) * MAP_PLANE * 2.5
              : getMapFloorHeight(x3d, z3d, mapName)
            po.group.position.set(x3d, floorY, z3d)
            // CS2 yaw: 0=east(+X), 90=south(+Y source→Three.js +Z)
            // Three.js rotation.y=π/2 faces +X → formula: π/2 - yaw*(π/180)
            if (sn.w !== undefined) {
              po.group.rotation.y = -sn.w * (Math.PI / 180) + Math.PI / 2
            }
            const deadT = deadAtRef.current[sn.n]
            const alive = deadT === undefined || pb.time < deadT
            setAlive(po, alive)
            // Update HP bar width and color
            if (alive) {
              const frac = Math.max(0, Math.min(sn.h ?? 100, 100)) / 100
              const HP_HALF = 0.31
              po.hpBarFg.scale.x = frac
              po.hpBarFg.position.x = -HP_HALF * (1 - frac)
              po.hpBarMat.color.setHex(frac > 0.6 ? 0x00dd66 : frac > 0.3 ? 0xffcc00 : 0xff3333)
            }
            updateTrail(po, pb.time, x3d, floorY, z3d, alive)
          }
        }
      }

      // Utilities
      const toggles = utilTogglesRef.current
      for (const u of utilObjsRef.current) {
        if (!toggles[u.type]) { u.group.visible = false; continue }
        u.group.visible = pb.time >= u.throwT && pb.time < u.landT + u.duration
        if (u.group.visible) updateUtilAnim(u, pb.time)
      }

      // Kill markers
      for (const km of killObjsRef.current) updateKillMarker(km, pb.time)

      // Bomb
      if (bombObjRef.current) updateBombObj(bombObjRef.current, pb.time)

      // Throttled React UI sync ~12fps
      uiAccum += delta
      if (uiAccum >= 1 / 12) {
        uiAccum = 0
        setUiTime(pb.time)
        setUiPlaying(pb.playing)

        const rnd = roundsRef.current[pb.roundIdx]
        if (rnd) {
          const vis = rnd.kills.filter(k => k.time <= pb.time).slice(-4).reverse()
          setKillFeed(vis.map(k => ({ killer: k.killer_name, victim: k.victim_name, weapon: k.weapon, hs: k.headshot })))
        }

        // Bomb HUD indicator
        const bomb = bombObjRef.current
        if (bomb && pb.time >= bomb.plantTime) {
          const defused = bomb.defused && bomb.defuseTime !== null && pb.time >= bomb.defuseTime
          setBombStatus(defused ? 'defused' : 'planted')
        } else {
          setBombStatus(null)
        }

        // Round outcome badge
        if (pb.time >= pb.duration && pb.duration > 0 && !roundEndShownRef.current) {
          roundEndShownRef.current = true
          const r = roundsRef.current[pb.roundIdx]
          if (r) {
            const win  = r.winner === myTeamName
            const draw = !r.winner || r.win_reason === 'round_draw'
            setRoundOutcome({ result: draw ? 'draw' : win ? 'win' : 'loss', reason: formatWinReason(r.win_reason), roundNum: r.number })
          }
        }
        // Clear badge if user scrubs back
        if (pb.time < pb.duration * 0.85 && roundEndShownRef.current) {
          roundEndShownRef.current = false
          setRoundOutcome(null)
        }
      }

      // Fire sound events
      if (soundCtxRef.current && soundEnabledRef.current && pb.playing) {
        const prevT = pb.time - delta * pb.speed
        for (const ev of soundEventsRef.current) {
          if (!ev.fired && ev.time > prevT && ev.time <= pb.time) {
            ev.fired = true
            switch (ev.type) {
              case 'kill':           sndKill(soundCtxRef.current); break
              case 'he':             sndExplosion(soundCtxRef.current); break
              case 'smoke':          sndSmoke(soundCtxRef.current); break
              case 'flash':          sndFlash(soundCtxRef.current); break
              case 'molotov':        sndExplosion(soundCtxRef.current); break
              case 'bomb_plant':     sndBombBeep(soundCtxRef.current); break
              case 'bomb_defuse':    sndBombDefuse(soundCtxRef.current); break
              case 'round_end_win':  sndRoundEnd(soundCtxRef.current, true); break
              case 'round_end_loss': sndRoundEnd(soundCtxRef.current, false); break
            }
          }
        }
      }

      // Follow camera — third-person over-the-shoulder
      const followName = followPlayerRef.current
      if (followName) {
        const po = players.get(followName)
        if (po && po.group.visible && po.alive) {
          const px = po.group.position.x, pz = po.group.position.z
          const ry = po.group.rotation.y
          const fwdX = Math.sin(ry), fwdZ = Math.cos(ry)
          followCamPos.set(px - fwdX * 3.2, 2.6, pz - fwdZ * 3.2)
          cam.position.lerp(followCamPos, 0.14)
          cam.lookAt(px + fwdX * 2.5, 0.5, pz + fwdZ * 2.5)
        } else if (po && !po.alive) {
          followPlayerRef.current = null
          setFollowingPlayer(null)
          controls.enabled = true; controls.update()
        }
      }

      controls.update()
      renderer.render(scene, cam)
    }
    requestAnimationFrame(tick)

    // ── Resize ─────────────────────────────────────────────────────────────────
    const ro = new ResizeObserver(() => {
      const nw = el.clientWidth, nh = el.clientHeight
      if (!nw || !nh) return
      cam.aspect = nw / nh; cam.updateProjectionMatrix(); renderer.setSize(nw, nh)
    })
    ro.observe(el)

    return () => {
      cancelled = true; cancelAnimationFrame(animId)
      renderer.domElement.removeEventListener('click', onCanvasClick)
      ro.disconnect(); controls.dispose(); renderer.dispose()
      soundCtxRef.current?.close(); soundCtxRef.current = null
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
      for (const po of players.values()) {
        po.hpBarMat.dispose(); po.hpBarBgMat.dispose()
        po.hpBarFg.geometry.dispose(); po.hpBarBg.geometry.dispose()
        po.dirArrow.geometry.dispose()
        ;(po.dirArrow.material as THREE.MeshBasicMaterial).dispose()
      }
      players.clear(); utilObjsRef.current = []; killObjsRef.current = []
      bombObjRef.current = null
      for (const o of mapGeoObjs) {
        const m = o as THREE.Mesh
        m.geometry?.dispose()
        if (m.material) {
          Array.isArray(m.material)
            ? m.material.forEach((mt: THREE.Material) => mt.dispose())
            : (m.material as THREE.Material).dispose()
        }
      }
    }
  }, [mapName, parsed, team1, team2])

  function resetCamera() {
    const cam = cameraRef.current, ctrl = controlsRef.current
    if (!cam || !ctrl) return
    cam.position.set(0, 22, 13); ctrl.target.set(0, 0, 0); ctrl.update()
  }

  const rounds      = parsed?.rounds ?? []
  const hasFrames   = rounds.some(r => r.frames && r.frames.length > 0)
  const myTeamLabel = team1 ?? parsed?.header.team1 ?? 'Team 1'
  const oppLabel    = team2 ?? parsed?.header.team2 ?? 'Team 2'

  const UTIL_BTNS: { key: UtilKey; label: string; active: string; dot: string }[] = [
    { key: 'smoke',   label: 'Smoke',   active: 'border-blue-400/50 text-blue-300 bg-blue-400/10',      dot: 'bg-blue-400' },
    { key: 'flash',   label: 'Flash',   active: 'border-yellow-300/50 text-yellow-200 bg-yellow-300/10', dot: 'bg-yellow-300' },
    { key: 'he',      label: 'HE',      active: 'border-orange-400/50 text-orange-300 bg-orange-400/10', dot: 'bg-orange-400' },
    { key: 'molotov', label: 'Molotov', active: 'border-red-500/50 text-red-300 bg-red-500/10',          dot: 'bg-red-500' },
  ]

  return (
    <div className="w-full rounded-lg overflow-hidden border border-border bg-[#070a16]">

      {/* Three.js canvas */}
      <div className="relative w-full" style={{ height: 460 }}>
        <div ref={mountRef} className="absolute inset-0" />

        {/* Loading */}
        {!loaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#070a16]">
            <Loader2 size={28} className="text-neon-green animate-spin" />
            <p className="text-xs text-muted-foreground font-mono">Loading 3D scene…</p>
          </div>
        )}

        {loaded && (
          <>
            {/* Map name */}
            <div className="absolute top-3 left-3 pointer-events-none select-none">
              <span className="bg-black/60 backdrop-blur-sm border border-neon-green/20 text-neon-green text-[11px] font-mono font-semibold px-2.5 py-1 rounded-md uppercase tracking-widest">
                {mapName.replace(/^(de_|cs_|ar_)/, '')}
              </span>
            </div>

            {/* Team chips */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 pointer-events-none select-none">
              <span className="bg-black/60 backdrop-blur-sm border border-neon-green/30 text-neon-green text-[10px] font-mono font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-neon-green inline-block" />{myTeamLabel}
              </span>
              <span className="bg-black/60 backdrop-blur-sm border border-red-500/30 text-red-400 text-[10px] font-mono font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />{oppLabel}
              </span>
            </div>

            {/* Bomb status HUD */}
            {bombStatus && (
              <div className="absolute top-3 right-14 pointer-events-none select-none">
                <span className={cn(
                  'text-[11px] font-mono font-bold px-2.5 py-1 rounded-md border backdrop-blur-sm uppercase tracking-widest flex items-center gap-1.5 animate-pulse',
                  bombStatus === 'planted'
                    ? 'bg-orange-500/20 border-orange-500/50 text-orange-300'
                    : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400',
                )}>
                  <span className={cn('w-2 h-2 rounded-full', bombStatus === 'planted' ? 'bg-orange-400' : 'bg-emerald-400')} />
                  {bombStatus === 'planted' ? 'BOMB PLANTED' : 'BOMB DEFUSED'}
                </span>
              </div>
            )}

            {/* Follow badge */}
            {followingPlayer && (
              <div className="absolute top-12 right-3 flex items-center gap-1.5 bg-black/70 backdrop-blur-sm border border-neon-green/30 rounded-md px-2.5 py-1 select-none">
                <span className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse shrink-0" />
                <span className="text-[10px] font-mono text-neon-green font-semibold truncate max-w-[120px]">{followingPlayer}</span>
                <button onClick={exitFollow} className="text-muted-foreground hover:text-white ml-0.5 leading-none" title="Exit follow">✕</button>
              </div>
            )}

            {/* Click hint when no one is followed */}
            {!followingPlayer && loaded && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none select-none">
                <span className="text-[9px] font-mono text-muted-foreground/40">Click a player to follow</span>
              </div>
            )}

            {/* Reset camera */}
            <button
              onClick={resetCamera}
              className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm border border-border/40 hover:border-neon-green/40 text-muted-foreground hover:text-neon-green transition-colors rounded-md p-1.5"
              title="Reset camera"
            >
              <RotateCcw size={14} />
            </button>

            {/* Round outcome badge — centered, fades in at round end */}
            {roundOutcome && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
                <div className={cn(
                  'flex flex-col items-center gap-1.5 rounded-2xl border px-10 py-5 backdrop-blur-md shadow-2xl',
                  roundOutcome.result === 'win'
                    ? 'bg-neon-green/10 border-neon-green/40'
                    : roundOutcome.result === 'loss'
                      ? 'bg-red-500/10 border-red-500/40'
                      : 'bg-yellow-400/10 border-yellow-400/40',
                )}>
                  <span className={cn(
                    'text-3xl font-black font-mono uppercase tracking-widest',
                    roundOutcome.result === 'win' ? 'text-neon-green' :
                    roundOutcome.result === 'loss' ? 'text-red-400' : 'text-yellow-400',
                  )}>
                    {roundOutcome.result === 'win' ? 'WIN' : roundOutcome.result === 'loss' ? 'LOSS' : 'DRAW'}
                  </span>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    Round {roundOutcome.roundNum} · {roundOutcome.reason}
                  </span>
                </div>
              </div>
            )}

            {/* Color legend — bottom-left */}
            <div className="absolute bottom-3 left-3 pointer-events-none select-none flex flex-col gap-1">
              {[
                { dot: 'bg-neon-green',   label: myTeamLabel },
                { dot: 'bg-red-500',      label: oppLabel },
                { dot: 'bg-blue-400',     label: 'Smoke' },
                { dot: 'bg-yellow-300',   label: 'Flash' },
                { dot: 'bg-orange-400',   label: 'HE' },
                { dot: 'bg-red-600',      label: 'Molotov' },
                { dot: 'bg-red-400',      label: 'Kill' },
                { dot: 'bg-orange-500',   label: 'Bomb' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${item.dot} shrink-0`} />
                  <span className="text-[9px] text-muted-foreground/55 font-mono">{item.label}</span>
                </div>
              ))}
            </div>

            {/* Kill feed — bottom-right */}
            {killFeed.length > 0 && (
              <div className="absolute bottom-3 right-3 flex flex-col gap-1 items-end pointer-events-none select-none">
                {killFeed.map((k, i) => (
                  <div key={i} className="bg-black/70 backdrop-blur-sm border border-border/30 rounded px-2 py-0.5 text-[10px] font-mono flex items-center gap-1.5">
                    <span className="text-neon-green">{k.killer}</span>
                    <span className="text-muted-foreground/60">{k.hs ? 'HS' : '·'}</span>
                    <span className="text-red-400 line-through">{k.victim}</span>
                    <span className="text-muted-foreground/50">[{k.weapon}]</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Controls bar */}
      {loaded && (
        <div className="border-t border-border px-4 py-3 space-y-2.5">

          {/* Row 1: play/pause · speed · time · scrubber */}
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              disabled={!hasFrames}
              className="w-8 h-8 flex items-center justify-center rounded-md bg-neon-green/10 border border-neon-green/30 text-neon-green hover:bg-neon-green/20 transition-colors disabled:opacity-30 shrink-0"
            >
              {uiPlaying ? <Pause size={14} /> : <Play size={14} />}
            </button>

            <div className="flex items-center gap-1 shrink-0">
              {([1, 2, 4] as const).map(s => (
                <button
                  key={s} onClick={() => handleSpeed(s)} disabled={!hasFrames}
                  className={cn(
                    'h-6 px-2 text-[10px] font-mono rounded border transition-colors disabled:opacity-30',
                    uiSpeed === s
                      ? 'bg-neon-green/20 border-neon-green/40 text-neon-green'
                      : 'border-border/50 text-muted-foreground hover:border-neon-green/30 hover:text-foreground',
                  )}
                >{s}×</button>
              ))}
            </div>

            <button
              onClick={handleSoundToggle}
              className={cn(
                'w-8 h-8 flex items-center justify-center rounded-md border transition-colors shrink-0',
                soundEnabled
                  ? 'bg-neon-green/10 border-neon-green/30 text-neon-green hover:bg-neon-green/20'
                  : 'bg-zinc-800/50 border-border/30 text-muted-foreground hover:border-neon-green/30',
              )}
              title={soundEnabled ? 'Mute sounds' : 'Unmute sounds'}
            >
              {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            </button>

            <span className="text-[11px] font-mono text-muted-foreground shrink-0 tabular-nums">
              {fmtTime(uiTime)} / {fmtTime(uiDuration)}
            </span>

            <input
              type="range" min={0} max={uiDuration || 1} step={0.05}
              value={uiTime} onChange={handleScrub} disabled={!hasFrames}
              className="flex-1 h-1.5 disabled:opacity-30"
              style={{ accentColor: '#00ff87' }}
            />
          </div>

          {/* Row 2: utility toggles + round selector */}
          <div className="flex items-center gap-4 flex-wrap">

            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] text-muted-foreground/50 font-mono uppercase tracking-wider">Util</span>
              {UTIL_BTNS.map(def => (
                <button
                  key={def.key} onClick={() => handleToggleUtil(def.key)}
                  className={cn(
                    'h-6 px-2 text-[10px] font-mono rounded border transition-all flex items-center gap-1',
                    utilToggles[def.key] ? def.active : 'border-border/25 text-muted-foreground/35',
                  )}
                >
                  <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', def.dot, !utilToggles[def.key] && 'opacity-30')} />
                  {def.label}
                </button>
              ))}
            </div>

            {rounds.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap min-w-0">
                <span className="text-[10px] text-muted-foreground/50 font-mono uppercase tracking-wider shrink-0">Round</span>
                {rounds.map((rnd, i) => {
                  const hasData = !!(rnd.frames && rnd.frames.length > 0)
                  return (
                    <button
                      key={i} onClick={() => selectRound(i)} disabled={!hasData}
                      title={`Round ${rnd.number}${hasData ? '' : ' — no frame data'}`}
                      className={cn(
                        'h-6 min-w-[26px] px-1.5 text-[10px] font-mono rounded border transition-colors',
                        uiRound === i
                          ? 'bg-neon-green/20 border-neon-green/50 text-neon-green'
                          : hasData
                            ? 'border-border/50 text-muted-foreground hover:border-neon-green/30 hover:text-foreground'
                            : 'border-border/20 text-muted-foreground/25 cursor-not-allowed',
                      )}
                    >{rnd.number}</button>
                  )
                })}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  )
}
