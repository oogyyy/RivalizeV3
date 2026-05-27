import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createHash, randomBytes } from 'crypto'

// Initiates FACEIT OAuth2 PKCE flow.
// Requires FACEIT_CLIENT_ID in env vars (from https://developers.faceit.com).
export async function GET(req: NextRequest) {
  const clientId = process.env.FACEIT_CLIENT_ID
  if (!clientId) {
    return NextResponse.json({ error: 'FACEIT_CLIENT_ID not configured' }, { status: 500 })
  }

  const appUrl     = (process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')
  const redirectUri = `${appUrl}/api/auth/faceit/callback`

  // PKCE: generate code verifier + challenge
  const codeVerifier  = randomBytes(64).toString('base64url')
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url')
  const state         = randomBytes(16).toString('hex')

  // Store verifier + state in a short-lived cookie
  const params = new URLSearchParams({
    response_type:          'code',
    client_id:              clientId,
    redirect_uri:           redirectUri,
    scope:                  'openid profile email',
    state,
    code_challenge:         codeChallenge,
    code_challenge_method:  'S256',
  })

  const res = NextResponse.redirect(
    `https://accounts.faceit.com/sso?${params.toString()}`
  )
  res.cookies.set('faceit_pkce_verifier', codeVerifier, { httpOnly: true, maxAge: 600, path: '/' })
  res.cookies.set('faceit_pkce_state',    state,         { httpOnly: true, maxAge: 600, path: '/' })
  return res
}
