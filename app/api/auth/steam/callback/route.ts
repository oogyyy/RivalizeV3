import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const STEAM_ID_PATTERN = /^https:\/\/steamcommunity\.com\/openid\/id\/(\d+)$/

function getAppUrl(params: URLSearchParams, req: NextRequest): string {
  const returnTo = params.get('openid.return_to')
  if (returnTo) {
    try {
      const u = new URL(returnTo)
      return `${u.protocol}//${u.host}`
    } catch { /* fall through */ }
  }
  const explicit = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL
  if (explicit) {
    return explicit.replace(/\/$/, '')
  }
  const proto = (req.headers.get('x-forwarded-proto') ?? 'https').split(',')[0].trim()
  const host  = (req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'localhost:3000').split(',')[0].trim()
  return `${proto}://${host}`
}

export async function GET(req: NextRequest) {
  const url    = new URL(req.url)
  const params = url.searchParams
  const appUrl = getAppUrl(params, req)
  const mode   = params.get('mode') ?? 'link' // 'login' | 'link'

  if (params.get('openid.mode') !== 'id_res') {
    const dest = mode === 'login' ? '/login?error=steam_cancelled' : '/profile?error=steam_cancelled'
    return NextResponse.redirect(`${appUrl}${dest}`)
  }

  // Validate the assertion with Steam
  const validationParams = new URLSearchParams(params)
  validationParams.set('openid.mode', 'check_authentication')

  const validationRes = await fetch('https://steamcommunity.com/openid/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: validationParams.toString(),
  })
  const validationText = await validationRes.text()

  if (!validationText.includes('is_valid:true')) {
    const dest = mode === 'login' ? '/login?error=steam_invalid' : '/profile?error=steam_invalid'
    return NextResponse.redirect(`${appUrl}${dest}`)
  }

  // Extract Steam64 ID
  const claimedId = params.get('openid.claimed_id') ?? ''
  const match     = STEAM_ID_PATTERN.exec(claimedId)
  if (!match) {
    const dest = mode === 'login' ? '/login?error=steam_parse' : '/profile?error=steam_parse'
    return NextResponse.redirect(`${appUrl}${dest}`)
  }
  const steamId = match[1]

  // ── LINK mode: attach Steam ID to an already-signed-in user ──────────────
  if (mode !== 'login') {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.redirect(`${appUrl}/login`)

    await supabase.from('profiles').update({ steam_id: steamId }).eq('id', user.id)
    return NextResponse.redirect(`${appUrl}/profile?linked=steam`)
  }

  // ── LOGIN mode: find or create a Supabase user, then create a session ────
  const admin = createAdminClient()

  // Look up an existing profile with this Steam ID
  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('steam_id', steamId)
    .single()

  let userEmail: string

  if (profile) {
    // Existing Steam user — fetch their email
    const { data: { user: existingUser }, error: fetchError } = await admin.auth.admin.getUserById(profile.id)
    if (fetchError || !existingUser) {
      return NextResponse.redirect(`${appUrl}/login?error=steam_fetch`)
    }
    userEmail = existingUser.email!
  } else {
    // New user — create account with a synthetic email derived from Steam ID
    userEmail = `steam_${steamId}@rivalize.pro`

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: userEmail,
      email_confirm: true,
      user_metadata: { steam_id: steamId, provider: 'steam' },
    })

    if (createError || !created.user) {
      // Email already exists but no profile row — shouldn't happen, but handle gracefully
      if (createError?.message?.includes('already been registered')) {
        const { data: { users } } = await admin.auth.admin.listUsers()
        const existing = users.find(u => u.email === userEmail)
        if (!existing) return NextResponse.redirect(`${appUrl}/login?error=steam_conflict`)
        userEmail = existing.email!
        await admin.from('profiles').update({ steam_id: steamId }).eq('id', existing.id)
      } else {
        return NextResponse.redirect(`${appUrl}/login?error=steam_create`)
      }
    } else {
      // Link Steam ID in the profiles row (created by DB trigger on auth.users insert)
      await admin.from('profiles').update({ steam_id: steamId }).eq('id', created.user.id)
    }
  }

  // Generate a magic link to establish a browser session, then redirect to dashboard
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: userEmail,
    options: { redirectTo: `${appUrl}/dashboard` },
  })

  if (linkError || !linkData) {
    return NextResponse.redirect(`${appUrl}/login?error=steam_session`)
  }

  return NextResponse.redirect(linkData.properties.action_link)
}
