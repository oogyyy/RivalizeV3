/**
 * Run once to create Stripe products, prices, and webhook for Rivalize.
 * Usage: node scripts/stripe-setup.mjs
 * Requires: STRIPE_SECRET_KEY set in your environment, or hardcode it below.
 */

import Stripe from 'stripe'

const KEY = process.env.STRIPE_SECRET_KEY
if (!KEY) {
  console.error('Set STRIPE_SECRET_KEY in your environment before running this script.')
  console.error('Example: STRIPE_SECRET_KEY=sk_live_... node scripts/stripe-setup.mjs')
  process.exit(1)
}
const APP_URL = 'https://rivalize.pro'

const stripe = new Stripe(KEY)

async function main() {
  console.log('Setting up Stripe for Rivalize...\n')

  // ── 1. Products ──────────────────────────────────────────────────────────
  console.log('Creating products...')

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

  console.log(`  ✓ Pro product:  ${pro.id}`)
  console.log(`  ✓ Team product: ${team.id}`)

  // ── 2. Prices ─────────────────────────────────────────────────────────────
  console.log('\nCreating prices...')

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

  console.log(`  ✓ Pro price:  ${proPrice.id}  ($19/mo)`)
  console.log(`  ✓ Team price: ${teamPrice.id}  ($49/mo)`)

  // ── 3. Webhook endpoint ───────────────────────────────────────────────────
  console.log('\nCreating webhook endpoint...')

  const webhook = await stripe.webhookEndpoints.create({
    url: `${APP_URL}/api/webhooks/stripe`,
    enabled_events: [
      'checkout.session.completed',
      'customer.subscription.updated',
      'customer.subscription.deleted',
      'invoice.payment_failed',
    ],
    description: 'Rivalize billing webhook',
  })

  console.log(`  ✓ Webhook: ${webhook.url}`)
  console.log(`  ✓ Webhook ID: ${webhook.id}`)

  // ── 4. Billing portal config ──────────────────────────────────────────────
  console.log('\nConfiguring billing portal...')

  await stripe.billingPortal.configurations.create({
    business_profile: {
      headline: 'Manage your Rivalize subscription',
      privacy_policy_url: `${APP_URL}/privacy`,
      terms_of_service_url: `${APP_URL}/terms`,
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
    default_return_url: `${APP_URL}/settings?tab=billing`,
  })

  console.log('  ✓ Billing portal configured')

  // ── 5. Summary ────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(60))
  console.log('Add these to your Railway / production environment:\n')
  console.log(`STRIPE_SECRET_KEY=${KEY}`)
  console.log(`STRIPE_PRO_PRICE_ID=${proPrice.id}`)
  console.log(`STRIPE_TEAM_PRICE_ID=${teamPrice.id}`)
  console.log(`STRIPE_WEBHOOK_SECRET=${webhook.secret}`)
  console.log('\n' + '─'.repeat(60))
  console.log('\n✅ Stripe setup complete!')
  console.log('\n⚠️  The secret key is printed above — rotate it in the Stripe')
  console.log('    dashboard after copying these values to your env.')
}

main().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
