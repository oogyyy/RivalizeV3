import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// PATCH /api/friends/[id] — accept or reject an incoming request
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { action } = await req.json() as { action: 'accept' | 'reject' }
  if (!['accept', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'action must be accept or reject' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: friendship } = await admin
    .from('friendships')
    .select('id, addressee_id, status')
    .eq('id', id)
    .single()

  if (!friendship) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (friendship.addressee_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (friendship.status !== 'pending') return NextResponse.json({ error: 'Already resolved' }, { status: 409 })

  const newStatus = action === 'accept' ? 'accepted' : 'rejected'
  await admin.from('friendships').update({ status: newStatus }).eq('id', id)

  return NextResponse.json({ status: newStatus })
}

// DELETE /api/friends/[id] — unfriend or cancel/reject a request
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: friendship } = await admin
    .from('friendships')
    .select('id, requester_id, addressee_id')
    .eq('id', id)
    .single()

  if (!friendship) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (friendship.requester_id !== user.id && friendship.addressee_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await admin.from('friendships').delete().eq('id', id)
  return NextResponse.json({ deleted: true })
}
