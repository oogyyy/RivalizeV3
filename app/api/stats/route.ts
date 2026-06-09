import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Served at request time (Supabase isn't available during build);
// the Cache-Control header below handles the 1-hour CDN cache.
export const dynamic = 'force-dynamic'

export async function GET() {
  const admin = createAdminClient()

  const { data, error } = await admin.rpc('get_platform_stats')

  if (error) {
    console.error('[stats] RPC error:', error)
    return NextResponse.json({ error: 'Failed to load stats' }, { status: 500 })
  }

  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
  })
}
