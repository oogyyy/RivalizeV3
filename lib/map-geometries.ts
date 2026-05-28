// Simplified 3D geometry regions for CS2 Active Duty maps.
//
// UV coordinates match the radar PNG from MurkyYT/cs2-map-icons:
//   u=0 = left  edge  (world_x = pos_x)
//   u=1 = right edge  (world_x = pos_x + scale*1024)
//   v=0 = top   edge  (world_y = pos_y)            ← north in-game
//   v=1 = bottom edge (world_y = pos_y - scale*1024) ← south in-game
//
// Conversion formula:
//   u = (world_x - pos_x) / (scale * 1024)
//   v = (pos_y - world_y) / (scale * 1024)
//
// y = floor elevation in scene units.  Ground plane = 0.
// The playable map fills a MAP_PLANE×MAP_PLANE square (default 20×20 units).
//
// Height guide (scene units):
//   -0.40  deep underground (nuke lower)
//   -0.15  depressed below ground (water, canal)
//    0.00  ground / T-spawn reference
//   +0.10  minor step (tunnel mouth, slight ramp)
//   +0.25  medium platform (CT spawn, palace)
//   +0.35  major bombsite platform (A site on most maps)
//   +0.62  highly elevated (overpass B, nuke upper)

export interface GeoRegion {
  u0: number; v0: number  // top-left UV  (inclusive)
  u1: number; v1: number  // bottom-right UV (inclusive)
  y: number               // floor surface elevation (scene units)
  type: 'platform' | 'wall'
  wallH?: number          // wall height in scene units (walls only; default 1.5)
}

export const MAP_GEO_DATA: Record<string, GeoRegion[]> = {

  // ── de_mirage ─────────────────────────────────────────────────────────────
  // pos_x=-3230  pos_y=1713  scale=5.00
  // u=(wx+3230)/5120   v=(1713−wy)/5120
  // A site: northeast (upper-right of radar)
  // B site: northwest (upper-left of radar)
  // T spawn: south-center (lower-center)
  de_mirage: [
    // ── Platforms ────────────────────────────────────────────────────────
    { u0:0.35, v0:0.02, u1:0.54, v1:0.16, y: 0.38, type:'platform' }, // A site
    { u0:0.24, v0:0.16, u1:0.40, v1:0.34, y: 0.20, type:'platform' }, // T ramp / palace approach
    { u0:0.44, v0:0.16, u1:0.56, v1:0.30, y: 0.28, type:'platform' }, // A short
    { u0:0.10, v0:0.02, u1:0.24, v1:0.16, y: 0.08, type:'platform' }, // B site
    { u0:0.10, v0:0.14, u1:0.26, v1:0.38, y: 0.10, type:'platform' }, // B apartments
    { u0:0.36, v0:0.28, u1:0.56, v1:0.46, y: 0.12, type:'platform' }, // mid / window
    { u0:0.44, v0:0.36, u1:0.64, v1:0.54, y: 0.24, type:'platform' }, // CT / van area
    { u0:0.22, v0:0.62, u1:0.46, v1:0.80, y: 0.00, type:'platform' }, // T spawn
    // ── Walls ────────────────────────────────────────────────────────────
    { u0:0.52, v0:0.00, u1:0.60, v1:0.18, y:0, wallH:1.80, type:'wall' }, // market building
    { u0:0.10, v0:0.38, u1:0.24, v1:0.62, y:0, wallH:2.00, type:'wall' }, // palace building
    { u0:0.26, v0:0.38, u1:0.38, v1:0.52, y:0, wallH:1.30, type:'wall' }, // jungle / top mid
  ],

  // ── de_dust2 ──────────────────────────────────────────────────────────────
  // pos_x=-2476  pos_y=3239  scale=4.40
  // u=(wx+2476)/4506   v=(3239−wy)/4506
  // A site: northeast (upper-right)   B site: west (left-center)
  // Long A runs across the top of the radar
  de_dust2: [
    // ── Platforms ────────────────────────────────────────────────────────
    { u0:0.54, v0:0.20, u1:0.66, v1:0.40, y: 0.50, type:'platform' }, // catwalk / short-A (highest)
    { u0:0.64, v0:0.04, u1:0.82, v1:0.20, y: 0.32, type:'platform' }, // A site
    { u0:0.68, v0:0.36, u1:0.90, v1:0.56, y: 0.28, type:'platform' }, // CT spawn
    { u0:0.40, v0:0.30, u1:0.58, v1:0.50, y: 0.14, type:'platform' }, // mid lower
    { u0:0.08, v0:0.30, u1:0.28, v1:0.48, y: 0.18, type:'platform' }, // B site
    { u0:0.14, v0:0.04, u1:0.64, v1:0.20, y: 0.05, type:'platform' }, // long A corridor
    { u0:0.26, v0:0.52, u1:0.44, v1:0.66, y: 0.08, type:'platform' }, // B upper tunnels
    { u0:0.10, v0:0.62, u1:0.42, v1:0.78, y: 0.00, type:'platform' }, // T spawn
    // ── Walls ────────────────────────────────────────────────────────────
    { u0:0.14, v0:0.02, u1:0.64, v1:0.08, y:0,    wallH:1.40, type:'wall' }, // long-A top wall
    { u0:0.82, v0:0.02, u1:0.90, v1:0.38, y:0,    wallH:1.40, type:'wall' }, // A-site back wall
    { u0:0.44, v0:0.38, u1:0.54, v1:0.48, y:0.14, wallH:0.70, type:'wall' }, // mid box
  ],

  // ── de_inferno ────────────────────────────────────────────────────────────
  // pos_x=-2087  pos_y=3870  scale=4.90
  // u=(wx+2087)/5018   v=(3870−wy)/5018
  // A site: northeast (upper-right, elevated)
  // B site: northwest (upper-left, behind banana approach)
  de_inferno: [
    // ── Platforms ────────────────────────────────────────────────────────
    { u0:0.52, v0:0.06, u1:0.74, v1:0.26, y: 0.42, type:'platform' }, // A site
    { u0:0.46, v0:0.22, u1:0.58, v1:0.34, y: 0.42, type:'platform' }, // A balcony / arch
    { u0:0.06, v0:0.28, u1:0.22, v1:0.44, y: 0.20, type:'platform' }, // B site
    { u0:0.12, v0:0.44, u1:0.48, v1:0.64, y: 0.06, type:'platform' }, // banana
    { u0:0.36, v0:0.20, u1:0.54, v1:0.40, y: 0.28, type:'platform' }, // CT spawn / arch
    { u0:0.14, v0:0.68, u1:0.42, v1:0.88, y: 0.00, type:'platform' }, // T spawn
    { u0:0.28, v0:0.40, u1:0.48, v1:0.56, y: 0.08, type:'platform' }, // 2nd mid / grotto
    // ── Walls ────────────────────────────────────────────────────────────
    { u0:0.70, v0:0.04, u1:0.82, v1:0.18, y:0,    wallH:2.10, type:'wall' }, // A construction building
    { u0:0.55, v0:0.32, u1:0.65, v1:0.42, y:0.42, wallH:1.00, type:'wall' }, // A balcony wall
    { u0:0.05, v0:0.28, u1:0.14, v1:0.44, y:0,    wallH:1.90, type:'wall' }, // B-site building
    { u0:0.54, v0:0.06, u1:0.64, v1:0.22, y:0,    wallH:1.60, type:'wall' }, // CT tower / apts
  ],

  // ── de_nuke ───────────────────────────────────────────────────────────────
  // pos_x=-3453  pos_y=2887  scale=7.00
  // u=(wx+3453)/7168   v=(2887−wy)/7168
  // Special: upper and lower bomb sites share the same 2D footprint.
  // They are differentiated by y (upper=+0.65, lower=-0.44).
  de_nuke: [
    // ── Platforms ────────────────────────────────────────────────────────
    { u0:0.18, v0:0.10, u1:0.50, v1:0.44, y:  0.65, type:'platform' }, // upper site
    { u0:0.18, v0:0.10, u1:0.50, v1:0.44, y: -0.44, type:'platform' }, // lower site
    { u0:0.50, v0:0.12, u1:0.84, v1:0.56, y:  0.22, type:'platform' }, // outside / lobby
    { u0:0.52, v0:0.56, u1:0.80, v1:0.80, y:  0.42, type:'platform' }, // CT / ramp area
    { u0:0.22, v0:0.72, u1:0.46, v1:0.88, y:  0.10, type:'platform' }, // hut / T entry
    // ── Walls ────────────────────────────────────────────────────────────
    { u0:0.36, v0:0.08, u1:0.56, v1:0.48, y:0,    wallH:2.60, type:'wall' }, // silo / main building
    { u0:0.16, v0:0.08, u1:0.22, v1:0.80, y:0,    wallH:1.80, type:'wall' }, // reactor left wall
    { u0:0.18, v0:0.44, u1:0.50, v1:0.50, y:0.22, wallH:0.50, type:'wall' }, // garage roof edge
  ],

  // ── de_ancient ────────────────────────────────────────────────────────────
  // pos_x=-2953  pos_y=2164  scale=5.00
  // u=(wx+2953)/5120   v=(2164−wy)/5120
  // A site: northeast (upper-right)   B site: west (left-center)
  de_ancient: [
    // ── Platforms ────────────────────────────────────────────────────────
    { u0:0.56, v0:0.12, u1:0.78, v1:0.36, y: 0.32, type:'platform' }, // A site
    { u0:0.50, v0:0.32, u1:0.66, v1:0.50, y: 0.20, type:'platform' }, // A short
    { u0:0.08, v0:0.40, u1:0.32, v1:0.62, y: 0.24, type:'platform' }, // B site
    { u0:0.30, v0:0.24, u1:0.56, v1:0.48, y: 0.12, type:'platform' }, // mid
    { u0:0.44, v0:0.46, u1:0.68, v1:0.68, y: 0.22, type:'platform' }, // CT spawn
    { u0:0.18, v0:0.68, u1:0.48, v1:0.86, y: 0.00, type:'platform' }, // T spawn
    { u0:0.08, v0:0.28, u1:0.26, v1:0.44, y: 0.10, type:'platform' }, // cave / B entry
    // ── Walls ────────────────────────────────────────────────────────────
    { u0:0.76, v0:0.10, u1:0.84, v1:0.36, y:0, wallH:1.60, type:'wall' }, // A-site ruins wall
    { u0:0.38, v0:0.30, u1:0.48, v1:0.42, y:0, wallH:1.30, type:'wall' }, // donut / mid pillar
    { u0:0.06, v0:0.38, u1:0.16, v1:0.54, y:0, wallH:1.50, type:'wall' }, // B-site building
  ],

  // ── de_anubis ─────────────────────────────────────────────────────────────
  // pos_x=-2796  pos_y=3328  scale=5.22
  // u=(wx+2796)/5345   v=(3328−wy)/5345
  // A site: northeast (upper-right, elevated temple)
  // B site: northwest (upper-left)  Water: center (depressed)
  de_anubis: [
    // ── Platforms ────────────────────────────────────────────────────────
    { u0:0.54, v0:0.06, u1:0.80, v1:0.30, y:  0.32, type:'platform' }, // A site
    { u0:0.46, v0:0.22, u1:0.60, v1:0.40, y:  0.18, type:'platform' }, // A connector
    { u0:0.08, v0:0.44, u1:0.30, v1:0.66, y:  0.22, type:'platform' }, // B site
    { u0:0.28, v0:0.26, u1:0.54, v1:0.48, y:  0.10, type:'platform' }, // mid
    { u0:0.30, v0:0.46, u1:0.54, v1:0.62, y: -0.18, type:'platform' }, // water crossing (depressed)
    { u0:0.42, v0:0.48, u1:0.66, v1:0.68, y:  0.20, type:'platform' }, // CT spawn
    { u0:0.14, v0:0.70, u1:0.46, v1:0.88, y:  0.00, type:'platform' }, // T spawn
    // ── Walls ────────────────────────────────────────────────────────────
    { u0:0.76, v0:0.04, u1:0.84, v1:0.30, y:0, wallH:1.50, type:'wall' }, // A temple wall
    { u0:0.06, v0:0.42, u1:0.14, v1:0.58, y:0, wallH:1.60, type:'wall' }, // B arch building
    { u0:0.34, v0:0.30, u1:0.44, v1:0.42, y:0, wallH:1.00, type:'wall' }, // mid ruins / boat
  ],

  // ── de_overpass ───────────────────────────────────────────────────────────
  // pos_x=-4831  pos_y=1781  scale=5.20
  // u=(wx+4831)/5325   v=(1781−wy)/5325
  // A site: center-south (under bridge — depressed)
  // B site: upper-right (highly elevated platform)
  // T spawn: upper-left (elevated)
  de_overpass: [
    // ── Platforms ────────────────────────────────────────────────────────
    { u0:0.12, v0:0.52, u1:0.40, v1:0.76, y: -0.22, type:'platform' }, // A site (under bridge)
    { u0:0.54, v0:0.10, u1:0.82, v1:0.44, y:  0.62, type:'platform' }, // B site (elevated)
    { u0:0.24, v0:0.22, u1:0.54, v1:0.50, y: -0.12, type:'platform' }, // mid / water fountain
    { u0:0.10, v0:0.06, u1:0.46, v1:0.26, y:  0.42, type:'platform' }, // T upper spawn
    { u0:0.50, v0:0.50, u1:0.78, v1:0.72, y:  0.28, type:'platform' }, // CT spawn
    { u0:0.12, v0:0.34, u1:0.36, v1:0.54, y: -0.30, type:'platform' }, // canal / lower mid
    // ── Walls ────────────────────────────────────────────────────────────
    { u0:0.32, v0:0.36, u1:0.52, v1:0.56, y:0, wallH:2.10, type:'wall' }, // bridge structure
    { u0:0.10, v0:0.26, u1:0.18, v1:0.56, y:0, wallH:1.60, type:'wall' }, // underpass wall
    { u0:0.80, v0:0.08, u1:0.90, v1:0.44, y:0, wallH:1.50, type:'wall' }, // B-site back wall
  ],
}

// Returns the approximate floor elevation (scene Y) at a given 3D scene position.
// Picks the smallest containing platform region for specificity.
// Falls back to 0 for unmapped maps or positions outside all regions.
export function getMapFloorHeight(
  x3d: number,
  z3d: number,
  mapName: string,
  mapPlane = 20,
): number {
  const regions = MAP_GEO_DATA[mapName]
  if (!regions) return 0
  const u = x3d / mapPlane + 0.5
  const v = z3d / mapPlane + 0.5
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
