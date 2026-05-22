import { NextRequest, NextResponse } from 'next/server'

// Derives the public base URL from the request, preferring the explicit env
// var. Falls back to x-forwarded-proto/host so Railway/Vercel deployments
// work even when NEXT_PUBLIC_APP_URL is not configured.
function getBaseUrl(req: NextRequest): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  }
  const proto = req.headers.get('x-forwarded-proto') ?? 'https'
  const host  = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'localhost:3000'
  return `${proto}://${host}`
}

// Initiates Steam OpenID login. Redirects the user to Steam's login page.
// On return, Steam calls /api/auth/steam/callback with the verified identity.
export async function GET(req: NextRequest) {
  const appUrl   = getBaseUrl(req)
  const returnTo = `${appUrl}/api/auth/steam/callback`
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
