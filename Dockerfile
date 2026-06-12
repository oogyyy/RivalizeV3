# ---- Stage 1: Install dependencies ----
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# ---- Stage 2: Build ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

# NEXT_PUBLIC_* vars must be available at build time so Next.js can
# inline them into client bundles. Pass them from Railway's env dashboard
# as build-time variables (Railway forwards all env vars to Docker builds).
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

# Increase Node heap so TypeScript compilation doesn't OOM on larger codebases
ENV NODE_OPTIONS="--max-old-space-size=4096"

RUN npm run build

# ---- Stage 3: Production runner ----
FROM node:22-alpine AS runner
WORKDIR /app

# zstd for decompressing .dem.zst demos
RUN apk add --no-cache zstd

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Knowledge base markdown is read from disk at runtime (AI prompt grounding +
# boot-time embedding sync) — Next file tracing can't see the dynamic fs
# reads, so it must be copied explicitly.
COPY --from=builder --chown=nextjs:nodejs /app/knowledge_base ./knowledge_base

# Embedding model cache must live somewhere the nextjs user can write
ENV TRANSFORMERS_CACHE=/tmp/transformers

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
