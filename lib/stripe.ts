import Stripe from 'stripe'

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) throw new Error('STRIPE_SECRET_KEY is not configured')
    _stripe = new Stripe(key, { apiVersion: '2026-05-27.dahlia' })
  }
  return _stripe
}

export const PLANS = {
  free: {
    name: 'Free',
    price: 0,
    priceId: null,
    demosPerMonth: 2,
    maxTeams: 1,
    aiCoaching: false,
    discordBot: false,
    pdfExports: false,
    features: [
      '2 demos per month',
      '1 team',
      'Basic stats & timelines',
    ],
  },
  pro: {
    name: 'Pro',
    price: 5,
    priceId: process.env.STRIPE_PRO_PRICE_ID ?? null,
    demosPerMonth: -1, // unlimited
    maxTeams: 3,
    aiCoaching: true,
    discordBot: false,
    pdfExports: false,
    features: [
      'Unlimited demos',
      'Up to 3 teams',
      'AI coaching & scouting briefs',
      'Economy & heatmap analysis',
      'Playbook & strategy board',
    ],
  },
  team: {
    name: 'Team',
    price: 20,
    priceId: process.env.STRIPE_TEAM_PRICE_ID ?? null,
    demosPerMonth: -1,
    maxTeams: -1,
    aiCoaching: true,
    discordBot: true,
    pdfExports: true,
    features: [
      'Unlimited demos & teams',
      'Everything in Pro',
      'Discord bot integration',
      'PDF scouting report exports',
      'Multi-coach access',
      'Priority support',
    ],
  },
} as const

export type PlanId = keyof typeof PLANS

export function getPlanLimits(plan: PlanId) {
  return PLANS[plan]
}
