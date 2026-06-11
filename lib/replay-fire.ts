// CS2-style fire grenade rendering for the 2D replays.
//
// T side throws a Molotov, CT side an Incendiary. The demo records both as the
// same "molotov" event, so the side is inferred from the thrower. They burn for
// ~7s, covering an area that grows in, flickers, and shrinks out as it dies.
// We colour Molotov orange and Incendiary blue, and give the Incendiary a
// slightly larger footprint (it spreads wider on flat ground).

const DEPLOY_SECS = 0.6
const FADE_SECS   = 1.4
const MOLOTOV_WORLD_RADIUS    = 175
const INCENDIARY_WORLD_RADIUS = 205

/** Full canvas-space radius of a fire patch for the given map scale / canvas. */
export function fireCanvasRadius(mapScale: number, canvasSize: number, isCT: boolean): number {
  const r = isCT ? INCENDIARY_WORLD_RADIUS : MOLOTOV_WORLD_RADIUS
  return (r / mapScale) * (canvasSize / 1024)
}

/**
 * Whether the thrower was on CT during this round, from their starting side and
 * the round number (MR12 regulation; overtime alternates in 3-round blocks).
 */
export function throwerOnCT(startsOnTSide: boolean, roundNumber: number): boolean {
  let firstHalf: boolean
  if (roundNumber <= 24) {
    firstHalf = roundNumber <= 12
  } else {
    const block = Math.floor((roundNumber - 25) / 3)
    firstHalf = block % 2 === 1
  }
  const onT = firstHalf ? startsOnTSide : !startsOnTSide
  return !onT
}

/**
 * Draws an animated fire patch centred at (cx, cy): flickering flame tongues
 * over a glow, expanding in and shrinking out across its lifetime. Orange for a
 * Molotov (T), blue for an Incendiary (CT).
 */
export function drawFire(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  age: number,
  holdDur: number,
  isCT: boolean,
): void {
  if (age < 0 || age > holdDur) return

  // Coverage envelope: grow in, full burn, shrink out.
  let env: number
  if (age < DEPLOY_SECS) env = age / DEPLOY_SECS
  else if (age > holdDur - FADE_SECS) env = Math.max(0, (holdDur - age) / FADE_SECS)
  else env = 1

  const R = radius * (0.6 + 0.4 * env)

  const hot  = isCT ? [150, 205, 255] : [255, 215, 100]
  const mid  = isCT ? [60, 130, 255]  : [255, 120, 20]
  const edge = isCT ? [20, 60, 200]   : [200, 40, 0]

  // Base glow.
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R)
  g.addColorStop(0,   `rgba(${mid[0]},${mid[1]},${mid[2]},${0.35 * env})`)
  g.addColorStop(0.7, `rgba(${edge[0]},${edge[1]},${edge[2]},${0.18 * env})`)
  g.addColorStop(1,   `rgba(${edge[0]},${edge[1]},${edge[2]},0)`)
  ctx.fillStyle = g
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill()

  // Flickering flame tongues.
  const tongues = 9
  for (let i = 0; i < tongues; i++) {
    const ang   = (i / tongues) * Math.PI * 2 + age * 0.4
    const flick = 0.5 + 0.5 * Math.sin(age * 7 + i * 1.9)
    const dist  = R * (0.12 + 0.5 * (((i * 53) % 100) / 100))
    const fx    = cx + Math.cos(ang) * dist
    const fy    = cy + Math.sin(ang) * dist
    const fr    = R * (0.22 + 0.16 * flick) * (0.6 + 0.4 * env)
    const fg = ctx.createRadialGradient(fx, fy, 0, fx, fy, fr)
    fg.addColorStop(0,   `rgba(${hot[0]},${hot[1]},${hot[2]},${(0.55 + 0.35 * flick) * env})`)
    fg.addColorStop(0.5, `rgba(${mid[0]},${mid[1]},${mid[2]},${0.4 * env})`)
    fg.addColorStop(1,   `rgba(${edge[0]},${edge[1]},${edge[2]},0)`)
    ctx.fillStyle = fg
    ctx.beginPath(); ctx.arc(fx, fy, fr, 0, Math.PI * 2); ctx.fill()
  }

  ctx.globalAlpha = 1
}
