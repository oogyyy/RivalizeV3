import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const VALID_EXTENSIONS = ['.dem', '.dem.zst']

const schema = z.object({
  teamId: z.string().uuid(),
  filename: z.string().min(1).max(255),
  fileSize: z.number().positive().max(1_073_741_824), // 1 GB max
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

  // Validate file extension
  const lowerName = filename.toLowerCase()
  if (!VALID_EXTENSIONS.some(ext => lowerName.endsWith(ext))) {
    return NextResponse.json(
      { error: 'Only .dem and .dem.zst files are accepted' },
      { status: 400 }
    )
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
  // storagePath is relative to the bucket root — no bucket prefix
  const storagePath = `${teamId}/${Date.now()}-${safeFilename}`

  const { data, error } = await admin.storage
    .from('demos')
    .createSignedUploadUrl(storagePath)

  if (error || !data) {
    console.error('[presign] storage error:', error)
    // Surface the real error so the client can display it
    return NextResponse.json(
      { error: error?.message ?? 'Failed to generate upload URL' },
      { status: 500 }
    )
  }

  // Return path + token so the browser can call uploadToSignedUrl() directly,
  // which uses the correct /object/upload/sign/ endpoint (not the raw signedUrl).
  return NextResponse.json({
    path: storagePath,
    token: data.token,
    // signedUrl is also included for reference / debugging
    signedUrl: data.signedUrl,
    expiresIn: 3600,
  })
}
