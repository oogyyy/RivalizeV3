import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/notifications — list notifications for the current user
//   default        → unread only (badge + dropdown)
//   ?filter=all    → full history incl. read (notifications page), plus unreadCount
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const includeRead = new URL(request.url).searchParams.get('filter') === 'all'

  const admin = createAdminClient()
  let query = admin
    .from('notifications')
    .select('id, type, title, body, link, read, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (!includeRead) query = query.eq('read', false)

  const { data } = await query.limit(includeRead ? 50 : 30)
  const notifications = data ?? []

  let unreadCount = notifications.length
  if (includeRead) {
    const { count } = await admin
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false)
    unreadCount = count ?? notifications.filter(n => !n.read).length
  }

  return NextResponse.json({ notifications, unreadCount })
}

// PATCH /api/notifications — mark notifications as read
// Body: { ids?: string[] }  — if omitted, marks all unread as read
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as { ids?: string[] }
  const admin = createAdminClient()

  const q = admin.from('notifications').update({ read: true }).eq('user_id', user.id)
  if (body.ids?.length) {
    await q.in('id', body.ids)
  } else {
    await q.eq('read', false)
  }

  return NextResponse.json({ ok: true })
}
