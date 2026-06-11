// CS2-style smoke rendering for the 2D replays. A real CS2 smoke deploys to a
// fixed volume (~144-unit radius) in about a second, holds as an opaque
// billowing cloud for ~15s, then dissipates. This mimics that on a 2D canvas.

const DEPLOY_SECS = 1.1
const FADE_SECS   = 2.6
const SMOKE_WORLD_RADIUS = 165 // slightly larger than the gameplay radius so it reads on the radar

/** Full canvas-space radius of a smoke for the given map scale and canvas size. */
export function smokeCanvasRadius(mapScale: number, canvasSize: number): number {
  return (SMOKE_WORLD_RADIUS / mapScale) * (canvasSize / 1024)
}

/**
 * Draws an animated CS2-like smoke cloud centred at (cx, cy). `radius` is the
 * deployed canvas-space radius (see smokeCanvasRadius); `age` is seconds since
 * the smoke landed; `holdDur` is the smoke lifetime.
 */
export function drawSmoke(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  age: number,
  holdDur = 18,
): void {
  if (age < 0 || age > holdDur) return

  let scale: number
  let opacity: number
  if (age < DEPLOY_SECS) {
    // Rapid ease-out expansion as the smoke deploys.
    const k = age / DEPLOY_SECS
    const ease = 1 - Math.pow(1 - k, 3)
    scale = 0.45 + 0.55 * ease
    opacity = ease
  } else if (age > holdDur - FADE_SECS) {
    // Thin out and drift slightly while dissipating.
    const k = (age - (holdDur - FADE_SECS)) / FADE_SECS
    scale = 1 + 0.06 * k
    opacity = 1 - k
  } else {
    scale = 1
    opacity = 1
  }

  const R  = radius * scale
  const op = Math.max(0, opacity) * 0.92

  // Billowing offset puffs give the cloud texture and slow internal motion.
  const puffs = 6
  for (let i = 0; i < puffs; i++) {
    const ang  = (i / puffs) * Math.PI * 2 + age * 0.2 + i
    const wob  = 0.45 + 0.25 * Math.sin(age * 0.8 + i * 1.7)
    const dist = R * 0.4 * wob
    const px   = cx + Math.cos(ang) * dist
    const py   = cy + Math.sin(ang) * dist
    const pr   = R * (0.62 + 0.12 * Math.sin(age * 1.1 + i * 2.3))
    const g = ctx.createRadialGradient(px, py, 0, px, py, pr)
    g.addColorStop(0,   `rgba(214,214,224,${op * 0.42})`)
    g.addColorStop(0.6, `rgba(198,198,212,${op * 0.30})`)
    g.addColorStop(1,   'rgba(190,190,205,0)')
    ctx.fillStyle = g
    ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill()
  }

  // Dense core for opacity.
  const core = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R)
  core.addColorStop(0,   `rgba(208,208,220,${op * 0.85})`)
  core.addColorStop(0.7, `rgba(198,198,212,${op * 0.6})`)
  core.addColorStop(1,   'rgba(190,190,205,0)')
  ctx.fillStyle = core
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill()

  ctx.globalAlpha = 1
}
