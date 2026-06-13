'use client'
// de_mirage 3D blockout replay scene (vanilla three.js — same proven approach
// as Replay3DCanvas, so it typechecks/builds without the React-Three-Fiber
// global-JSX hazard). Mounted via MirageReplay and dynamically imported with
// { ssr: false } at the page boundary.

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import {
  createMirageScene, addZoneLabels, getSpawnPosition,
  worldToThree, PLAYER_HEIGHT, EYE_HEIGHT, MIRAGE_ZONES,
} from '@/lib/three/mirage'

export interface PlayerState {
  steamId: string
  name?: string
  team: 'T' | 'CT'
  x: number; y: number; z: number   // CS2 world units
  yaw?: number                       // degrees (CS2: 0 = +X, CCW+)
  alive?: boolean
}
export interface DemoFrame { tick: number; players: PlayerState[] }
export interface DemoData { frames: DemoFrame[] }   // sorted ascending by tick
export interface Trajectory { points: { x: number; y: number; z: number }[]; color?: string }

export interface MirageSceneProps {
  demoData?: DemoData
  currentTick?: number
  playerModels?: Record<string, { color?: string }>
  trajectories?: Trajectory[]
  showZones?: boolean
  selectedSteamId?: string | null
  onSelectPlayer?: (steamId: string | null) => void
}

const TEAM_COLOR: Record<string, number> = { T: 0xf2b134, CT: 0x4a90e2 }

/* Linear-interpolate every player's state at a (fractional) tick. */
function sampleAtTick(demo: DemoData | undefined, tick: number): PlayerState[] {
  if (!demo?.frames?.length) return []
  const f = demo.frames
  if (tick <= f[0].tick) return f[0].players
  if (tick >= f[f.length - 1].tick) return f[f.length - 1].players
  let lo = 0, hi = f.length - 1
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (f[m].tick <= tick) lo = m; else hi = m }
  const a = f[lo], b = f[hi]
  const t = (tick - a.tick) / Math.max(1e-6, b.tick - a.tick)
  const byId = new Map(b.players.map(p => [p.steamId, p]))
  return a.players.map(pa => {
    const pb = byId.get(pa.steamId) ?? pa
    return {
      ...pa,
      x: pa.x + (pb.x - pa.x) * t, y: pa.y + (pb.y - pa.y) * t, z: pa.z + (pb.z - pa.z) * t,
      yaw: (pa.yaw ?? 0) + (((pb.yaw ?? 0) - (pa.yaw ?? 0)) * t),
      alive: pb.alive ?? true,
    }
  })
}

interface Marker { group: THREE.Group; body: THREE.Mesh; bodyMat: THREE.MeshStandardMaterial; label: THREE.Sprite }

function makeNameSprite(text: string): THREE.Sprite {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64
  const ctx = cv.getContext('2d')!
  ctx.font = 'bold 26px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, 256, 64)
  ctx.fillStyle = '#fff'; ctx.fillText(text.slice(0, 16), 128, 34)
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false, transparent: true }))
  spr.scale.set(180, 45, 1); spr.position.set(0, PLAYER_HEIGHT + 50, 0)
  return spr
}

export default function MirageScene(props: MirageSceneProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  // Latest props for the render loop without re-initializing the scene.
  const propsRef = useRef(props); propsRef.current = props
  const markersRef = useRef<Map<string, Marker>>(new Map())
  const posRef = useRef<Map<string, THREE.Vector3>>(new Map())
  const trajRef = useRef<THREE.Group | null>(null)
  const trajKeyRef = useRef<string>('')

  // ── One-time scene setup ──
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const w = mount.clientWidth || 800, h = mount.clientHeight || 500

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0e1016)
    scene.fog = new THREE.Fog(0xb9c4cf, 4000, 11000)

    const camera = new THREE.PerspectiveCamera(55, w / h, 10, 20000)
    const start = getSpawnPosition('CT')
    camera.position.set(start.x + 1500, 2600, start.z + 1500)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(w, h); renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    mount.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true; controls.dampingFactor = 0.1
    controls.maxPolarAngle = Math.PI / 2.05; controls.target.set(0, 0, 800)

    // Lights
    scene.add(new THREE.HemisphereLight(0xbfd4e8, 0xb29773, 0.7))
    scene.add(new THREE.AmbientLight(0xffffff, 0.25))
    const sun = new THREE.DirectionalLight(0xfff2dd, 1.1)
    sun.position.set(2500, 4000, 1500); sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    Object.assign(sun.shadow.camera, { left: -4000, right: 4000, top: 4000, bottom: -4000, near: 100, far: 12000 })
    scene.add(sun)

    // Map + zone labels
    scene.add(createMirageScene())
    scene.add(addZoneLabels())

    // Calibration overlay (toggled via showZones)
    const overlay = new THREE.Group(); overlay.name = 'zoneOverlay'; overlay.visible = false
    for (const z of MIRAGE_ZONES) {
      const wd = Math.abs(z.x1 - z.x0), dp = Math.abs(z.y1 - z.y0)
      const col = z.kind === 't' ? 0xd98a3a : z.kind === 'ct' ? 0x4a78b0 : z.kind === 'a' ? 0xff7043 : z.kind === 'b' ? 0x42a5f5 : 0x888888
      const box = new THREE.Mesh(new THREE.BoxGeometry(wd, z.h, dp),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.12, depthWrite: false }))
      box.position.copy(worldToThree((z.x0 + z.x1) / 2, (z.y0 + z.y1) / 2, z.z + z.h / 2))
      overlay.add(box)
    }
    scene.add(overlay)

    // Raycast selection
    const ray = new THREE.Raycaster(), mouse = new THREE.Vector2()
    const onClick = (e: MouseEvent) => {
      const r = renderer.domElement.getBoundingClientRect()
      mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(mouse, camera)
      const bodies = [...markersRef.current.values()].map(m => m.body)
      const hit = ray.intersectObjects(bodies, false)[0]
      const id = hit ? (hit.object.userData.steamId as string) : null
      const cur = propsRef.current.selectedSteamId
      propsRef.current.onSelectPlayer?.(id && id === cur ? null : id)
    }
    renderer.domElement.addEventListener('click', onClick)

    const resize = () => {
      const nw = mount.clientWidth, nh = mount.clientHeight
      camera.aspect = nw / nh; camera.updateProjectionMatrix(); renderer.setSize(nw, nh)
    }
    const ro = new ResizeObserver(resize); ro.observe(mount)

    let raf = 0
    const tmp = new THREE.Vector3()
    const loop = () => {
      raf = requestAnimationFrame(loop)
      const p = propsRef.current
      overlay.visible = !!p.showZones
      syncMarkers(scene)         // update player markers to current tick
      syncTrajectories(scene)    // rebuild trajectory tubes if changed
      // Smooth follow of selected player
      if (p.selectedSteamId) {
        const pos = posRef.current.get(p.selectedSteamId)
        if (pos) { tmp.copy(pos).add(new THREE.Vector3(0, EYE_HEIGHT, 0)); controls.target.lerp(tmp, 0.12) }
      }
      controls.update()
      renderer.render(scene, camera)
    }
    loop()

    function syncMarkers(scn: THREE.Scene) {
      const p = propsRef.current
      const players = sampleAtTick(p.demoData, p.currentTick ?? 0)
      const seen = new Set<string>()
      posRef.current.clear()
      for (const pl of players) {
        seen.add(pl.steamId)
        let mk = markersRef.current.get(pl.steamId)
        if (!mk) {
          const group = new THREE.Group()
          const colorHex = p.playerModels?.[pl.steamId]?.color
            ? new THREE.Color(p.playerModels[pl.steamId].color!).getHex()
            : (TEAM_COLOR[pl.team] ?? 0xcccccc)
          const bodyMat = new THREE.MeshStandardMaterial({ color: colorHex })
          const body = new THREE.Mesh(new THREE.CapsuleGeometry(16, PLAYER_HEIGHT - 32, 4, 8), bodyMat)
          body.position.y = PLAYER_HEIGHT / 2; body.castShadow = true; body.userData.steamId = pl.steamId
          const cone = new THREE.Mesh(new THREE.ConeGeometry(18, 60, 12),
            new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.5 }))
          cone.rotation.x = Math.PI / 2; cone.position.set(0, EYE_HEIGHT, 40)
          const label = makeNameSprite(pl.name ?? '')
          group.add(body, cone, label); scn.add(group)
          mk = { group, body, bodyMat, label }
          markersRef.current.set(pl.steamId, mk)
        }
        const alive = pl.alive !== false
        mk.group.visible = alive
        if (!alive) continue
        const pos = worldToThree(pl.x, pl.y, pl.z)
        posRef.current.set(pl.steamId, pos.clone())
        mk.group.position.copy(pos)
        mk.group.rotation.y = THREE.MathUtils.degToRad(-(pl.yaw ?? 0)) - Math.PI / 2
        const sel = p.selectedSteamId === pl.steamId
        mk.bodyMat.emissive.setHex(sel ? mk.bodyMat.color.getHex() : 0x000000)
        mk.bodyMat.emissiveIntensity = sel ? 0.6 : 0
      }
      // Hide markers for players no longer present
      for (const [id, mk] of markersRef.current) if (!seen.has(id)) mk.group.visible = false
    }

    function syncTrajectories(scn: THREE.Scene) {
      const list = propsRef.current.trajectories ?? []
      const key = list.map(t => `${t.color}:${t.points.length}`).join('|')
      if (key === trajKeyRef.current) return
      trajKeyRef.current = key
      if (trajRef.current) { scn.remove(trajRef.current); trajRef.current.traverse(o => { const m = o as THREE.Mesh; m.geometry?.dispose?.() }) }
      const g = new THREE.Group()
      for (const tr of list) {
        if (tr.points.length < 2) continue
        const curve = new THREE.CatmullRomCurve3(tr.points.map(pt => worldToThree(pt.x, pt.y, pt.z)))
        const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(8, tr.points.length * 2), 6, 6, false),
          new THREE.MeshBasicMaterial({ color: tr.color ?? 0xffd54f }))
        g.add(tube)
      }
      trajRef.current = g; scn.add(g)
    }

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      renderer.domElement.removeEventListener('click', onClick)
      renderer.dispose()
      mount.removeChild(renderer.domElement)
      markersRef.current.clear()
    }
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
}
