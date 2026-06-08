import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const { type, title, description, email } = body as {
    type?: string
    title?: string
    description?: string
    email?: string
  }

  if (!description?.trim()) {
    return NextResponse.json({ error: 'Description is required' }, { status: 400 })
  }
  if (!['bug', 'suggestion', 'other'].includes(type ?? '')) {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  }

  // Attach user_id if logged in, but don't require it
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const admin = createAdminClient()
  const { error } = await admin.from('feedback').insert({
    type,
    title: title?.trim() || null,
    description: description.trim(),
    email: email?.trim() || null,
    user_id: user?.id ?? null,
  })

  if (error) {
    console.error('[feedback]', error)
    return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: 201 })
}
