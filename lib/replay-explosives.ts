// CS2-style HE explosion and flashbang rendering for the 2D replays.

export function worldRadiusToCanvas(worldR: number, mapScale: number, canvasSize: number): number {
  return (worldR / mapScale) * (canvasSize / 1024)
}

const HE_WORLD_RADIUS    = 280 // blast/shockwave footprint
const FLASH_WORLD_RADIUS = 150 // flash bloom footprint

export function heCanvasRadius(mapScale: number, canvasSize: number): number {
  return worldRadiusToCanvas(HE_WORLD_RADIUS, mapScale, canvasSize)
}
export function flashCanvasRadius(mapScale: number, canvasSize: number): number {
  return worldRadiusToCanvas(FLASH_WORLD_RADIUS, mapScale, canvasSize)
}

/**
 * HE detonation: an instant bright core flash, a fast-expanding shockwave ring,
 * and a brief smoke residue. `age` is seconds since detonation.
 */
export function drawExplosion(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  age: number,
  dur: number,
): void {
  if (age < 0 || age > dur) return
  const life = Math.min(1, age / Math.min(dur, 0.8)) // blast plays out over ~0.8s

  // Core flash — very brief.
  if (life < 0.4) {
    const coreOp = 1 - life / 0.4
    const cr = radius * (0.45 + life)
    const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr)
    cg.addColorStop(0,   `rgba(255,250,225,${coreOp})`)
    cg.addColorStop(0.4, `rgba(255,180,70,${coreOp * 0.8})`)
    cg.addColorStop(1,   'rgba(255,120,0,0)')
    ctx.fillStyle = cg
    ctx.beginPath(); ctx.arc(cx, cy, cr, 0, Math.PI * 2); ctx.fill()
  }

  // Shockwave ring.
  const ringR  = radius * (0.2 + 0.8 * Math.sqrt(life))
  const ringOp = Math.max(0, 1 - life)
  ctx.strokeStyle = `rgba(255,160,50,${ringOp * 0.85})`
  ctx.lineWidth   = 2.5 * (1 - life) + 0.5
  ctx.beginPath(); ctx.arc(cx, cy, ringR, 0, Math.PI * 2); ctx.stroke()

  // Smoke residue fades over the full duration.
  const smokeOp = Math.max(0, 1 - age / dur) * 0.22
  if (smokeOp > 0.01) {
    const sg = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 0.7)
    sg.addColorStop(0, `rgba(120,112,102,${smokeOp})`)
    sg.addColorStop(1, 'rgba(120,112,102,0)')
    ctx.fillStyle = sg
    ctx.beginPath(); ctx.arc(cx, cy, radius * 0.7, 0, Math.PI * 2); ctx.fill()
  }

  ctx.globalAlpha = 1
}

/**
 * Flashbang detonation: a blinding white bloom with a bright core and a quick
 * star glint, fading within ~0.5s.
 */
export function drawFlashbang(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  age: number,
  dur: number,
): void {
  if (age < 0 || age > dur) return
  const life = Math.min(1, age / Math.min(dur, 0.55))
  const op   = Math.pow(1 - life, 1.3)
  const R    = radius * (0.3 + Math.pow(life, 0.4))

  // White bloom.
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R)
  g.addColorStop(0,   `rgba(255,255,255,${op})`)
  g.addColorStop(0.5, `rgba(236,246,255,${op * 0.7})`)
  g.addColorStop(1,   'rgba(210,230,255,0)')
  ctx.fillStyle = g
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill()

  // Bright core + star glint while fresh.
  if (life < 0.5) {
    const cOp = 1 - life / 0.5
    ctx.fillStyle = `rgba(255,255,255,${cOp})`
    ctx.beginPath(); ctx.arc(cx, cy, radius * 0.25 * (1 + life), 0, Math.PI * 2); ctx.fill()

    ctx.strokeStyle = `rgba(255,255,255,${cOp * 0.9})`
    ctx.lineWidth = 1.5
    const gl = R * 1.15
    ctx.beginPath()
    ctx.moveTo(cx - gl, cy); ctx.lineTo(cx + gl, cy)
    ctx.moveTo(cx, cy - gl); ctx.lineTo(cx, cy + gl)
    ctx.stroke()
  }

  ctx.globalAlpha = 1
}
