import { spawnSync } from 'child_process'
import { writeFileSync, readFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomBytes } from 'crypto'

/**
 * If the buffer is a Zstandard-compressed demo (.dem.zst), decompress it
 * using the system zstd binary (installed via apk/apt) which supports all
 * valid zstd files including those produced by CS2.
 *
 * Falls back to writing a temp file so large decompressed outputs (800 MB+)
 * go through the filesystem rather than a pipe buffer.
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
    if (result.status !== 0) {
      const msg = result.stderr?.toString().trim() || 'decompression failed'
      throw new Error(`zstd: ${msg}`)
    }
    return readFileSync(outPath)
  } finally {
    for (const p of [inPath, outPath]) {
      try { unlinkSync(p) } catch { /* ignore */ }
    }
  }
}
