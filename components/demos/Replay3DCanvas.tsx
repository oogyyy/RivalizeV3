'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Loader2, RotateCcw } from 'lucide-react'
import { MAP_CONFIGS, loadMapImage } from '@/lib/map-config'
import type { ParsedDemoData } from '@/types/database'

// Size of the map ground plane in Three.js world units
const MAP_PLANE = 20

// Neon green accent color (matches app theme: #00ff87)
const NEON = 0x00ff87

export interface Replay3DProps {
  mapName: string
  parsed: ParsedDemoData | null
  team1?: string
  team2?: string
}

export default function Replay3DCanvas({ mapName }: Replay3DProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const el = mountRef.current
    if (!el) return

    let cancelled = false
    let animId: number

    const W = el.clientWidth
    const H = el.clientHeight || 560

    // ── Scene ───────────────────────────────────────────────────────────────
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x070a16)
    scene.fog = new THREE.FogExp2(0x070a16, 0.014)

    // ── Camera — "Commander View": angled top-down ──────────────────────────
    const cam = new THREE.PerspectiveCamera(45, W / H, 0.1, 200)
    cam.position.set(0, 22, 13)
    cam.lookAt(0, 0, 0)
    cameraRef.current = cam

    // ── Renderer ────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(W, H)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.1
    el.appendChild(renderer.domElement)

    // ── Lighting ─────────────────────────────────────────────────────────────
    // Sky/ground hemisphere for ambient tone
    scene.add(new THREE.HemisphereLight(0x1e2b50, 0x040508, 0.65))

    // Main directional "spotlight from above" — casts shadows
    const sun = new THREE.DirectionalLight(0xffffff, 1.9)
    sun.position.set(8, 25, 10)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    const sc = sun.shadow.camera as THREE.OrthographicCamera
    sc.near = 1; sc.far = 80
    sc.left = -18; sc.right = 18; sc.top = 18; sc.bottom = -18
    scene.add(sun)

    // Neon corner point lights — "glowing table" effect
    const cornerOffsets: [number, number][] = [
      [-MAP_PLANE / 2, -MAP_PLANE / 2],
      [ MAP_PLANE / 2, -MAP_PLANE / 2],
      [-MAP_PLANE / 2,  MAP_PLANE / 2],
      [ MAP_PLANE / 2,  MAP_PLANE / 2],
    ]
    for (const [cx, cz] of cornerOffsets) {
      const pt = new THREE.PointLight(NEON, 0.6, MAP_PLANE * 1.5, 2)
      pt.position.set(cx, 0.6, cz)
      scene.add(pt)
    }

    // ── Dark table surface extending beyond the map ──────────────────────────
    const tableMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.MeshStandardMaterial({ color: 0x040710, roughness: 1, metalness: 0 }),
    )
    tableMesh.rotation.x = -Math.PI / 2
    tableMesh.position.y = -0.03
    tableMesh.receiveShadow = true
    scene.add(tableMesh)

    // ── Map ground plane ─────────────────────────────────────────────────────
    const mapMat = new THREE.MeshStandardMaterial({
      color: 0x1a2a3a,
      roughness: 0.72,
      metalness: 0.04,
      emissive: new THREE.Color(0x0a1825),
      emissiveIntensity: 0.28,
    })
    const mapMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(MAP_PLANE, MAP_PLANE),
      mapMat,
    )
    mapMesh.rotation.x = -Math.PI / 2
    mapMesh.receiveShadow = true
    scene.add(mapMesh)

    // Load radar texture via the existing cached loader (handles crossOrigin)
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

    // ── Neon green border ────────────────────────────────────────────────────
    const half = MAP_PLANE / 2
    const bY = 0.06

    const buildBorder = (h: number, inset: number, opacity: number) => {
      const i = inset
      const pts = [
        new THREE.Vector3(-h + i, bY, -h + i),
        new THREE.Vector3( h - i, bY, -h + i),
        new THREE.Vector3( h - i, bY,  h - i),
        new THREE.Vector3(-h + i, bY,  h - i),
        new THREE.Vector3(-h + i, bY, -h + i),
      ]
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: NEON, transparent: opacity < 1, opacity }),
      )
      scene.add(line)
    }

    buildBorder(half, 0,    1.0)   // outer — bright
    buildBorder(half, 0.18, 0.28)  // inner — subtle double-edge effect

    // ── Subtle tick marks at cardinal edges ──────────────────────────────────
    const tickLen = 0.5
    const tY = bY + 0.005
    const ticks: [THREE.Vector3, THREE.Vector3][] = [
      // North/South midpoints
      [new THREE.Vector3(-tickLen / 2, tY, -half), new THREE.Vector3(tickLen / 2, tY, -half)],
      [new THREE.Vector3(-tickLen / 2, tY,  half), new THREE.Vector3(tickLen / 2, tY,  half)],
      // East/West midpoints
      [new THREE.Vector3(-half, tY, -tickLen / 2), new THREE.Vector3(-half, tY,  tickLen / 2)],
      [new THREE.Vector3( half, tY, -tickLen / 2), new THREE.Vector3( half, tY,  tickLen / 2)],
    ]
    for (const [a, b] of ticks) {
      scene.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([a, b]),
          new THREE.LineBasicMaterial({ color: NEON, opacity: 0.55, transparent: true }),
        ),
      )
    }

    // ── OrbitControls (commander-friendly settings) ──────────────────────────
    const controls = new OrbitControls(cam, renderer.domElement)
    controls.target.set(0, 0, 0)
    controls.enableDamping = true
    controls.dampingFactor = 0.07
    controls.minDistance = 4
    controls.maxDistance = 48
    controls.minPolarAngle = 0            // can look straight down
    controls.maxPolarAngle = Math.PI * 0.47  // ~85° max tilt — can't go below table
    controls.rotateSpeed = 0.6
    controls.panSpeed = 0.6
    controls.zoomSpeed = 1.25
    controls.update()
    controlsRef.current = controls

    // ── Render loop ──────────────────────────────────────────────────────────
    const tick = () => {
      animId = requestAnimationFrame(tick)
      controls.update()
      renderer.render(scene, cam)
    }
    tick()

    // ── Resize observer ──────────────────────────────────────────────────────
    const ro = new ResizeObserver(() => {
      const nw = el.clientWidth
      const nh = el.clientHeight
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
      renderer.dispose()
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
    }
  }, [mapName])

  function resetCamera() {
    const cam = cameraRef.current
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
      {/* Three.js canvas mount */}
      <div ref={mountRef} className="absolute inset-0" />

      {/* Loading overlay */}
      {!loaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#070a16]">
          <Loader2 size={28} className="text-neon-green animate-spin" />
          <p className="text-xs text-muted-foreground font-mono">Loading 3D scene…</p>
        </div>
      )}

      {/* HUD overlay — shown once loaded */}
      {loaded && (
        <>
          {/* Map name badge */}
          <div className="absolute top-3 left-3 pointer-events-none select-none">
            <span className="bg-black/60 backdrop-blur-sm border border-neon-green/20 text-neon-green text-[11px] font-mono font-semibold px-2.5 py-1 rounded-md uppercase tracking-widest">
              {mapName.replace('de_', '').replace('cs_', '').replace('ar_', '')}
            </span>
          </div>

          {/* Reset camera button */}
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
              Commander View
            </span>
            <span className="bg-black/40 backdrop-blur-sm text-[10px] text-muted-foreground/60 font-mono px-2 py-1 rounded">
              Drag · Scroll · Right-drag pan
            </span>
          </div>
        </>
      )}
    </div>
  )
}
