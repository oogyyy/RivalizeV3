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
    <div style={{ display: 'flex', height: '100dvh', overflow: 'hidden', position: 'relative', background: 'var(--bg)' }}>
      {/* Root background — violet accent radial + signal soft radial */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        background: [
          'radial-gradient(1300px 720px at 84% -16%, color-mix(in srgb, var(--accent) 12%, transparent), transparent 58%)',
          'radial-gradient(1000px 600px at 2% 6%, color-mix(in srgb, var(--signal) 5%, transparent), transparent 56%)',
          'var(--bg)',
        ].join(', '),
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
