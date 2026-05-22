// CS2 map radar calibration data + image URLs.
// Calibration values come from the game's radar info files:
//   pixel_x = (world_x - pos_x) / scale
//   pixel_y = (pos_y  - world_y) / scale
// The radar images are 1024×1024 px.

const RAW = 'https://raw.githubusercontent.com/ghostcap-gaming/cs2-map-images/main/cs2'

export interface MapConfig {
  imageUrl: string
  pos_x: number
  pos_y: number
  scale: number
}

export const MAP_CONFIGS: Record<string, MapConfig> = {
  de_mirage:   { imageUrl: `${RAW}/de_mirage.png`,   pos_x: -3230, pos_y:  1713, scale: 5.00 },
  de_inferno:  { imageUrl: `${RAW}/de_inferno.png`,  pos_x: -2087, pos_y:  3870, scale: 4.90 },
  de_dust2:    { imageUrl: `${RAW}/de_dust2.png`,    pos_x: -2476, pos_y:  3239, scale: 4.40 },
  de_nuke:     { imageUrl: `${RAW}/de_nuke.png`,     pos_x: -3453, pos_y:  2887, scale: 7.00 },
  de_ancient:  { imageUrl: `${RAW}/de_ancient.png`,  pos_x: -2953, pos_y:  2164, scale: 5.00 },
  de_anubis:   { imageUrl: `${RAW}/de_anubis.png`,   pos_x: -2796, pos_y:  3328, scale: 5.22 },
  de_overpass: { imageUrl: `${RAW}/de_overpass.png`, pos_x: -4831, pos_y:  1781, scale: 5.20 },
  de_vertigo:  { imageUrl: `${RAW}/de_vertigo.png`,  pos_x: -3168, pos_y:  1762, scale: 4.00 },
  de_train:    { imageUrl: `${RAW}/de_train.png`,    pos_x: -2477, pos_y:  2392, scale: 4.70 },
  de_cache:    { imageUrl: `${RAW}/de_cache.png`,    pos_x: -2000, pos_y:  3250, scale: 5.50 },
  de_basalt:   { imageUrl: `${RAW}/de_basalt.png`,   pos_x: -2592, pos_y:  2592, scale: 5.00 },
}

// ── Image loading ─────────────────────────────────────────────────────────────

const _cache = new Map<string, HTMLImageElement | null>()
const _pending = new Map<string, Promise<HTMLImageElement | null>>()

export function loadMapImage(mapName: string): Promise<HTMLImageElement | null> {
  const cfg = MAP_CONFIGS[mapName]
  if (!cfg) return Promise.resolve(null)
  const url = cfg.imageUrl
  if (_cache.has(url)) return Promise.resolve(_cache.get(url)!)
  if (_pending.has(url)) return _pending.get(url)!
  const p = new Promise<HTMLImageElement | null>(resolve => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload  = () => { _cache.set(url, img);   resolve(img)  }
    img.onerror = () => { _cache.set(url, null);  resolve(null) }
    img.src = url
  })
  _pending.set(url, p)
  return p
}

// ── Coordinate helpers ────────────────────────────────────────────────────────

// Convert CS2 world coordinates to canvas pixel coordinates.
// Assumes the map image fills canvasSize × canvasSize (square canvas).
export function worldToCanvas(
  wx: number, wy: number,
  cfg: MapConfig,
  canvasSize: number,
): [number, number] {
  const s = canvasSize / 1024
  return [
    ((wx - cfg.pos_x) / cfg.scale) * s,
    ((cfg.pos_y - wy) / cfg.scale) * s,
  ]
}
