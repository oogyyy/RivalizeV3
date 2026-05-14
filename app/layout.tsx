import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: { default: 'Rivalize', template: '%s | Rivalize' },
  description: 'AI-powered CS2 demo analysis and coaching platform for competitive teams.',
  keywords: ['CS2', 'Counter-Strike', 'demo analysis', 'AI coach', 'esports'],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://rivalize.gg',
    siteName: 'Rivalize',
    title: 'Rivalize — AI-Powered CS2 Analysis',
    description: 'Professional-grade CS2 demo analysis and AI coaching for every team.',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} min-h-screen bg-background text-foreground antialiased`}>
        {children}
      </body>
    </html>
  )
}
