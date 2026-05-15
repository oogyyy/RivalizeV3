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
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop sidebar — hidden on mobile */}
      <Sidebar profile={profile} />

      {/* Content column: mobile top bar + scrollable page */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <MobileMenu profile={profile} />
        <main className="flex-1 overflow-auto min-w-0">
          {children}
        </main>
      </div>
    </div>
  )
}
