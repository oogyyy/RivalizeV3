export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/get-user'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import MobileMenu from '@/components/layout/MobileMenu'

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
      {/* Ambient background gradient */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        background: 'linear-gradient(175deg, #09091a 0%, #0d0b24 45%, #090915 100%)',
      }}/>
      <div style={{
        position: 'fixed', top: '20%', left: 0, right: 0, height: 200, zIndex: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 60% 80% at 50% 50%, rgba(130,20,255,0.08) 0%, rgba(255,45,120,0.04) 60%, transparent 100%)',
        filter: 'blur(32px)',
      }}/>

      {/* Desktop sidebar */}
      <Sidebar profile={profile} />

      {/* Main content */}
      <main className="flex-1 overflow-auto min-w-0 pt-16 md:pt-0" style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </main>

      {/* Mobile menu */}
      <MobileMenu profile={profile} />
    </div>
  )
}
