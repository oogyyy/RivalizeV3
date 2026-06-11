export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Profile {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  steam_id: string | null
  discord_id: string | null
  faceit_id: string | null
  favorite_maps: string[] | null
  preferred_roles: string[] | null
  created_at: string
  updated_at: string
}

export interface UserSettings {
  user_id: string
  email_notifications: boolean
  ai_coach_ready: boolean
  public_profile: boolean
  ai_model_preference: string
  ai_response_style: string
  updated_at: string
}

export interface Team {
  id: string
  name: string
  slug: string
  created_by: string
  logo_url: string | null
  created_at: string
}

export interface TeamMember {
  team_id: string
  user_id: string
  role: 'owner' | 'admin' | 'member'
}

export interface Demo {
  id: string
  team_id: string
  opponent_name: string
  opponent_slug: string | null
  map: string
  match_date: string | null
  league: string | null
  raw_file_path: string
  parsed_data: ParsedDemoData | null
  status: DemoStatus
  /** 'opponent' = scouting upload; 'self' = own-team self-analysis upload */
  demo_type: 'opponent' | 'self'
  created_by: string
  created_at: string
  processing_started_at: string | null
  queued_at: string | null
  last_heartbeat_at: string | null
  error_message: string | null
  file_size_bytes: number | null
  share_id: string | null
  retry_count: number
  faceit_match_id?: string | null
}

export interface Friendship {
  id: string
  requester_id: string
  addressee_id: string
  status: 'pending' | 'accepted' | 'rejected'
  created_at: string
  updated_at: string
}

export interface TeamFolder {
  id: string
  user_team_id: string
  opponent_slug: string
  opponent_display_name: string
  aggregated_stats: AggregatedStats
}

export interface ParsedDemoData {
  header: DemoHeader
  rounds: Round[]
  players: PlayerStats[]
  events: GameEvent[]
  heatmap_data?: HeatmapPoint[]
  _debug?: Record<string, unknown>
}

export interface DemoHeader {
  map: string
  team1: string
  team2: string
  score_team1: number
  score_team2: number
  duration: number
  total_rounds: number
  match_date?: string
}

export interface PlayerSnapshot {
  n: string    // player name
  x: number    // world X
  y: number    // world Y
  z?: number   // world Z / height (available in parser v2+)
  a: boolean   // alive
  h?: number   // health (0-100)
  w?: number   // yaw angle in degrees (-180 to 180)
  t?: string   // team: "CT" or "T"
}

export interface PositionFrame {
  t: number           // seconds since round start
  p: PlayerSnapshot[]
}

export interface Round {
  number: number
  winner: string
  win_reason: string
  duration: number
  freeze_end_time?: number  // seconds from round start to freeze-time end (round goes live)
  team1_economy: number
  team2_economy: number
  kills: Kill[]
  grenades?: GrenadeEvent[]
  frames?: PositionFrame[]
  bomb_planted?: boolean
  bomb_defused?: boolean
  // Bomb event details (parser v3+; seconds from round start, world coords)
  plant_time?: number
  plant_x?: number
  plant_y?: number
  plant_site?: string
  defuse_time?: number
}

export interface GrenadeEvent {
  tick: number
  time: number
  type: 'smoke' | 'flash' | 'he' | 'molotov' | 'decoy'
  thrower: string
  throw_x: number
  throw_y: number
  land_x: number
  land_y: number
  land_time: number
}

export interface Kill {
  tick: number
  time: number
  killer_name: string
  victim_name: string
  weapon: string
  headshot: boolean
  is_entry?: boolean  // first cross-team kill of the round
  killer_x: number
  killer_y: number
  victim_x: number
  victim_y: number
}

export interface PlayerStats {
  steam_id: string
  name: string
  team: string
  kills: number
  deaths: number
  assists: number
  headshots: number
  headshot_percentage: number
  adr: number
  kast: number
  rating: number
  utility_damage: number
  flash_assists: number
  mvps: number
  rounds_played: number
  // Phase 2 extended stats
  entry_kills?: number
  entry_deaths?: number
  trade_kills?: number
  traded_deaths?: number
  clutch_attempts?: number
  clutch_wins?: number
  flashes_thrown?: number
  flashes_effective?: number
}

export interface GameEvent {
  tick: number
  type: string
  data: Json
}

export interface HeatmapPoint {
  x: number
  y: number
  type: 'kill' | 'death' | 'bomb' | 'grenade'
  team: string
}

export interface AggregatedStats {
  total_matches: number
  wins: number
  losses: number
  draws: number
  maps_played: Record<string, number>
  avg_rating: number
  top_players: PlayerStats[]
  win_rate: number
}

// Updated for the new reliable queue system
export type DemoStatus = 'queued' | 'processing' | 'completed' | 'failed'
export type TeamRole = 'owner' | 'admin' | 'member'
export type AIModel = 'gpt-4o' | 'grok-2' | 'claude-3-5-sonnet'
export type ResponseStyle = 'detailed' | 'concise' | 'coaching'

export const CS2_MAPS = [
  'de_dust2', 'de_mirage', 'de_inferno', 'de_nuke', 'de_overpass',
  'de_vertigo', 'de_ancient', 'de_anubis', 'de_cache', 'de_train'
] as const

export const PLAYER_ROLES = [
  'IGL', 'AWPer', 'Entry Fragger', 'Support', 'Lurker', 'Rifler', 'Anchor'
] as const
