# Rivalize

**CS2 team analytics and match-prep platform for competitive players.**

Upload your demo files, get automatic opponent scouting reports, run map veto simulations, and query an AI coach that knows your team's actual tendencies — all in one dashboard.

---

## Features

| Feature | Description |
|---|---|
| **Demo Analysis** | Upload `.dem` files; the Go parser extracts kills, rounds, utility, economy |
| **Opponent Scouting** | Per-opponent stat folders — win rate, map tendencies, best maps |
| **Map Veto Helper** | Side-by-side map stats for you vs. opponent; AI veto recommendation |
| **AI Coach** | LLM chat (Groq Llama 3.3 70B by default, provider-configurable) grounded in your real match data and CS2 knowledge base |
| **Playbook** | Save and tag tactical setups per map with lineup images |
| **Profile** | Link Steam + FACEIT accounts; track personal stats across teams |

---

## Tech Stack

```
Frontend         Next.js 15 (App Router) · React 19 · TypeScript 5 · Tailwind CSS 4
Database/Auth    Supabase (Postgres + Row Level Security + Auth)
File Storage     Cloudflare R2 (demo uploads, lineup images)
Demo Parser      Go 1.24 microservice (github.com/markus-wa/demoinfocs-golang)
AI              Vercel AI SDK · Groq Llama 3.3 70B (swap any OpenAI-compatible provider via AI_API_KEY / AI_BASE_URL / AI_MODEL)
Deployment       Railway (Next.js + Go parser as separate services)
```

---

## Repository Layout

```
rivalizev3/
├── app/                    # Next.js App Router
│   ├── (app)/              # Authenticated dashboard pages
│   │   ├── my-team/        # Team stats and map breakdown
│   │   ├── opponents/      # Opponent scouting library
│   │   ├── veto/           # Map veto helper
│   │   ├── ai-coach/       # AI coaching chat
│   │   ├── playbook/       # Tactical lineup library
│   │   └── profile/        # User profile & account linking
│   ├── (auth)/             # Sign-in / sign-up pages
│   └── api/                # API routes (uploads, parsing, Steam, FaceIT)
├── components/             # Shared React components
│   ├── teams/              # Team/demo UI (DemoListMultiSelect, etc.)
│   ├── opponents/          # Opponent card views
│   ├── ui/                 # Design system primitives (rv-panel, etc.)
│   └── ...
├── lib/                    # Utilities (Supabase client, map config, auth helpers)
├── types/                  # TypeScript type definitions
├── hooks/                  # Custom React hooks
├── supabase/               # Database migrations and config
│   └── migrations/
├── go-parser/              # Go microservice — CS2 demo parsing
│   ├── main.go
│   ├── parser.go
│   ├── Dockerfile
│   └── railway.json
├── worker/                 # Background job worker (separate Railway service)
├── public/                 # Static assets
├── scripts/                # One-off data ingestion scripts
├── .env.example            # Required environment variables (template)
├── Dockerfile              # Next.js production image
└── railway.json            # Railway deployment config
```

---

## Local Development

### Prerequisites

- **Node.js 22+** (`node --version`)
- **Go 1.24+** (`go version`) — only needed if modifying the parser
- **Supabase CLI** — `npm install -g supabase`
- A [Supabase](https://supabase.com) project
- A [Cloudflare R2](https://developers.cloudflare.com/r2/) bucket

### 1. Clone and install

```bash
git clone https://github.com/oogyyy/RivalizeV3.git
cd RivalizeV3
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
# Edit .env.local and fill in every value — see comments in the file
```

Required variables:

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Dashboard → R2 |
| `R2_BUCKET_NAME` | R2 bucket name you created |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | R2 → Manage API Tokens |
| `R2_PUBLIC_URL` | R2 bucket public URL |
| `OPENAI_API_KEY` | [platform.openai.com](https://platform.openai.com/api-keys) |
| `PARSER_URL` | URL of the Go parser service (see below) |

### 3. Run database migrations

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

### 4. Start the dev server

```bash
npm run dev
# → http://localhost:3000
```

### 5. Run the Go parser locally (optional)

```bash
cd go-parser
go run .
# Listens on :8080 by default
# Set PARSER_URL=http://localhost:8080 in .env.local
```

---

## Deployment (Railway)

The app ships as two Railway services from the same repo.

### Next.js service

1. Create a new Railway project → **"Deploy from GitHub repo"**
2. Select `oogyyy/RivalizeV3`
3. Railway auto-detects the root `Dockerfile`
4. Add all variables from `.env.example` in Railway's **Variables** tab
5. Set the following **build-time** variables too (Railway forwards them to Docker ARG):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_APP_URL`

### Go parser service

1. Inside the same Railway project → **"Add Service" → "GitHub Repo"**
2. Set **Root Directory** to `go-parser`
3. Railway will use `go-parser/Dockerfile`
4. Set environment variables:
   - `SUPABASE_URL` — same as `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
5. Copy the generated internal Railway URL → set as `PARSER_URL` in the Next.js service

Full deployment notes: [`RAILWAY.md`](./RAILWAY.md)

---

## Code Quality

```bash
npm run lint          # ESLint
npm run lint:fix      # ESLint (auto-fix)
npm run format        # Prettier (write)
npm run format:check  # Prettier (check only)
npm run typecheck     # TypeScript (no emit)
```

Go:

```bash
cd go-parser
go vet ./...
gofmt -w .
```

---

## Contributing

1. Fork the repo and create a branch: `git checkout -b feat/my-feature`
2. Make your changes, run `npm run lint` and `npm run typecheck`
3. Commit with a descriptive message: `git commit -m "feat: add round timeline chart"`
4. Open a pull request against `main`

Please keep PRs focused — one feature or fix per PR. For large changes, open an issue first to discuss the approach.

---

## Environment Variables Reference

See [`.env.example`](./.env.example) for the full annotated list with setup instructions for each service.

---

## License

Private — all rights reserved.
