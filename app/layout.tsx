import type { Metadata, Viewport } from 'next'
import { Inter, Barlow, Barlow_Condensed, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })
const barlow = Barlow({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-barlow' })
const barlowCondensed = Barlow_Condensed({ subsets: ['latin'], weight: ['700', '800', '900'], variable: '--font-barlow-condensed' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-mono' })

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export const metadata: Metadata = {
  title: { default: 'Rivalize', template: '%s | Rivalize' },
  description: 'AI-powered CS2 demo analysis and coaching platform for competitive teams.',
  keywords: ['CS2', 'Counter-Strike', 'demo analysis', 'AI coach', 'esports'],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://rivalize.pro',
    siteName: 'Rivalize',
    title: 'Rivalize — AI-Powered CS2 Analysis',
    description: 'Professional-grade CS2 demo analysis and AI coaching for every team.',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} ${barlow.variable} ${barlowCondensed.variable} ${jetbrainsMono.variable} min-h-screen bg-background text-foreground antialiased`}>
        {children}
      </body>
    </html>
  )
}
