export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/get-user'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import MobileMenu from '@/components/layout/MobileMenu'
import TopBar from '@/components/layout/TopBar'
import SocialPanel from '@/components/layout/SocialPanel'
import FeedbackBubble from '@/components/feedback/FeedbackBubble'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div style={{ display: 'flex', height: '100dvh', overflow: 'hidden', position: 'relative', background: '#09091a' }}>
      {/* Base gradient */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        background: 'linear-gradient(160deg, #0e0b2a 0%, #09091a 50%, #0a0815 100%)',
      }}/>

      {/* Dot grid */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.055) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
        maskImage: 'radial-gradient(ellipse 100% 100% at 50% 50%, black 30%, transparent 100%)',
        WebkitMaskImage: 'radial-gradient(ellipse 100% 100% at 50% 50%, black 30%, transparent 100%)',
      }}/>

      {/* Purple orb — top right */}
      <div style={{
        position: 'fixed', top: '-10%', right: '-5%', width: 600, height: 600, zIndex: 0, pointerEvents: 'none',
        background: 'radial-gradient(circle, rgba(139,62,255,0.18) 0%, rgba(100,30,200,0.08) 45%, transparent 70%)',
        filter: 'blur(48px)',
      }}/>

      {/* Pink orb — bottom left */}
      <div style={{
        position: 'fixed', bottom: '-15%', left: '5%', width: 700, height: 500, zIndex: 0, pointerEvents: 'none',
        background: 'radial-gradient(circle, rgba(255,45,120,0.12) 0%, rgba(200,20,80,0.05) 50%, transparent 70%)',
        filter: 'blur(56px)',
      }}/>

      {/* Teal orb — mid left (near content area) */}
      <div style={{
        position: 'fixed', top: '40%', left: '20%', width: 500, height: 400, zIndex: 0, pointerEvents: 'none',
        background: 'radial-gradient(circle, rgba(0,255,200,0.05) 0%, transparent 65%)',
        filter: 'blur(40px)',
      }}/>

      {/* Desktop sidebar */}
      <Sidebar profile={profile} />

      {/* Content column */}
      <div className="flex-1 min-w-0 flex flex-col" style={{ position: 'relative', zIndex: 1 }}>
        <TopBar profile={profile} />
        <main className="flex-1 overflow-auto pt-16 md:pt-0">
          {children}
        </main>
      </div>

      {/* Right social panel */}
      <SocialPanel />

      {/* Mobile menu */}
      <MobileMenu profile={profile} />

      {/* Global Feedback Bubble */}
      <FeedbackBubble />
    </div>
  )
}
