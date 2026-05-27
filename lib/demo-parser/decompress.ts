import { spawnSync } from 'child_process'
import { writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomBytes } from 'crypto'

/**
 * If the buffer is a Zstandard-compressed demo (.dem.zst), decompress it
 * using the system zstd binary (installed via apk/apt).
 *
 * Uses stdout output (-c) rather than a named output file so that partial
 * decompression output is captured even when zstd exits non-zero. zstd
 * deletes named output files on any error as a safety measure, which would
 * make the file-based approach always return nothing on failure — stdout
 * avoids this.  This handles CS2 demos that are missing the final frame
 * endmark: zstd decompresses all data successfully, then complains about
 * the missing trailer, but the stdout buffer already contains everything.
 */
export function maybeDecompress(buf: Buffer, filename: string): Buffer {
  if (!filename.toLowerCase().endsWith('.zst')) return buf

  const id = randomBytes(8).toString('hex')
  const inPath = join(tmpdir(), `${id}.dem.zst`)

  try {
    writeFileSync(inPath, buf)

    const result = spawnSync('zstd', ['-d', '-c', inPath], {
      stdio: 'pipe',
      maxBuffer: 2 * 1024 * 1024 * 1024, // 2 GB — large enough for any CS2 demo
    })
    if (result.error) throw result.error

    if (result.stdout && result.stdout.byteLength > 0) {
      return result.stdout
    }

    const raw = result.stderr?.toString().trim() ?? ''
    throw new Error(`zstd decompression produced no output: ${raw || 'unknown error'}`)
  } finally {
    try { unlinkSync(inPath) } catch { /* ignore */ }
  }
}

