'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Loader2, RotateCcw, Play, Pause } from 'lucide-react'
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
  trailHistory: { t: number; x: number; z: number }[]
  teamR: number; teamG: number; teamB: number
  isMyTeam: boolean; alive: boolean
  dirArrow:    THREE.Mesh
  hpBarFg:     THREE.Mesh
  hpBarBg:     THREE.Mesh
  hpBarMat:    THREE.MeshBasicMaterial
  hpBarBgMat:  THREE.MeshBasicMaterial
}

interface UtilObj {
  group:    THREE.Group
  mainMat:  THREE.MeshStandardMaterial
  type:     UtilKey
  throwT:   number
  landT:    number
  duration: number
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

function updateTrail(p: PlayerObj, t: number, x3d: number, z3d: number, alive: boolean) {
  const hist = p.trailHistory
  if (alive && (!hist.length || t - hist[hist.length - 1].t >= TRAIL_STEP)) {
    hist.push({ t, x: x3d, z: z3d })
  }
  const cutoff = t - TRAIL_SECS
  while (hist.length && hist[0].t < cutoff) hist.shift()
  const n = Math.min(hist.length, MAX_TRAIL)
  if (n < 2) { p.trailGeo.setDrawRange(0, 0); return }
  const start = hist.length - n
  for (let i = 0; i < n; i++) {
    const e = hist[start + i], base = i * 3, fade = i / (n - 1)
    p.trailPosArr[base]     = e.x
    p.trailPosArr[base + 1] = 0.08
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
  const SEGS = 14, LIFT = 1.5
  const pts: THREE.Vector3[] = []
  for (let i = 0; i <= SEGS; i++) {
    const u = i / SEGS
    pts.push(new THREE.Vector3(
      tx + (lx - tx) * u,
      0.12 + LIFT * 4 * u * (1 - u),  // parabola peaks at u=0.5
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

  // child[0]: throw dot
  const throwDotMat = new THREE.MeshStandardMaterial({
    color: col, emissive: new THREE.Color(col), emissiveIntensity: 0.6,
    transparent: true, opacity: 0.55,
  })
  const throwDot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), throwDotMat)
  throwDot.position.set(tx, 0.12, tz)
  group.add(throwDot)

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

  return { group, mainMat, type, throwT: g.time, landT: g.land_time, duration: dur }
}

function updateUtilAnim(u: UtilObj, t: number) {
  const throwDot = u.group.children[0]
  const arcLine  = u.group.children[1]
  const mainMesh = u.group.children[2]
  const inFlight = t >= u.throwT && t < u.landT
  const age      = t - u.landT

  throwDot.visible = inFlight
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

  const [loaded,       setLoaded]       = useState(false)
  const [uiPlaying,    setUiPlaying]    = useState(false)
  const [uiSpeed,      setUiSpeed]      = useState<1 | 2 | 4>(1)
  const [uiTime,       setUiTime]       = useState(0)
  const [uiDuration,   setUiDuration]   = useState(0)
  const [uiRound,      setUiRound]      = useState(0)
  const [killFeed,     setKillFeed]     = useState<{ killer: string; victim: string; weapon: string; hs: boolean }[]>([])
  const [utilToggles,  setUtilToggles]  = useState<UtilToggle>({ smoke: true, flash: true, he: true, molotov: true })
  const [roundOutcome, setRoundOutcome] = useState<RoundOutcome | null>(null)
  const [bombStatus,   setBombStatus]   = useState<'planted' | 'defused' | null>(null)

  const togglePlay = useCallback(() => {
    const pb = pbRef.current
    if (!pb.playing && pb.duration > 0 && pb.time >= pb.duration) pb.time = 0
    pb.playing = !pb.playing; setUiPlaying(pb.playing)
  }, [])

  const handleSpeed = useCallback((s: 1 | 2 | 4) => {
    pbRef.current.speed = s; setUiSpeed(s)
  }, [])

  const handleScrub = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const t = parseFloat(e.target.value)
    pbRef.current.time = t; setUiTime(t)
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

  useEffect(() => {
    const el = mountRef.current
    if (!el) return

    let cancelled = false, animId: number, lastTS = 0, uiAccum = 0
    let lodAccum = 0, lastCamY = -1

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
    scene.add(Object.assign(new THREE.DirectionalLight(0x1a2a44, 0.55), { position: new THREE.Vector3(-6, 8, -8) }))

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
      po.group.visible = false
      players.set(name, po)
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

    // ── rAF loop ───────────────────────────────────────────────────────────────
    const tick = (ts: number) => {
      animId = requestAnimationFrame(tick)
      const delta = Math.min((ts - lastTS) / 1000, 0.1)
      lastTS = ts
      const pb = pbRef.current

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
            po.group.position.set(x3d, 0, z3d)
            // Apply yaw: CS2 yaw 0=east(+X), 90=north(+Y→Three.js -Z)
            // Three.js: rotation.y=0 faces +Z, -π/2 faces +X
            if (sn.w !== undefined) {
              po.group.rotation.y = -sn.w * (Math.PI / 180) - Math.PI / 2
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
            updateTrail(po, pb.time, x3d, z3d, alive)
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
      ro.disconnect(); controls.dispose(); renderer.dispose()
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
      for (const po of players.values()) {
        po.hpBarMat.dispose(); po.hpBarBgMat.dispose()
        po.hpBarFg.geometry.dispose(); po.hpBarBg.geometry.dispose()
        po.dirArrow.geometry.dispose()
        ;(po.dirArrow.material as THREE.MeshBasicMaterial).dispose()
      }
      players.clear(); utilObjsRef.current = []; killObjsRef.current = []
      bombObjRef.current = null
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
