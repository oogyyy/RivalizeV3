import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createPresignedPutUrl, getPublicUrl } from '@/lib/r2'

const MAX_FILE_SIZE = 500 * 1024 * 1024 // 500 MB

const schema = z.object({
  teamId: z.string().uuid(),
  filename: z.string().min(1).max(255),
  fileSize: z.number().positive().max(MAX_FILE_SIZE),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { teamId, filename, fileSize } = parsed.data

  const lowerName = filename.toLowerCase()
  if (!lowerName.endsWith('.dem') && !lowerName.endsWith('.zst')) {
    return NextResponse.json({ error: 'Only .dem and .zst files are accepted' }, { status: 400 })
  }

  // Admin client bypasses RLS — identity is verified via auth.getUser() above
  const admin = createAdminClient()

  const { data: member } = await admin
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .single()

  if (!member) {
    return NextResponse.json({ error: 'You are not a member of this team' }, { status: 403 })
  }

  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  const key = `${teamId}/${Date.now()}-${safeFilename}`

  try {
    const uploadUrl = await createPresignedPutUrl(key)
    return NextResponse.json({
      key,
      uploadUrl,
      fileUrl: getPublicUrl(key),
      expiresIn: 3600,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[presign] R2 error:', message)
    return NextResponse.json(
      { error: `Failed to generate upload URL: ${message}` },
      { status: 500 },
    )
  }
}
