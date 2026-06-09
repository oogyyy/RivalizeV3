import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe, PLANS, type PlanId } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { teamId, plan } = await req.json() as { teamId: string; plan: PlanId }
  if (!teamId || !plan || plan === 'free') {
    return NextResponse.json({ error: 'Invalid plan or missing teamId' }, { status: 400 })
  }

  const priceId = PLANS[plan].priceId
  if (!priceId) {
    return NextResponse.json({ error: 'Stripe price not configured' }, { status: 503 })
  }

  const admin = createAdminClient()

  // Verify user is owner/admin of this team
  const { data: member } = await admin
    .from('team_members').select('role')
    .eq('team_id', teamId).eq('user_id', user.id).single()
  if (!member || !['owner', 'admin'].includes(member.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Get or create Stripe customer
  const { data: existing } = await admin
    .from('subscriptions').select('stripe_customer_id').eq('team_id', teamId).maybeSingle()

  let customerId = existing?.stripe_customer_id

  if (!customerId) {
    const { data: team } = await admin.from('teams').select('name').eq('id', teamId).single()
    const { data: profile } = await admin.from('profiles').select('email').eq('id', user.id).single()

    const customer = await getStripe().customers.create({
      email: profile?.email ?? user.email,
      name: team?.name,
      metadata: { teamId, userId: user.id },
    })
    customerId = customer.id

    // Upsert the subscription row so we have the customer ID stored
    await admin.from('subscriptions').upsert(
      { team_id: teamId, stripe_customer_id: customerId, plan: 'free', status: 'active' },
      { onConflict: 'team_id' },
    )
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const session = await getStripe().checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/settings?tab=billing&upgraded=1`,
    cancel_url:  `${appUrl}/settings?tab=billing`,
    metadata: { teamId, plan },
    subscription_data: { metadata: { teamId, plan } },
    allow_promotion_codes: true,
  })

  return NextResponse.json({ url: session.url })
}
