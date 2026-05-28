'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Loader2, RotateCcw, Play, Pause } from 'lucide-react'
import { MAP_CONFIGS, loadMapImage, worldToCanvas, type MapConfig } from '@/lib/map-config'
import type { ParsedDemoData, PositionFrame, Round } from '@/types/database'
import { cn } from '@/lib/utils'

// ── Constants ──────────────────────────────────────────────────────────────────
const MAP_PLANE  = 20
const NEON       = 0x00ff87
const RED        = 0xff3355
const DEAD_COLOR = 0x3a3a4a
const P_RADIUS   = 0.22
const P_LENGTH   = 0.40
const P_TOTAL_H  = P_LENGTH + 2 * P_RADIUS  // 0.84
const TRAIL_SECS = 2.5
const TRAIL_STEP = 0.06
const MAX_TRAIL  = 80

// ── Types ──────────────────────────────────────────────────────────────────────
export interface Replay3DProps {
  mapName: string
  parsed: ParsedDemoData | null
  team1?: string
  team2?: string
}

interface PlayerObj {
  group:        THREE.Group
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
    return {
      n: ap.n,
      x: ap.x + (bp.x - ap.x) * alpha,
      y: ap.y + (bp.y - ap.y) * alpha,
      a: alpha < 0.5 ? ap.a : bp.a,
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

// ── Three.js object helpers ────────────────────────────────────────────────────

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
  sprite.position.y = P_TOTAL_H / 2 + 0.52
  return sprite
}

function makePlayer(
  name: string, isMyTeam: boolean,
  capsuleGeo: THREE.CapsuleGeometry, ringGeo: THREE.TorusGeometry,
  scene: THREE.Scene,
): PlayerObj {
  const teamHex = isMyTeam ? NEON : RED
  const [rC, gC, bC] = hexToRgb(teamHex)

  const bodyMat = new THREE.MeshStandardMaterial({
    color: teamHex, roughness: 0.35, metalness: 0.3,
    emissive: new THREE.Color(teamHex), emissiveIntensity: 0.25,
  })
  const body = new THREE.Mesh(capsuleGeo, bodyMat)
  body.castShadow = true; body.position.y = P_TOTAL_H / 2

  const ringMat = new THREE.MeshStandardMaterial({
    color: teamHex, roughness: 0.3, metalness: 0.5,
    emissive: new THREE.Color(teamHex), emissiveIntensity: 0.6,
    transparent: true, opacity: 0.85,
  })
  const ring = new THREE.Mesh(ringGeo, ringMat)
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.04

  const sprite = makeNameSprite(name, teamHex)
  const group = new THREE.Group()
  group.add(body, ring, sprite); scene.add(group)

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
    group, bodyMat, ringMat,
    spriteMat: sprite.material as THREE.SpriteMaterial,
    trailLine, trailGeo, trailPosArr, trailColArr,
    trailHistory: [], teamR: rC, teamG: gC, teamB: bC,
    isMyTeam, alive: true,
  }
}

function setAlive(p: PlayerObj, alive: boolean) {
  if (p.alive === alive) return
  p.alive = alive
  const c = alive ? (p.isMyTeam ? NEON : RED) : DEAD_COLOR
  p.bodyMat.color.setHex(c)
  p.bodyMat.emissive.setHex(alive ? c : 0x000000)
  p.bodyMat.emissiveIntensity = alive ? 0.25 : 0
  p.ringMat.color.setHex(c)
  p.ringMat.emissive.setHex(alive ? c : 0x000000)
  p.ringMat.emissiveIntensity = alive ? 0.6 : 0
  p.ringMat.opacity = alive ? 0.85 : 0.3
  p.spriteMat.opacity = alive ? 1 : 0.35
  p.group.scale.setScalar(alive ? 1 : 0.82)
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

// ── Component ──────────────────────────────────────────────────────────────────

export default function Replay3DCanvas({ mapName, parsed, team1, team2 }: Replay3DProps) {
  const mountRef    = useRef<HTMLDivElement>(null)
  const cameraRef   = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)

  // Hot-path state in refs — no re-renders from the rAF loop
  const pbRef           = useRef<PB>({ playing: false, speed: 1, time: 0, duration: 0, roundIdx: 0 })
  const playersRef      = useRef<Map<string, PlayerObj>>(new Map())
  const framesRef       = useRef<PositionFrame[]>([])
  const deadAtRef       = useRef<Record<string, number>>({})
  const pendingRoundRef = useRef<number | null>(null)
  const roundsRef       = useRef<Round[]>([])

  // React state — only for UI rendering, updated at ~12fps
  const [loaded,     setLoaded]     = useState(false)
  const [uiPlaying,  setUiPlaying]  = useState(false)
  const [uiSpeed,    setUiSpeed]    = useState<1 | 2 | 4>(1)
  const [uiTime,     setUiTime]     = useState(0)
  const [uiDuration, setUiDuration] = useState(0)
  const [uiRound,    setUiRound]    = useState(0)
  const [killFeed,   setKillFeed]   = useState<{ killer: string; victim: string; weapon: string; hs: boolean }[]>([])

  const togglePlay = useCallback(() => {
    const pb = pbRef.current
    if (!pb.playing && pb.duration > 0 && pb.time >= pb.duration) pb.time = 0
    pb.playing = !pb.playing
    setUiPlaying(pb.playing)
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

  useEffect(() => {
    const el = mountRef.current
    if (!el) return

    let cancelled = false, animId: number, lastTS = 0, uiAccum = 0

    const W = el.clientWidth, H = el.clientHeight || 460

    // ── Scene ─────────────────────────────────────────────────────────────────
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x070a16)
    scene.fog = new THREE.FogExp2(0x070a16, 0.014)

    const cam = new THREE.PerspectiveCamera(45, W / H, 0.1, 200)
    cam.position.set(0, 22, 13); cam.lookAt(0, 0, 0)
    cameraRef.current = cam

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(W, H); renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1
    el.appendChild(renderer.domElement)

    // ── Lighting ──────────────────────────────────────────────────────────────
    scene.add(new THREE.HemisphereLight(0x1e2b50, 0x040508, 0.65))
    const sun = new THREE.DirectionalLight(0xffffff, 1.9)
    sun.position.set(8, 25, 10); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048)
    const sc = sun.shadow.camera as THREE.OrthographicCamera
    sc.near = 1; sc.far = 80; sc.left = -18; sc.right = 18; sc.top = 18; sc.bottom = -18
    scene.add(sun)
    for (const [cx, cz] of [[-MAP_PLANE/2,-MAP_PLANE/2],[MAP_PLANE/2,-MAP_PLANE/2],[-MAP_PLANE/2,MAP_PLANE/2],[MAP_PLANE/2,MAP_PLANE/2]] as [number,number][]) {
      const pt = new THREE.PointLight(NEON, 0.6, MAP_PLANE * 1.5, 2)
      pt.position.set(cx, 0.6, cz); scene.add(pt)
    }

    // ── Map plane ─────────────────────────────────────────────────────────────
    const tableMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.MeshStandardMaterial({ color: 0x040710, roughness: 1, metalness: 0 }),
    )
    tableMesh.rotation.x = -Math.PI / 2; tableMesh.position.y = -0.03; tableMesh.receiveShadow = true
    scene.add(tableMesh)

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
    const capsuleGeo = new THREE.CapsuleGeometry(P_RADIUS, P_LENGTH, 6, 12)
    const ringGeo    = new THREE.TorusGeometry(P_RADIUS + 0.12, 0.035, 8, 24)

    const rounds = parsed?.rounds ?? []
    roundsRef.current = rounds

    const myTeamName = team1 ?? parsed?.header.team1 ?? ''
    const myTeamSet  = new Set((parsed?.players ?? []).filter(p => p.team === myTeamName).map(p => p.name))

    // Collect all player names from position frames
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
      const po = makePlayer(name, isMyTeam, capsuleGeo, ringGeo, scene)
      po.group.visible = false
      players.set(name, po)
    }

    // ── Round init ─────────────────────────────────────────────────────────────
    function initRound(idx: number) {
      const rnd = rounds[idx]
      framesRef.current  = rnd?.frames ?? []
      deadAtRef.current  = rnd ? buildDeadAt(rnd) : {}
      clearTrails(players)
      const dur = rnd?.duration ?? 0
      pbRef.current.time     = 0
      pbRef.current.duration = dur
      pbRef.current.roundIdx = idx
      pbRef.current.playing  = false
      for (const p of players.values()) { setAlive(p, true); p.group.visible = false }
      setUiTime(0); setUiDuration(dur); setUiRound(idx); setUiPlaying(false); setKillFeed([])
    }

    const firstWithFrames = rounds.findIndex(r => r.frames && r.frames.length > 0)
    initRound(Math.max(0, firstWithFrames))

    // ── OrbitControls ──────────────────────────────────────────────────────────
    const controls = new OrbitControls(cam, renderer.domElement)
    controls.target.set(0, 0, 0); controls.enableDamping = true; controls.dampingFactor = 0.07
    controls.minDistance = 4; controls.maxDistance = 48
    controls.minPolarAngle = 0; controls.maxPolarAngle = Math.PI * 0.47
    controls.rotateSpeed = 0.6; controls.panSpeed = 0.6; controls.zoomSpeed = 1.25
    controls.update(); controlsRef.current = controls

    // ── rAF loop ───────────────────────────────────────────────────────────────
    const tick = (ts: number) => {
      animId = requestAnimationFrame(tick)
      const delta = Math.min((ts - lastTS) / 1000, 0.1)
      lastTS = ts
      const pb = pbRef.current

      // Apply queued round change from React handlers
      if (pendingRoundRef.current !== null) {
        initRound(pendingRoundRef.current)
        pendingRoundRef.current = null
      }

      // Advance playback time
      if (pb.playing && pb.duration > 0) {
        pb.time = Math.min(pb.time + delta * pb.speed, pb.duration)
        if (pb.time >= pb.duration) pb.playing = false
      }

      // Update player positions via interpolation
      if (cfg && framesRef.current.length > 0) {
        const snaps = getPositions(framesRef.current, pb.time)
        if (snaps) {
          for (const sn of snaps) {
            const po = players.get(sn.n); if (!po) continue
            const [x3d, z3d] = worldTo3D(sn.x, sn.y, cfg)
            po.group.visible = true
            po.group.position.set(x3d, 0, z3d)
            const deadT = deadAtRef.current[sn.n]
            const alive = deadT === undefined || pb.time < deadT
            setAlive(po, alive)
            updateTrail(po, pb.time, x3d, z3d, alive)
          }
        }
      }

      // Throttled React UI sync at ~12fps
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
      }

      controls.update()
      renderer.render(scene, cam)
    }
    requestAnimationFrame(tick)

    // ── Resize observer ────────────────────────────────────────────────────────
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
      players.clear()
    }
  }, [mapName, parsed, team1, team2])

  function resetCamera() {
    const cam = cameraRef.current, ctrl = controlsRef.current
    if (!cam || !ctrl) return
    cam.position.set(0, 22, 13); ctrl.target.set(0, 0, 0); ctrl.update()
  }

  const rounds = parsed?.rounds ?? []
  const hasFrames = rounds.some(r => r.frames && r.frames.length > 0)
  const myTeamDisplay  = team1 ?? parsed?.header.team1 ?? 'Team 1'
  const oppDisplay     = team2 ?? parsed?.header.team2 ?? 'Team 2'

  return (
    <div className="w-full rounded-lg overflow-hidden border border-border bg-[#070a16]">
      {/* Three.js mount */}
      <div className="relative w-full" style={{ height: 460 }}>
        <div ref={mountRef} className="absolute inset-0" />

        {/* Loading overlay */}
        {!loaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#070a16]">
            <Loader2 size={28} className="text-neon-green animate-spin" />
            <p className="text-xs text-muted-foreground font-mono">Loading 3D scene…</p>
          </div>
        )}

        {loaded && (
          <>
            {/* Map name badge */}
            <div className="absolute top-3 left-3 pointer-events-none select-none">
              <span className="bg-black/60 backdrop-blur-sm border border-neon-green/20 text-neon-green text-[11px] font-mono font-semibold px-2.5 py-1 rounded-md uppercase tracking-widest">
                {mapName.replace(/^(de_|cs_|ar_)/, '')}
              </span>
            </div>

            {/* Team legend */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 pointer-events-none select-none">
              <span className="bg-black/60 backdrop-blur-sm border border-neon-green/30 text-neon-green text-[10px] font-mono font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-neon-green inline-block" />
                {myTeamDisplay}
              </span>
              <span className="bg-black/60 backdrop-blur-sm border border-red-500/30 text-red-400 text-[10px] font-mono font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                {oppDisplay}
              </span>
            </div>

            {/* Reset camera */}
            <button
              onClick={resetCamera}
              className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm border border-border/40 hover:border-neon-green/40 text-muted-foreground hover:text-neon-green transition-colors rounded-md p-1.5"
              title="Reset camera"
            >
              <RotateCcw size={14} />
            </button>

            {/* Kill feed */}
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

            {/* Camera hint */}
            <div className="absolute bottom-3 left-3 pointer-events-none select-none">
              <span className="bg-black/40 backdrop-blur-sm text-[10px] text-neon-green/50 font-mono uppercase tracking-widest px-2 py-1 rounded">
                Commander View · Drag · Scroll
              </span>
            </div>
          </>
        )}
      </div>

      {/* Playback controls */}
      {loaded && (
        <div className="border-t border-border px-4 py-3 space-y-2.5">
          {/* Row 1: play/pause, speed, time, scrubber */}
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
                  key={s}
                  onClick={() => handleSpeed(s)}
                  disabled={!hasFrames}
                  className={cn(
                    'h-6 px-2 text-[10px] font-mono rounded border transition-colors disabled:opacity-30',
                    uiSpeed === s
                      ? 'bg-neon-green/20 border-neon-green/40 text-neon-green'
                      : 'border-border/50 text-muted-foreground hover:border-neon-green/30 hover:text-foreground',
                  )}
                >
                  {s}×
                </button>
              ))}
            </div>

            <span className="text-[11px] font-mono text-muted-foreground shrink-0 tabular-nums">
              {fmtTime(uiTime)} / {fmtTime(uiDuration)}
            </span>

            <input
              type="range"
              min={0}
              max={uiDuration || 1}
              step={0.05}
              value={uiTime}
              onChange={handleScrub}
              disabled={!hasFrames}
              className="flex-1 h-1.5 disabled:opacity-30"
              style={{ accentColor: '#00ff87' }}
            />
          </div>

          {/* Row 2: round selector */}
          {rounds.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[10px] text-muted-foreground/60 font-mono uppercase tracking-wider mr-1 shrink-0">
                Round
              </span>
              {rounds.map((rnd, i) => {
                const hasData = !!(rnd.frames && rnd.frames.length > 0)
                return (
                  <button
                    key={i}
                    onClick={() => selectRound(i)}
                    disabled={!hasData}
                    title={`Round ${rnd.number}${hasData ? '' : ' — no frame data'}`}
                    className={cn(
                      'h-6 min-w-[26px] px-1.5 text-[10px] font-mono rounded border transition-colors',
                      uiRound === i
                        ? 'bg-neon-green/20 border-neon-green/50 text-neon-green'
                        : hasData
                          ? 'border-border/50 text-muted-foreground hover:border-neon-green/30 hover:text-foreground'
                          : 'border-border/20 text-muted-foreground/25 cursor-not-allowed',
                    )}
                  >
                    {rnd.number}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
