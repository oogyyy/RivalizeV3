import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { getPublicUrl } from '@/lib/r2'

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v']
const MAX_IMAGE_SIZE = 10 * 1024 * 1024   // 10 MB
const MAX_VIDEO_SIZE = 200 * 1024 * 1024  // 200 MB

function makeR2Client() {
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
 * POST /api/lineups/upload-media
 * Body: { lineupId, files: [{ filename, contentType, size }] }
 * Returns: { uploads: [{ presignedUrl, key, publicUrl }] }
 *
 * Clients upload directly to R2 using the returned presigned PUT URLs,
 * then PATCH /api/lineups/{id} with the resulting publicUrls as media_urls.
 *
 * Note: direct browser uploads require CORS to be configured on your R2 bucket.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    lineupId: string
    files: Array<{ filename: string; contentType: string; size: number }>
  }

  const { lineupId, files } = body
  if (!lineupId || !Array.isArray(files) || files.length === 0) {
    return NextResponse.json({ error: 'lineupId and files required' }, { status: 400 })
  }

  if (files.length > 10) {
    return NextResponse.json({ error: 'Maximum 10 files per upload' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: lineup } = await admin
    .from('lineups')
    .select('team_id')
    .eq('id', lineupId)
    .single()

  if (!lineup) return NextResponse.json({ error: 'Lineup not found' }, { status: 404 })

  const { data: member } = await admin
    .from('team_members')
    .select('role')
    .eq('team_id', lineup.team_id)
    .eq('user_id', user.id)
    .single()

  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (!process.env.CLOUDFLARE_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID) {
    return NextResponse.json({ error: 'Storage not configured' }, { status: 503 })
  }

  const r2 = makeR2Client()
  const uploads: Array<{ presignedUrl: string; key: string; publicUrl: string }> = []

  for (const file of files) {
    const isImage = ALLOWED_IMAGE_TYPES.includes(file.contentType)
    const isVideo = ALLOWED_VIDEO_TYPES.includes(file.contentType)

    if (!isImage && !isVideo) {
      return NextResponse.json({ error: `Unsupported file type: ${file.contentType}` }, { status: 400 })
    }

    const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `${file.filename} exceeds the ${isImage ? '10 MB image' : '200 MB video'} limit` },
        { status: 413 },
      )
    }

    const safeFilename = file.filename.replace(/[^a-zA-Z0-9._-]/g, '_')
    const key = `lineup-media/${lineupId}/${Date.now()}-${safeFilename}`

    const presignedUrl = await getSignedUrl(
      r2,
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: key,
        ContentType: file.contentType,
      }),
      { expiresIn: 3600 },
    )

    uploads.push({ presignedUrl, key, publicUrl: getPublicUrl(key) })
  }

  return NextResponse.json({ uploads })
}
