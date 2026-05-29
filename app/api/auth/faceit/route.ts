import { NextRequest, NextResponse } from 'next/server'
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

  // PKCE: generate code verifier + challenge
  const codeVerifier  = randomBytes(64).toString('base64url')
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url')

  // Encode verifier + user ID in state to avoid cross-origin cookie issues.
  // The state is opaque to FACEIT and echoed back in the callback.
  const statePayload = Buffer.from(JSON.stringify({ cv: codeVerifier, uid: user.id })).toString('base64url')

  const params = new URLSearchParams({
    response_type:         'code',
    client_id:             clientId,
    redirect_uri:          redirectUri,
    scope:                 'openid profile email',
    state:                 statePayload,
    code_challenge:        codeChallenge,
    code_challenge_method: 'S256',
  })

  return NextResponse.redirect(`https://accounts.faceit.com/accounts?${params.toString()}`)
}
