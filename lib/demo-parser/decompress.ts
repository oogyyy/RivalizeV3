import { decompress } from 'fzstd'

/**
 * If the buffer is a Zstandard-compressed demo (.dem.zst), decompress it.
 * Otherwise return the buffer unchanged.
 */
export function maybeDecompress(buf: Buffer, filename: string): Buffer {
  if (!filename.toLowerCase().endsWith('.zst')) return buf
  const decompressed = decompress(new Uint8Array(buf))
  return Buffer.from(decompressed)
}
