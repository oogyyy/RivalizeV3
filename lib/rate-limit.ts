/**
 * In-memory sliding-window rate limiter.
 * Safe for single-process Node.js servers (Railway, etc.).
 * Not suitable for multi-instance deployments without a shared store.
 */

interface Window {
  count: number
  resetAt: number
}

const store = new Map<string, Window>()

// Prune expired entries every 5 minutes to avoid memory leaks
setInterval(() => {
  const now = Date.now()
  for (const [key, w] of store) {
    if (w.resetAt < now) store.delete(key)
  }
}, 5 * 60 * 1000)

/**
 * Returns true if the request is allowed, false if rate-limited.
 * @param key      Unique identifier (e.g. userId + route)
 * @param limit    Max requests per window
 * @param windowMs Window length in milliseconds
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (entry.count >= limit) return false
  entry.count++
  return true
}

export function rateLimitResponse() {
  return new Response(
    JSON.stringify({ error: 'Too many requests. Please slow down.' }),
    { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60' } },
  )
}
