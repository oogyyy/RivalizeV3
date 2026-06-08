# go-parser

Go microservice that parses CS2 demo files (`.dem` / `.dem.zst`) and writes structured stats to Supabase.

## How it works

1. Receives a POST request from the Next.js worker with a presigned R2 URL for a demo file
2. Downloads and optionally decompresses the demo (`.dem.zst` → `zstd`)
3. Parses it with [demoinfocs-golang](https://github.com/markus-wa/demoinfocs-golang) — extracts kills, rounds, utility, economy, player positions
4. Writes aggregated stats to Supabase and marks the demo as `status = 'parsed'`

## Local development

```bash
# Install Go 1.24+
go mod download
go run .
# Listens on :8080
```

Required environment variables (copy from root `.env.example`):

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (bypasses RLS) |

## Deployment

Deployed as a separate Railway service. See root [`RAILWAY.md`](../RAILWAY.md).

Docker image: built from `go-parser/Dockerfile` with Railway's root directory set to `go-parser/`.
