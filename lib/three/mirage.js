// lib/three/mirage.js
// Procedural de_mirage blockout for the CS2 demo replayer.
// Geometry is authored in native CS2 world units and aligned to the same
// zone boxes the demo parser uses, so demoinfocs player positions drop in
// with a single coordinate transform.
//
// ┌── COORDINATE SYSTEM ─────────────────────────────────────────────────┐
// │ CS2 / Source 2:  right-handed, Z-UP, 1 unit ≈ 1 inch.                 │
// │ demoinfocs-golang player.Position() = r3.Vector{ X, Y, Z } (units).   │
// │ Three.js is Y-UP, so the bridge is:                                   │
// │     three(x, y, z) = ( worldX, worldZ, -worldY )                      │
// │ Use worldToThree() everywhere you place something from demo data.     │
// │ Player hull: 32×32 wide, 72 tall; eye height ~64.                     │
// └───────────────────────────────────────────────────────────────────────┘
import * as THREE from 'three'

export const PLAYER_HEIGHT = 72
export const EYE_HEIGHT = 64

/** Convert CS2 world coords (Z-up) → Three.js (Y-up). */
export function worldToThree(x, y, z = 0) {
  return new THREE.Vector3(x, z, -y)
}

/* ---------------------------------------------------------------------------
 * ZONE / AREA DATA  (world-unit footprints; z = floor height, h = wall height)
 * Footprints mirror the parser's de_mirage zone boxes so the model lines up
 * with parsed positions. floor/wall heights are tunable estimates.
 * ------------------------------------------------------------------------- */
export const MIRAGE_ZONES = [
  { name: 'T Spawn',      x0: -1200, x1:  200, y0: -3200, y1: -2500, z: -120, h: 320, kind: 't'  },
  { name: 'Mid',          x0: -1400, x1:  200, y0: -1900, y1:  -900, z: -150, h: 380, kind: 'n'  },
  { name: 'B Apartments', x0: -2400, x1: -900, y0: -2900, y1: -1500, z: -160, h: 300, kind: 'n'  },
  { name: 'B Site',       x0: -3200, x1:-2100, y0: -1100, y1:   100, z: -300, h: 360, kind: 'b'  },
  { name: 'A Apartments', x0: -1100, x1:  200, y0: -1200, y1:  -300, z: -120, h: 300, kind: 'n'  },
  { name: 'A Site',       x0:   400, x1: 1400, y0:  -700, y1:   300, z: -170, h: 400, kind: 'a'  },
  { name: 'CT Spawn',     x0:   500, x1: 1600, y0:   200, y1:  1500, z:  -40, h: 340, kind: 'ct' },
  { name: 'Short',        x0: -1100, x1: -100, y0: -2600, y1: -1800, z: -150, h: 280, kind: 'n'  },
  { name: 'Market',       x0: -1600, x1: -600, y0: -2500, y1: -1500, z: -180, h: 280, kind: 'n'  },
  { name: 'B Short',      x0: -2300, x1:-1100, y0: -1600, y1:  -700, z: -220, h: 280, kind: 'b'  },
  { name: 'Jungle',       x0:   -50, x1:  650, y0:  -250, y1:   700, z: -120, h: 280, kind: 'a'  },
  { name: 'CT Entrance',  x0:   650, x1: 1150, y0:   150, y1:   750, z:  -60, h: 260, kind: 'ct' },
]

/** Hero landmark blocks: [name, x0,x1, y0,y1, zBottom, height]. */
export const MIRAGE_LANDMARKS = [
  ["Sniper's Nest", -900, -500, -1500, -1100, -150, 140],
  ['Catwalk',       -700,  100, -1900, -1200, -120,  40],
  ['Connector',     -300,  300,  -900,  -300, -140, 220],
  ['Palace',       -1200, -300, -1100,  -200,  -40, 200],
  ['Ramp',           300,  650,  -900,  -300, -170, 120],
  ['Tetris',         850, 1100,  -550,  -300, -170,  90],
  ['Van',          -2400,-1800,  -800,  -100, -300, 110],
  ['Boost Boxes',  -3050,-2750,  -300,    50, -300, 130],
]

const CRATES = [
  [-600, -1500, -150], [-450, -1400, -150], [-520, -1250, -150],
  [ 900,  -450, -170], [1020,  -480, -170],
  [-2600, -700, -300], [-2750, -550, -300],
]

const SPAWNS = {
  T:  { x: -500, y: -2900, z: -120 },
  CT: { x: 1050, y:   900, z:  -40 },
}
const BOMB_SITES = {
  A: { x:  1000, y: -150, z: -170 },
  B: { x: -2650, y: -450, z: -300 },
}

/* ---------------------------------------------------------------------------
 * MATERIALS
 * ------------------------------------------------------------------------- */
function makeMaterials() {
  const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0, ...o })
  return {
    base:     std(0x2a2d33, { roughness: 1 }),
    floor:    std(0x6b6b64),
    wall:     std(0xc2a878),       // mirage sandstone
    landmark: std(0xb5996f),
    crate:    std(0x9c7b4a),
    tint_t:   std(0xd98a3a, { transparent: true, opacity: 0.16 }),
    tint_ct:  std(0x4a78b0, { transparent: true, opacity: 0.16 }),
    tint_a:   std(0xff7043, { transparent: true, opacity: 0.12 }),
    tint_b:   std(0x42a5f5, { transparent: true, opacity: 0.12 }),
  }
}

/* Box spanning a world footprint, vertical from zBottom for `height`. */
function boxBetween(x0, x1, y0, y1, zBottom, height, mat) {
  const w = Math.abs(x1 - x0), d = Math.abs(y1 - y0)
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, height, d), mat)
  mesh.position.set((x0 + x1) / 2, zBottom + height / 2, -(y0 + y1) / 2)
  mesh.castShadow = mesh.receiveShadow = true
  return mesh
}

function buildArea(area, mats) {
  const g = new THREE.Group(); g.name = area.name
  g.add(boxBetween(area.x0, area.x1, area.y0, area.y1, area.z - 12, 12, mats.floor))   // slab
  const tint = mats[`tint_${area.kind}`]
  if (tint) g.add(boxBetween(area.x0, area.x1, area.y0, area.y1, area.z, 2, tint))      // side tint
  const t = 16                                                                          // outline walls
  g.add(boxBetween(area.x0, area.x0 + t, area.y0, area.y1, area.z, area.h, mats.wall))
  g.add(boxBetween(area.x1 - t, area.x1, area.y0, area.y1, area.z, area.h, mats.wall))
  g.add(boxBetween(area.x0, area.x1, area.y0, area.y0 + t, area.z, area.h, mats.wall))
  g.add(boxBetween(area.x0, area.x1, area.y1 - t, area.y1, area.z, area.h, mats.wall))
  return g
}

/* ---------------------------------------------------------------------------
 * PUBLIC: createMirageScene() → THREE.Group of all map geometry (no lights).
 * ------------------------------------------------------------------------- */
export function createMirageScene({ spawns = true, bombSites = true } = {}) {
  const mats = makeMaterials()
  const root = new THREE.Group(); root.name = 'de_mirage'

  // Base ground under the whole playable space.
  root.add(boxBetween(-3400, 1900, -3400, 1700, -340, 12, mats.base))

  const areas = new THREE.Group(); areas.name = 'areas'
  MIRAGE_ZONES.forEach(a => areas.add(buildArea(a, mats)))
  root.add(areas)

  const land = new THREE.Group(); land.name = 'landmarks'
  MIRAGE_LANDMARKS.forEach(([n, x0, x1, y0, y1, z, h]) => {
    const b = boxBetween(x0, x1, y0, y1, z, h, mats.landmark); b.name = n; land.add(b)
  })
  root.add(land)

  // Crates via InstancedMesh (cheap repeated props).
  const SIZE = 96
  const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(SIZE, SIZE, SIZE), mats.crate, CRATES.length)
  const dummy = new THREE.Object3D()
  CRATES.forEach(([x, y, z], i) => {
    dummy.position.copy(worldToThree(x, y, z + SIZE / 2))
    dummy.rotation.y = i * 0.6; dummy.updateMatrix()
    inst.setMatrixAt(i, dummy.matrix)
  })
  inst.castShadow = inst.receiveShadow = true; inst.name = 'crates'
  root.add(inst)

  if (bombSites) {
    const sg = new THREE.Group(); sg.name = 'bombsites'
    for (const [label, color] of [['A', 0xff7043], ['B', 0x42a5f5]]) {
      const p = BOMB_SITES[label]
      const c = new THREE.Mesh(
        new THREE.CylinderGeometry(220, 220, 8, 32),
        new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.3 }),
      )
      c.position.copy(worldToThree(p.x, p.y, p.z + 4)); c.name = `site_${label}`
      sg.add(c)
    }
    root.add(sg)
  }

  if (spawns) {
    const sp = new THREE.Group(); sp.name = 'spawns'
    const cluster = (side, color) => {
      const a = SPAWNS[side]
      for (let i = 0; i < 5; i++) {
        const r = new THREE.Mesh(new THREE.RingGeometry(28, 38, 24),
          new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }))
        r.rotation.x = -Math.PI / 2
        r.position.copy(worldToThree(a.x + (i - 2) * 90, a.y, a.z + 2))
        sp.add(r)
      }
    }
    cluster('T', 0x4ade80); cluster('CT', 0x60a5fa)
    root.add(sp)
  }

  return root
}

/* ---------------------------------------------------------------------------
 * HELPERS
 * ------------------------------------------------------------------------- */

/** Three.js position of a side's spawn (for default camera / spawn markers). */
export function getSpawnPosition(side) {
  const s = SPAWNS[String(side).toUpperCase()] ?? SPAWNS.T
  return worldToThree(s.x, s.y, s.z)
}

/** Three.js position of a bomb site center. */
export function getBombSitePosition(site) {
  const s = BOMB_SITES[String(site).toUpperCase()] ?? BOMB_SITES.A
  return worldToThree(s.x, s.y, s.z)
}

/** Build a Group of floating text sprites labeling the major zones. */
export function addZoneLabels({ scale = 1, color = '#ffffff' } = {}) {
  const g = new THREE.Group(); g.name = 'zoneLabels'
  for (const z of MIRAGE_ZONES) {
    const cx = (z.x0 + z.x1) / 2, cy = (z.y0 + z.y1) / 2
    g.add(makeTextSprite(z.name, worldToThree(cx, cy, z.z + z.h + 60), scale, color))
  }
  return g
}

function makeTextSprite(text, pos, scale = 1, color = '#ffffff') {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64
  const ctx = cv.getContext('2d')
  ctx.font = 'bold 30px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, 256, 64)
  ctx.fillStyle = color; ctx.fillText(text, 128, 34)
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false, transparent: true }))
  spr.position.copy(pos); spr.scale.set(280 * scale, 70 * scale, 1)
  return spr
}
