'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Loader2, RotateCcw } from 'lucide-react'
import { MAP_CONFIGS, loadMapImage, worldToCanvas, type MapConfig } from '@/lib/map-config'
import type { ParsedDemoData, PlayerSnapshot } from '@/types/database'

// ── Constants ──────────────────────────────────────────────────────────────────
const MAP_PLANE   = 20      // ground plane size in Three.js units
const NEON        = 0x00ff87 // team-1 / your-team green  (#00ff87)
const RED         = 0xff3355 // team-2 / opponent red
const DEAD_COLOR  = 0x3a3a4a // faded state for dead players
const P_RADIUS    = 0.22     // capsule radius
const P_LENGTH    = 0.40     // capsule cylindrical length
const P_TOTAL_H   = P_LENGTH + 2 * P_RADIUS  // full capsule height = 0.84

export interface Replay3DProps {
  mapName: string
  parsed: ParsedDemoData | null
  team1?: string
  team2?: string
}

// ── Name-label sprite ──────────────────────────────────────────────────────────
// Draws a canvas chip with a team-colour accent bar and the player name, then
// wraps it in a THREE.Sprite so it always faces the camera.
function makeNameSprite(name: string, teamColor: number, alive: boolean) {
  const W = 256, H = 46
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')!

  // Background pill
  const alpha = alive ? 0.80 : 0.38
  ctx.fillStyle = `rgba(4,7,20,${alpha})`
  const R = 10
  ctx.beginPath()
  ctx.moveTo(R, 0);    ctx.lineTo(W - R, 0)
  ctx.quadraticCurveTo(W, 0, W, R)
  ctx.lineTo(W, H - R); ctx.quadraticCurveTo(W, H, W - R, H)
  ctx.lineTo(R, H);    ctx.quadraticCurveTo(0, H, 0, H - R)
  ctx.lineTo(0, R);    ctx.quadraticCurveTo(0, 0, R, 0)
  ctx.closePath()
  ctx.fill()

  // Left accent bar
  const hex = '#' + teamColor.toString(16).padStart(6, '0')
  ctx.fillStyle = hex
  ctx.beginPath()
  ctx.moveTo(R, 2);    ctx.lineTo(6, 2)
  ctx.quadraticCurveTo(2, 2, 2, R)
  ctx.lineTo(2, H - R); ctx.quadraticCurveTo(2, H - 2, R, H - 2)
  ctx.lineTo(6, H - 2); ctx.closePath()
  ctx.fill()

  // Player name text
  const display = name.length > 13 ? name.slice(0, 12) + '…' : name
  ctx.globalAlpha = alive ? 1.0 : 0.55
  ctx.font = 'bold 22px "Courier New",Courier,monospace'
  ctx.fillStyle = hex
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(display, 14, H / 2)

  const tex = new THREE.CanvasTexture(canvas)
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, sizeAttenuation: true })
  const sprite = new THREE.Sprite(mat)
  // Preserve canvas aspect ratio; ~2.8 units wide at game scale
  sprite.scale.set((W / H) * 0.59, 0.59, 1)
  return { sprite, mat, tex }
}

// ── Convert CS2 world coords → Three.js XZ ─────────────────────────────────────
function worldTo3D(wx: number, wy: number, cfg: MapConfig) {
  const [px, py] = worldToCanvas(wx, wy, cfg, 1024)
  return {
    x: (px / 1024 - 0.5) * MAP_PLANE,
    z: (py / 1024 - 0.5) * MAP_PLANE,
  }
}

// ── Build a single player group ────────────────────────────────────────────────
function buildPlayerGroup(
  snap: PlayerSnapshot,
  isMyTeam: boolean,
  capsuleGeo: THREE.CapsuleGeometry,
  ringGeo: THREE.TorusGeometry,
) {
  const alive = snap.a
  const teamColor  = isMyTeam ? NEON : RED
  const bodyColor  = alive ? teamColor : DEAD_COLOR
  const emissiveMul = alive ? 0.30 : 0.05

  const group = new THREE.Group()

  // ── Capsule body ──
  const bodyMat = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness: 0.30,
    metalness: 0.60,
    emissive: new THREE.Color(bodyColor).multiplyScalar(emissiveMul),
    transparent: !alive,
    opacity: alive ? 1.0 : 0.30,
  })
  const body = new THREE.Mesh(capsuleGeo, bodyMat)
  // Sit the capsule on top of the ground plane (y = 0)
  body.position.y = P_TOTAL_H / 2 + 0.02
  body.castShadow = true
  group.add(body)

  // ── Glow ring at the base ──
  const ringColor = alive ? teamColor : DEAD_COLOR
  const ringMat = new THREE.MeshStandardMaterial({
    color: ringColor,
    emissive: new THREE.Color(ringColor).multiplyScalar(alive ? 0.75 : 0.08),
    roughness: 0.25,
    metalness: 0.70,
    transparent: true,
    opacity: alive ? 0.90 : 0.18,
  })
  const ring = new THREE.Mesh(ringGeo, ringMat)
  ring.rotation.x = -Math.PI / 2   // lay flat in XZ plane
  ring.position.y  = 0.03
  group.add(ring)

  // ── Floating name label ──
  const { sprite, mat: spriteMat, tex: spriteTex } = makeNameSprite(snap.n, teamColor, alive)
  sprite.position.y = P_TOTAL_H + 0.72
  group.add(sprite)

  return { group, bodyMat, ringMat, spriteMat, spriteTex }
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function Replay3DCanvas({ mapName, parsed, team1, team2 }: Replay3DProps) {
  const mountRef    = useRef<HTMLDivElement>(null)
  const cameraRef   = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const el = mountRef.current
    if (!el) return

    let cancelled = false
    let animId: number

    const W = el.clientWidth
    const H = el.clientHeight || 560

    // ── Scene ────────────────────────────────────────────────────────────────
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x070a16)
    scene.fog = new THREE.FogExp2(0x070a16, 0.014)

    // ── Commander camera — angled top-down ────────────────────────────────────
    const cam = new THREE.PerspectiveCamera(45, W / H, 0.1, 200)
    cam.position.set(0, 22, 13)
    cam.lookAt(0, 0, 0)
    cameraRef.current = cam

    // ── Renderer ──────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(W, H)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.1
    el.appendChild(renderer.domElement)

    // ── Lighting ──────────────────────────────────────────────────────────────
    scene.add(new THREE.HemisphereLight(0x1e2b50, 0x040508, 0.65))

    const sun = new THREE.DirectionalLight(0xffffff, 1.9)
    sun.position.set(8, 25, 10)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    const sc = sun.shadow.camera as THREE.OrthographicCamera
    sc.near = 1; sc.far = 80; sc.left = -18; sc.right = 18; sc.top = 18; sc.bottom = -18
    scene.add(sun)

    // Corner neon glow lights
    for (const [cx, cz] of [
      [-MAP_PLANE / 2, -MAP_PLANE / 2], [ MAP_PLANE / 2, -MAP_PLANE / 2],
      [-MAP_PLANE / 2,  MAP_PLANE / 2], [ MAP_PLANE / 2,  MAP_PLANE / 2],
    ] as [number, number][]) {
      const pt = new THREE.PointLight(NEON, 0.6, MAP_PLANE * 1.5, 2)
      pt.position.set(cx, 0.6, cz)
      scene.add(pt)
    }

    // ── Table surface ─────────────────────────────────────────────────────────
    const tableMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.MeshStandardMaterial({ color: 0x040710, roughness: 1, metalness: 0 }),
    )
    tableMesh.rotation.x = -Math.PI / 2
    tableMesh.position.y = -0.03
    tableMesh.receiveShadow = true
    scene.add(tableMesh)

    // ── Map ground plane ──────────────────────────────────────────────────────
    const mapMat = new THREE.MeshStandardMaterial({
      color: 0x1a2a3a,
      roughness: 0.72,
      metalness: 0.04,
      emissive: new THREE.Color(0x0a1825),
      emissiveIntensity: 0.28,
    })
    const mapMesh = new THREE.Mesh(new THREE.PlaneGeometry(MAP_PLANE, MAP_PLANE), mapMat)
    mapMesh.rotation.x = -Math.PI / 2
    mapMesh.receiveShadow = true
    scene.add(mapMesh)

    loadMapImage(mapName).then(img => {
      if (cancelled) return
      if (img) {
        const tex = new THREE.Texture(img)
        tex.colorSpace = THREE.SRGBColorSpace
        tex.needsUpdate = true
        mapMat.map = tex
        mapMat.color.set(0xffffff)
        mapMat.emissive.set(0x0d1c2c)
        mapMat.emissiveIntensity = 0.18
        mapMat.needsUpdate = true
      }
      if (!cancelled) setLoaded(true)
    })

    // ── Map border (double-edge neon lines) ───────────────────────────────────
    const half = MAP_PLANE / 2
    const bY   = 0.06
    const addBorder = (inset: number, opacity: number) => {
      const i = inset
      const pts = [
        new THREE.Vector3(-half + i, bY, -half + i),
        new THREE.Vector3( half - i, bY, -half + i),
        new THREE.Vector3( half - i, bY,  half - i),
        new THREE.Vector3(-half + i, bY,  half - i),
        new THREE.Vector3(-half + i, bY, -half + i),
      ]
      scene.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: NEON, transparent: opacity < 1, opacity }),
      ))
    }
    addBorder(0,    1.0)
    addBorder(0.18, 0.28)

    // Cardinal tick marks
    const tY = bY + 0.005, tL = 0.5
    for (const [a, b] of [
      [new THREE.Vector3(-tL / 2, tY, -half), new THREE.Vector3(tL / 2, tY, -half)],
      [new THREE.Vector3(-tL / 2, tY,  half), new THREE.Vector3(tL / 2, tY,  half)],
      [new THREE.Vector3(-half, tY, -tL / 2), new THREE.Vector3(-half, tY,  tL / 2)],
      [new THREE.Vector3( half, tY, -tL / 2), new THREE.Vector3( half, tY,  tL / 2)],
    ] as [THREE.Vector3, THREE.Vector3][]) {
      scene.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([a, b]),
        new THREE.LineBasicMaterial({ color: NEON, opacity: 0.55, transparent: true }),
      ))
    }

    // ── Phase 2: Player representations ──────────────────────────────────────
    const cfg = MAP_CONFIGS[mapName]

    // Build team-name → isMyTeam lookup
    const playerTeamOf: Record<string, string> = {}
    for (const p of (parsed?.players ?? [])) playerTeamOf[p.name] = p.team

    // Find first round that has position frames
    const frameRound = parsed?.rounds.find(r => (r.frames?.length ?? 0) > 0)
    const snapshots  = frameRound?.frames?.[0]?.p ?? []

    // Shared geometries (one geometry instance, many mesh references — OK in Three.js)
    const capsuleGeo = new THREE.CapsuleGeometry(P_RADIUS, P_LENGTH, 4, 16)
    const ringGeo    = new THREE.TorusGeometry(0.34, 0.035, 8, 32)

    // Track materials/textures for disposal on cleanup
    const disposeMaterials: THREE.Material[] = []
    const disposeTextures: THREE.Texture[]   = []

    const hasFrames = snapshots.length > 0
    let playersToRender: { name: string; x: number; z: number; alive: boolean; isMyTeam: boolean }[] = []

    if (hasFrames && cfg) {
      // Use real positions from the first frame
      for (const snap of snapshots) {
        const pTeam = playerTeamOf[snap.n] ?? ''
        const { x, z } = worldTo3D(snap.x, snap.y, cfg)
        playersToRender.push({ name: snap.n, x, z, alive: snap.a, isMyTeam: pTeam === team1 })
      }
    } else {
      // Fallback: arrange teams in two facing lines when no frame data
      const t1 = (parsed?.players ?? []).filter(p => p.team === team1)
      const t2 = (parsed?.players ?? []).filter(p => p.team !== team1)
      const line = (players: typeof t1, xPos: number, isMyTeam: boolean) =>
        players.map((p, i) => ({
          name: p.name,
          x: xPos,
          z: (i - (players.length - 1) / 2) * 1.4,
          alive: true,
          isMyTeam,
        }))
      playersToRender = [...line(t1, -4.5, true), ...line(t2, 4.5, false)]
    }

    for (const p of playersToRender) {
      const { group, bodyMat, ringMat, spriteMat, spriteTex } =
        buildPlayerGroup({ n: p.name, x: 0, y: 0, a: p.alive }, p.isMyTeam, capsuleGeo, ringGeo)
      group.position.set(p.x, 0, p.z)
      scene.add(group)
      disposeMaterials.push(bodyMat, ringMat, spriteMat)
      disposeTextures.push(spriteTex)
    }

    // ── OrbitControls ─────────────────────────────────────────────────────────
    const controls = new OrbitControls(cam, renderer.domElement)
    controls.target.set(0, 0, 0)
    controls.enableDamping  = true
    controls.dampingFactor  = 0.07
    controls.minDistance    = 4
    controls.maxDistance    = 48
    controls.minPolarAngle  = 0
    controls.maxPolarAngle  = Math.PI * 0.47
    controls.rotateSpeed    = 0.6
    controls.panSpeed       = 0.6
    controls.zoomSpeed      = 1.25
    controls.update()
    controlsRef.current = controls

    // ── Render loop ───────────────────────────────────────────────────────────
    const tick = () => {
      animId = requestAnimationFrame(tick)
      controls.update()
      renderer.render(scene, cam)
    }
    tick()

    // ── Resize ────────────────────────────────────────────────────────────────
    const ro = new ResizeObserver(() => {
      const nw = el.clientWidth, nh = el.clientHeight
      if (!nw || !nh) return
      cam.aspect = nw / nh
      cam.updateProjectionMatrix()
      renderer.setSize(nw, nh)
    })
    ro.observe(el)

    return () => {
      cancelled = true
      cancelAnimationFrame(animId)
      ro.disconnect()
      controls.dispose()
      capsuleGeo.dispose()
      ringGeo.dispose()
      for (const m of disposeMaterials) m.dispose()
      for (const t of disposeTextures)  t.dispose()
      renderer.dispose()
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
    }
  }, [mapName, parsed, team1])

  function resetCamera() {
    const cam  = cameraRef.current
    const ctrl = controlsRef.current
    if (!cam || !ctrl) return
    cam.position.set(0, 22, 13)
    ctrl.target.set(0, 0, 0)
    ctrl.update()
  }

  return (
    <div
      className="relative w-full rounded-lg overflow-hidden"
      style={{ height: 560, background: '#070a16' }}
    >
      {/* Three.js mount */}
      <div ref={mountRef} className="absolute inset-0" />

      {/* Loading overlay */}
      {!loaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#070a16]">
          <Loader2 size={28} className="text-neon-green animate-spin" />
          <p className="text-xs text-muted-foreground font-mono">Loading 3D scene…</p>
        </div>
      )}

      {/* HUD */}
      {loaded && (
        <>
          {/* Map name */}
          <div className="absolute top-3 left-3 pointer-events-none select-none">
            <span className="bg-black/60 backdrop-blur-sm border border-neon-green/20 text-neon-green text-[11px] font-mono font-semibold px-2.5 py-1 rounded-md uppercase tracking-widest">
              {mapName.replace(/^(de|cs|ar)_/, '')}
            </span>
          </div>

          {/* Team legend */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-3 pointer-events-none select-none">
            <span className="flex items-center gap-1.5 bg-black/55 backdrop-blur-sm px-2.5 py-1 rounded-md border border-neon-green/20 text-[11px] font-mono">
              <span className="w-2 h-2 rounded-full bg-[#00ff87] inline-block" />
              <span className="text-[#00ff87]">{team1 ?? 'Team 1'}</span>
            </span>
            <span className="flex items-center gap-1.5 bg-black/55 backdrop-blur-sm px-2.5 py-1 rounded-md border border-red-500/20 text-[11px] font-mono">
              <span className="w-2 h-2 rounded-full bg-[#ff3355] inline-block" />
              <span className="text-[#ff3355]">{team2 ?? 'Opponent'}</span>
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

          {/* Controls hint */}
          <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between pointer-events-none select-none">
            <span className="bg-black/40 backdrop-blur-sm text-[10px] text-neon-green/50 font-mono uppercase tracking-widest px-2 py-1 rounded">
              Commander View · Phase 2
            </span>
            <span className="bg-black/40 backdrop-blur-sm text-[10px] text-muted-foreground/60 font-mono px-2 py-1 rounded">
              Drag orbit · Scroll zoom · Right-drag pan
            </span>
          </div>
        </>
      )}
    </div>
  )
}
