// CS2 map radar calibration data + image URLs.
// Images are the official game radar PNGs (1024×1024) extracted from CS2 PSD files.
// Source: https://github.com/MurkyYT/cs2-map-icons
//
// Calibration formula (matches Valve's overview files):
//   pixel_x = (world_x - pos_x) / scale
//   pixel_y = (pos_y  - world_y) / scale

const RAW = 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/radars'

export interface MapConfig {
  imageUrl: string
  pos_x: number
  pos_y: number
  scale: number
  // Optional 3D GLB model.  When present, the flat radar plane is replaced by
  // the real geometry.  Transform is auto-computed from pos_x/pos_y/scale but
  // yOffset lets you nudge the model up/down if needed.
  glbUrl?: string
  glbYOffset?: number
}

export const MAP_CONFIGS: Record<string, MapConfig> = {
  de_mirage:   { imageUrl: `${RAW}/de_mirage_radar_psd.png`,   pos_x: -3230, pos_y:  1713, scale: 5.00, glbUrl: '/maps/de_mirage.glb' },
  de_inferno:  { imageUrl: `${RAW}/de_inferno_radar_psd.png`,  pos_x: -2087, pos_y:  3870, scale: 4.90 },
  de_dust2:    { imageUrl: `${RAW}/de_dust2_radar_psd.png`,    pos_x: -2476, pos_y:  3239, scale: 4.40 },
  de_nuke:     { imageUrl: `${RAW}/de_nuke_radar_psd.png`,     pos_x: -3453, pos_y:  2887, scale: 7.00 },
  de_ancient:  { imageUrl: `${RAW}/de_ancient_radar_psd.png`,  pos_x: -2953, pos_y:  2164, scale: 5.00 },
  de_anubis:   { imageUrl: `${RAW}/de_anubis_radar_psd.png`,   pos_x: -2796, pos_y:  3328, scale: 5.22 },
  de_overpass: { imageUrl: `${RAW}/de_overpass_radar_psd.png`, pos_x: -4831, pos_y:  1781, scale: 5.20 },
  de_vertigo:  { imageUrl: `${RAW}/de_vertigo_radar_psd.png`,  pos_x: -3168, pos_y:  1762, scale: 4.00 },
  de_train:    { imageUrl: `${RAW}/de_train_radar_psd.png`,    pos_x: -2477, pos_y:  2392, scale: 4.70 },
  de_cache:    { imageUrl: `${RAW}/de_cache_radar_psd.png`,    pos_x: -2000, pos_y:  3250, scale: 5.50 },
  cs_italy:    { imageUrl: `${RAW}/cs_italy_radar_psd.png`,    pos_x: -2647, pos_y:  2592, scale: 4.60 },
  cs_office:   { imageUrl: `${RAW}/cs_office_radar_psd.png`,   pos_x: -1838, pos_y:  1858, scale: 3.00 },
  ar_baggage:  { imageUrl: `${RAW}/ar_baggage_radar_psd.png`,  pos_x: -1316, pos_y:  1571, scale: 3.55 },
}

// ── Map thumbnails (for page headers) ────────────────────────────────────────

const THUMBS = 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs'

export const MAP_THUMBS: Record<string, string> = {
  de_mirage:   `${THUMBS}/de_mirage_png.png`,
  de_inferno:  `${THUMBS}/de_inferno_png.png`,
  de_dust2:    `${THUMBS}/de_dust2_png.png`,
  de_nuke:     `${THUMBS}/de_nuke_png.png`,
  de_ancient:  `${THUMBS}/de_ancient_png.png`,
  de_anubis:   `${THUMBS}/de_anubis_png.png`,
  de_overpass: `${THUMBS}/de_overpass_png.png`,
  de_vertigo:  `${THUMBS}/de_vertigo_png.png`,
  de_train:    `${THUMBS}/de_train_png.png`,
  de_cache:    `${THUMBS}/de_cache_png.png`,
  cs_italy:    `${THUMBS}/cs_italy_png.png`,
  cs_office:   `${THUMBS}/cs_office_png.png`,
  ar_baggage:  `${THUMBS}/ar_baggage_png.png`,
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
