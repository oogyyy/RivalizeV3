import { type NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PARSED_SUMMARY_SELECT, summaryToParsedData, type ParsedSummaryRow } from '@/lib/demo-parser/parsed-summary'

// Public endpoint — no auth required
// GET /api/scouts/[id]  (id = team_folders.id)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const admin = createAdminClient()

  const { data: folder } = await admin
    .from('team_folders')
    .select('id, opponent_display_name, opponent_slug, published_at, aggregated_stats, ai_brief, updated_at')
    .eq('id', slug)
    .eq('is_public', true)
    .single()

  if (!folder) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Recent completed demos for this folder — slim parsed_data projection
  const { data: demosRaw } = await admin
    .from('demos')
    .select(`id, map, match_date, created_at, ${PARSED_SUMMARY_SELECT}`)
    .eq('opponent_slug', folder.opponent_slug)
    .eq('demo_type', 'opponent')
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(10)
  const demos = ((demosRaw ?? []) as Array<{ id: string; map: string; match_date: string | null; created_at: string } & ParsedSummaryRow>)
    .map(r => ({ id: r.id, map: r.map, match_date: r.match_date, created_at: r.created_at, parsed_data: summaryToParsedData(r) }))

  // Rating counts
  const { data: ratings } = await admin
    .from('opponent_ratings')
    .select('rating')
    .eq('folder_id', folder.id)

  const up   = (ratings ?? []).filter(r => r.rating ===  1).length
  const down = (ratings ?? []).filter(r => r.rating === -1).length

  const res = NextResponse.json({
    id:          folder.id,
    name:        folder.opponent_display_name,
    slug:        folder.opponent_slug,
    publishedAt: folder.published_at,
    updatedAt:   folder.updated_at,
    stats:       folder.aggregated_stats,
    aiBrief:     folder.ai_brief,
    demos:       demos ?? [],
    ratings:     { up, down },
  })
  res.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300')
  return res
}
