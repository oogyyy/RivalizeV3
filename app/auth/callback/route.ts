import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// request.url on Railway reflects the internal host (localhost:3000), not the
// public domain. Use APP_URL (runtime env var) or forwarded headers instead.
function getOrigin(request: NextRequest): string {
  const explicit = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL
  if (explicit) return explicit.replace(/\/$/, '')
  const proto = (request.headers.get('x-forwarded-proto') ?? 'https').split(',')[0].trim()
  const host  = (request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? 'localhost:3000').split(',')[0].trim()
  return `${proto}://${host}`
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const origin = getOrigin(request)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`)
}
