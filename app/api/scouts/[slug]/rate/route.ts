import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/scouts/[id]/rate  body: { rating: 1 | -1 | 0 }
// rating 0 = remove vote
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slug } = await params
  const { rating } = await req.json() as { rating: 1 | -1 | 0 }

  if (![1, -1, 0].includes(rating)) {
    return NextResponse.json({ error: 'rating must be 1, -1, or 0' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verify folder is public
  const { data: folder } = await admin
    .from('team_folders').select('id').eq('id', slug).eq('is_public', true).single()
  if (!folder) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (rating === 0) {
    await admin.from('opponent_ratings')
      .delete().eq('folder_id', slug).eq('user_id', user.id)
  } else {
    await admin.from('opponent_ratings').upsert(
      { folder_id: slug, user_id: user.id, rating },
      { onConflict: 'folder_id,user_id' },
    )
  }

  // Return updated counts
  const { data: ratings } = await admin
    .from('opponent_ratings').select('rating').eq('folder_id', slug)
  const up   = (ratings ?? []).filter(r => r.rating ===  1).length
  const down = (ratings ?? []).filter(r => r.rating === -1).length

  return NextResponse.json({ up, down })
}
