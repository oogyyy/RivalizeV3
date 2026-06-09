import type { NextConfig } from 'next'

const securityHeaders = [
  { key: 'X-Frame-Options',           value: 'DENY' },
  { key: 'X-Content-Type-Options',    value: 'nosniff' },
  { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.supabase.co https://avatars.steamstatic.com https://cdn.discordapp.com https://raw.githubusercontent.com",
      "font-src 'self'",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      "frame-ancestors 'none'",
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }]
  },
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'avatars.steamstatic.com' },
      { protocol: 'https', hostname: 'cdn.discordapp.com' },
    ],
  },
  // Keep steam-user + globaloffensive as Node.js externals — they load native
  // files (system.pem, protobuf schemas) at runtime and cannot be bundled.
  serverExternalPackages: ['steam-user', 'globaloffensive', 'bytebuffer', 'protobufjs', 'steam-totp', '@xenova/transformers'],
  // Force-include steam packages in standalone output — Next.js file tracing
  // misses dynamic require() calls and non-JS assets (system.pem, .proto files).
  outputFileTracingIncludes: {
    '/api/cs2/sync': [
      './node_modules/steam-user/**/*',
      './node_modules/globaloffensive/**/*',
      './node_modules/@doctormckay/**/*',
      './node_modules/bytebuffer/**/*',
      './node_modules/protobufjs/**/*',
      './node_modules/adm-zip/**/*',
      './node_modules/binarykvparser/**/*',
      './node_modules/file-manager/**/*',
      './node_modules/kvparser/**/*',
      './node_modules/lzma/**/*',
      './node_modules/steam-appticket/**/*',
      './node_modules/steam-session/**/*',
      './node_modules/steam-totp/**/*',
      './node_modules/steamid/**/*',
      './node_modules/websocket13/**/*',
      './node_modules/zstddec/**/*',
      './node_modules/steam-totp/**/*',
    ],
  },
  // Optimizes lucide-react icon imports (heavily used across the app)
  // Reduces bundle size by only including used icons at build time.
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
}

export default nextConfig
