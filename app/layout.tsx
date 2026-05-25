import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans, Press_Start_2P, VT323 } from 'next/font/google'
import './globals.css'

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans',
})

const pressStart2P = Press_Start_2P({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-pixel',
})

const vt323 = VT323({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-display',
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
    title: 'Rivalize — AI-Powered CS2 Analysis',
    description: 'Professional-grade CS2 demo analysis and AI coaching for every team.',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${plusJakartaSans.variable} ${pressStart2P.variable} ${vt323.variable} ${plusJakartaSans.className} min-h-screen bg-background text-foreground antialiased`}
      >
        {children}
      </body>
    </html>
  )
}
