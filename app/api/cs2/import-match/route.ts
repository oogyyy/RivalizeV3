import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const bodySchema = z.object({ matchId: z.string().uuid() })

/**
 * POST /api/cs2/import-match
 *
 * Flags a discovered match for demo import. The actual download/decompress/parse
 * is done by the worker (off the request path) — this just sets the request flag
 * after verifying ownership and that a demo URL is available.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let raw: unknown
  try { raw = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })

  const admin = createAdminClient()
  const { data: match } = await admin
    .from('cs2_matches')
    .select('id, user_id, demo_url, demo_id')
    .eq('id', parsed.data.matchId)
    .single()

  if (!match || match.user_id !== user.id) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 })
  }
  if (match.demo_id) {
    return NextResponse.json({ status: 'already_imported' })
  }
  if (!match.demo_url) {
    return NextResponse.json({ error: 'No demo URL available for this match yet — try syncing again shortly.' }, { status: 409 })
  }

  await admin
    .from('cs2_matches')
    .update({ import_requested_at: new Date().toISOString() })
    .eq('id', match.id)

  return NextResponse.json({ status: 'queued' })
}
