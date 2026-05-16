import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const schema = z.object({
  teamId: z.string().uuid(),
  filename: z.string().min(1).max(255),
  fileSize: z.number().positive().max(1_073_741_824), // 1 GB max
})

// Returns a presigned Supabase Storage URL so the client can upload
// the .dem file directly — the file bytes never pass through Railway.
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

  // Verify the caller is a member/owner of their own team (teamId is always the uploader's team)
  const { data: member } = await supabase
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .single()

  if (!member) {
    return NextResponse.json(
      { error: 'You must be a member of this team to upload opponent demos' },
      { status: 403 }
    )
  }

  // Build a unique storage path
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `${teamId}/${Date.now()}-${safeFilename}`

  // Use the admin client to generate a signed upload URL
  const admin = createAdminClient()
  const { data, error } = await admin.storage
    .from('demos')
    .createSignedUploadUrl(storagePath)

  if (error || !data) {
    console.error('[presign] Supabase storage error:', error)
    return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 })
  }

  return NextResponse.json({
    signedUrl: data.signedUrl,
    path: storagePath,
    token: data.token,
    expiresIn: 3600,
  })
}
