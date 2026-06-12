import { type NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

// One-time setup endpoint — creates Stripe products, prices, webhook, and billing portal.
// Protected by STRIPE_SETUP_SECRET env var.
// After running: copy the returned env vars into Railway, then remove STRIPE_SETUP_SECRET.

export async function GET(req: NextRequest) {
  const secret = process.env.STRIPE_SETUP_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'STRIPE_SETUP_SECRET is not set' }, { status: 403 })
  }
  if (req.nextUrl.searchParams.get('secret') !== secret) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 403 })
  }

  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    return NextResponse.json({ error: 'STRIPE_SECRET_KEY is not set' }, { status: 500 })
  }

  const stripe = new Stripe(key)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://rivalize.pro'

  // ── Products ──────────────────────────────────────────────────────────────
  const pro = await stripe.products.create({
    name: 'Rivalize Pro',
    description: 'Unlimited demos, AI coaching, up to 3 teams',
    metadata: { plan: 'pro' },
  })

  const team = await stripe.products.create({
    name: 'Rivalize Team',
    description: 'Unlimited demos & teams, Discord bot, PDF exports, multi-coach access',
    metadata: { plan: 'team' },
  })

  // ── Prices ────────────────────────────────────────────────────────────────
  const proPrice = await stripe.prices.create({
    product: pro.id,
    unit_amount: 1900,
    currency: 'usd',
    recurring: { interval: 'month' },
    metadata: { plan: 'pro' },
  })

  const teamPrice = await stripe.prices.create({
    product: team.id,
    unit_amount: 4900,
    currency: 'usd',
    recurring: { interval: 'month' },
    metadata: { plan: 'team' },
  })

  // ── Webhook endpoint ──────────────────────────────────────────────────────
  const webhook = await stripe.webhookEndpoints.create({
    url: `${appUrl}/api/webhooks/stripe`,
    enabled_events: [
      'checkout.session.completed',
      'customer.subscription.updated',
      'customer.subscription.deleted',
      'invoice.payment_failed',
    ],
    description: 'Rivalize billing webhook',
  })

  // ── Billing portal ────────────────────────────────────────────────────────
  await stripe.billingPortal.configurations.create({
    business_profile: {
      headline: 'Manage your Rivalize subscription',
    },
    features: {
      subscription_cancel: { enabled: true, mode: 'at_period_end', proration_behavior: 'none' },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ['price'],
        proration_behavior: 'always_invoice',
        products: [
          { product: pro.id, prices: [proPrice.id] },
          { product: team.id, prices: [teamPrice.id] },
        ],
      },
      payment_method_update: { enabled: true },
      invoice_history: { enabled: true },
    },
    default_return_url: `${appUrl}/settings?tab=billing`,
  })

  return NextResponse.json({
    success: true,
    message: 'Add these to Railway env vars, then remove STRIPE_SETUP_SECRET',
    env: {
      STRIPE_PRO_PRICE_ID: proPrice.id,
      STRIPE_TEAM_PRICE_ID: teamPrice.id,
      STRIPE_WEBHOOK_SECRET: webhook.secret,
    },
  })
}
