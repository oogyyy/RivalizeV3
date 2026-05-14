# Deploying Rivalize on Railway

## Prerequisites

- [Railway account](https://railway.app)
- GitHub repository with this code pushed
- [Supabase project](https://supabase.com) with schema applied (`supabase/schema.sql`)
- OpenAI (or xAI/Anthropic) API key

---

## Step 1 — Apply the Database Schema

In your Supabase dashboard → **SQL Editor**, paste and run the contents of
`supabase/schema.sql`. This creates all tables, RLS policies, triggers, and
storage buckets.

---

## Step 2 — Create a Railway Project

1. Go to [railway.app](https://railway.app) → **New Project**
2. Choose **Deploy from GitHub repo**
3. Authorise Railway and select your Rivalize repository
4. Railway auto-detects the `Dockerfile` — no extra config needed

---

## Step 3 — Set Environment Variables

In your Railway service → **Variables**, add every variable from `.env.example`:

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API |
| `OPENAI_API_KEY` | platform.openai.com/api-keys |
| `NEXT_PUBLIC_APP_URL` | Your Railway domain (set after first deploy) |

> **Important:** `NEXT_PUBLIC_*` variables are baked into the client bundle
> at build time. Set them **before** triggering a deploy, then redeploy if
> you change them later.

---

## Step 4 — Configure the Service

In your Railway service → **Settings**:

| Setting | Value |
|---|---|
| Build command | *(auto — uses Dockerfile)* |
| Start command | `node server.js` |
| Health check path | `/api/health` |
| Health check timeout | `30` seconds |
| Restart policy | On failure (max 3 retries) |

---

## Step 5 — Add a Custom Domain (optional)

1. Railway service → **Settings → Domains → Generate Domain**
   (gives you a `*.up.railway.app` URL)
2. Or add a custom domain and point your DNS CNAME to Railway
3. Update `NEXT_PUBLIC_APP_URL` to the final domain and redeploy

---

## Step 6 — First Deploy

Push a commit (or click **Deploy** in the Railway dashboard).
Railway will:
1. Pull your repo
2. Run the multi-stage Docker build (deps → builder → runner)
3. Start the standalone Next.js server on port 3000
4. Verify `/api/health` returns `200 OK`

Typical cold build: **3–5 minutes**.

---

## Architecture Notes

### Why demo files never touch Railway

`.dem` files are 50–500 MB. Streaming them through the Next.js server would
exhaust Railway's request timeout and memory.

Instead, Rivalize uses a **presigned upload** flow:

```
Browser → POST /api/demos/presign     (tiny JSON — Railway)
        ← { signedUrl, path }

Browser → PUT <signedUrl>  (raw file — goes DIRECTLY to Supabase Storage, skips Railway)

Browser → POST /api/demos/register   (tiny JSON — Railway creates DB record)
```

This means Railway only handles small JSON payloads; large files go directly
to Supabase Storage from the client browser.

### Background parsing

After registration, the server fires a non-blocking async function to parse
the demo and update the `demos` table. For production scale, replace this
with a proper job queue (e.g. Railway's built-in cron, BullMQ backed by
Railway Redis, or Inngest).

---

## Scaling & Costs

| Resource | Recommendation |
|---|---|
| Railway plan | **Hobby ($5/mo)** for staging; **Pro** for production |
| Memory | 512 MB is enough for Next.js; increase if you add in-process parsing |
| Replicas | 1 replica is fine; enable horizontal scaling on Pro if needed |
| Supabase | Free tier works for dev; Pro ($25/mo) for production (removes pausing) |

### Estimated monthly cost (small team)

- Railway Hobby: **$5**
- Supabase Pro: **$25**
- OpenAI GPT-4o (AI Coach): **$5–20** depending on usage
- **Total: ~$35–50/month**

---

## Monitoring

- **Railway Logs**: Service → **Deployments → Logs** (live tail)
- **Railway Metrics**: Service → **Metrics** (CPU, memory, request count)
- **Health check**: `GET /api/health` — returns `{ status, timestamp, version }`
- **Supabase**: Dashboard → **Logs → API** for database query inspection

---

## Environment Variables Reference (Railway format)

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
OPENAI_API_KEY=sk-...
NEXT_PUBLIC_APP_URL=https://rivalize.up.railway.app

# If you add a Railway Postgres service later:
# DATABASE_URL=${{Postgres.DATABASE_URL}}
```
