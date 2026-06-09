import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const PS_BASE = 'https://api.pandascore.co/csgo'

type PSTeam = {
  id?: number
  name?: string
  acronym?: string | null
  image_url?: string | null
}

type PSGame = {
  status?: string
  finished?: boolean
  map?: { name?: string } | null
  winner?: { id?: number } | null
}

type PSMatch = {
  id: number
  status?: string
  begin_at?: string | null
  number_of_games?: number
  league?: { name?: string }
  serie?: { full_name?: string }
  tournament?: { name?: string }
  opponents?: Array<{ opponent?: PSTeam }>
  results?: Array<{ team_id?: number; score?: number }>
  games?: PSGame[]
  streams_list?: Array<{ raw_url?: string; main?: boolean; official?: boolean; language?: string }>
}

function normalizeMap(name: string): string {
  const n = name.toLowerCase().replace(/\s+/g, '')
  return n.startsWith('de_') || n.startsWith('cs_') ? n : `de_${n}`
}

function shapeMatch(m: PSMatch) {
  const opp = (m.opponents ?? []).map(o => o.opponent).filter((t): t is PSTeam => !!t)
  const t1 = opp[0]
  const t2 = opp[1]
  const scoreFor = (id?: number) =>
    m.results?.find(r => r.team_id != null && r.team_id === id)?.score ?? 0
  const eventParts = [m.league?.name, m.serie?.full_name || m.tournament?.name].filter(Boolean)

  const games = (m.games ?? [])
  const runningGame = games.find(g => g.status === 'running')
  const lastGame = games.filter(g => g.map?.name).at(-1) ?? null
  const currentGame = runningGame ?? lastGame
  const currentMap = currentGame?.map?.name ? normalizeMap(currentGame.map.name) : null
  const mapsFinished = games.filter(g => g.finished).length

  const streams = (m.streams_list ?? []).filter(s => s.raw_url)
  const stream = streams.find(s => s.main) ?? streams.find(s => s.official) ??
    streams.find(s => s.language === 'en') ?? streams[0] ?? null

  return {
    id: `ps-${m.id}`,
    team1: t1?.name ?? t1?.acronym ?? 'TBD',
    team2: t2?.name ?? t2?.acronym ?? 'TBD',
    team1_logo: t1?.image_url ?? null,
    team2_logo: t2?.image_url ?? null,
    team1_score: scoreFor(t1?.id),
    team2_score: scoreFor(t2?.id),
    current_map: currentMap,
    maps_finished: mapsFinished,
    best_of: m.number_of_games ?? null,
    begin_at: m.begin_at ?? null,
    event: eventParts.join(' — ') || 'Pro Match',
    status: m.status ?? 'unknown',
    stream_url: stream?.raw_url ?? null,
  }
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.PANDASCORE_API_KEY
  if (!apiKey) {
    return NextResponse.json({ live: [], upcoming: [], fallback: true }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  const headers = { Accept: 'application/json', Authorization: `Bearer ${apiKey}` }

  try {
    const [liveRes, upcomingRes] = await Promise.all([
      // /csgo/matches/running returns plain match objects (the top-level
      // /lives endpoint wraps them differently and mixes all videogames).
      fetch(`${PS_BASE}/matches/running?sort=begin_at&page[size]=10`, {
        headers,
        cache: 'no-store',
      }),
      fetch(`${PS_BASE}/matches/upcoming?sort=begin_at&page[size]=8`, {
        headers,
        next: { revalidate: 120 },
      }),
    ])

    const live: ReturnType<typeof shapeMatch>[] = liveRes.ok
      ? (await liveRes.json() as PSMatch[]).map(shapeMatch)
      : []

    const upcoming: ReturnType<typeof shapeMatch>[] = upcomingRes.ok
      ? (await upcomingRes.json() as PSMatch[]).map(shapeMatch)
      : []

    return NextResponse.json({ live, upcoming }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch {
    return NextResponse.json({ live: [], upcoming: [], error: 'fetch_failed' }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  }
}
