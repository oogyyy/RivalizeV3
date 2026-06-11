FROM node:22-alpine

# zstd for .dem.zst demos; bzip2 for Valve CDN .dem.bz2 match demos
RUN apk add --no-cache zstd bzip2

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

ENV NODE_ENV=production

CMD ["node_modules/.bin/tsx", "worker/index.ts"]
