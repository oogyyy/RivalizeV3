import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Public endpoint — no auth required
// GET /api/scouts?limit=20&offset=0
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const limit  = Math.min(parseInt(searchParams.get('limit')  ?? '20', 10), 50)
  const offset = parseInt(searchParams.get('offset') ?? '0', 10)
  const q      = searchParams.get('q')?.trim().toLowerCase()

  const admin = createAdminClient()

  let query = admin
    .from('team_folders')
    .select('id, opponent_display_name, opponent_slug, published_at, aggregated_stats')
    .eq('is_public', true)
    .order('published_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (q) {
    query = query.ilike('opponent_display_name', `%${q}%`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Attach rating counts
  const ids = (data ?? []).map(f => f.id)
  const { data: ratings } = ids.length
    ? await admin
        .from('opponent_ratings')
        .select('folder_id, rating')
        .in('folder_id', ids)
    : { data: [] }

  const ratingMap: Record<string, { up: number; down: number }> = {}
  for (const r of ratings ?? []) {
    if (!ratingMap[r.folder_id]) ratingMap[r.folder_id] = { up: 0, down: 0 }
    if (r.rating === 1)  ratingMap[r.folder_id].up++
    if (r.rating === -1) ratingMap[r.folder_id].down++
  }

  const result = (data ?? []).map(f => ({
    id:          f.id,
    name:        f.opponent_display_name,
    slug:        f.opponent_slug,
    publishedAt: f.published_at,
    stats:       f.aggregated_stats,
    ratings:     ratingMap[f.id] ?? { up: 0, down: 0 },
  }))

  return NextResponse.json(result)
}
