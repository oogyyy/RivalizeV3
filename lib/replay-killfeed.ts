// CS2-style kill feed overlay for the 2D replay canvas. Drawn in screen space
// (after any focus zoom is restored) in the top-right corner: recent kills as
// "killer  [weapon]  victim" rows in team colours, fading out after a few
// seconds like the in-game feed.

import type { Kill } from '@/types/database'

const FEED_SECS  = 4.5  // how long a kill stays in the feed
const FADE_SECS  = 0.8  // fade-out at the end of its life
const MAX_ROWS   = 5
const ROW_H      = 17
const PAD_X      = 7
const MARGIN     = 10

function weaponLabel(weapon: string): string {
  return weapon.replace(/^weapon_/, '').replace(/_/g, ' ').toUpperCase()
}

export function drawKillFeed(
  ctx: CanvasRenderingContext2D,
  kills: Kill[],
  t: number,
  canvasWidth: number,
  colorOf: (name: string) => string,
): void {
  const recent = kills
    .filter(k => k.time <= t && k.time > t - FEED_SECS)
    .slice(-MAX_ROWS)
  if (recent.length === 0) return

  ctx.save()
  ctx.textBaseline = 'middle'

  recent.forEach((k, i) => {
    const age  = t - k.time
    const fade = age > FEED_SECS - FADE_SECS
      ? Math.max(0, (FEED_SECS - age) / FADE_SECS)
      : 1

    const weapon = weaponLabel(k.weapon)
    const hs     = k.headshot ? ' ◉' : ''

    ctx.font = 'bold 10px monospace'
    const killerW = ctx.measureText(k.killer_name).width
    const victimW = ctx.measureText(k.victim_name).width
    ctx.font = '9px monospace'
    const midText = ` [${weapon}${hs}] `
    const midW    = ctx.measureText(midText).width

    const rowW = killerW + midW + victimW + PAD_X * 2
    const x0   = canvasWidth - MARGIN - rowW
    const y0   = MARGIN + i * (ROW_H + 3)
    const cy   = y0 + ROW_H / 2

    // Background pill
    ctx.globalAlpha = fade * 0.72
    ctx.fillStyle = '#0a0e14'
    ctx.beginPath()
    ctx.roundRect(x0, y0, rowW, ROW_H, 4)
    ctx.fill()
    ctx.globalAlpha = fade
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.lineWidth = 1
    ctx.stroke()

    // killer — weapon — victim
    let x = x0 + PAD_X
    ctx.textAlign = 'left'
    ctx.font = 'bold 10px monospace'
    ctx.fillStyle = colorOf(k.killer_name)
    ctx.fillText(k.killer_name, x, cy)
    x += killerW

    ctx.font = '9px monospace'
    ctx.fillStyle = k.headshot ? 'rgba(255,215,0,0.95)' : 'rgba(255,255,255,0.55)'
    ctx.fillText(midText, x, cy)
    x += midW

    ctx.font = 'bold 10px monospace'
    ctx.fillStyle = colorOf(k.victim_name)
    ctx.fillText(k.victim_name, x, cy)
  })

  ctx.restore()
  ctx.globalAlpha = 1
}
