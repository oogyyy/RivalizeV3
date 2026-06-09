export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth/get-user'
import { redirect } from 'next/navigation'
import { AlertCircle, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import MyTeamDemoPageClient from '@/components/demos/MyTeamDemoPageClient'
import type { Demo } from '@/types/database'

interface Props {
  params: Promise<{ demoId: string }>
}

export default async function MyTeamDemoPage({ params }: Props) {
  const { demoId } = await params

  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: demo } = await admin
    .from('demos')
    .select('*')
    .eq('id', demoId)
    .eq('demo_type', 'self')
    .single()

  if (!demo) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4">
        <AlertCircle size={40} className="text-red-400" />
        <p className="text-foreground font-medium">Demo not found</p>
        <Link href="/my-team">
          <Button variant="outline" size="sm" className="gap-2">
            <ArrowLeft size={14} />
            Back to My Team
          </Button>
        </Link>
      </div>
    )
  }

  if (!demo.team_id) redirect('/my-team')
  const { data: member } = await admin
    .from('team_members')
    .select('role')
    .eq('team_id', demo.team_id)
    .eq('user_id', user.id)
    .single()

  if (!member) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4">
        <AlertCircle size={40} className="text-red-400" />
        <p className="text-foreground font-medium">Access denied</p>
        <Link href="/my-team">
          <Button variant="outline" size="sm" className="gap-2">
            <ArrowLeft size={14} />
            Back to My Team
          </Button>
        </Link>
      </div>
    )
  }

  return <MyTeamDemoPageClient demo={demo as Demo} />
}
