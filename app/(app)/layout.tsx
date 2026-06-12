export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/get-user'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import MobileMenu from '@/components/layout/MobileMenu'
import MobileTopBar from '@/components/layout/MobileTopBar'
import BottomNav from '@/components/layout/BottomNav'
import TopBar from '@/components/layout/TopBar'
import SocialPanel from '@/components/layout/SocialPanel'
import { NavigationRefresh } from '@/components/layout/NavigationRefresh'
import ExtensionModal from '@/components/extension/ExtensionModal'
import OnboardingWizard, { type OnboardingState } from '@/components/onboarding/OnboardingWizard'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUserPlan } from '@/lib/billing'

async function getOnboardingState(userId: string): Promise<OnboardingState> {
  const admin = createAdminClient()
  const { data: memberships } = await admin
    .from('team_members')
    .select('team_id')
    .eq('user_id', userId)
  const teamIds = (memberships ?? []).map(m => m.team_id).filter(Boolean)

  const [demoCount, coachCount] = await Promise.all([
    teamIds.length
      ? admin.from('demos').select('id', { count: 'exact', head: true }).in('team_id', teamIds)
      : Promise.resolve({ count: 0 }),
    admin.from('coach_sessions').select('id', { count: 'exact', head: true }).eq('user_id', userId),
  ])

  return {
    teamCreated:  teamIds.length > 0,
    demoUploaded: (demoCount.count ?? 0) > 0,
    coachUsed:    (coachCount.count ?? 0) > 0,
  }
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const supabase = await createClient()

  const [{ data: profile }, onboarding, userPlan] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    getOnboardingState(user.id),
    getUserPlan(user.id),
  ])

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
        {/* Mobile sticky header — hidden on md+ */}
        <MobileTopBar />

        {/* Desktop top bar — hidden on mobile */}
        <TopBar profile={profile} plan={userPlan} />

        <main className="flex-1 overflow-auto rv-main-scroll md:pt-0">
          {children}
        </main>
      </div>

      {/* Right social panel */}
      <SocialPanel />

      {/* Mobile bottom navigation */}
      <BottomNav />

      {/* Mobile full-screen menu drawer */}
      <MobileMenu profile={profile} />

      {/* Extension install prompt (first-time only, auto-hides if installed) */}
      <ExtensionModal />

      {/* Onboarding checklist — auto-hides once all steps complete or dismissed */}
      <OnboardingWizard state={onboarding} />

      {/* Refresh server data on every navigation to prevent stale RSC cache */}
      <NavigationRefresh />
    </div>
  )
}
