// Player view-cone rendering: a translucent FOV wedge in the player's team
// colour showing where they're looking, replacing the bare direction arrow.

function withAlpha(hex: string, alphaHex: string): string {
  return hex.length === 7 ? hex + alphaHex : hex
}

const CONE_LEN    = 34
const HALF_ANGLE  = Math.PI / 4.4 // ~82° total wedge — close to the radar FOV feel

/**
 * Draws a view cone at (x, y) facing `angleRad` (canvas space — caller negates
 * yaw for the flipped Y axis). Pass `focused: true` for a brighter cone on the
 * focused player.
 */
export function drawViewCone(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angleRad: number,
  color: string,
  focused = false,
): void {
  const len = focused ? CONE_LEN * 1.25 : CONE_LEN
  const innerA = focused ? '5e' : '42'

  const grad = ctx.createRadialGradient(x, y, 2, x, y, len)
  grad.addColorStop(0, withAlpha(color, innerA))
  grad.addColorStop(1, withAlpha(color, '00'))
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.arc(x, y, len, angleRad - HALF_ANGLE, angleRad + HALF_ANGLE)
  ctx.closePath()
  ctx.fill()

  // Centre sight-line tick so the exact aim direction stays readable.
  ctx.strokeStyle = withAlpha(color, 'aa')
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x + Math.cos(angleRad) * 11, y + Math.sin(angleRad) * 11)
  ctx.stroke()
}
