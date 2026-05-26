import { NextRequest, NextResponse } from 'next/server'

// Derives the public base URL from the request.
// APP_URL (server-side only, read at runtime) takes priority over
// NEXT_PUBLIC_APP_URL (which Next.js bakes in at build time and may be stale).
// Falls back to x-forwarded-proto/host for zero-config deployments.
function getBaseUrl(req: NextRequest): string {
  const explicit = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL
  if (explicit) {
    const raw = explicit.replace(/\/$/, '')
    return raw.startsWith('http') ? raw : `https://${raw}`
  }
  const proto = (req.headers.get('x-forwarded-proto') ?? 'https').split(',')[0].trim()
  const host  = (req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'localhost:3000').split(',')[0].trim()
  return `${proto}://${host}`
}

// Initiates Steam OpenID login. Redirects the user to Steam's login page.
// On return, Steam calls /api/auth/steam/callback with the verified identity.
// Pass ?mode=login to initiate a sign-in/sign-up flow instead of account linking.
export async function GET(req: NextRequest) {
  const appUrl   = getBaseUrl(req)
  const mode     = req.nextUrl.searchParams.get('mode') ?? 'link'
  const returnTo = `${appUrl}/api/auth/steam/callback?mode=${mode}`
  const realm    = appUrl

  const params = new URLSearchParams({
    'openid.ns':         'http://specs.openid.net/auth/2.0',
    'openid.mode':       'checkid_setup',
    'openid.return_to':  returnTo,
    'openid.realm':      realm,
    'openid.identity':   'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
  })

  return NextResponse.redirect(
    `https://steamcommunity.com/openid/login?${params.toString()}`
  )
}
