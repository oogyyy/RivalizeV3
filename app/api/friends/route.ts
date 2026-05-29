import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/friends — returns { friends, incoming, outgoing }
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: rows } = await admin
    .from('friendships')
    .select(`
      id, status, created_at,
      requester:profiles!friendships_requester_id_fkey(id, username, display_name, avatar_url, preferred_roles),
      addressee:profiles!friendships_addressee_id_fkey(id, username, display_name, avatar_url, preferred_roles)
    `)
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)

  const friends: unknown[]  = []
  const incoming: unknown[] = []
  const outgoing: unknown[] = []

  for (const row of rows ?? []) {
    const r = row as {
      id: string; status: string; created_at: string
      requester: { id: string; username: string; display_name: string | null; avatar_url: string | null; preferred_roles: string[] | null }
      addressee: { id: string; username: string; display_name: string | null; avatar_url: string | null; preferred_roles: string[] | null }
    }
    const iRequested = r.requester.id === user.id
    const other = iRequested ? r.addressee : r.requester

    const entry = { id: r.id, status: r.status, created_at: r.created_at, profile: other }

    if (r.status === 'accepted') {
      friends.push(entry)
    } else if (r.status === 'pending') {
      if (iRequested) outgoing.push(entry)
      else incoming.push(entry)
    }
  }

  return NextResponse.json({ friends, incoming, outgoing })
}

// POST /api/friends — send a friend request by username
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { username } = await req.json() as { username?: string }
  if (!username?.trim()) return NextResponse.json({ error: 'Username required' }, { status: 400 })

  const admin = createAdminClient()

  // Find the target user
  const { data: target } = await admin
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .eq('username', username.trim().replace(/^@/, '').toLowerCase())
    .single()

  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (target.id === user.id) return NextResponse.json({ error: 'Cannot add yourself' }, { status: 400 })

  // Check if a relationship already exists (either direction)
  const { data: existing } = await admin
    .from('friendships')
    .select('id, status, requester_id')
    .or(`and(requester_id.eq.${user.id},addressee_id.eq.${target.id}),and(requester_id.eq.${target.id},addressee_id.eq.${user.id})`)
    .single()

  if (existing) {
    if (existing.status === 'accepted') return NextResponse.json({ error: 'Already friends' }, { status: 409 })
    if (existing.status === 'pending' && existing.requester_id === user.id) {
      return NextResponse.json({ error: 'Request already sent' }, { status: 409 })
    }
    // They sent us a request — auto-accept
    if (existing.status === 'pending' && existing.requester_id === target.id) {
      await admin.from('friendships').update({ status: 'accepted' }).eq('id', existing.id)
      return NextResponse.json({ message: 'Friend request accepted', status: 'accepted' })
    }
  }

  const { data: created, error } = await admin
    .from('friendships')
    .insert({ requester_id: user.id, addressee_id: target.id, status: 'pending' })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ id: created.id, status: 'pending', profile: target }, { status: 201 })
}
