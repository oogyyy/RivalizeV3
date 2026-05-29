import type { PlayerStats } from '@/types/database'

export type PlayerRole = 'AWPer' | 'Entry' | 'Support' | 'Lurker' | 'IGL' | 'Rifler'

export interface RoleInfo {
  role: PlayerRole
  color: string
  bg: string
  label: string
}

const ROLE_STYLES: Record<PlayerRole, { color: string; bg: string }> = {
  AWPer:   { color: 'text-purple-400',  bg: 'bg-purple-400/10' },
  Entry:   { color: 'text-orange-400',  bg: 'bg-orange-400/10' },
  Support: { color: 'text-blue-400',    bg: 'bg-blue-400/10' },
  Lurker:  { color: 'text-yellow-400',  bg: 'bg-yellow-400/10' },
  IGL:     { color: 'text-pink-400',    bg: 'bg-pink-400/10' },
  Rifler:  { color: 'text-muted-foreground', bg: 'bg-accent' },
}

/**
 * Rule-based role detection from a player's aggregated stats.
 *
 * AWPer   — low HS% (AWPs rarely headshot) + high kills suggests primary AWP
 * Entry   — high kills + high deaths + high ADR (trades often, goes in first)
 * Support — high flash_assists + high utility_damage relative to kills
 * Lurker  — decent rating but low kills/deaths (passive, waits for openings)
 * IGL     — low deaths relative to kills (positioning), moderate utility
 * Rifler  — fallback
 */
export function detectPlayerRole(player: PlayerStats): PlayerRole {
  const { kills, deaths, headshot_percentage, flash_assists, utility_damage, adr, kast } = player

  const kd = deaths > 0 ? kills / deaths : kills
  const isHighImpact = adr >= 75 || kills >= 15

  // AWPer: very low HS% (< 22%) with meaningful kills — AWP bypasses headshot animations
  if (headshot_percentage < 22 && kills >= 8) return 'AWPer'

  // Support: utility-first player — lots of flash assists or high util damage relative to kills
  const utilityScore = flash_assists * 8 + utility_damage
  if (utilityScore >= 60 && kills <= 18) return 'Support'

  // Entry: aggressive fragger — high kills, high deaths, high ADR
  if (kills >= 16 && deaths >= 14 && adr >= 70) return 'Entry'

  // Lurker: decent rating but conservative — low deaths, high KAST, fewer kills
  if (kd >= 1.1 && kast >= 68 && kills < 15 && deaths < 12) return 'Lurker'

  // IGL: balanced player — consistent but not a stat monster, low deaths
  if (kast >= 65 && kd >= 0.95 && isHighImpact && kills < 18 && flash_assists >= 1) return 'IGL'

  return 'Rifler'
}

export function getRoleInfo(role: PlayerRole): RoleInfo {
  return {
    role,
    label: role,
    ...ROLE_STYLES[role],
  }
}

export function getPlayerRoleInfo(player: PlayerStats): RoleInfo {
  return getRoleInfo(detectPlayerRole(player))
}
