export const maxDuration = 300  // 5 min — large demo files can take a while

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getPublicUrl } from '@/lib/r2'
import { slugify } from '@/lib/utils'

const MAX_FILE_SIZE = 500 * 1024 * 1024

function getR2Client(): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  })
}

/**
 * POST /api/demos/upload
 * Receives the raw demo file as the request body (Content-Type: application/octet-stream)
 * and proxies it to R2 — bypassing the browser CORS restriction on direct R2 presigned uploads.
 *
 * Query params: teamId, filename, opponentName, demoType (opponent|self)
 * Headers:      x-file-size (optional, for accurate DB record)
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = request.nextUrl.searchParams
  const teamId      = q.get('teamId')
  const filename    = q.get('filename')
  const opponentName = q.get('opponentName') ?? 'Unknown'
  const demoType    = (q.get('demoType') ?? 'opponent') as 'opponent' | 'self'

  if (!teamId || !filename) {
    return NextResponse.json({ error: 'Missing teamId or filename' }, { status: 400 })
  }

  const lower = filename.toLowerCase()
  if (!lower.endsWith('.dem') && !lower.endsWith('.zst')) {
    return NextResponse.json({ error: 'Only .dem and .zst files accepted' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: member } = await admin
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .single()
  if (!member) return NextResponse.json({ error: 'Not a member of this team' }, { status: 403 })

  if (!process.env.CLOUDFLARE_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID) {
    return NextResponse.json({ error: 'R2 not configured' }, { status: 503 })
  }

  // Buffer the request body
  const buffer = await request.arrayBuffer()
  if (buffer.byteLength > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File exceeds 500 MB limit' }, { status: 413 })
  }

  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  const key = `${teamId}/${Date.now()}-${safeFilename}`

  // Upload to R2
  try {
    await getR2Client().send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      Body: new Uint8Array(buffer),
      ContentType: 'application/octet-stream',
      ContentLength: buffer.byteLength,
    }))
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown R2 error'
    console.error('[upload] R2 error:', msg)
    return NextResponse.json({ error: `Storage upload failed: ${msg}` }, { status: 500 })
  }

  // Register demo in DB
  const resolvedOpponent = demoType === 'self' ? 'My Team' : opponentName.trim() || 'Unknown'
  const opponentSlug = slugify(resolvedOpponent)
  const fileUrl = getPublicUrl(key)

  const { data: demo, error: demoError } = await admin
    .from('demos')
    .insert({
      team_id: teamId,
      opponent_name: resolvedOpponent,
      opponent_slug: opponentSlug,
      map: 'unknown',
      raw_file_path: key,
      file_url: fileUrl,
      status: 'processing',
      file_size_bytes: buffer.byteLength,
      created_by: user.id,
      demo_type: demoType,
      parsed_data: { opponentSide: demoType === 'self' ? 'team1' : 'team2' },
    })
    .select()
    .single()

  if (demoError) {
    console.error('[upload] DB error:', demoError)
    return NextResponse.json({ error: demoError.message }, { status: 500 })
  }

  if (demoType === 'opponent') {
    await admin.from('team_folders').upsert(
      { user_team_id: teamId, opponent_slug: opponentSlug, opponent_display_name: resolvedOpponent },
      { onConflict: 'user_team_id,opponent_slug' },
    )
  }

  return NextResponse.json(demo, { status: 201 })
}
