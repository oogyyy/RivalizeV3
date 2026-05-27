export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth/get-user'
import { notFound, redirect } from 'next/navigation'
import { AlertCircle, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import DemoPageClient from '@/components/demos/DemoPageClient'
import type { Demo } from '@/types/database'

interface Props {
  params: Promise<{ demoId: string }>
  searchParams: Promise<{ folder?: string }>
}

export default async function DemoPage({ params, searchParams }: Props) {
  const { demoId } = await params
  const { folder: folderId = null } = await searchParams

  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: demo } = await admin
    .from('demos')
    .select('*')
    .eq('id', demoId)
    .single()

  if (!demo) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4">
        <AlertCircle size={40} className="text-red-400" />
        <p className="text-foreground font-medium">Demo not found</p>
        <Link href={folderId ? `/opponents/${folderId}` : '/opponents'}>
          <Button variant="outline" size="sm" className="gap-2">
            <ArrowLeft size={14} />
            Back to Opponents
          </Button>
        </Link>
      </div>
    )
  }

  // Verify the caller is a member of the demo's team
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
        <Link href="/opponents">
          <Button variant="outline" size="sm" className="gap-2">
            <ArrowLeft size={14} />
            Back to Opponents
          </Button>
        </Link>
      </div>
    )
  }

  return <DemoPageClient demo={demo as Demo} folderId={folderId} />
}
