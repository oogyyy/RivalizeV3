import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/notifications — list unread notifications for the current user
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data } = await admin
    .from('notifications')
    .select('id, type, title, body, link, created_at')
    .eq('user_id', user.id)
    .eq('read', false)
    .order('created_at', { ascending: false })
    .limit(30)

  return NextResponse.json({ notifications: data ?? [] })
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
