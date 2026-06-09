export const maxDuration = 60

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { uploadObject, getPublicUrl } from '@/lib/r2'
import { slugify } from '@/lib/utils'

const MAX_BYTES = 500 * 1024 * 1024 // matches the direct-upload limit

const bodySchema = z.object({
  teamId: z.string().uuid(),
  url: z.string().url().max(2048),
  opponentName: z.string().min(1).max(100),
  map: z.string().max(64).optional(),
  matchDate: z.string().optional(),
  event: z.string().max(200).optional(),
})

/** Reject URLs pointing at localhost / private networks (basic SSRF guard). */
function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return true
  if (host === '::1' || host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd')) return true
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (m) {
    const [a, b] = [parseInt(m[1], 10), parseInt(m[2], 10)]
    if (a === 0 || a === 10 || a === 127 || a === 169 && b === 254) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
  }
  return false
}

/** Extract a filename from Content-Disposition or the URL path. */
function resolveFilename(res: Response, url: URL): string {
  const cd = res.headers.get('content-disposition') ?? ''
  const cdMatch = cd.match(/filename\*?=(?:UTF-8''|")?([^";]+)"?/i)
  if (cdMatch?.[1]) return decodeURIComponent(cdMatch[1]).trim()
  const base = url.pathname.split('/').filter(Boolean).pop()
  return base ? decodeURIComponent(base) : `demo-${Date.now()}.dem`
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const { teamId, url: rawUrl, opponentName, map, matchDate, event } = parsed.data

  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return NextResponse.json({ error: 'URL must use http(s)' }, { status: 400 })
  }
  if (isBlockedHost(url.hostname)) {
    return NextResponse.json({ error: 'URL host not allowed' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: member } = await admin
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .single()
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    let res: Response
    try {
      res = await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(55000),
        headers: { 'User-Agent': 'Rivalize-Demo-Import/1.0' },
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return NextResponse.json({ error: `Could not download from URL: ${msg}` }, { status: 502 })
    }
    if (!res.ok || !res.body) {
      return NextResponse.json({ error: `Download failed (HTTP ${res.status})` }, { status: 502 })
    }

    const contentLength = parseInt(res.headers.get('content-length') ?? '', 10)
    if (Number.isFinite(contentLength) && contentLength > MAX_BYTES) {
      return NextResponse.json({ error: 'File exceeds the 500 MB limit' }, { status: 413 })
    }

    const filename = resolveFilename(res, url)
    const lower = filename.toLowerCase()
    if (lower.endsWith('.rar') || lower.endsWith('.zip') || lower.endsWith('.7z')) {
      return NextResponse.json(
        { error: 'Archives aren’t supported — extract the .dem file and upload it from the Opponents page instead.' },
        { status: 415 }
      )
    }
    const contentType = (res.headers.get('content-type') ?? '').toLowerCase()
    if (contentType.includes('text/html')) {
      return NextResponse.json(
        { error: 'That URL returned a web page, not a demo file. Use a direct download link to the .dem file.' },
        { status: 415 }
      )
    }

    // Stream into memory with a hard size cap, then upload to R2.
    const reader = res.body.getReader()
    const chunks: Uint8Array[] = []
    let received = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) {
        received += value.byteLength
        if (received > MAX_BYTES) {
          await reader.cancel()
          return NextResponse.json({ error: 'File exceeds the 500 MB limit' }, { status: 413 })
        }
        chunks.push(value)
      }
    }
    const buf = Buffer.concat(chunks)
    if (buf.byteLength < 1024) {
      return NextResponse.json({ error: 'Downloaded file is too small to be a demo' }, { status: 415 })
    }
    // Demos are binary — an HTML/JSON payload means the link wasn't a direct download.
    const head = buf.subarray(0, 64).toString('utf8').trimStart().toLowerCase()
    if (head.startsWith('<!doctype') || head.startsWith('<html') || head.startsWith('{')) {
      return NextResponse.json(
        { error: 'That URL returned a web page, not a demo file. Use a direct download link to the .dem file.' },
        { status: 415 }
      )
    }

    const hasDemoExt = ['.dem', '.gz', '.zst', '.bz2'].some(ext => lower.endsWith(ext))
    const safeName = slugify(filename.replace(/\.[^.]+(\.[^.]+)?$/, '')) || 'demo'
    const extension = hasDemoExt ? filename.slice(filename.indexOf('.', 1)) : '.dem'
    const r2Key = `${teamId}/url-${Date.now()}-${safeName}${extension}`

    await uploadObject(r2Key, buf)
    const fileUrl = getPublicUrl(r2Key)

    const opponentSlug = slugify(opponentName)
    const parsedDate = matchDate ? new Date(matchDate) : null
    const isoDate = parsedDate && !Number.isNaN(parsedDate.getTime())
      ? parsedDate.toISOString()
      : new Date().toISOString()

    // Register as 'queued' so the worker picks it up
    const { data: demo, error: demoError } = await admin
      .from('demos')
      .insert({
        team_id: teamId,
        opponent_name: opponentName,
        opponent_slug: opponentSlug,
        map: map || 'unknown',
        match_date: isoDate,
        league: event || 'Pro Match',
        raw_file_path: fileUrl,
        status: 'queued',
        queued_at: new Date().toISOString(),
        demo_type: 'opponent',
        created_by: user.id,
      })
      .select('id')
      .single()

    if (demoError || !demo) {
      return NextResponse.json({ error: demoError?.message ?? 'Failed to register demo' }, { status: 500 })
    }

    await admin.from('team_folders').upsert(
      { user_team_id: teamId, opponent_slug: opponentSlug, opponent_display_name: opponentName },
      { onConflict: 'user_team_id,opponent_slug' }
    )

    return NextResponse.json({ demoId: demo.id }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Import failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
