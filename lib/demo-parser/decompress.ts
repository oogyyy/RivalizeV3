import { spawnSync } from 'child_process'
import { writeFileSync, readFileSync, unlinkSync, existsSync, statSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomBytes } from 'crypto'

/**
 * If the buffer is a Zstandard-compressed demo (.dem.zst), decompress it
 * using the system zstd binary (installed via apk/apt).
 *
 * CS2 demos can have a missing or truncated final zstd frame endmark — the
 * game data is complete but the stream trailer is absent. Skipping the
 * --test pre-check and accepting partial decompression output handles this
 * transparently.
 */
export function maybeDecompress(buf: Buffer, filename: string): Buffer {
  if (!filename.toLowerCase().endsWith('.zst')) return buf

  const id = randomBytes(8).toString('hex')
  const inPath  = join(tmpdir(), `${id}.dem.zst`)
  const outPath = join(tmpdir(), `${id}.dem`)

  try {
    writeFileSync(inPath, buf)

    const result = spawnSync('zstd', ['-d', inPath, '-o', outPath, '--force'], {
      stdio: 'pipe',
    })
    if (result.error) throw result.error

    // Accept output even on non-zero exit: CS2 demos sometimes omit the final
    // frame endmark, causing zstd to complain but still write complete data.
    if (existsSync(outPath) && statSync(outPath).size > 0) {
      return readFileSync(outPath)
    }

    const raw = result.stderr?.toString().trim() ?? ''
    throw new Error(`zstd decompression produced no output: ${raw || 'unknown error'}`)
  } finally {
    for (const p of [inPath, outPath]) {
      try { unlinkSync(p) } catch { /* ignore */ }
    }
  }
}
