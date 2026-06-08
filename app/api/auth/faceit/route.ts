import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createHash, randomBytes } from 'crypto'

function getAppUrl(req: NextRequest): string {
  const explicit = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL
  if (explicit) return explicit.replace(/\/$/, '')
  const proto = (req.headers.get('x-forwarded-proto') ?? 'https').split(',')[0].trim()
  const host  = (req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'localhost:3000').split(',')[0].trim()
  return `${proto}://${host}`
}

// Initiates FACEIT OAuth2 PKCE flow.
// Requires FACEIT_CLIENT_ID + FACEIT_CLIENT_SECRET in env vars.
export async function GET(req: NextRequest) {
  const clientId     = process.env.FACEIT_CLIENT_ID
  const clientSecret = process.env.FACEIT_CLIENT_SECRET
  const appUrl       = getAppUrl(req)

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${appUrl}/profile?error=faceit_config`)
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${appUrl}/login`)
  }

  const redirectUri = `${appUrl}/api/auth/faceit/callback`

  // PKCE: 32 bytes → 43-char base64url verifier (well within PKCE spec minimums)
  const codeVerifier  = randomBytes(32).toString('base64url')
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url')

  // State = verifier (always 43 chars) + userId (always 36 chars) = 79 chars total.
  // Flat concat avoids JSON+base64url wrapping that pushed the state to ~190 chars,
  // which FACEIT may silently truncate, breaking JSON.parse in the callback.
  const statePayload = codeVerifier + user.id

  const params = new URLSearchParams({
    response_type:         'code',
    response_mode:         'query',
    client_id:             clientId,
    redirect_uri:          redirectUri,
    scope:                 'openid profile email',
    state:                 statePayload,
    code_challenge:        codeChallenge,
    code_challenge_method: 'S256',
  })

  // redirect_popup=true tells FACEIT to do a standard browser redirect to
  // redirect_uri?code=...&state=... instead of the Connect widget popup flow
  // which relies on window.opener (null on Firefox due to COOP enforcement).
  return NextResponse.redirect(`https://accounts.faceit.com/accounts?redirect_popup=true&${params.toString()}`)
}
