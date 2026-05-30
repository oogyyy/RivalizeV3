---

## Architecture Notes

### Why demo files never touch Railway

`.dem` files are 50–500 MB. Streaming them through the Next.js server would
exhaust Railway's request timeout and memory.

Instead, Rivalize uses a **presigned upload** flow:

```
Browser → POST /api/demos/presign     (tiny JSON — Railway)
        ← { signedUrl, path }

Browser → PUT <signedUrl>  (raw file — goes DIRECTLY to R2, skips Railway)

Browser → POST /api/demos/register   (tiny JSON — Railway creates DB record with status='queued')
```

This means Railway only handles small JSON payloads; large files go directly
to R2 from the client browser.

### Background parsing (reliable worker model)

Rivalize uses a **dedicated worker service** (see `worker/`) that continuously
polls the `demos` table for jobs in `status = 'queued'` (or legacy `processing` during transition).

Key improvements (implemented in 2026):
- Strict enqueue-only API layer (web routes no longer perform parsing)
- Atomic claiming with Postgres `FOR UPDATE SKIP LOCKED`
- Dynamic, file-size-aware stale job reclaim (much faster than the old fixed 35 min)
- Structured logging with `[worker][demoId=...]` correlation
- Clean separation: `parseAndSaveDemo` now returns results; the worker owns all DB state transitions

The worker and the Go parser (`go-parser/`) run as separate Railway services.

For very high scale you can later add horizontal replicas to the worker or
move to a proper job queue (Inngest / BullMQ), but the current design handles
low-to-moderate volume very reliably.

---

## Scaling & Costs

| Resource | Recommendation |
|---|---|
| Railway plan | **Hobby ($5/mo)** for staging; **Pro** for production |
| Memory | 512 MB is enough for Next.js; the worker and Go parser may need more for large demos |
| Replicas | 1 replica per service is usually enough; scale the worker on Pro if you have high concurrent uploads |
| Supabase | Free tier works for dev; Pro ($25/mo) for production (removes pausing) |

### Estimated monthly cost (small team)

- Railway Hobby: **$5**
- Supabase Pro: **$25**
- OpenAI GPT-4o (AI Coach): **$5–20** depending on usage
- **Total: ~$35–50/month**

---

## Monitoring

- **Railway Logs**: Service → **Deployments → Logs** (live tail). Look for `[worker][demoId=...]` lines.
- **Railway Metrics**: Service → **Metrics** (CPU, memory, request count)
- **Health check**: `GET /api/health` — returns `{ status, timestamp, version }`
- **Supabase**: Dashboard → **Logs → API** for database query inspection
- **Queue visibility**: Call `GET /api/admin/queue-stats` (service role) for quick `queued` / `processing` / stuck counts

---

## Environment Variables Reference (Railway format)

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
OPENAI_API_KEY=sk-...
NEXT_PUBLIC_APP_URL=https://rivalize.up.railway.app
PARSER_URL=https://your-go-parser.up.railway.app   # Points to the separate go-parser service

# If you add a Railway Postgres service later:
# DATABASE_URL=${{Postgres.DATABASE_URL}}
```
