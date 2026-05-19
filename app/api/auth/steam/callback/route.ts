import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const STEAM_ID_PATTERN = /^https:\/\/steamcommunity\.com\/openid\/id\/(\d+)$/

// Receives Steam OpenID callback, validates it, extracts the Steam64 ID,
// and saves it to the user's profile.
export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const url    = new URL(req.url)
  const params = url.searchParams

  // Must be a positive assertion
  if (params.get('openid.mode') !== 'id_res') {
    return NextResponse.redirect(`${appUrl}/profile?error=steam_cancelled`)
  }

  // Validate the response with Steam's endpoint
  const validationParams = new URLSearchParams(params)
  validationParams.set('openid.mode', 'check_authentication')

  const validationRes = await fetch('https://steamcommunity.com/openid/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: validationParams.toString(),
  })
  const validationText = await validationRes.text()

  if (!validationText.includes('is_valid:true')) {
    return NextResponse.redirect(`${appUrl}/profile?error=steam_invalid`)
  }

  // Extract Steam64 ID from the claimed_id URL
  const claimedId = params.get('openid.claimed_id') ?? ''
  const match     = STEAM_ID_PATTERN.exec(claimedId)
  if (!match) {
    return NextResponse.redirect(`${appUrl}/profile?error=steam_parse`)
  }
  const steamId = match[1]

  // Persist to the user's profile
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${appUrl}/login`)
  }

  await supabase.from('profiles').update({ steam_id: steamId }).eq('id', user.id)

  return NextResponse.redirect(`${appUrl}/profile?linked=steam`)
}
