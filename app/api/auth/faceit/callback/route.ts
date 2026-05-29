import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function getAppUrl(req: NextRequest): string {
  const explicit = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL
  if (explicit) return explicit.replace(/\/$/, '')
  const proto = (req.headers.get('x-forwarded-proto') ?? 'https').split(',')[0].trim()
  const host  = (req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'localhost:3000').split(',')[0].trim()
  return `${proto}://${host}`
}

async function handleCallback(req: NextRequest, code: string | null, state: string | null) {
  const appUrl = getAppUrl(req)

  const codeVerifier  = req.cookies.get('faceit_pkce_verifier')?.value
  const expectedState = req.cookies.get('faceit_pkce_state')?.value

  console.log('[faceit-callback] code:', !!code, 'codeVerifier:', !!codeVerifier, 'stateMatch:', state === expectedState)

  if (!code || !codeVerifier || state !== expectedState) {
    console.log('[faceit-callback] PKCE validation failed - code:', !!code, 'verifier:', !!codeVerifier, 'state match:', state === expectedState)
    return NextResponse.redirect(`${appUrl}/profile?error=faceit_invalid`)
  }

  const clientId     = process.env.FACEIT_CLIENT_ID
  const clientSecret = process.env.FACEIT_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    console.log('[faceit-callback] Missing OAuth credentials')
    return NextResponse.redirect(`${appUrl}/profile?error=faceit_config`)
  }

  const redirectUri = `${appUrl}/api/auth/faceit/callback`

  // Exchange code for tokens
  const tokenRes = await fetch('https://api.faceit.com/auth/v1/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type:    'authorization_code',
      code,
      redirect_uri:  redirectUri,
      code_verifier: codeVerifier,
    }).toString(),
  })

  if (!tokenRes.ok) {
    const tokenErrText = await tokenRes.text().catch(() => '')
    console.log('[faceit-callback] Token exchange failed:', tokenRes.status, tokenErrText)
    return NextResponse.redirect(`${appUrl}/profile?error=faceit_token`)
  }

  const { access_token } = await tokenRes.json() as { access_token: string }
  console.log('[faceit-callback] Token exchange OK')

  // Fetch FACEIT user info
  const userRes = await fetch('https://api.faceit.com/auth/v1/resources/userinfo', {
    headers: { Authorization: `Bearer ${access_token}` },
  })

  if (!userRes.ok) {
    console.log('[faceit-callback] Userinfo fetch failed:', userRes.status)
    return NextResponse.redirect(`${appUrl}/profile?error=faceit_userinfo`)
  }

  const faceitUser = await userRes.json() as {
    sub: string
    nickname: string
  }

  // Persist to the user's profile
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  console.log('[faceit-callback] getUser result - user:', !!user, 'error:', authErr?.message)
  if (!user) {
    return NextResponse.redirect(`${appUrl}/profile?error=faceit_session`)
  }

  const { error: updateError } = await supabase.from('profiles').update({
    faceit_id: faceitUser.nickname,
  }).eq('id', user.id)

  if (updateError) {
    console.log('[faceit-callback] DB update failed:', updateError.message)
    return NextResponse.redirect(`${appUrl}/profile?error=faceit_save`)
  }

  console.log('[faceit-callback] Success - linked nickname:', faceitUser.nickname)

  const res = NextResponse.redirect(`${appUrl}/profile?linked=faceit&nickname=${encodeURIComponent(faceitUser.nickname)}`)
  res.cookies.delete('faceit_pkce_verifier')
  res.cookies.delete('faceit_pkce_state')
  return res
}

// Standard GET redirect (most OAuth flows)
export async function GET(req: NextRequest) {
  const url   = new URL(req.url)
  const code  = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  return handleCallback(req, code, state)
}

// FACEIT uses a form POST via its /post-redirect page
export async function POST(req: NextRequest) {
  let code: string | null = null
  let state: string | null = null

  const contentType = req.headers.get('content-type') ?? ''
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const body = new URLSearchParams(await req.text())
    code  = body.get('code')
    state = body.get('state')
  } else {
    // Fallback: try JSON body
    try {
      const body = await req.json() as { code?: string; state?: string }
      code  = body.code ?? null
      state = body.state ?? null
    } catch {}
  }

  console.log('[faceit-callback] POST received - code:', !!code, 'state:', !!state)
  return handleCallback(req, code, state)
}
