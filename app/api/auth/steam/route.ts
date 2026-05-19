import { NextRequest, NextResponse } from 'next/server'

// Initiates Steam OpenID login. Redirects the user to Steam's login page.
// On return, Steam calls /api/auth/steam/callback with the verified identity.
export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
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
