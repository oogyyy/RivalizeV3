// In-flight grenade rendering for the 2D replays.
//
// A radar view is top-down, so the real flight path is the straight ground
// line — the arc lives in Z. We convey altitude the way top-down viewers do:
// the projectile lifts off the ground line and grows toward the parabolic
// apex while a small shadow stays on the true map position, then both
// converge at the landing spot.

function withAlpha(hex: string, alphaHex: string): string {
  return hex.length === 7 ? hex + alphaHex : hex
}

export function drawGrenadeArc(
  ctx: CanvasRenderingContext2D,
  tx: number, ty: number,   // throw origin (canvas space)
  lx: number, ly: number,   // landing spot (canvas space)
  prog: number,             // 0..1 flight progress
  color: string,            // grenade colour (#rrggbb)
): void {
  const p = Math.min(1, Math.max(0, prog))
  const px = tx + (lx - tx) * p
  const py = ty + (ly - ty) * p

  const dist = Math.hypot(lx - tx, ly - ty)
  const arcH = Math.min(26, 6 + dist * 0.16)  // apparent apex height in px
  const h    = 4 * p * (1 - p)                // parabolic altitude 0→1→0

  // Ground path behind the projectile.
  ctx.setLineDash([2, 4])
  ctx.strokeStyle = withAlpha(color, '40')
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(px, py); ctx.stroke()
  ctx.setLineDash([])

  // Shadow on the true map position — shrinks as the grenade comes down.
  ctx.fillStyle = `rgba(0,0,0,${0.18 + 0.2 * h})`
  ctx.beginPath()
  ctx.ellipse(px, py, 2.5 + h * 2, 1.6 + h * 1.2, 0, 0, Math.PI * 2)
  ctx.fill()

  // Projectile, lifted and scaled by altitude.
  const ay = py - h * arcH
  const r  = 2.5 + h * 2.2
  ctx.fillStyle = color
  ctx.beginPath(); ctx.arc(px, ay, r, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'
  ctx.lineWidth = 0.75
  ctx.stroke()
}
