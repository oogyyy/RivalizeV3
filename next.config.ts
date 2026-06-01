import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
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
  serverExternalPackages: ['steam-user', 'globaloffensive', 'bytebuffer', 'protobufjs'],
  // Optimizes lucide-react icon imports (heavily used across the app)
  // Reduces bundle size by only including used icons at build time.
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
}

export default nextConfig
