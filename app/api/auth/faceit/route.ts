import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createHash, randomBytes } from 'crypto'

// Initiates FACEIT OAuth2 PKCE flow.
// Requires FACEIT_CLIENT_ID + FACEIT_CLIENT_SECRET in env vars.
export async function GET(req: NextRequest) {
  const clientId     = process.env.FACEIT_CLIENT_ID
  const clientSecret = process.env.FACEIT_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    const appUrl = (process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')
    return NextResponse.redirect(`${appUrl}/profile?error=faceit_config`)
  }

  const appUrl      = (process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')
  const redirectUri = `${appUrl}/api/auth/faceit/callback`

  // PKCE: generate code verifier + challenge
  const codeVerifier  = randomBytes(64).toString('base64url')
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url')
  const state         = randomBytes(16).toString('hex')

  const params = new URLSearchParams({
    response_type:         'code',
    client_id:             clientId,
    redirect_uri:          redirectUri,
    scope:                 'openid profile email',
    state,
    code_challenge:        codeChallenge,
    code_challenge_method: 'S256',
  })

  // SameSite=None required so cookies are sent on the cross-origin POST
  // that FACEIT's /post-redirect page makes back to our callback.
  const res = NextResponse.redirect(`https://accounts.faceit.com/sso?${params.toString()}`)
  res.cookies.set('faceit_pkce_verifier', codeVerifier, {
    httpOnly: true,
    maxAge: 600,
    path: '/',
    secure: true,
    sameSite: 'none',
  })
  res.cookies.set('faceit_pkce_state', state, {
    httpOnly: true,
    maxAge: 600,
    path: '/',
    secure: true,
    sameSite: 'none',
  })
  return res
}
