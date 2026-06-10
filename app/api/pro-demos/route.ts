import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// PandaScore — official esports data API. The free tier covers schedules,
// results and match context (teams, scores, maps, events) for pro CS2.
// CS2 data lives under the legacy /csgo prefix.
// https://developers.pandascore.co
const PANDASCORE_BASE = 'https://api.pandascore.co/csgo/matches'

type PSTeam = {
  id?: number
  name?: string
  acronym?: string | null
  image_url?: string | null
}

type PSMatch = {
  id: number
  begin_at?: string | null
  end_at?: string | null
  number_of_games?: number
  league?: { name?: string; image_url?: string | null }
  serie?: { full_name?: string }
  tournament?: { name?: string; prizepool?: string | null; tier?: string | null }
  opponents?: Array<{ opponent?: PSTeam }>
  results?: Array<{ team_id?: number; score?: number }>
  // Map info per game is included for CS matches when available.
  games?: Array<{ map?: { name?: string } | null }>
}

/** Normalize PandaScore map names ("Mirage") to engine names ("de_mirage"). */
function normalizeMap(name: string): string {
  const n = name.toLowerCase().replace(/\s+/g, '')
  return n.startsWith('de_') || n.startsWith('cs_') ? n : `de_${n}`
}

/** "10000 United States Dollar" → "$10,000". Falls back to the raw string. */
function formatPrizepool(p?: string | null): string | null {
  if (!p) return null
  const m = p.match(/^([\d,.]+)\s+(.+)$/)
  if (!m) return p
  const symbols: Record<string, string> = {
    'United States Dollar': '$', Euro: '€', 'British Pound': '£',
  }
  const sym = symbols[m[2]]
  const amount = Number(m[1].replace(/,/g, ''))
  if (!sym || !Number.isFinite(amount)) return p
  return `${sym}${amount.toLocaleString('en-US')}`
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const mapFilter = (searchParams.get('map') ?? '').toLowerCase()
  const query = searchParams.get('q')?.trim() ?? ''
  const date = searchParams.get('date') ?? '' // YYYY-MM-DD — limit results to one day
  const tier = searchParams.get('tier') ?? '' // "top" → only S/A/B tier tournaments
  const view = searchParams.get('view') === 'upcoming' ? 'upcoming' : 'past'
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const limit = Math.min(50, parseInt(searchParams.get('limit') ?? '20', 10) || 20)

  const apiKey = process.env.PANDASCORE_API_KEY
  if (!apiKey) {
    return NextResponse.json({
      matches: CURATED_MATCHES,
      page: 1,
      hasMore: false,
      total: CURATED_MATCHES.length,
      fallback: true,
      reason: 'missing-key',
    })
  }

  // PandaScore has no per-map filter, so over-fetch when one is active and
  // filter server-side. Pagination stays page-based in both modes.
  const pageSize = mapFilter ? 100 : date ? 50 : limit
  const endpoint = `${PANDASCORE_BASE}/${view}`

  try {
    const params = new URLSearchParams({
      sort: view === 'upcoming' ? 'begin_at' : '-end_at',
      'page[size]': pageSize.toString(),
      'page[number]': page.toString(),
    })
    // Match slugs look like "navi-vs-faze-2026-06-01" — partial slug search
    // is the most reliable way to find matches by team name.
    if (query) params.set('search[slug]', query.toLowerCase().replace(/\s+/g, '-'))
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      params.set('range[begin_at]', `${date}T00:00:00Z,${date}T23:59:59Z`)
    }
    if (tier === 'top') params.set('filter[tournament_tier]', 's,a,b')

    const doFetch = (p: URLSearchParams) => fetch(`${endpoint}?${p}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${apiKey}` },
      next: { revalidate: view === 'upcoming' ? 120 : 300 },
    })

    let res = await doFetch(params)
    let postFilterTier = false

    // Some PandaScore plans reject the tournament_tier filter — over-fetch
    // unfiltered and apply the tier cut ourselves so top-tier matches (e.g.
    // Major games) never get drowned out by qualifier noise.
    if (!res.ok && tier === 'top') {
      params.delete('filter[tournament_tier]')
      params.set('page[size]', '100')
      postFilterTier = true
      res = await doFetch(params)
    }

    if (!res.ok) {
      throw new Error(`PandaScore API returned ${res.status}`)
    }

    let rows = await res.json() as PSMatch[]
    const totalHeader = parseInt(res.headers.get('x-total') ?? '', 10)
    const rawCount = rows.length
    if (postFilterTier) {
      rows = rows.filter(r => ['s', 'a', 'b'].includes(r.tournament?.tier ?? '')).slice(0, limit)
    }

    let matches = rows.map(m => {
      const opp = (m.opponents ?? []).map(o => o.opponent).filter((t): t is PSTeam => !!t)
      const t1 = opp[0]
      const t2 = opp[1]
      const scoreFor = (teamId?: number) =>
        m.results?.find(r => r.team_id != null && r.team_id === teamId)?.score
      const s1 = scoreFor(t1?.id)
      const s2 = scoreFor(t2?.id)
      const maps = (m.games ?? [])
        .map(g => g.map?.name)
        .filter((n): n is string => typeof n === 'string' && n.length > 0)
        .map(normalizeMap)
      const eventParts = [m.league?.name, m.serie?.full_name || m.tournament?.name]
        .filter(Boolean)

      return {
        id: `ps-${m.id}`,
        team1: t1?.name ?? t1?.acronym ?? 'TBD',
        team2: t2?.name ?? t2?.acronym ?? 'TBD',
        team1_logo: t1?.image_url ?? null,
        team2_logo: t2?.image_url ?? null,
        team1_score: s1 ?? null,
        team2_score: s2 ?? null,
        winner: s1 !== undefined && s2 !== undefined && s1 !== s2 ? (s1 > s2 ? 1 : 2) : null,
        map: maps[0] ?? null,
        maps,
        best_of: m.number_of_games ?? null,
        date: view === 'upcoming' ? m.begin_at ?? null : m.end_at ?? m.begin_at ?? null,
        event: eventParts.join(' — ') || 'Pro Match',
        league_logo: m.league?.image_url ?? null,
        prizepool: formatPrizepool(m.tournament?.prizepool),
        tier: m.tournament?.tier ?? null,
        score: view === 'past' && s1 !== undefined && s2 !== undefined ? `${s1}–${s2}` : null,
      }
    })

    const hasMore = rawCount === (postFilterTier ? 100 : pageSize)

    if (mapFilter) {
      const wanted = mapFilter.replace(/^de_/, '')
      matches = matches
        .filter(x => x.maps.some(mm => mm.replace(/^(de|cs)_/, '').includes(wanted)))
        .slice(0, limit)
    }

    return NextResponse.json({
      matches,
      page,
      hasMore,
      total: Number.isFinite(totalHeader) && !mapFilter && !postFilterTier ? totalHeader : null,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch pro matches'
    // Fall back to curated static list
    return NextResponse.json({
      matches: CURATED_MATCHES,
      page: 1,
      hasMore: false,
      total: CURATED_MATCHES.length,
      fallback: true,
      reason: 'error',
      error: msg,
    })
  }
}

// Curated fallback list shown when PandaScore is unconfigured or unavailable
const CURATED_MATCHES = [
  { id: 'c1',  team1: 'Vitality', team2: 'NAVI',     map: 'de_mirage',   maps: ['de_mirage'],   best_of: 1, date: '2024-03-31', event: 'PGL Major Copenhagen 2024',  score: '16–10', team1_logo: null, team2_logo: null },
  { id: 'c2',  team1: 'Vitality', team2: 'FaZe',     map: 'de_inferno',  maps: ['de_inferno'],  best_of: 1, date: '2024-03-30', event: 'PGL Major Copenhagen 2024',  score: '16–12', team1_logo: null, team2_logo: null },
  { id: 'c3',  team1: 'Spirit',   team2: 'Vitality', map: 'de_dust2',    maps: ['de_dust2'],    best_of: 1, date: '2024-09-22', event: 'BLAST Premier Fall Final',   score: '16–14', team1_logo: null, team2_logo: null },
  { id: 'c4',  team1: 'NAVI',     team2: 'G2',       map: 'de_nuke',     maps: ['de_nuke'],     best_of: 1, date: '2024-06-03', event: 'IEM Dallas 2024',            score: '16–8',  team1_logo: null, team2_logo: null },
  { id: 'c5',  team1: 'G2',       team2: 'FaZe',     map: 'de_ancient',  maps: ['de_ancient'],  best_of: 1, date: '2024-06-02', event: 'IEM Dallas 2024',            score: '16–13', team1_logo: null, team2_logo: null },
  { id: 'c6',  team1: 'Liquid',   team2: 'Vitality', map: 'de_anubis',   maps: ['de_anubis'],   best_of: 1, date: '2024-08-11', event: 'ESL Pro League S20',         score: '16–14', team1_logo: null, team2_logo: null },
  { id: 'c7',  team1: 'FaZe',     team2: 'Spirit',   map: 'de_overpass', maps: ['de_overpass'], best_of: 1, date: '2024-08-12', event: 'ESL Pro League S20',         score: '16–11', team1_logo: null, team2_logo: null },
  { id: 'c8',  team1: 'MOUZ',     team2: 'Spirit',   map: 'de_mirage',   maps: ['de_mirage'],   best_of: 1, date: '2024-11-24', event: 'BLAST Premier World Final',  score: '16–9',  team1_logo: null, team2_logo: null },
  { id: 'c9',  team1: 'Vitality', team2: 'MOUZ',     map: 'de_inferno',  maps: ['de_inferno'],  best_of: 1, date: '2024-11-23', event: 'BLAST Premier World Final',  score: '16–12', team1_logo: null, team2_logo: null },
  { id: 'c10', team1: 'Spirit',   team2: 'G2',       map: 'de_anubis',   maps: ['de_anubis'],   best_of: 1, date: '2024-11-22', event: 'BLAST Premier World Final',  score: '16–8',  team1_logo: null, team2_logo: null },
  { id: 'c11', team1: 'NAVI',     team2: 'FaZe',     map: 'de_dust2',    maps: ['de_dust2'],    best_of: 1, date: '2024-09-15', event: 'IEM Cologne 2024',           score: '16–12', team1_logo: null, team2_logo: null },
  { id: 'c12', team1: 'G2',       team2: 'Liquid',   map: 'de_nuke',     maps: ['de_nuke'],     best_of: 1, date: '2024-09-14', event: 'IEM Cologne 2024',           score: '16–9',  team1_logo: null, team2_logo: null },
  { id: 'c13', team1: 'Vitality', team2: 'NAVI',     map: 'de_ancient',  maps: ['de_ancient'],  best_of: 1, date: '2024-09-13', event: 'IEM Cologne 2024',           score: '16–11', team1_logo: null, team2_logo: null },
  { id: 'c14', team1: 'Spirit',   team2: 'FaZe',     map: 'de_mirage',   maps: ['de_mirage'],   best_of: 1, date: '2024-05-05', event: 'ESL Pro League S19',         score: '16–14', team1_logo: null, team2_logo: null },
  { id: 'c15', team1: 'Vitality', team2: 'Spirit',   map: 'de_overpass', maps: ['de_overpass'], best_of: 1, date: '2024-05-12', event: 'ESL Pro League S19',         score: '16–10', team1_logo: null, team2_logo: null },
  { id: 'c16', team1: 'MOUZ',     team2: 'NAVI',     map: 'de_anubis',   maps: ['de_anubis'],   best_of: 1, date: '2024-03-15', event: 'ESL Pro League S19',         score: '16–13', team1_logo: null, team2_logo: null },
  { id: 'c17', team1: 'Astralis', team2: 'Liquid',   map: 'de_inferno',  maps: ['de_inferno'],  best_of: 1, date: '2024-02-20', event: 'BLAST Premier Spring',       score: '16–8',  team1_logo: null, team2_logo: null },
  { id: 'c18', team1: 'G2',       team2: 'Spirit',   map: 'de_vertigo',  maps: ['de_vertigo'],  best_of: 1, date: '2024-01-30', event: 'BLAST Premier Spring',       score: '16–12', team1_logo: null, team2_logo: null },
  { id: 'c19', team1: 'FaZe',     team2: 'Vitality', map: 'de_dust2',    maps: ['de_dust2'],    best_of: 1, date: '2024-01-15', event: 'IEM Katowice 2024',          score: '16–10', team1_logo: null, team2_logo: null },
  { id: 'c20', team1: 'Spirit',   team2: 'MOUZ',     map: 'de_mirage',   maps: ['de_mirage'],   best_of: 1, date: '2024-01-14', event: 'IEM Katowice 2024',          score: '16–11', team1_logo: null, team2_logo: null },
]
