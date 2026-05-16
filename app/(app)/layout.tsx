export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import MobileMenu from '@/components/layout/MobileMenu'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div className="flex h-[100dvh] bg-background overflow-hidden">
      {/* Desktop sidebar — hidden on mobile */}
      <Sidebar profile={profile} />

      {/* Main content with top clearance for floating hamburger on mobile */}
      <main className="flex-1 overflow-auto min-w-0 pt-16 md:pt-0">
        {children}
      </main>

      {/* Mobile floating hamburger + drawer — all fixed, no layout impact */}
      <MobileMenu profile={profile} />
    </div>
  )
}
