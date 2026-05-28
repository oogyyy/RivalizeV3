import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { createPresignedPutUrl, deleteObject } from '@/lib/r2'

const MAX_AUDIO_SIZE = 200 * 1024 * 1024 // 200 MB

export async function POST(
  request: Request,
  { params }: { params: Promise<{ demoId: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { demoId } = await params
  const body = await request.json()
  const { filename, fileSize, offsetSeconds = 0 } = body as {
    filename: string
    fileSize: number
    offsetSeconds?: number
  }

  if (!filename || fileSize > MAX_AUDIO_SIZE) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const lowerName = filename.toLowerCase()
  if (!lowerName.endsWith('.mp3') && !lowerName.endsWith('.ogg') && !lowerName.endsWith('.wav') && !lowerName.endsWith('.m4a')) {
    return NextResponse.json({ error: 'Only .mp3, .ogg, .wav, .m4a files accepted' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: demo } = await admin
    .from('demos')
    .select('id, team_id, voice_comms_r2_key')
    .eq('id', demoId)
    .single()

  if (!demo) return NextResponse.json({ error: 'Demo not found' }, { status: 404 })

  const { data: member } = await admin
    .from('team_members')
    .select('role')
    .eq('team_id', demo.team_id)
    .eq('user_id', user.id)
    .single()

  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  const key = `voice-comms/${demo.team_id}/${demoId}-${Date.now()}-${safeFilename}`

  try {
    const uploadUrl = await createPresignedPutUrl(key)

    await admin
      .from('demos')
      .update({
        voice_comms_r2_key: key,
        voice_comms_offset_seconds: offsetSeconds,
      })
      .eq('id', demoId)

    return NextResponse.json({ key, uploadUrl })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ demoId: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { demoId } = await params
  const body = await request.json()
  const { offsetSeconds } = body as { offsetSeconds: number }

  const admin = createAdminClient()

  const { data: demo } = await admin
    .from('demos')
    .select('id, team_id')
    .eq('id', demoId)
    .single()

  if (!demo) return NextResponse.json({ error: 'Demo not found' }, { status: 404 })

  const { data: member } = await admin
    .from('team_members')
    .select('role')
    .eq('team_id', demo.team_id)
    .eq('user_id', user.id)
    .single()

  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await admin
    .from('demos')
    .update({ voice_comms_offset_seconds: offsetSeconds })
    .eq('id', demoId)

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ demoId: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { demoId } = await params
  const admin = createAdminClient()

  const { data: demo } = await admin
    .from('demos')
    .select('id, team_id, voice_comms_r2_key')
    .eq('id', demoId)
    .single()

  if (!demo) return NextResponse.json({ error: 'Demo not found' }, { status: 404 })

  const { data: member } = await admin
    .from('team_members')
    .select('role')
    .eq('team_id', demo.team_id)
    .eq('user_id', user.id)
    .single()

  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const key = (demo as { voice_comms_r2_key?: string | null }).voice_comms_r2_key
  if (key) {
    try { await deleteObject(key) } catch { /* already gone */ }
  }

  await admin
    .from('demos')
    .update({ voice_comms_r2_key: null, voice_comms_offset_seconds: 0 })
    .eq('id', demoId)

  return NextResponse.json({ ok: true })
}
