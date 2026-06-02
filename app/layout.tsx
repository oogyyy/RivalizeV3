import type { Metadata, Viewport } from 'next'
import { Inter, Sora, Space_Grotesk, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
})

const sora = Sora({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-sora',
})

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-space',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono-var',
})

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
    title: 'Rivalize — Know Your Enemy',
    description: 'Professional-grade CS2 demo analysis and AI coaching for every team.',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${sora.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} min-h-screen bg-background text-foreground antialiased font-sans`}
      >
        {children}
      </body>
    </html>
  )
}
