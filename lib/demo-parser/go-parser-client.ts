// Per-request timeout for the parse job (download + parse + upload can take up to 25 min)
const PARSER_TIMEOUT_MS = 28 * 60 * 1000

// How long to wait for the parser to become healthy after a cold start
const WARMUP_MAX_MS      = 90_000
const WARMUP_INTERVAL_MS = 4_000

export interface ParseJobResult {
  parsedJsonUrl: string
  warnings: string[]
}

/**
 * Pings /health until the parser responds OK or the deadline is reached.
 * Handles Railway cold starts where the service needs up to ~60s to wake.
 */
export async function waitForParser(baseUrl: string): Promise<void> {
  const deadline = Date.now() + WARMUP_MAX_MS
  let attempt = 0
  while (Date.now() < deadline) {
    attempt++
    try {
      const ctrl = new AbortController()
      const tid  = setTimeout(() => ctrl.abort(), 5_000)
      const res  = await fetch(`${baseUrl}/health`, { signal: ctrl.signal })
      clearTimeout(tid)
      if (res.ok) {
        if (attempt > 1) console.log(`[go-parser] healthy after ${attempt} warmup attempts`)
        return
      }
    } catch {
      // not yet up — keep polling
    }
    await new Promise(r => setTimeout(r, WARMUP_INTERVAL_MS))
  }
  throw new Error(`Go parser unreachable (${baseUrl}): did not become healthy within ${WARMUP_MAX_MS / 1000}s`)
}

/**
 * Sends a parse job request to the Go parser service.
 *
 * Instead of uploading the demo bytes, the worker passes presigned R2 URLs:
 *   - demo_download_url     — presigned GET for the raw demo (already decompressed)
 *   - parsed_json_upload_url — presigned PUT for the output JSON
 *   - parsed_json_public_url — permanent public URL for the output JSON
 *
 * The Go parser streams the demo, parses it, uploads the result to R2,
 * and updates demos.status = 'parsed' in Supabase. No large payload
 * crosses the worker ↔ parser boundary.
 */
export async function triggerParseJob(
  demoId: string,
  r2Key: string,
  demoDownloadUrl: string,
  parsedJsonUploadUrl: string,
  parsedJsonPublicUrl: string,
): Promise<ParseJobResult> {
  const parserUrl = process.env.PARSER_URL
  if (!parserUrl) {
    throw new Error('PARSER_URL environment variable is not set.')
  }

  const base = parserUrl.replace(/\/$/, '')
  await waitForParser(base)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), PARSER_TIMEOUT_MS)

  let res: Response
  try {
    res = await fetch(`${base}/parse`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        demo_id:               demoId,
        r2_key:                r2Key,
        demo_download_url:     demoDownloadUrl,
        parsed_json_upload_url: parsedJsonUploadUrl,
        parsed_json_public_url: parsedJsonPublicUrl,
      }),
      signal: controller.signal,
    })
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      throw new Error(`Go parser timed out after ${PARSER_TIMEOUT_MS / 1000}s`)
    }
    throw new Error(`Go parser unreachable (${parserUrl}): ${(e as Error).message}`)
  } finally {
    clearTimeout(timeoutId)
  }

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    const prefix = res.status === 422 ? 'Go parser demo error' : 'Go parser returned HTTP'
    throw new Error(`${prefix} ${res.status}: ${text}`)
  }

  const raw = await res.json() as { ok: boolean; demo_id: string; parsed_json_url: string }

  if (!raw.ok || !raw.parsed_json_url) {
    throw new Error(`Go parser returned invalid response (missing parsed_json_url)`)
  }

  return {
    parsedJsonUrl: raw.parsed_json_url,
    warnings: [],
  }
}
