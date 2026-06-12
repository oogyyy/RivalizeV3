// Verified CS2 callout lists per active-duty map, grouped by territory.
// Injected into AI strategy prompts so the model grounds positions in real
// callouts and respects side ownership (e.g. never starts a T player in
// CT-only territory).

export interface MapCallouts {
  /** Reachable from T spawn in the opening seconds without crossing a site */
  tSide: string[]
  /** Contested ground both sides fight over early */
  contested: string[]
  aSite: string[]
  bSite: string[]
  /** CT-controlled territory — T players cannot be here in the first ~30s */
  ctSide: string[]
  /** Vision/elevation facts — what positions physically can and cannot see */
  vision?: string[]
}

export const MAP_CALLOUTS: Record<string, MapCallouts> = {
  de_mirage: {
    tSide:     ['T Spawn', 'T Ramp', 'Palace Alley', 'Top Mid', 'Underpass'],
    contested: ['Mid', 'Mid Boxes', 'Catwalk', 'B Short', 'Ladder Room'],
    aSite:     ['A Site', 'A Ramp', 'Palace', 'Tetris', 'Sandwich', 'Stairs', 'Firebox', 'Triple Box', 'Default Plant', 'Ninja'],
    bSite:     ['B Site', 'Van', 'Bench', 'B Apartments', 'Upper Apartments', 'Lower Apartments', 'Kitchen', 'Market', 'Market Window', 'Market Door'],
    ctSide:    ['CT Spawn', 'Connector', 'Jungle', 'Window'],
    vision:    [
      'Underpass is a tunnel BELOW Mid — from inside it there is no line of sight to Window, Top Mid or Connector; a player must exit up to Mid level to hold those angles',
      'Window (Sniper\'s Nest) is elevated and overlooks Mid, Top Mid, the Underpass exit and Connector',
      'Palace overlooks A site from above; Jungle and Stairs face A site from the CT side',
    ],
  },
  de_dust2: {
    tSide:     ['T Spawn', 'Outside Tunnels', 'Upper Tunnels', 'Lower Tunnels', 'Outside Long', 'Top Mid', 'Suicide'],
    contested: ['Mid', 'Mid Doors', 'Xbox', 'Catwalk', 'Short Stairs', 'Long Doors'],
    aSite:     ['A Site', 'Long A', 'Pit', 'Goose', 'Barrels', 'A Car', 'A Ramp', 'A Plat', 'Short'],
    bSite:     ['B Site', 'B Platform', 'Back Plat', 'B Car', 'Big Box', 'Double Stack', 'B Window', 'B Doors'],
    ctSide:    ['CT Spawn', 'CT Mid'],
    vision:    [
      'Lower Tunnels run BENEATH Upper Tunnels — no sight of B, Mid or Upper until exiting',
      'Catwalk is elevated above Mid; Mid Doors and CT Mid sightlines run the full length of Mid',
    ],
  },
  de_inferno: {
    tSide:     ['T Spawn', 'Buggy', 'Bridge', 'Second Mid', 'Alt Mid', 'Bottom Banana', 'T Apartments Entrance'],
    contested: ['Mid', 'Top Mid', 'Boiler', 'Apartments', 'Banana', 'Sandbags', 'Logs', 'Car', 'Half Wall'],
    aSite:     ['A Site', 'Default', 'Pit', 'Quad', 'Graveyard', 'Balcony', 'Porch', 'Truck'],
    bSite:     ['B Site', 'Coffins', 'Dark', 'New Box', 'First Oranges', 'Spools', 'Garden', 'Construction', 'Fountain'],
    ctSide:    ['CT Spawn', 'Arch', 'Library', 'Moto', 'Speedway'],
    vision:    [
      'Pit is sunken below A site — a player in Pit cannot see Balcony or Apartments exits until they peek up',
      'Balcony overlooks A site from Apartments; Arch and Library face A from the CT side',
    ],
  },
  de_nuke: {
    tSide:     ['T Spawn', 'Lobby', 'Outside', 'Silo', 'T Red'],
    contested: ['Ramp', 'Squeaky', 'Main', 'Trophy', 'Garage', 'Secret'],
    aSite:     ['A Site', 'Hut', 'Heaven', 'Hell', 'Rafters', 'A Default'],
    bSite:     ['B Site', 'Dark', 'Decon', 'Doors', 'Vents', 'Window', 'Control Room'],
    ctSide:    ['CT Spawn', 'CT Red', 'Heaven'],
    vision:    [
      'A site and B site are stacked VERTICALLY — the same map position on different floors; players on A cannot see or shoot B and vice versa',
      'Heaven is elevated above A site; Vents connect the floors but have no sightlines outward',
    ],
  },
  de_overpass: {
    tSide:     ['T Spawn', 'Playground', 'Park', 'Toilets', 'Fountain'],
    contested: ['Long A', 'Short', 'Connector', 'Canal', 'Water', 'Monster', 'Sewers', 'Lower Tunnels'],
    aSite:     ['A Site', 'Bank', 'Truck', 'Dice', 'Bridge', 'Party'],
    bSite:     ['B Site', 'Pillar', 'Barrels', 'Graffiti', 'B Short', 'Sandbags'],
    ctSide:    ['CT Spawn', 'Heaven'],
    vision:    [
      'Water/Sewers run BENEATH the B site level — no sight of B until emerging at Monster or Short stairs',
      'Heaven overlooks B site from above; Bank and Truck face A site at ground level',
    ],
  },
  de_ancient: {
    tSide:     ['T Spawn', 'Temple', 'Outside A', 'Outside B'],
    contested: ['Mid', 'Doors', 'Cave', 'Alley'],
    aSite:     ['A Site', 'A Main', 'Donut', 'Red Room'],
    bSite:     ['B Site', 'B Main', 'B Ramp', 'Long', 'Short', 'Lane', 'Cubby'],
    ctSide:    ['CT Spawn', 'A CT', 'B CT'],
    vision:    [
      'Donut is an enclosed room off A — no sightlines beyond its doorways',
      'Mid Doors block all Mid sightlines until opened space is taken',
    ],
  },
  de_anubis: {
    tSide:     ['T Spawn', 'Upper Mid', 'Outside A', 'B Palace Entrance'],
    contested: ['Mid', 'Water', 'Bridge', 'Connector', 'Canal', 'Palace'],
    aSite:     ['A Site', 'A Main', 'A Long', 'Heaven'],
    bSite:     ['B Site', 'B Main', 'Street', 'Back B'],
    ctSide:    ['CT Spawn', 'A CT', 'B CT'],
    vision:    [
      'Water/Canal is sunken below Bridge level — limited upward sightlines until climbing out',
      'Heaven overlooks A site from above',
    ],
  },
  de_vertigo: {
    tSide:     ['T Spawn', 'T Stairs'],
    contested: ['Mid', 'Ladder', 'Yellow', 'Elevators', 'Scaffolding', 'A Ramp', 'B Stairs'],
    aSite:     ['A Site', 'A Default', 'Sandbags', 'Generator Room'],
    bSite:     ['B Site', 'B Default', 'Back B', 'Generator'],
    ctSide:    ['CT Spawn'],
    vision:    [
      'The map has two floors — the lower level (via Ladder/Elevators) has NO sight of A or B until a player comes back up',
      'Scaffolding on A Ramp is exposed to the whole ramp sightline',
    ],
  },
}

/**
 * Builds a prompt block listing the verified callouts for a map, grouped by
 * territory ownership. Returns '' for unknown maps.
 */
export function calloutGuide(map: string): string {
  const c = MAP_CALLOUTS[map]
  if (!c) return ''
  return `
VERIFIED CALLOUTS for ${map} — every position you name MUST come from this list. Do not invent or rename positions:
- T-side territory (where T players start and can be in the opening seconds): ${c.tSide.join(', ')}
- Contested ground (either side may fight here early): ${c.contested.join(', ')}
- A site area: ${c.aSite.join(', ')}
- B site area: ${c.bSite.join(', ')}
- CT-side territory (T players CANNOT be here in the first 30 seconds; CT players start here or on the sites): ${c.ctSide.join(', ')}${c.vision?.length ? `
VISION & ELEVATION FACTS for ${map} — a player can only hold or peek an angle their position physically sees. Never assign a hold that violates these:
${c.vision.map(v => `- ${v}`).join('\n')}` : ''}`
}
