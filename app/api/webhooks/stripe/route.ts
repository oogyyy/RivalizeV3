import { type NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import type Stripe from 'stripe'

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) return new NextResponse('Webhook secret not configured', { status: 503 })

  const sig = req.headers.get('stripe-signature') ?? ''
  const rawBody = await req.text()

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(rawBody, sig, secret)
  } catch {
    return new NextResponse('Invalid signature', { status: 400 })
  }

  const admin = createAdminClient()

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.mode !== 'subscription') break
      const teamId = session.metadata?.teamId
      const plan   = session.metadata?.plan
      if (!teamId || !plan) break

      const subId = session.subscription as string
      const stripeSub = await getStripe().subscriptions.retrieve(subId) as unknown as Stripe.Subscription

      await admin.from('subscriptions').upsert({
        team_id:                teamId,
        stripe_customer_id:     session.customer as string,
        stripe_subscription_id: subId,
        plan,
        status:                 stripeSub.status,
        cancel_at_period_end:   stripeSub.cancel_at_period_end,
        current_period_start:   new Date((stripeSub as any).billing_cycle_anchor * 1000).toISOString(),
        current_period_end:     stripeSub.cancel_at ? new Date(stripeSub.cancel_at * 1000).toISOString() : null,
        updated_at:             new Date().toISOString(),
      }, { onConflict: 'team_id' })
      break
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as unknown as Stripe.Subscription
      const teamId = sub.metadata?.teamId
      if (!teamId) break

      const plan = (sub.metadata?.plan ?? sub.items.data[0]?.price?.metadata?.plan ?? 'pro') as string

      await admin.from('subscriptions').upsert({
        team_id:                teamId,
        stripe_customer_id:     sub.customer as string,
        stripe_subscription_id: sub.id,
        plan,
        status:                 sub.status,
        cancel_at_period_end:   sub.cancel_at_period_end,
        current_period_start:   new Date((sub as any).billing_cycle_anchor * 1000).toISOString(),
        current_period_end:     sub.cancel_at ? new Date(sub.cancel_at * 1000).toISOString() : null,
        updated_at:             new Date().toISOString(),
      }, { onConflict: 'team_id' })
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as unknown as Stripe.Subscription
      const teamId = sub.metadata?.teamId
      if (!teamId) break

      await admin.from('subscriptions').upsert({
        team_id:                teamId,
        stripe_customer_id:     sub.customer as string,
        stripe_subscription_id: sub.id,
        plan:                   'free',
        status:                 'canceled',
        cancel_at_period_end:   false,
        current_period_end:     sub.cancel_at ? new Date(sub.cancel_at * 1000).toISOString() : null,
        updated_at:             new Date().toISOString(),
      }, { onConflict: 'team_id' })
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      // In API 2026 the subscription ref is under parent.subscription_details.subscription
      const subRef = (invoice.parent as any)?.subscription_details?.subscription as string | null
      if (!subRef) break

      await admin.from('subscriptions')
        .update({ status: 'past_due', updated_at: new Date().toISOString() })
        .eq('stripe_subscription_id', subRef)
      break
    }
  }

  return NextResponse.json({ received: true })
}
