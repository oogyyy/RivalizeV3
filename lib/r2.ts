import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

let _client: S3Client | null = null

function getR2Client(): S3Client {
  if (_client) return _client

  const missing = ['CLOUDFLARE_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY']
    .filter(k => !process.env[k])
  if (missing.length) {
    throw new Error(`R2 not configured — missing env vars: ${missing.join(', ')}`)
  }

  _client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  })
  return _client
}

/** Generate a presigned PUT URL for a single object upload (up to 5 GB). */
export async function createPresignedPutUrl(key: string, expiresIn = 3600): Promise<string> {
  return getSignedUrl(getR2Client(), new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: key,
    ContentType: 'application/octet-stream',
  }), { expiresIn })
}

/** Build the public download URL for an R2 object key. */
export function getPublicUrl(key: string): string {
  return `${process.env.R2_PUBLIC_URL!.replace(/\/$/, '')}/${key}`
}

/** Delete an object from R2 storage. No-ops if the key doesn't exist. */
export async function deleteObject(key: string): Promise<void> {
  await getR2Client().send(new DeleteObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: key,
  }))
}

async function streamToBuffer(body: AsyncIterable<Uint8Array>): Promise<Buffer> {
  const chunks: Uint8Array[] = []
  for await (const chunk of body) chunks.push(chunk)
  return Buffer.concat(chunks)
}

/**
 * Download the complete content of an R2 object as a Buffer.
 * Use for demo parsing — may be hundreds of MB, so only call from background tasks.
 * Validates the downloaded byte count against ContentLength so a silently-truncated
 * stream throws rather than returning a partial buffer that fails later in the pipeline.
 */
export async function downloadObject(key: string): Promise<Buffer> {
  const response = await getR2Client().send(new GetObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: key,
  }))
  if (!response.Body) throw new Error('Empty response body from R2')
  const buf = await streamToBuffer(response.Body as AsyncIterable<Uint8Array>)
  if (response.ContentLength !== undefined && buf.byteLength !== response.ContentLength) {
    throw new Error(
      `R2 download truncated: expected ${response.ContentLength} bytes, got ${buf.byteLength}`
    )
  }
  return buf
}

/**
 * Upload a ReadableStream directly to R2 (used for FaceIt demo streaming).
 * Buffers the stream in memory — suitable for demos up to a few hundred MB.
 */
export async function uploadStream(key: string, stream: ReadableStream): Promise<void> {
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) chunks.push(value)
  }
  const body = Buffer.concat(chunks)
  await getR2Client().send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: key,
    Body: body,
    ContentType: 'application/octet-stream',
  }))
}

/**
 * Download the first `bytes` bytes of an R2 object.
 * Uses a range request so we never download the full demo file.
 */
export async function getFirstBytes(key: string, bytes = 8192): Promise<Buffer> {
  const response = await getR2Client().send(new GetObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: key,
    Range: `bytes=0-${bytes - 1}`,
  }))
  if (!response.Body) throw new Error('Empty response body from R2')
  return streamToBuffer(response.Body as AsyncIterable<Uint8Array>)
}
