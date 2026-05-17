/**
 * Binary demo file header parser — no native addons required.
 *
 * Supports:
 *  • CS:GO / Source 1 demos  ("HL2DEMO\0")  — fixed-offset header, very reliable
 *  • CS2  / Source 2 demos   ("PBDEMS2\0")  — protobuf, map name scanned from first 8 KB
 *
 * Returns null for non-demo files so callers can fall back gracefully.
 */

export interface DemoHeaderInfo {
  format: 'csgo' | 'cs2' | 'unknown'
  mapName: string | null
  serverName: string | null
  durationSeconds: number | null
}

const CSGO_MAGIC = Buffer.from('HL2DEMO\x00')
const CS2_MAGIC = Buffer.from('PBDEMS2\x00')

// CS:GO fixed-layout offsets (bytes)
const CSGO_SERVER_NAME_OFFSET = 16    // 260 bytes
const CSGO_CLIENT_NAME_OFFSET = 276   // 260 bytes
const CSGO_MAP_NAME_OFFSET    = 536   // 260 bytes
const CSGO_DURATION_OFFSET    = 1096  // float32

function readNullTerminated(buf: Buffer, offset: number, maxLen: number): string {
  const slice = buf.slice(offset, offset + maxLen)
  const nullIdx = slice.indexOf(0)
  return slice.slice(0, nullIdx >= 0 ? nullIdx : maxLen).toString('ascii').trim()
}

const MAP_NAME_RE = /^(?:de|ar|cs|gg|aim|surf|kz)_[a-z0-9_]{2,40}$/

/**
 * Primary: search for the protobuf field-5 (map_name in CDemoFileHeader) tag byte.
 * In CS2 PBDEMS2 files the CDemoFileHeader proto encodes map_name as field 5,
 * wire type 2 (length-delimited) → tag byte 0x2a.  Reading the exact length
 * prefix means we get the real string without false positives.
 */
function findProtoMapName(buf: Buffer): string | null {
  // (5 << 3) | 2 = 42 = 0x2a
  const TAG = 0x2a

  for (let i = 8; i < buf.length - 6; i++) {
    if (buf[i] !== TAG) continue

    // Decode the length varint that follows the tag byte
    let pos = i + 1
    let len = 0
    let shift = 0
    let ok = false
    while (pos < buf.length) {
      const b = buf[pos++]
      len |= (b & 0x7f) << shift
      if (!(b & 0x80)) { ok = true; break }
      shift += 7
      if (shift > 21) break // varint too long
    }

    if (!ok || len < 4 || len > 60 || pos + len > buf.length) continue

    const candidate = buf.slice(pos, pos + len).toString('ascii')
    if (MAP_NAME_RE.test(candidate)) return candidate
  }
  return null
}

/**
 * Fallback: scan raw bytes for known CS2 map prefixes.
 * Used when the protobuf tag approach finds nothing (e.g. unusual encoding).
 */
function scanForMapName(buf: Buffer): string | null {
  const raw = buf.toString('binary')
  const prefixes = ['de_', 'ar_', 'cs_', 'gg_', 'aim_', 'surf_', 'kz_']

  for (const prefix of prefixes) {
    let searchFrom = 0
    while (true) {
      const idx = raw.indexOf(prefix, searchFrom)
      if (idx === -1) break
      const prevChar = idx > 0 ? raw[idx - 1] : ''
      if (prevChar && /[a-z0-9_]/i.test(prevChar)) { searchFrom = idx + 1; continue }
      let end = idx
      while (end < raw.length && /[a-z0-9_]/i.test(raw[end])) end++
      const candidate = raw.slice(idx, end)
      if (MAP_NAME_RE.test(candidate)) return candidate
      searchFrom = idx + 1
    }
  }
  return null
}

/**
 * Parse the header of a demo file from a Buffer containing at least the first 8 KB.
 * Returns null if the buffer does not look like a CS demo.
 */
export function parseDemoHeader(buf: Buffer): DemoHeaderInfo | null {
  if (buf.length < 8) return null

  const magic = buf.slice(0, 8)

  // ── CS:GO / Source 1 ──────────────────────────────────────────────────────
  if (magic.equals(CSGO_MAGIC)) {
    const mapName    = buf.length > CSGO_MAP_NAME_OFFSET    ? readNullTerminated(buf, CSGO_MAP_NAME_OFFSET, 260)    : null
    const serverName = buf.length > CSGO_SERVER_NAME_OFFSET ? readNullTerminated(buf, CSGO_SERVER_NAME_OFFSET, 260) : null
    const duration   = buf.length > CSGO_DURATION_OFFSET + 4
      ? buf.readFloatLE(CSGO_DURATION_OFFSET)
      : null

    return {
      format: 'csgo',
      mapName: mapName && mapName.length > 0 ? mapName : null,
      serverName: serverName && serverName.length > 0 ? serverName : null,
      durationSeconds: duration && Number.isFinite(duration) ? Math.round(duration) : null,
    }
  }

  // ── CS2 / Source 2 (protobuf) ─────────────────────────────────────────────
  if (magic.equals(CS2_MAGIC)) {
    // Try the proto-aware extractor first (reads the exact CDemoFileHeader
    // map_name field via its tag byte), then fall back to a raw prefix scan.
    const mapName = findProtoMapName(buf) ?? scanForMapName(buf.slice(16))
    return {
      format: 'cs2',
      mapName,
      serverName: null, // requires full protobuf decode
      durationSeconds: null,
    }
  }

  return null
}
