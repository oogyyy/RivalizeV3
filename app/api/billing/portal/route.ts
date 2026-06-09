import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { stripe } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { teamId } = await req.json() as { teamId: string }
  if (!teamId) return NextResponse.json({ error: 'Missing teamId' }, { status: 400 })

  const admin = createAdminClient()

  const { data: member } = await admin
    .from('team_members').select('role')
    .eq('team_id', teamId).eq('user_id', user.id).single()
  if (!member || !['owner', 'admin'].includes(member.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: sub } = await admin
    .from('subscriptions').select('stripe_customer_id').eq('team_id', teamId).maybeSingle()
  if (!sub?.stripe_customer_id) {
    return NextResponse.json({ error: 'No billing account found' }, { status: 404 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${appUrl}/settings?tab=billing`,
  })

  return NextResponse.json({ url: session.url })
}
