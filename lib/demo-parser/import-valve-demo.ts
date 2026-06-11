import { spawnSync } from 'child_process'
import { writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomBytes } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { uploadObject, getPublicUrl } from '@/lib/r2'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = SupabaseClient<any>

export interface ValveMatch {
  id: string
  match_id: string
  demo_url: string | null
  map: string | null
  match_time: string | null
}

/**
 * Decompresses a bzip2 buffer using the system bzip2 binary (added to the
 * worker image). Mirrors the zstd approach in decompress.ts — capture stdout so
 * partial output survives a non-zero exit on a truncated trailer.
 */
function bunzip2(buf: Buffer): Buffer {
  const id = randomBytes(8).toString('hex')
  const inPath = join(tmpdir(), `${id}.dem.bz2`)
  try {
    writeFileSync(inPath, buf)
    const result = spawnSync('bzip2', ['-d', '-c', inPath], {
      stdio: 'pipe',
      maxBuffer: 2 * 1024 * 1024 * 1024, // 2 GB — large enough for any CS2 demo
    })
    const out = result.stdout
    if (!out || out.length === 0) {
      throw new Error(`bzip2 produced no output: ${result.stderr?.toString().slice(0, 200) || 'unknown'}`)
    }
    return out
  } finally {
    try { unlinkSync(inPath) } catch { /* ignore */ }
  }
}

/**
 * Imports a discovered Valve match's demo into the demos table as a self-demo.
 *
 * Downloads the .dem.bz2 from the Valve CDN, decompresses to a raw .dem, uploads
 * it to R2, inserts a queued demo row (which the normal worker pipeline then
 * parses), and links the match. Best-effort: returns an error string rather than
 * throwing so the caller can keep going.
 */
export async function importValveDemo(
  admin: AdminClient,
  match: ValveMatch,
  teamId: string,
  userId: string,
): Promise<{ demoId?: string; error?: string }> {
  if (!match.demo_url) return { error: 'no demo URL on match' }

  // Download the compressed demo
  let res: Response
  try {
    res = await fetch(match.demo_url, { redirect: 'follow', signal: AbortSignal.timeout(120_000) })
  } catch (err) {
    return { error: `download failed: ${(err as Error).message}` }
  }
  if (!res.ok) return { error: `download HTTP ${res.status}` }

  let raw: Buffer
  try {
    const bz2 = Buffer.from(await res.arrayBuffer())
    raw = bunzip2(bz2)
  } catch (err) {
    return { error: `decompress failed: ${(err as Error).message}` }
  }

  // Upload the raw .dem (the Go parser handles raw demos directly)
  const r2Key = `${teamId}/cs2-${match.match_id}-${Date.now()}.dem`
  try {
    await uploadObject(r2Key, raw, 'application/octet-stream')
  } catch (err) {
    return { error: `upload failed: ${(err as Error).message}` }
  }

  // Insert a queued self-demo; the worker's normal loop parses it.
  const { data: demo, error } = await admin
    .from('demos')
    .insert({
      team_id:       teamId,
      opponent_name: 'Matchmaking',
      opponent_slug: 'matchmaking',
      map:           match.map || 'unknown',
      match_date:    match.match_time ?? new Date().toISOString(),
      league:        'CS2 Matchmaking',
      raw_file_path: r2Key,
      file_url:      getPublicUrl(r2Key),
      status:        'queued',
      queued_at:     new Date().toISOString(),
      demo_type:     'self',
      created_by:    userId,
      parsed_data:   { opponentSide: 'team2' },
    })
    .select('id')
    .single()

  if (error || !demo) return { error: error?.message ?? 'failed to create demo row' }

  await admin.from('cs2_matches').update({ demo_id: demo.id }).eq('id', match.id)
  return { demoId: demo.id }
}
