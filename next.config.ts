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
  // Demo files upload directly to Supabase Storage via presigned URLs,
  // so Next.js server actions only handle small JSON payloads.
  experimental: {
    serverActions: { bodySizeLimit: '4mb' },
  },
}

export default nextConfig
