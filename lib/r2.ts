import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

function getR2Client() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY

  if (!accountId || !accessKeyId || !secretAccessKey) {
    const missing = ['CLOUDFLARE_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY']
      .filter(k => !process.env[k])
      .join(', ')
    throw new Error(`R2 not configured — missing env vars: ${missing}`)
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  })
}

/** Generate a presigned PUT URL for a single object upload (up to 5 GB). */
export async function createPresignedPutUrl(key: string, expiresIn = 3600): Promise<string> {
  const client = getR2Client()
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: key,
    ContentType: 'application/octet-stream',
  })
  return getSignedUrl(client, command, { expiresIn })
}

/** Build the public download URL for an R2 object key. */
export function getPublicUrl(key: string): string {
  const base = process.env.R2_PUBLIC_URL!.replace(/\/$/, '')
  return `${base}/${key}`
}
