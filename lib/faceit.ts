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
  members: FaceitTeamMember[]
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
