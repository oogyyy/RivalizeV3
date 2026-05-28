const FACEIT_API_BASE = 'https://open.faceit.com/data/v4'

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
  results: { winner: string; score: { faction1: number; faction2: number } }
  teams: {
    faction1: { name: string; roster: Array<{ nickname: string; player_id: string }> }
    faction2: { name: string; roster: Array<{ nickname: string; player_id: string }> }
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
