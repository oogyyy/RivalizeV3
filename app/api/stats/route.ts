import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const revalidate = 3600 // cache for 1 hour

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
