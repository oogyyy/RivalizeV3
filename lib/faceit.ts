const FACEIT_API_BASE = 'https://open.faceit.com/data/v4'
const FACEIT_DOWNLOADS_BASE = 'https://api.faceit.com'

function getApiKey(): string {
  const key = process.env.FACEIT_API_KEY
  if (!key) throw new Error('FACEIT_API_KEY environment variable is not set')
  return key
}

function headers() {
  return {
    Authorization: `Bearer ${getApiKey()}`,
    Accept: 'application/json',
  }
}

async function fetchFaceit<T>(path: string): Promise<T> {
  const res = await fetch(`${FACEIT_API_BASE}${path}`, { headers: headers() })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`FaceIt API ${path} → ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

export interface FaceitPlayer {
  player_id: string
  nickname: string
  avatar: string
  country: string
  cover_image: string
  games: {
    cs2?: {
      faceit_elo: number
      game_player_id: string
      skill_level: number
      region: string
    }
  }
  faceit_url: string
}

export interface FaceitMatchItem {
  match_id: string
  game_id: string
  competition_type: string
  competition_name: string
  results: { winner: string; score: { faction1: number; faction2: number } } | null
  teams: {
    faction1: { name: string | null; roster?: Array<{ nickname: string; player_id: string }> }
    faction2: { name: string | null; roster?: Array<{ nickname: string; player_id: string }> }
  }
  started_at: number
  finished_at: number
  match_url: string
}

export interface FaceitMatchHistory {
  items: FaceitMatchItem[]
  start: number
  end: number
}

export interface FaceitMatchDetail {
  match_id: string
  game: string
  region: string
  competition_name: string
  competition_type: string
  best_of: number
  round: number
  results: FaceitMatchItem['results']
  teams: FaceitMatchItem['teams']
  started_at: number
  finished_at: number
  demo_url: string[]
  voting?: {
    map?: { pick: string[] }
  }
}

export interface FaceitTeamMember {
  user_id: string
  nickname: string
  avatar: string
  country: string
}

export interface FaceitTeam {
  team_id: string
  nickname: string
  name: string
  avatar: string
  cover_image: string
  game: string
  /** user_id of the team captain, when present. */
  leader?: string
  members: FaceitTeamMember[]
}

/** A single ESEA/league match for a team, derived from a roster player's history. */
export interface FaceitTeamMatch {
  matchId: string
  competitionName: string
  date: number             // ms epoch
  opponentName: string     // the team they played against
  ourScore: number | null
  oppScore: number | null
  won: boolean | null
  matchUrl: string
  /** Which faction the scouted team was in this match. */
  ourFaction: 'faction1' | 'faction2'
}

/** One stat segment (e.g. a map) from the team stats endpoint. */
export interface FaceitTeamMapStat {
  label: string          // e.g. "de_mirage"
  img_small?: string
  matches: number
  wins: number
  winRate: number        // 0–100
}

export interface FaceitTeamStats {
  matches: number
  wins: number
  winRate: number        // 0–100
  maps: FaceitTeamMapStat[]
}

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

/**
 * Extract a FACEIT team UUID from raw input — accepts either a bare id or a
 * full team URL (…/teams/<id>/leagues, /stats, etc.) or an esea.team link.
 * Returns the lowercased id, or null if no valid UUID is present.
 */
export function parseFaceitTeamId(input: string): string | null {
  const m = input.trim().match(UUID_RE)
  return m ? m[0].toLowerCase() : null
}

/** Canonical FACEIT team page (ESEA league view). */
export function faceitTeamUrl(teamId: string): string {
  return `https://www.faceit.com/en/teams/${teamId}/leagues`
}

/** Third-party esea.team stats view for a FACEIT team id. */
export function eseaTeamUrl(teamId: string): string {
  return `https://esea.team/team/${teamId}`
}

/** Fetch a FACEIT team profile (name, avatar, roster). */
export async function getTeam(teamId: string): Promise<FaceitTeam> {
  return fetchFaceit<FaceitTeam>(`/teams/${teamId}`)
}

interface RawTeamStats {
  lifetime?: Record<string, string>
  segments?: Array<{
    type: string
    mode?: string
    label: string
    img_small?: string
    stats: Record<string, string>
  }>
}

/** Fetch aggregate CS2 team stats with per-map breakdown. */
export async function getTeamStats(teamId: string): Promise<FaceitTeamStats> {
  const raw = await fetchFaceit<RawTeamStats>(`/teams/${teamId}/stats/cs2`)
  const num = (v: string | undefined) => (v ? Number(v) : 0)

  const maps: FaceitTeamMapStat[] = (raw.segments ?? [])
    .filter(s => s.type === 'Map')
    .map(s => ({
      label: s.label,
      img_small: s.img_small,
      matches: num(s.stats['Matches']),
      wins: num(s.stats['Wins']),
      winRate: num(s.stats['Win Rate %']),
    }))
    .sort((a, b) => b.matches - a.matches)

  return {
    matches: num(raw.lifetime?.['Matches']),
    wins: num(raw.lifetime?.['Wins']),
    winRate: num(raw.lifetime?.['Win Rate %']),
    maps,
  }
}

/**
 * Recent ESEA/league match history for a team.
 *
 * The FACEIT Data API has no team-match-history endpoint, so we anchor on a
 * roster player (the captain when known) and pull their CS2 history, keeping
 * only `championship` matches (ESEA league play) where that player's faction
 * is the linked team. The opponent is read from the other faction.
 */
export async function getTeamMatchHistory(
  teamId: string,
  limit = 30,
): Promise<{ team: FaceitTeam; matches: FaceitTeamMatch[] }> {
  const team = await getTeam(teamId)
  const anchorId = team.leader || team.members[0]?.user_id
  if (!anchorId) return { team, matches: [] }

  const history = await getPlayerMatchHistory(anchorId, Math.min(100, limit * 3))
  const matches: FaceitTeamMatch[] = []
  for (const m of history.items) {
    if (m.competition_type !== 'championship') continue
    const inF1 = m.teams.faction1.roster?.some(p => p.player_id === anchorId) ?? false
    const opp  = inF1 ? m.teams.faction2 : m.teams.faction1
    const score = m.results?.score
    matches.push({
      matchId: m.match_id,
      competitionName: m.competition_name,
      date: m.started_at * 1000,
      opponentName: opp.name || 'Unknown',
      ourScore: score ? (inF1 ? score.faction1 : score.faction2) : null,
      oppScore: score ? (inF1 ? score.faction2 : score.faction1) : null,
      won: m.results ? m.results.winner === (inF1 ? 'faction1' : 'faction2') : null,
      matchUrl: m.match_url,
      ourFaction: inF1 ? 'faction1' : 'faction2',
    })
    if (matches.length >= limit) break
  }
  return { team, matches }
}

/** A single map drop/pick from a match veto, in veto order. */
export interface FaceitVetoStep {
  map: string
  status: 'drop' | 'pick'
  faction: 'faction1' | 'faction2' | null
}

interface RawDemocracy {
  payload?: {
    tickets?: Array<{
      entity_type?: string
      entities?: Array<{
        guid?: string
        status?: string
        selected_by?: string
        round?: number
        random?: boolean
      }>
    }>
  }
}

/**
 * Map veto (ban/pick sequence) for a match, via FACEIT's internal democracy
 * endpoint — the only public source for ordered ban data (the Data API exposes
 * only the picked map). Best-effort: returns null on any failure or shape change
 * so callers can degrade gracefully.
 */
export async function getMatchVeto(matchId: string): Promise<FaceitVetoStep[] | null> {
  try {
    const res = await fetch(`${FACEIT_DOWNLOADS_BASE}/democracy/v1/match/${matchId}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const json = await res.json() as RawDemocracy
    const mapTicket = (json.payload?.tickets ?? []).find(t => t.entity_type === 'map')
      ?? (json.payload?.tickets ?? [])[0]
    const entities = mapTicket?.entities ?? []
    if (entities.length === 0) return null

    const steps: FaceitVetoStep[] = entities
      .filter(e => e.guid && (e.status === 'drop' || e.status === 'pick'))
      .sort((a, b) => (a.round ?? 0) - (b.round ?? 0))
      .map(e => ({
        map: e.guid as string,
        status: e.status as 'drop' | 'pick',
        faction: e.selected_by === 'faction1' ? 'faction1'
          : e.selected_by === 'faction2' ? 'faction2'
          : null,
      }))
    return steps.length > 0 ? steps : null
  } catch {
    return null
  }
}

/** Lookup a player by FaceIt nickname. */
export async function getPlayerByNickname(nickname: string): Promise<FaceitPlayer> {
  return fetchFaceit<FaceitPlayer>(`/players?nickname=${encodeURIComponent(nickname)}`)
}

/** Get recent CS2 match history for a player. */
export async function getPlayerMatchHistory(playerId: string, limit = 20): Promise<FaceitMatchHistory> {
  return fetchFaceit<FaceitMatchHistory>(
    `/players/${playerId}/history?game=cs2&limit=${limit}&offset=0`
  )
}

/** Get full match details including demo_url. */
export async function getMatchDetail(matchId: string): Promise<FaceitMatchDetail> {
  return fetchFaceit<FaceitMatchDetail>(`/matches/${matchId}`)
}

/** Check whether the FaceIt API key is configured. */
export function isFaceitConfigured(): boolean {
  return Boolean(process.env.FACEIT_API_KEY)
}

/** Check whether the FACEIT Downloads API token is configured. */
export function isDownloadsConfigured(): boolean {
  return Boolean(process.env.FACEIT_DOWNLOADS_TOKEN)
}

/**
 * Exchange a private cloud resource URL (from demo_url in match details)
 * for a signed download URL via the FACEIT Downloads API.
 * Requires FACEIT_DOWNLOADS_TOKEN with Downloads API scope.
 */
export async function getSignedDemoUrl(resourceUrl: string): Promise<string> {
  const token = process.env.FACEIT_DOWNLOADS_TOKEN
  if (!token) throw new Error('FACEIT_DOWNLOADS_TOKEN is not configured')

  const res = await fetch(`${FACEIT_DOWNLOADS_BASE}/download/v2/demos/download`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ resource_url: resourceUrl }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`FACEIT Downloads API → ${res.status}: ${text}`)
  }

  const json = await res.json() as { payload?: { download_url?: string } }
  const url = json?.payload?.download_url
  if (!url) throw new Error('FACEIT Downloads API returned no download_url')
  return url
}
