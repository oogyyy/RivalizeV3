/**
 * Steam bot that connects to the CS2 Game Coordinator and retrieves
 * recent match data (map, scores, timestamps) for a given SteamID64.
 *
 * Requires STEAM_BOT_USERNAME + STEAM_BOT_PASSWORD env vars.
 * Set STEAM_BOT_SHARED_SECRET to the account's mobile authenticator
 * shared secret so the bot can generate 2FA codes automatically.
 * The bot account does NOT need to own CS2.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const SteamUser = require('steam-user')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const GlobalOffensive = require('globaloffensive')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const SteamTotp = require('steam-totp')

const STEAM_APPID = 730
const GC_TIMEOUT_MS = 45_000

export interface CS2GCMatchData {
  matchId:      string
  reservationId: string
  matchTime:    number    // unix timestamp (seconds)
  map:          string | null
  scoreTeam1:   number
  scoreTeam2:   number
  /** Raw GC match_result integer (2 = team1 wins, 3 = team2 wins, 1 = tie) */
  matchResult:  number
  tvPort:       number
}

export function isSteamBotConfigured(): boolean {
  return Boolean(process.env.STEAM_BOT_USERNAME && process.env.STEAM_BOT_PASSWORD)
}

/** Connect to Steam GC and fetch recent games for a SteamID64. */
export function fetchRecentCS2Matches(steamId64: string): Promise<CS2GCMatchData[]> {
  return new Promise((resolve, reject) => {
    const client = new SteamUser()
    const csgo   = new GlobalOffensive(client)
    let settled  = false

    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      cleanUp()
      reject(new Error('CS2 GC connection timed out after 45s'))
    }, GC_TIMEOUT_MS)

    function cleanUp() {
      clearTimeout(timer)
      try { client.logOff() } catch { /* ignore */ }
    }

    function done(matches: CS2GCMatchData[]) {
      if (settled) return
      settled = true
      cleanUp()
      resolve(matches)
    }

    function fail(err: Error) {
      if (settled) return
      settled = true
      cleanUp()
      reject(err)
    }

    client.on('error', fail)

    // Handle Steam Guard — required on first login from a new IP.
    // If STEAM_BOT_SHARED_SECRET is set we compute the TOTP code automatically.
    // Without it, email-guard accounts will block here and eventually time out.
    client.on('steamGuard', (domain: string | null, callback: (code: string) => void) => {
      const sharedSecret = process.env.STEAM_BOT_SHARED_SECRET
      if (!sharedSecret) {
        // No shared secret — can't generate code. Abort with a clear message.
        fail(new Error(
          domain
            ? `Steam Guard email code required (sent to *@${domain}). Set STEAM_BOT_SHARED_SECRET or disable Steam Guard on the bot account.`
            : 'Steam Guard (mobile authenticator) required. Set STEAM_BOT_SHARED_SECRET env var.'
        ))
        return
      }
      // Generate TOTP code from the shared secret
      const code = SteamTotp.generateAuthCode(sharedSecret) as string
      callback(code)
    })

    client.logOn({
      accountName: process.env.STEAM_BOT_USERNAME,
      password:    process.env.STEAM_BOT_PASSWORD,
    })

    // Once Steam confirms app ownership, start playing CS2 so the GC accepts us
    client.on('appOwnershipCached', () => {
      client.gamesPlayed([STEAM_APPID], true)
    })

    csgo.on('connectedToGC', () => {
      csgo.requestRecentGames(steamId64)
    })

    csgo.on('matchList', (matches: unknown[]) => {
      const parsed = (matches ?? []).map(parseMatch).filter(Boolean) as CS2GCMatchData[]
      done(parsed)
    })
  })
}

// ── Internals ─────────────────────────────────────────────────────────────────

function parseMatch(raw: unknown): CS2GCMatchData | null {
  try {
    const m = raw as Record<string, unknown>

    const matchId      = toLong(m.matchid)
    const matchTime    = (m.matchtime as number) ?? 0
    const watchable    = m.watchablematchinfo as Record<string, unknown> | null
    const roundstats   = m.roundstatsall as unknown[] | null
    const last         = roundstats?.[(roundstats?.length ?? 1) - 1] as Record<string, unknown> | null

    const reservationId = toLong(last?.reservationid ?? watchable?.reservation_id)
    const map           = (last?.map as string | null) ?? null
    const teamScores    = (last?.team_scores as number[]) ?? []
    const scoreTeam1    = teamScores[0] ?? 0
    const scoreTeam2    = teamScores[1] ?? 0
    const matchResult   = (last?.match_result as number) ?? 0
    const tvPort        = (watchable?.tv_port as number) ?? 0

    if (!matchId) return null

    return { matchId, reservationId, matchTime, map, scoreTeam1, scoreTeam2, matchResult, tvPort }
  } catch {
    return null
  }
}

/** Convert a Long / BigInt / number / string to a decimal string. */
function toLong(v: unknown): string {
  if (!v) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  if (typeof v === 'bigint') return v.toString()
  // node-long style object { low, high }
  const lo = v as { low?: number; high?: number; toNumber?: () => number; toString?: () => string }
  if (typeof lo.toString === 'function') return lo.toString()
  if (lo.low !== undefined && lo.high !== undefined) {
    const n = BigInt(lo.high) * BigInt(0x100000000) + BigInt(lo.low >>> 0)
    return n.toString()
  }
  return String(v)
}

// ── Demo URL probe ────────────────────────────────────────────────────────────
// The Valve CDN shard is not in the protobuf. We probe a range of shards
// concurrently to find a valid URL. Typical shards are 1–500.

const PROBE_SHARDS = Array.from({ length: 500 }, (_, i) => i + 1)

/**
 * Try to locate the Valve CDN URL for a demo. Returns the URL if found,
 * null otherwise. Sends HEAD requests in batches of 40 in parallel.
 */
export async function findDemoUrl(
  matchId: string,
  matchTime: number,
): Promise<string | null> {
  const filename = `${matchId}_${matchTime}.dem.bz2`
  const BATCH = 40

  for (let i = 0; i < PROBE_SHARDS.length; i += BATCH) {
    const batch = PROBE_SHARDS.slice(i, i + BATCH)
    const results = await Promise.all(
      batch.map(async (n) => {
        const url = `http://replay${n}.valve.net/730/${filename}`
        try {
          const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(3000) })
          return res.ok ? url : null
        } catch {
          return null
        }
      })
    )
    const found = results.find(r => r !== null)
    if (found) return found
  }
  return null
}
