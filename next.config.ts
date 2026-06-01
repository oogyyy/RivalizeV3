import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  // Disable client-side router cache for dynamic pages.
  // Without this, back-navigation serves a stale RSC payload from the browser
  // cache before the server re-renders, causing pages to appear blank/empty
  // until a manual refresh. Setting dynamic: 0 forces a server round-trip on
  // every navigation for pages marked `force-dynamic`.
  staleTimes: {
    dynamic: 0,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'avatars.steamstatic.com' },
      { protocol: 'https', hostname: 'cdn.discordapp.com' },
    ],
  },
  // Optimizes lucide-react icon imports (heavily used across the app)
  // Reduces bundle size by only including used icons at build time.
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
}

export default nextConfig
