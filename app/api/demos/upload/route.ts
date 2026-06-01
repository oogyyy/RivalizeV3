export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3'
import { getPublicUrl } from '@/lib/r2'
import { slugify } from '@/lib/utils'

const MAX_FILE_SIZE  = 500 * 1024 * 1024
const MAX_CHUNK_SIZE =  10 * 1024 * 1024  // stay under Railway's 10 MB proxy limit

function getR2Client(): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId:     process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  })
}

/**
 * POST /api/demos/upload?action=init   — start a multipart upload
 * POST /api/demos/upload?action=part   — upload one chunk (≤ 9 MB)
 * POST /api/demos/upload?action=complete — assemble parts and register demo
 *
 * Railway's reverse proxy truncates request bodies at ~10 MB, so we never
 * send the full file in a single request. Each chunk is safely under the
 * limit; R2's multipart upload API assembles them into the final object.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q      = request.nextUrl.searchParams
  const action = q.get('action') ?? 'init'

  if (action === 'init')     return handleInit(request, user.id, q)
  if (action === 'part')     return handlePart(request, q)
  if (action === 'complete') return handleComplete(request, user.id, q)
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

// ── Step 1: create the multipart upload ───────────────────────────────────────

async function handleInit(
  _req: NextRequest,
  userId: string,
  q: URLSearchParams,
): Promise<NextResponse> {
  const teamId   = q.get('teamId')
  const filename = q.get('filename')
  if (!teamId || !filename) {
    return NextResponse.json({ error: 'Missing teamId or filename' }, { status: 400 })
  }

  const lower = filename.toLowerCase()
  if (!lower.endsWith('.dem') && !lower.endsWith('.zst')) {
    return NextResponse.json({ error: 'Only .dem and .zst files accepted' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: member } = await admin
    .from('team_members').select('role')
    .eq('team_id', teamId).eq('user_id', userId).single()
  if (!member) return NextResponse.json({ error: 'Not a member of this team' }, { status: 403 })

  const fileHash     = q.get('fileHash')
  const opponentName = q.get('opponentName') ?? 'Unknown'
  const demoType     = (q.get('demoType') ?? 'opponent') as 'opponent' | 'self'

  if (fileHash) {
    // ── Same-team duplicate: reject ───────────────────────────────────────────
    const { data: sameTeam } = await admin
      .from('demos')
      .select('id, created_at, map, opponent_name, status')
      .eq('team_id', teamId)
      .eq('file_hash', fileHash)
      .neq('status', 'failed') // allow re-upload if the previous parse failed
      .limit(1)
      .maybeSingle()

    if (sameTeam) {
      return NextResponse.json(
        { error: 'duplicate', existingDemo: sameTeam },
        { status: 409 },
      )
    }

    // ── Cross-team duplicate: adopt instantly without uploading ───────────────
    // Another team already uploaded and fully parsed this file.
    // Copy their parsed data into a new demo row for this team so the user
    // sees the result immediately — zero bytes uploaded to R2.
    const { data: source } = await admin
      .from('demos')
      .select('parsed_data, parsed_json_url, map, raw_file_path, parsed_at')
      .eq('file_hash', fileHash)
      .eq('status', 'completed')
      .limit(1)
      .maybeSingle()

    if (source) {
      const resolvedOpponent = demoType === 'self' ? 'My Team' : (opponentName.trim() || 'Unknown')
      const opponentSlug     = slugify(resolvedOpponent)

      const parsedData = {
        ...((source.parsed_data as Record<string, unknown>) ?? {}),
        opponentSide: demoType === 'self' ? 'team1' : 'team2',
      }

      const { data: newDemo, error: insertErr } = await admin
        .from('demos')
        .insert({
          team_id:         teamId,
          opponent_name:   resolvedOpponent,
          opponent_slug:   opponentSlug,
          map:             source.map ?? 'unknown',
          raw_file_path:   source.raw_file_path,
          status:          'completed',
          created_by:      userId,
          demo_type:       demoType,
          parsed_data:     parsedData,
          parsed_json_url: source.parsed_json_url ?? null,
          file_hash:       fileHash,
          parsed_at:       source.parsed_at ?? new Date().toISOString(),
        })
        .select()
        .single()

      if (!insertErr && newDemo) {
        if (demoType === 'opponent') {
          await admin.from('team_folders').upsert(
            { user_team_id: teamId, opponent_slug: opponentSlug, opponent_display_name: resolvedOpponent },
            { onConflict: 'user_team_id,opponent_slug' },
          )
        }
        return NextResponse.json({ adopted: true, demo: newDemo }, { status: 201 })
      }
    }
  }

  if (!process.env.CLOUDFLARE_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID) {
    return NextResponse.json({ error: 'R2 not configured' }, { status: 503 })
  }

  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  const key = `${teamId}/${Date.now()}-${safeFilename}`

  const { UploadId } = await getR2Client().send(new CreateMultipartUploadCommand({
    Bucket:      process.env.R2_BUCKET_NAME!,
    Key:         key,
    ContentType: 'application/octet-stream',
  }))

  return NextResponse.json({ uploadId: UploadId, key })
}

// ── Step 2: upload one chunk ──────────────────────────────────────────────────

async function handlePart(request: NextRequest, q: URLSearchParams): Promise<NextResponse> {
  const uploadId   = q.get('uploadId')
  const key        = q.get('key')
  const partNumber = parseInt(q.get('partNumber') ?? '1', 10)

  if (!uploadId || !key) {
    return NextResponse.json({ error: 'Missing uploadId or key' }, { status: 400 })
  }

  const buffer = await request.arrayBuffer()
  if (buffer.byteLength > MAX_CHUNK_SIZE) {
    return NextResponse.json({ error: 'Chunk exceeds 10 MB limit' }, { status: 413 })
  }

  const { ETag } = await getR2Client().send(new UploadPartCommand({
    Bucket:        process.env.R2_BUCKET_NAME!,
    Key:           key,
    UploadId:      uploadId,
    PartNumber:    partNumber,
    Body:          new Uint8Array(buffer),
    ContentLength: buffer.byteLength,
  }))

  return NextResponse.json({ etag: ETag })
}

// ── Step 3: complete upload and register demo ─────────────────────────────────

async function handleComplete(
  request: NextRequest,
  userId: string,
  q: URLSearchParams,
): Promise<NextResponse> {
  const uploadId   = q.get('uploadId')
  const key        = q.get('key')
  const teamId     = q.get('teamId')
  const filename   = q.get('filename') ?? ''
  const opponentName = q.get('opponentName') ?? 'Unknown'
  const demoType   = (q.get('demoType') ?? 'opponent') as 'opponent' | 'self'
  const fileSize   = parseInt(q.get('fileSize') ?? '0', 10)
  const fileHash   = q.get('fileHash') || null

  if (!uploadId || !key || !teamId) {
    return NextResponse.json({ error: 'Missing uploadId, key, or teamId' }, { status: 400 })
  }

  if (fileSize > MAX_FILE_SIZE) {
    await getR2Client().send(new AbortMultipartUploadCommand({
      Bucket: process.env.R2_BUCKET_NAME!, Key: key, UploadId: uploadId,
    })).catch(() => {})
    return NextResponse.json({ error: 'File exceeds 500 MB limit' }, { status: 413 })
  }

  const { parts } = await request.json() as {
    parts: Array<{ partNumber: number; etag: string }>
  }

  try {
    await getR2Client().send(new CompleteMultipartUploadCommand({
      Bucket:   process.env.R2_BUCKET_NAME!,
      Key:      key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts.map(p => ({ PartNumber: p.partNumber, ETag: p.etag })),
      },
    }))
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown R2 error'
    console.error('[upload] CompleteMultipart error:', msg)
    return NextResponse.json({ error: `Storage upload failed: ${msg}` }, { status: 500 })
  }

  const admin = createAdminClient()
  const resolvedOpponent = demoType === 'self' ? 'My Team' : opponentName.trim() || 'Unknown'
  const opponentSlug     = slugify(resolvedOpponent)
  const fileUrl          = getPublicUrl(key)

  const { data: demo, error: demoError } = await admin
    .from('demos')
    .insert({
      team_id:        teamId,
      opponent_name:  resolvedOpponent,
      opponent_slug:  opponentSlug,
      map:            'unknown',
      raw_file_path:  key,
      file_url:       fileUrl,
      status:         'processing',
      file_size_bytes: fileSize || null,
      created_by:     userId,
      demo_type:      demoType,
      parsed_data:    { opponentSide: demoType === 'self' ? 'team1' : 'team2' },
      file_hash:      fileHash,
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
