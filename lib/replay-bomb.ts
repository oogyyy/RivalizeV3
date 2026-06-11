// Bomb plant / defuse / detonation rendering for the 2D replays.
//
// After the plant: a pulsing C4 marker at the plant spot with a countdown ring
// (CS2 timer is 40s) whose blink accelerates as detonation nears. A defuse
// freezes the timer and shows a green defuse ring; a detonation hands off to
// the explosion effect.

import { drawExplosion } from './replay-explosives'

export const C4_TIMER_SECS = 40
const EXPLOSION_SECS = 1.6

export interface BombState {
  plantTime: number          // seconds (round clock) the bomb was planted
  defuseTime?: number        // seconds it was defused, if it was
  exploded: boolean          // round ended with detonation
  x: number                  // canvas-space plant position
  y: number
}

/**
 * Draws the bomb lifecycle at time `t` (round clock). `explosionRadius` is the
 * canvas-space blast radius used when the bomb detonates.
 */
export function drawBomb(
  ctx: CanvasRenderingContext2D,
  bomb: BombState,
  t: number,
  explosionRadius: number,
): void {
  if (t < bomb.plantTime) return

  const sincePlant = t - bomb.plantTime
  const defusedAt  = bomb.defuseTime && bomb.defuseTime > bomb.plantTime
    ? bomb.defuseTime - bomb.plantTime
    : null
  const explodeAt  = bomb.exploded && defusedAt === null ? C4_TIMER_SECS : null

  const { x, y } = bomb

  // ── Detonation ──────────────────────────────────────────────────────────
  if (explodeAt !== null && sincePlant >= explodeAt) {
    const age = sincePlant - explodeAt
    if (age < EXPLOSION_SECS) drawExplosion(ctx, x, y, explosionRadius, age, EXPLOSION_SECS)
    return
  }

  // ── Defused ─────────────────────────────────────────────────────────────
  if (defusedAt !== null && sincePlant >= defusedAt) {
    const age  = sincePlant - defusedAt
    const fade = Math.max(0, 1 - age / 4)
    if (fade <= 0) return
    ctx.globalAlpha = fade
    ctx.strokeStyle = '#34d399'
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.stroke()
    // check mark
    ctx.beginPath()
    ctx.moveTo(x - 4.5, y + 0.5); ctx.lineTo(x - 1.5, y + 3.5); ctx.lineTo(x + 4.5, y - 3.5)
    ctx.stroke()
    ctx.globalAlpha = 1
    return
  }

  // ── Armed: pulsing danger zone + C4 marker + countdown ring ─────────────
  const frac = Math.min(1, sincePlant / C4_TIMER_SECS) // 0 → planted, 1 → boom

  // Danger pulse, faster as the timer runs down (like the beep).
  const beepHz = 1 + frac * 5
  const pulse  = 0.5 + 0.5 * Math.sin(sincePlant * beepHz * Math.PI * 2)
  const dangerR = 16 + pulse * 4
  const dg = ctx.createRadialGradient(x, y, 0, x, y, dangerR)
  dg.addColorStop(0, `rgba(255,60,60,${0.16 + 0.12 * pulse})`)
  dg.addColorStop(1, 'rgba(255,60,60,0)')
  ctx.fillStyle = dg
  ctx.beginPath(); ctx.arc(x, y, dangerR, 0, Math.PI * 2); ctx.fill()

  // Countdown ring — drains clockwise from 12 o'clock.
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'
  ctx.lineWidth = 2.5
  ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.stroke()
  ctx.strokeStyle = frac > 0.75 ? '#ff4444' : frac > 0.5 ? '#ffaa33' : '#ffd24d'
  ctx.beginPath()
  ctx.arc(x, y, 11, -Math.PI / 2, -Math.PI / 2 + (1 - frac) * Math.PI * 2)
  ctx.stroke()

  // C4 body.
  ctx.fillStyle = '#1c1f26'
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.roundRect(x - 6, y - 4.5, 12, 9, 2); ctx.fill(); ctx.stroke()
  // blinking LED
  ctx.fillStyle = pulse > 0.5 ? '#ff3333' : '#7a1111'
  ctx.beginPath(); ctx.arc(x + 3, y - 1.5, 1.4, 0, Math.PI * 2); ctx.fill()
  // label
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.font = 'bold 5px monospace'
  ctx.textAlign = 'left'
  ctx.fillText('C4', x - 4.5, y + 2)
}

/** Builds a BombState from a parsed round, or null when there's no plant data. */
export function bombStateFromRound(
  round: {
    plant_time?: number
    plant_x?: number
    plant_y?: number
    defuse_time?: number
    bomb_planted?: boolean
    win_reason?: string
  },
  toXY: (wx: number, wy: number) => [number, number],
): BombState | null {
  if (!round.bomb_planted || !round.plant_time || round.plant_x == null || round.plant_y == null) return null
  if (round.plant_x === 0 && round.plant_y === 0) return null // missing position
  const [x, y] = toXY(round.plant_x, round.plant_y)
  const reason = (round.win_reason ?? '').toLowerCase()
  return {
    plantTime:  round.plant_time,
    defuseTime: round.defuse_time && round.defuse_time > 0 ? round.defuse_time : undefined,
    exploded:   reason === 'bomb_exploded' || reason === 'target_bombed',
    x, y,
  }
}
