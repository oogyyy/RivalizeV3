const STEAM_API_BASE = 'https://api.steampowered.com'

export function isSteamApiConfigured(): boolean {
  return Boolean(process.env.STEAM_API_KEY)
}

/**
 * Returns the NEXT match sharing code after `knownCode` for this player,
 * or null if there are no newer matches / on error.
 *
 * Requires STEAM_API_KEY environment variable.
 * steamAuthToken is obtained by the user from:
 *   https://help.steampowered.com/en/wizard/HelpWithGameIssue/?appid=730&issueid=128
 */
export async function getNextMatchSharingCode(
  steamId: string,
  steamAuthToken: string,
  knownCode: string,
): Promise<string | null> {
  const key = process.env.STEAM_API_KEY
  if (!key) throw new Error('STEAM_API_KEY not configured')

  const url = new URL(`${STEAM_API_BASE}/ICSGOPlayers_730/GetNextMatchSharingCode/v1`)
  url.searchParams.set('key', key)
  url.searchParams.set('steamid', steamId)
  url.searchParams.set('steamidkey', steamAuthToken)
  url.searchParams.set('knowncode', knownCode)

  const res = await fetch(url.toString())
  if (!res.ok) return null

  const data = await res.json() as { result?: { nextcode?: string } }
  const next = data?.result?.nextcode
  if (!next || next === 'n/a') return null
  return next
}
