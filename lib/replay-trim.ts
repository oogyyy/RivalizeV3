import type { Round, PositionFrame, GrenadeEvent, Kill } from '@/types/database'

type TrimInput = {
  freeze_end_time?: number
  grenades?: GrenadeEvent[]
  kills?: Kill[]
  frames?: PositionFrame[]
}

const LEAD_IN = 1.5        // seconds of context kept before the action starts
const MOVE_THRESHOLD = 130 // world units a player must travel to count as "moving"

/**
 * Seconds of dead freeze/buy time to skip at the start of a round replay so it
 * begins when the round actually goes live. The parser bases every timestamp on
 * round start (which includes the ~15-20s freeze), so without trimming a replay
 * opens on frozen players and smokes appear to "land late".
 *
 * Precise when the demo was parsed with freeze_end_time; otherwise falls back to
 * movement detection (works on existing demos with frames) and finally a
 * first-event heuristic.
 */
export function roundStartOffset(round: TrimInput): number {
  // 1. Authoritative parser value (re-parsed / new demos)
  if (typeof round.freeze_end_time === 'number' && round.freeze_end_time > 0.5) {
    return Math.max(0, round.freeze_end_time - LEAD_IN)
  }

  // 2. Movement-based: first frame where ≥2 players have left their spawn spot
  const frames = round.frames ?? []
  if (frames.length > 1) {
    const base = new Map(frames[0].p.map(s => [s.n, s]))
    for (const f of frames) {
      let moved = 0
      for (const s of f.p) {
        const b = base.get(s.n)
        if (!b) continue
        if (Math.hypot(s.x - b.x, s.y - b.y) > MOVE_THRESHOLD) moved++
      }
      if (moved >= 2) return Math.max(0, f.t - LEAD_IN)
    }
  }

  // 3. First-event heuristic, only when it lands in a plausible freeze window
  const grenT = round.grenades?.length ? Math.min(...round.grenades.map(g => g.time)) : Infinity
  const killT = round.kills?.length ? Math.min(...round.kills.map(k => k.time)) : Infinity
  const firstEvent = Math.min(grenT, killT)
  if (firstEvent > 3 && firstEvent < 30) return firstEvent - LEAD_IN

  return 0
}

// Allow callers to pass a full Round without widening.
export type RoundTrimmable = Pick<Round, 'grenades' | 'kills' | 'frames'> & { freeze_end_time?: number }
