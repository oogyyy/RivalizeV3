import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/admin/queue-stats
 *
 * Returns basic queue health metrics.
 * Protected: requires SUPABASE_SERVICE_ROLE_KEY (or internal Railway network call).
 *
 * In production you can front this with a simple header check or
 * expose it only on an internal port.
 */
export async function GET(request: Request) {
  // Basic protection: require the service role key (or a custom internal header)
  const authHeader = request.headers.get('authorization') || ''
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  const isServiceRole =
    authHeader.includes(serviceKey || '') ||
    request.headers.get('x-internal-admin') === 'true'

  if (!isServiceRole) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  const { data: queued } = await admin
    .from('demos')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'queued')

  const { data: processing } = await admin
    .from('demos')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'processing')

  const { data: failedRecent } = await admin
    .from('demos')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'failed')
    .gte('created_at', new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString())

  const { data: stuck } = await admin
    .from('demos')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'processing')
    .lt('processing_started_at', new Date(Date.now() - 1000 * 60 * 45).toISOString())

  return NextResponse.json({
    queued: queued?.length ?? 0,
    processing: processing?.length ?? 0,
    failedLast24h: failedRecent?.length ?? 0,
    potentiallyStuck: stuck?.length ?? 0,
    timestamp: new Date().toISOString(),
  })
}
