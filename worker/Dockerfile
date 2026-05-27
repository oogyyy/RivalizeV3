FROM node:22-alpine

# zstd for decompressing .dem.zst CS2 demos
RUN apk add --no-cache zstd

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

ENV NODE_ENV=production

CMD ["node_modules/.bin/tsx", "worker/index.ts"]
