// Positional analytics derived from kill and grenade coordinates already
// stored in demos.parsed_data, mapped onto the callout zones in cs2-zones.ts.
// No parser changes required — this mines the position data the parser
// already captures per kill (killer/victim x,y) and per grenade (land x,y).

import { getZoneForPosition } from './cs2-zones'
import type { Round, Kill, GrenadeEvent } from '@/types/database'

type ZoneCount = Record<string, number>

function topZones(bucket: ZoneCount, total: number, limit = 4, minShare = 0.08): string[] {
  return Object.entries(bucket)
    .filter(([, c]) => c / total >= minShare)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, c]) => `${name} (${Math.round((c / total) * 100)}%)`)
}

function fmtClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/**
 * Summarises positional tendencies for one map across one or more demos.
 *
 * @param roundSets     rounds grouped per demo (same shape detectTacticalPatterns takes)
 * @param map           CS2 map name, e.g. de_mirage (must exist in cs2-zones)
 * @param focusPlayers  player names whose perspective we analyse (the opponent's
 *                      roster in scouting mode, your own roster in self mode).
 *                      Omitted → all players are included.
 */
export function summarizeZoneTendencies(
  roundSets: Round[][],
  map: string,
  focusPlayers?: Set<string>,
): { text: string[]; hasData: boolean } {
  const rounds = roundSets.flat()
  const allKills: Kill[] = rounds.flatMap(r => r.kills ?? [])
  if (allKills.length === 0) return { text: [], hasData: false }

  // Bail out early on maps without zone definitions
  if (!getZoneForPosition(map, 0, 0) && !allKills.some(k => getZoneForPosition(map, k.killer_x, k.killer_y))) {
    return { text: [], hasData: false }
  }

  const inFocus = (name: string) => !focusPlayers || focusPlayers.has(name)
  const lines: string[] = []

  // ── Where they take their kills from (holding/shooting positions) ──────────
  const killOrigins: ZoneCount = {}
  const killsByPlayer: Record<string, ZoneCount> = {}
  let focusKills = 0
  for (const k of allKills) {
    if (!inFocus(k.killer_name)) continue
    const z = getZoneForPosition(map, k.killer_x, k.killer_y)
    if (!z) continue
    focusKills++
    killOrigins[z.name] = (killOrigins[z.name] ?? 0) + 1
    if (!killsByPlayer[k.killer_name]) killsByPlayer[k.killer_name] = {}
    killsByPlayer[k.killer_name][z.name] = (killsByPlayer[k.killer_name][z.name] ?? 0) + 1
  }
  if (focusKills >= 10) {
    const zones = topZones(killOrigins, focusKills)
    if (zones.length > 0) lines.push(`Kill positions (where they shoot from): ${zones.join(', ')}`)
  }

  // ── Where they die ──────────────────────────────────────────────────────────
  const deathZones: ZoneCount = {}
  let focusDeaths = 0
  for (const k of allKills) {
    if (!inFocus(k.victim_name)) continue
    const z = getZoneForPosition(map, k.victim_x, k.victim_y)
    if (!z) continue
    focusDeaths++
    deathZones[z.name] = (deathZones[z.name] ?? 0) + 1
  }
  if (focusDeaths >= 10) {
    const zones = topZones(deathZones, focusDeaths)
    if (zones.length > 0) lines.push(`Death locations (where they get caught): ${zones.join(', ')}`)
  }

  // ── Per-player positioning profiles (top fraggers in the focus set) ─────────
  const profiles = Object.entries(killsByPlayer)
    .map(([name, zones]) => ({ name, total: Object.values(zones).reduce((a, b) => a + b, 0), zones }))
    .filter(p => p.total >= 8)
    .sort((a, b) => b.total - a.total)
    .slice(0, 4)
  for (const p of profiles) {
    const fav = topZones(p.zones, p.total, 3, 0.15)
    if (fav.length > 0) lines.push(`${p.name} holds/frags from: ${fav.join(', ')}`)
  }

  // ── Opening duels ───────────────────────────────────────────────────────────
  const openers: ZoneCount = {}
  const openerTimes: number[] = []
  for (const r of rounds) {
    const first = (r.kills ?? [])[0]
    if (!first) continue
    const z = getZoneForPosition(map, first.victim_x, first.victim_y)
    if (!z) continue
    openers[z.name] = (openers[z.name] ?? 0) + 1
    openerTimes.push(first.time)
  }
  const openerTotal = Object.values(openers).reduce((a, b) => a + b, 0)
  if (openerTotal >= 8) {
    const zones = topZones(openers, openerTotal, 3, 0.12)
    const avgT = openerTimes.reduce((a, b) => a + b, 0) / openerTimes.length
    if (zones.length > 0) {
      lines.push(`Opening duels happen at: ${zones.join(', ')} — avg first blood ${fmtClock(avgT)} into the round`)
    }
  }

  // ── Execute timing per site (first grenade landing in a site zone) ─────────
  const siteTimes: Record<'A' | 'B', number[]> = { A: [], B: [] }
  for (const r of rounds) {
    const siteCounts: Record<'A' | 'B', number> = { A: 0, B: 0 }
    let firstSiteNade: { site: 'A' | 'B'; time: number } | null = null
    for (const g of (r.grenades ?? []) as GrenadeEvent[]) {
      const z = getZoneForPosition(map, g.land_x, g.land_y)
      if (!z?.site) continue
      siteCounts[z.site]++
      if (!firstSiteNade || g.land_time < firstSiteNade.time) {
        firstSiteNade = { site: z.site, time: g.land_time }
      }
    }
    const site = siteCounts.A > siteCounts.B ? 'A' : siteCounts.B > siteCounts.A ? 'B' : null
    if (site && firstSiteNade && firstSiteNade.site === site) {
      siteTimes[site].push(firstSiteNade.time)
    }
  }
  for (const site of ['A', 'B'] as const) {
    const times = siteTimes[site]
    if (times.length < 3) continue
    const sorted = [...times].sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]
    const early = times.filter(t => t <= 35).length
    const style = early / times.length >= 0.5 ? 'fast hits' : 'slow/default-heavy'
    lines.push(`${site} executes: utility starts landing ~${fmtClock(median)} into the round (${times.length} rounds, ${style})`)
  }

  return { text: lines, hasData: lines.length > 0 }
}

/**
 * Resolves the focus roster (player names) for a parsed demo, given which
 * side is the one being analysed.
 */
export function focusRoster(
  players: Array<{ name: string; team: string }> | undefined,
  header: { team1?: string; team2?: string } | undefined,
  opponentSide: string | undefined,
  perspective: 'opponent' | 'self',
): Set<string> {
  const out = new Set<string>()
  if (!players) return out
  const side = opponentSide ?? 'team2'
  const opponentLabel = side === 'team1' ? header?.team1 : header?.team2
  for (const p of players) {
    const isOpponent = p.team === opponentLabel
    if (perspective === 'opponent' ? isOpponent : !isOpponent) out.add(p.name)
  }
  return out
}
