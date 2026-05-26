// CS2 map callout zone definitions in world (Hammer) coordinates.
// Overview data used for reference transforms:
//   de_mirage:   pos_x=-3230, pos_y=1713, scale=5.0
//   de_inferno:  pos_x=-2087, pos_y=3870, scale=4.9
//   de_dust2:    pos_x=-2476, pos_y=3239, scale=4.4
//   de_nuke:     pos_x=-3453, pos_y=2887, scale=7.0
//   de_overpass: pos_x=-4831, pos_y=1781, scale=5.2
//   de_anubis:   pos_x=-2796, pos_y=3328, scale=5.22 (estimated)
//   de_ancient:  pos_x=-2953, pos_y=2164, scale=5.0  (estimated)
// Zone priority: higher = more specific; higher-priority zones take precedence on overlap.
// site field marks zones closely associated with a bomb site for execute detection.

import type { Round, GrenadeEvent } from '@/types/database'

type Zone = {
  name: string
  x_min: number
  x_max: number
  y_min: number
  y_max: number
  priority: number
  site?: 'A' | 'B'
}

// ── Zone definitions ──────────────────────────────────────────────────────────

const ZONES: Record<string, Zone[]> = {

  de_mirage: [
    // Broad regions (priority 5)
    { name: 'T Spawn',        x_min: -1200, x_max:   200, y_min: -3200, y_max: -2500, priority: 5 },
    { name: 'Mid',            x_min: -1400, x_max:   200, y_min: -1900, y_max:  -900, priority: 5 },
    { name: 'B Apartments',   x_min: -2400, x_max:  -900, y_min: -2900, y_max: -1500, priority: 5, site: 'B' },
    { name: 'B Site',         x_min: -3200, x_max: -2100, y_min: -1100, y_max:   100, priority: 5, site: 'B' },
    { name: 'A Apartments',   x_min: -1100, x_max:   200, y_min: -1200, y_max:  -300, priority: 5, site: 'A' },
    { name: 'A Site',         x_min:   400, x_max:  1400, y_min:  -700, y_max:   300, priority: 5, site: 'A' },
    { name: 'CT',             x_min:   500, x_max:  1600, y_min:   200, y_max:  1500, priority: 5 },
    // Mid sub-zones (priority 8)
    { name: 'Short',          x_min: -1100, x_max:  -100, y_min: -2600, y_max: -1800, priority: 8 },
    { name: 'Catwalk',        x_min:  -700, x_max:   100, y_min: -1900, y_max: -1200, priority: 8 },
    { name: 'Market',         x_min: -1600, x_max:  -600, y_min: -2500, y_max: -1500, priority: 8 },
    { name: 'Ticket Booth',   x_min: -1100, x_max:  -400, y_min: -2700, y_max: -2100, priority: 8 },
    // B sub-zones (priority 8)
    { name: 'B Short',        x_min: -2300, x_max: -1100, y_min: -1600, y_max:  -700, priority: 8, site: 'B' },
    { name: 'Van',            x_min: -2400, x_max: -1800, y_min:  -800, y_max:  -100, priority: 10, site: 'B' },
    // A sub-zones (priority 8–12)
    { name: 'Palace',         x_min: -1200, x_max:  -300, y_min: -1100, y_max:  -200, priority: 8,  site: 'A' },
    { name: 'Stairs',         x_min:   100, x_max:   700, y_min:  -900, y_max:  -300, priority: 10, site: 'A' },
    { name: 'Jungle',         x_min:   -50, x_max:   650, y_min:  -250, y_max:   700, priority: 8,  site: 'A' },
    { name: 'CT Entrance',    x_min:   650, x_max:  1150, y_min:   150, y_max:   750, priority: 12, site: 'A' },
    { name: 'Window',         x_min:  -900, x_max:  -100, y_min: -1500, y_max:  -900, priority: 10 },
  ],

  de_inferno: [
    // Broad regions
    { name: 'T Spawn',        x_min:  -700, x_max:   400, y_min:  -900, y_max:   200, priority: 5 },
    { name: 'A Apartments',   x_min:  -400, x_max:   700, y_min:   200, y_max:  1900, priority: 5, site: 'A' },
    { name: 'A Site',         x_min:   700, x_max:  1900, y_min:  2100, y_max:  3200, priority: 5, site: 'A' },
    { name: 'Banana',         x_min: -1900, x_max:  -700, y_min:   400, y_max:  2400, priority: 5, site: 'B' },
    { name: 'B Site',         x_min: -2100, x_max:  -800, y_min:  2100, y_max:  3100, priority: 5, site: 'B' },
    { name: 'CT Spawn',       x_min:  -700, x_max:   400, y_min:  3000, y_max:  3900, priority: 5 },
    { name: 'Mid',            x_min:  -700, x_max:   700, y_min:  1000, y_max:  2600, priority: 5 },
    // A sub-zones (priority 8–12)
    { name: 'A Short',        x_min:   300, x_max:  1300, y_min:  1200, y_max:  2300, priority: 8,  site: 'A' },
    { name: 'Balcony',        x_min:   400, x_max:  1000, y_min:  2000, y_max:  2700, priority: 10, site: 'A' },
    { name: 'Library',        x_min:   700, x_max:  1300, y_min:  2500, y_max:  3100, priority: 10, site: 'A' },
    { name: 'Pit',            x_min:  1200, x_max:  1900, y_min:  2200, y_max:  2900, priority: 10, site: 'A' },
    { name: 'Graveyard',      x_min:   100, x_max:   800, y_min:  2700, y_max:  3500, priority: 8,  site: 'A' },
    { name: 'CT from A',      x_min:  -200, x_max:   400, y_min:  3000, y_max:  3600, priority: 12, site: 'A' },
    // B sub-zones (priority 8–12)
    { name: 'Top Banana',     x_min: -1800, x_max:  -900, y_min:  1600, y_max:  2400, priority: 10, site: 'B' },
    { name: 'Car',            x_min: -1700, x_max: -1000, y_min:  2100, y_max:  2700, priority: 12, site: 'B' },
    { name: 'Dark',           x_min: -1600, x_max: -1000, y_min:  2500, y_max:  3100, priority: 12, site: 'B' },
    { name: 'CT from B',      x_min:  -700, x_max:     0, y_min:  2900, y_max:  3600, priority: 12, site: 'B' },
    { name: 'B Apartments',   x_min: -2200, x_max: -1500, y_min:  2000, y_max:  2900, priority: 8,  site: 'B' },
  ],

  de_dust2: [
    // Verified ref: pos_x=-2476, pos_y=3239, scale=4.4
    // Approx anchors: A site~(-1700,2350), B site~(1000,2950), T spawn~(-800,-600), CT~(-700,2900)
    { name: 'T Spawn',        x_min: -1300, x_max:  -300, y_min: -1200, y_max:   -50, priority: 5 },
    { name: 'Long A',         x_min: -2400, x_max: -1200, y_min:   600, y_max:  2100, priority: 5, site: 'A' },
    { name: 'A Site',         x_min: -2200, x_max:  -900, y_min:  2100, y_max:  3100, priority: 5, site: 'A' },
    { name: 'Mid',            x_min: -1000, x_max:   400, y_min:   600, y_max:  2200, priority: 5 },
    { name: 'B Tunnels',      x_min:   600, x_max:  1700, y_min:  1200, y_max:  2700, priority: 5, site: 'B' },
    { name: 'B Site',         x_min:   600, x_max:  1800, y_min:  2700, y_max:  3200, priority: 5, site: 'B' },
    { name: 'CT Spawn',       x_min: -1200, x_max:   200, y_min:  2600, y_max:  3200, priority: 5 },
    // A sub-zones
    { name: 'Long Doors',     x_min: -2300, x_max: -1700, y_min:  1300, y_max:  2000, priority: 10, site: 'A' },
    { name: 'Pit',            x_min: -2100, x_max: -1400, y_min:  2100, y_max:  2700, priority: 10, site: 'A' },
    { name: 'A Cross',        x_min: -1600, x_max:  -900, y_min:  2400, y_max:  3000, priority: 10, site: 'A' },
    { name: 'Catwalk',        x_min:  -700, x_max:   400, y_min:  1600, y_max:  2300, priority: 8  },
    { name: 'CT from A',      x_min: -1100, x_max:  -400, y_min:  2800, y_max:  3200, priority: 12, site: 'A' },
    // B sub-zones
    { name: 'B Platform',     x_min:   700, x_max:  1500, y_min:  2600, y_max:  3200, priority: 10, site: 'B' },
    { name: 'CT from B',      x_min:  -600, x_max:   300, y_min:  2700, y_max:  3200, priority: 12, site: 'B' },
  ],

  de_nuke: [
    // Verified ref: pos_x=-3453, pos_y=2887, scale=7.0
    // Anchors: A site~(-500,800), B site~(-500,800 lower Z), T Spawn~(-2700,-300), CT~(900,600)
    { name: 'T Spawn',        x_min: -3400, x_max: -1600, y_min:  -900, y_max:   700, priority: 5 },
    { name: 'Outside',        x_min: -2000, x_max:   200, y_min:  -700, y_max:  1700, priority: 5 },
    { name: 'A Site',         x_min:  -800, x_max:  1000, y_min:  -400, y_max:  1600, priority: 5, site: 'A' },
    { name: 'B Site',         x_min:  -800, x_max:  1000, y_min:  -400, y_max:  1600, priority: 4, site: 'B' }, // same XY, lower Z
    { name: 'CT Spawn',       x_min:   900, x_max:  2500, y_min:   100, y_max:  2000, priority: 5 },
    { name: 'Lobby',          x_min: -2200, x_max:  -600, y_min:  1600, y_max:  2900, priority: 5 },
    // Sub-zones
    { name: 'Ramp',           x_min: -2200, x_max:  -600, y_min:  -700, y_max:   600, priority: 8,  site: 'A' },
    { name: 'Silo',           x_min: -2200, x_max: -1200, y_min:   400, y_max:  1600, priority: 8  },
    { name: 'Heaven',         x_min:  -800, x_max:   500, y_min:   800, y_max:  2200, priority: 8,  site: 'A' },
    { name: 'Hut',            x_min:  -200, x_max:   900, y_min:  1200, y_max:  2100, priority: 10, site: 'A' },
    { name: 'Secret',         x_min:  -800, x_max:   200, y_min:  -900, y_max:  -300, priority: 10, site: 'B' },
    { name: 'Squeaky',        x_min:   600, x_max:  1500, y_min:  -500, y_max:   400, priority: 10, site: 'B' },
  ],

  de_overpass: [
    // Verified ref: pos_x=-4831, pos_y=1781, scale=5.2
    // Anchors: T Spawn~(-3200,-2800), A site~(-1800,-600), B site~(-3800,400), CT~(-1800,1100)
    { name: 'T Spawn',        x_min: -3800, x_max: -2300, y_min: -3500, y_max: -2100, priority: 5 },
    { name: 'Short',          x_min: -2700, x_max: -1500, y_min: -2300, y_max:  -900, priority: 5, site: 'A' },
    { name: 'A Site',         x_min: -2500, x_max: -1100, y_min:  -900, y_max:   200, priority: 5, site: 'A' },
    { name: 'Canal',          x_min: -4400, x_max: -3000, y_min: -1600, y_max:   300, priority: 5, site: 'B' },
    { name: 'B Site',         x_min: -4600, x_max: -3200, y_min:   200, y_max:  1400, priority: 5, site: 'B' },
    { name: 'CT Spawn',       x_min: -2600, x_max: -1100, y_min:   600, y_max:  1700, priority: 5 },
    { name: 'Mid',            x_min: -3000, x_max: -1500, y_min:  -900, y_max:   400, priority: 5 },
    // Sub-zones
    { name: 'Playground',     x_min: -2900, x_max: -2100, y_min: -2300, y_max: -1500, priority: 8,  site: 'A' },
    { name: 'A Long',         x_min: -2100, x_max: -1200, y_min: -2000, y_max: -1000, priority: 8,  site: 'A' },
    { name: 'Bank',           x_min: -2500, x_max: -1800, y_min:  -900, y_max:  -200, priority: 10, site: 'A' },
    { name: 'Party',          x_min: -4600, x_max: -3800, y_min: -1000, y_max:   200, priority: 8,  site: 'B' },
    { name: 'Fountain',       x_min: -4200, x_max: -3200, y_min:   100, y_max:   900, priority: 10, site: 'B' },
    { name: 'Connector',      x_min: -3200, x_max: -2200, y_min:  -500, y_max:   500, priority: 8  },
  ],

  de_anubis: [
    // Estimated from spawn anchors: CT~(-400,2192), T~(-416,-1696)
    // A site~(700,1200), B site~(-1500,1100)
    { name: 'T Spawn',        x_min: -1000, x_max:   200, y_min: -2200, y_max:  -900, priority: 5 },
    { name: 'Mid',            x_min:  -800, x_max:   600, y_min:  -600, y_max:   800, priority: 5 },
    { name: 'A Site',         x_min:   300, x_max:  1500, y_min:   700, y_max:  2000, priority: 5, site: 'A' },
    { name: 'B Site',         x_min: -1900, x_max:  -700, y_min:   600, y_max:  1900, priority: 5, site: 'B' },
    { name: 'CT Spawn',       x_min:  -900, x_max:   200, y_min:  1900, y_max:  2700, priority: 5 },
    // Sub-zones
    { name: 'A Main',         x_min:   100, x_max:   800, y_min:   100, y_max:  1000, priority: 8,  site: 'A' },
    { name: 'A Connector',    x_min:   700, x_max:  1500, y_min:   300, y_max:   900, priority: 8,  site: 'A' },
    { name: 'A CT',           x_min:   200, x_max:   800, y_min:  1700, y_max:  2400, priority: 10, site: 'A' },
    { name: 'B Alley',        x_min: -1800, x_max:  -700, y_min:  -200, y_max:   800, priority: 8,  site: 'B' },
    { name: 'B CT',           x_min: -1600, x_max:  -600, y_min:  1600, y_max:  2400, priority: 10, site: 'B' },
    { name: 'Palace',         x_min:  -900, x_max:   100, y_min:   700, y_max:  1600, priority: 8  },
  ],

  de_ancient: [
    // Estimated from spawn anchors: CT~(-400,1600), T~(-480,-2352)
    // A site~(300,900), B site~(-800,700)
    { name: 'T Spawn',        x_min:  -900, x_max:   100, y_min: -2800, y_max: -1600, priority: 5 },
    { name: 'Mid',            x_min:  -700, x_max:   300, y_min: -1000, y_max:   400, priority: 5 },
    { name: 'A Site',         x_min:  -100, x_max:  1000, y_min:   400, y_max:  1600, priority: 5, site: 'A' },
    { name: 'B Site',         x_min: -1400, x_max:  -300, y_min:   100, y_max:  1300, priority: 5, site: 'B' },
    { name: 'CT Spawn',       x_min:  -900, x_max:   100, y_min:  1300, y_max:  2100, priority: 5 },
    // Sub-zones
    { name: 'A Main',         x_min:  -300, x_max:   500, y_min:  -200, y_max:   700, priority: 8,  site: 'A' },
    { name: 'A Ramp',         x_min:   100, x_max:   800, y_min:   100, y_max:   700, priority: 10, site: 'A' },
    { name: 'A CT',           x_min:   -50, x_max:   600, y_min:  1200, y_max:  1900, priority: 10, site: 'A' },
    { name: 'Cave',           x_min:  -700, x_max:  -100, y_min:  -600, y_max:   300, priority: 8  },
    { name: 'B Main',         x_min: -1300, x_max:  -400, y_min:  -500, y_max:   400, priority: 8,  site: 'B' },
    { name: 'B CT',           x_min: -1200, x_max:  -300, y_min:   900, y_max:  1700, priority: 10, site: 'B' },
    { name: 'Middle',         x_min:  -500, x_max:   200, y_min:   300, y_max:  1000, priority: 8  },
  ],
}

// ── Zone lookup ───────────────────────────────────────────────────────────────

export function getZoneForPosition(
  map: string,
  x: number,
  y: number,
): { name: string; site?: 'A' | 'B' } | null {
  const zones = ZONES[map]
  if (!zones) return null

  const matches = zones
    .filter(z => x >= z.x_min && x <= z.x_max && y >= z.y_min && y <= z.y_max)
    .sort((a, b) => b.priority - a.priority)

  if (!matches[0]) return null
  return { name: matches[0].name, site: matches[0].site }
}

// ── Cross-round pattern detection ─────────────────────────────────────────────

type EconClass = 'eco' | 'force' | 'full_buy'

function classifyEconomy(teamEconomy: number): EconClass {
  if (teamEconomy < 2000) return 'eco'
  if (teamEconomy < 10000) return 'force'
  return 'full_buy'
}

type SiteSummary = {
  rounds: number
  smokeZones: Record<string, number>   // zone name → count of rounds it appeared in
  flashZones: Record<string, number>
  molotovZones: Record<string, number>
}

type PatternOutput = {
  text: string[]
  hasData: boolean
}

export function detectTacticalPatterns(
  allRoundSets: Round[][],
  map: string,
): PatternOutput {
  const output: string[] = []

  // Flatten rounds from all demos, keeping round objects
  const allRounds = allRoundSets.flat()
  if (allRounds.length === 0) return { text: [], hasData: false }

  // Group by economy class — use minimum team economy as T-side approximation
  const byEcon: Record<EconClass, Round[]> = { eco: [], force: [], full_buy: [] }
  allRounds.forEach(r => {
    const econ = Math.min(r.team1_economy ?? 0, r.team2_economy ?? 0)
    if (econ > 0) byEcon[classifyEconomy(econ)].push(r)
  })

  const econLabels: Record<EconClass, string> = {
    eco: 'Eco rounds',
    force: 'Force buy rounds',
    full_buy: 'Full buy rounds',
  }

  for (const econ of (['full_buy', 'force', 'eco'] as EconClass[])) {
    const rounds = byEcon[econ]
    if (rounds.length < 2) continue

    const siteSummaries: Record<'A' | 'B', SiteSummary> = {
      A: { rounds: 0, smokeZones: {}, flashZones: {}, molotovZones: {} },
      B: { rounds: 0, smokeZones: {}, flashZones: {}, molotovZones: {} },
    }
    let unknownSite = 0

    rounds.forEach(r => {
      const grenades = r.grenades ?? []
      const smokes  = grenades.filter(g => g.type === 'smoke')
      const flashes = grenades.filter(g => g.type === 'flash')
      const mols    = grenades.filter(g => g.type === 'molotov')

      // Detect which site was attacked based on where smokes land
      const siteCounts: Record<string, number> = { A: 0, B: 0 }
      grenades.forEach((g: GrenadeEvent) => {
        const zone = getZoneForPosition(map, g.land_x, g.land_y)
        if (zone?.site) siteCounts[zone.site] = (siteCounts[zone.site] ?? 0) + 1
      })

      const site = siteCounts.A > siteCounts.B ? 'A'
        : siteCounts.B > siteCounts.A ? 'B'
        : null

      if (!site) { unknownSite++; return }

      const s = siteSummaries[site]
      s.rounds++

      const addZones = (list: GrenadeEvent[], bucket: Record<string, number>) => {
        const seen = new Set<string>()
        list.forEach((g: GrenadeEvent) => {
          const zone = getZoneForPosition(map, g.land_x, g.land_y)
          if (zone && !seen.has(zone.name)) {
            seen.add(zone.name)
            bucket[zone.name] = (bucket[zone.name] ?? 0) + 1
          }
        })
      }

      addZones(smokes, s.smokeZones)
      addZones(flashes, s.flashZones)
      addZones(mols, s.molotovZones)
    })

    const totalSited = siteSummaries.A.rounds + siteSummaries.B.rounds
    if (totalSited === 0) continue

    output.push(`\n${econLabels[econ]} (${rounds.length} rounds across demos):`)

    const aPct = Math.round((siteSummaries.A.rounds / rounds.length) * 100)
    const bPct = Math.round((siteSummaries.B.rounds / rounds.length) * 100)
    output.push(`  Site preference: A ${aPct}% | B ${bPct}%${unknownSite > 0 ? ` | mixed/unknown ${Math.round((unknownSite / rounds.length) * 100)}%` : ''}`)

    for (const site of (['A', 'B'] as const)) {
      const s = siteSummaries[site]
      if (s.rounds < 2) continue

      output.push(`  ${site} site executes (${s.rounds} rounds):`)

      const formatZones = (bucket: Record<string, number>, label: string) => {
        const top = Object.entries(bucket)
          .filter(([, c]) => c >= 2 || c / s.rounds >= 0.4)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([name, c]) => `${name} (${Math.round((c / s.rounds) * 100)}%)`)
        if (top.length > 0) output.push(`    ${label}: ${top.join(', ')}`)
      }
      formatZones(s.smokeZones,  'Common smokes')
      formatZones(s.flashZones,  'Flash zones')
      formatZones(s.molotovZones, 'Molotovs')

      // Detect signature combinations: sets of ≥2 zones that appear together in ≥40% of rounds
      const smokeSets = rounds
        .map(r => {
          const siteCounts: Record<string, number> = { A: 0, B: 0 }
          ;(r.grenades ?? []).forEach((g: GrenadeEvent) => {
            const z = getZoneForPosition(map, g.land_x, g.land_y)
            if (z?.site) siteCounts[z.site] = (siteCounts[z.site] ?? 0) + 1
          })
          const roundSite = siteCounts.A > siteCounts.B ? 'A' : siteCounts.B > siteCounts.A ? 'B' : null
          if (roundSite !== site) return null

          const zones = new Set<string>()
          ;(r.grenades ?? [])
            .filter(g => g.type === 'smoke')
            .forEach((g: GrenadeEvent) => {
              const z = getZoneForPosition(map, g.land_x, g.land_y)
              if (z) zones.add(z.name)
            })
          return zones.size > 0 ? zones : null
        })
        .filter(Boolean) as Set<string>[]

      if (smokeSets.length >= 3) {
        // Find pairs/triples that co-occur
        const comboFreq: Record<string, number> = {}
        smokeSets.forEach(zoneSet => {
          const arr = Array.from(zoneSet).sort()
          // Record all 2-combinations
          for (let i = 0; i < arr.length; i++) {
            for (let j = i + 1; j < arr.length; j++) {
              const key = `${arr[i]} + ${arr[j]}`
              comboFreq[key] = (comboFreq[key] ?? 0) + 1
            }
          }
        })
        const signature = Object.entries(comboFreq)
          .filter(([, c]) => c / smokeSets.length >= 0.5)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([combo, c]) => `[${combo}] ${Math.round((c / smokeSets.length) * 100)}%`)

        if (signature.length > 0) {
          output.push(`    Signature smoke combinations: ${signature.join(', ')}`)
        }
      }
    }
  }

  return { text: output, hasData: output.length > 0 }
}
