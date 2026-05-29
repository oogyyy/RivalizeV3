import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

function getAppUrl(req: NextRequest): string {
  const explicit = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL
  if (explicit) return explicit.replace(/\/$/, '')
  const proto = (req.headers.get('x-forwarded-proto') ?? 'https').split(',')[0].trim()
  const host  = (req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'localhost:3000').split(',')[0].trim()
  return `${proto}://${host}`
}

function htmlResponse(redirectUrl: string): NextResponse {
  const safeUrl = redirectUrl.replace(/'/g, '%27')
  // If running in a popup, navigate the opener (parent window) to the
  // destination and close the popup. Otherwise navigate the current window.
  const html = `<!DOCTYPE html><html><head>
<meta http-equiv="refresh" content="0;url=${safeUrl}">
</head><body><script>
(function(){
  var dest='${safeUrl}';
  if(window.opener&&!window.opener.closed){
    window.opener.location.href=dest;
    window.close();
  }else{
    try{window.top.location.href=dest}catch(e){window.location.href=dest}
  }
})();
</script></body></html>`
  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

async function handleCallback(req: NextRequest, code: string | null, state: string | null) {
  const appUrl = getAppUrl(req)

  if (!code || !state) {
    return htmlResponse(`${appUrl}/profile?error=faceit_invalid`)
  }

  // Decode stateless PKCE payload embedded in state
  let codeVerifier: string
  let userId: string
  try {
    const payload = JSON.parse(Buffer.from(state, 'base64url').toString('utf8')) as { cv: string; uid: string }
    codeVerifier = payload.cv
    userId       = payload.uid
    if (!codeVerifier || !userId) throw new Error('missing fields')
  } catch {
    return htmlResponse(`${appUrl}/profile?error=faceit_invalid`)
  }

  const clientId     = process.env.FACEIT_CLIENT_ID
  const clientSecret = process.env.FACEIT_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return htmlResponse(`${appUrl}/profile?error=faceit_config`)
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
    return htmlResponse(`${appUrl}/profile?error=faceit_token`)
  }

  const { access_token } = await tokenRes.json() as { access_token: string }

  // Fetch FACEIT user info
  const userRes = await fetch('https://api.faceit.com/auth/v1/resources/userinfo', {
    headers: { Authorization: `Bearer ${access_token}` },
  })

  if (!userRes.ok) {
    return htmlResponse(`${appUrl}/profile?error=faceit_userinfo`)
  }

  const faceitUser = await userRes.json() as {
    sub: string
    nickname: string
  }

  // Use admin client to bypass RLS — user ID comes from signed state, not session cookie
  const admin = createAdminClient()
  const { error: updateError } = await admin.from('profiles').update({
    faceit_id: faceitUser.nickname,
  }).eq('id', userId)

  if (updateError) {
    return htmlResponse(`${appUrl}/profile?error=faceit_save`)
  }

  return htmlResponse(`${appUrl}/profile?linked=faceit&nickname=${encodeURIComponent(faceitUser.nickname)}`)
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
    try {
      const body = await req.json() as { code?: string; state?: string }
      code  = body.code ?? null
      state = body.state ?? null
    } catch {}
  }

  return handleCallback(req, code, state)
}
