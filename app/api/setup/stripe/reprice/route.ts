import { type NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

// One-time endpoint to create new prices at $5/mo (Pro) and $20/mo (Team).
// Stripe prices are immutable — this creates new ones on the existing products.
// Protected by STRIPE_SETUP_SECRET. After running, update STRIPE_PRO_PRICE_ID
// and STRIPE_TEAM_PRICE_ID in Railway with the returned values.

export async function GET(req: NextRequest) {
  const secret = process.env.STRIPE_SETUP_SECRET
  if (!secret) return NextResponse.json({ error: 'STRIPE_SETUP_SECRET is not set' }, { status: 403 })
  if (req.nextUrl.searchParams.get('secret') !== secret) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 403 })
  }

  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return NextResponse.json({ error: 'STRIPE_SECRET_KEY is not set' }, { status: 500 })

  const stripe = new Stripe(key)

  // Find existing products by metadata
  const products = await stripe.products.list({ limit: 100, active: true })
  const proProd  = products.data.find(p => p.metadata?.plan === 'pro')
  const teamProd = products.data.find(p => p.metadata?.plan === 'team')

  if (!proProd || !teamProd) {
    return NextResponse.json({ error: 'Products not found — run /api/setup/stripe first' }, { status: 404 })
  }

  // Archive old prices
  const oldPrices = await stripe.prices.list({ limit: 100, active: true })
  for (const price of oldPrices.data) {
    if (price.product === proProd.id || price.product === teamProd.id) {
      await stripe.prices.update(price.id, { active: false })
    }
  }

  // Create new prices
  const proPrice = await stripe.prices.create({
    product: proProd.id,
    unit_amount: 500,
    currency: 'usd',
    recurring: { interval: 'month' },
    metadata: { plan: 'pro' },
  })

  const teamPrice = await stripe.prices.create({
    product: teamProd.id,
    unit_amount: 2000,
    currency: 'usd',
    recurring: { interval: 'month' },
    metadata: { plan: 'team' },
  })

  // Update billing portal to use new prices
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://rivalize.pro'
  const portals = await stripe.billingPortal.configurations.list({ limit: 1, active: true })
  if (portals.data[0]) {
    await stripe.billingPortal.configurations.update(portals.data[0].id, {
      features: {
        subscription_update: {
          enabled: true,
          default_allowed_updates: ['price'],
          proration_behavior: 'always_invoice',
          products: [
            { product: proProd.id, prices: [proPrice.id] },
            { product: teamProd.id, prices: [teamPrice.id] },
          ],
        },
      },
      default_return_url: `${appUrl}/settings?tab=billing`,
    })
  }

  return NextResponse.json({
    success: true,
    message: 'Update these in Railway, then remove STRIPE_SETUP_SECRET',
    env: {
      STRIPE_PRO_PRICE_ID: proPrice.id,
      STRIPE_TEAM_PRICE_ID: teamPrice.id,
    },
  })
}
