import { createAdminClient } from '@/lib/supabase/admin'
import type { PlanId } from '@/lib/stripe'
import { PLANS } from '@/lib/stripe'

export interface TeamSubscription {
  plan: PlanId
  status: string
  cancelAtPeriodEnd: boolean
  currentPeriodEnd: string | null
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  demosUsedThisMonth: number
  quotaResetAt: string
}

export async function getTeamSubscription(teamId: string): Promise<TeamSubscription> {
  const admin = createAdminClient()

  const [{ data: sub }, { data: team }] = await Promise.all([
    admin.from('subscriptions').select('*').eq('team_id', teamId).maybeSingle(),
    admin.from('teams').select('demos_used_this_month, quota_reset_at').eq('id', teamId).single(),
  ])

  return {
    plan: (sub?.plan ?? 'free') as PlanId,
    status: sub?.status ?? 'active',
    cancelAtPeriodEnd: sub?.cancel_at_period_end ?? false,
    currentPeriodEnd: sub?.current_period_end ?? null,
    stripeCustomerId: sub?.stripe_customer_id ?? null,
    stripeSubscriptionId: sub?.stripe_subscription_id ?? null,
    demosUsedThisMonth: team?.demos_used_this_month ?? 0,
    quotaResetAt: team?.quota_reset_at ?? new Date().toISOString(),
  }
}

export async function checkDemoQuota(teamId: string): Promise<{ allowed: boolean; reason?: string }> {
  const sub = await getTeamSubscription(teamId)
  const limits = PLANS[sub.plan]

  // Inactive subscriptions fall back to free limits
  const effectivePlan = (sub.status === 'active' || sub.status === 'trialing') ? sub.plan : 'free'
  const effectiveLimits = PLANS[effectivePlan]

  if (effectiveLimits.demosPerMonth === -1) return { allowed: true }

  // Reset quota if period has passed
  const resetAt = new Date(sub.quotaResetAt)
  const used = resetAt <= new Date() ? 0 : sub.demosUsedThisMonth

  if (used >= effectiveLimits.demosPerMonth) {
    return {
      allowed: false,
      reason: `You've used all ${effectiveLimits.demosPerMonth} demos for this month. Upgrade to Pro for unlimited demos.`,
    }
  }

  return { allowed: true }
}

export async function incrementDemoCount(teamId: string): Promise<void> {
  const admin = createAdminClient()
  await admin.rpc('increment_team_demo_count', { p_team_id: teamId })
}

// Returns the best active plan for a user across all their teams (team > pro > null).
export async function getUserPlan(userId: string): Promise<'pro' | 'team' | null> {
  const admin = createAdminClient()
  const { data: memberships } = await admin
    .from('team_members').select('team_id').eq('user_id', userId)
  if (!memberships?.length) return null

  const teamIds = memberships.map(m => m.team_id)
  const { data: subs } = await admin
    .from('subscriptions').select('plan, status')
    .in('team_id', teamIds)
    .in('status', ['active', 'trialing'])
  if (!subs?.length) return null

  if (subs.some(s => s.plan === 'team')) return 'team'
  if (subs.some(s => s.plan === 'pro')) return 'pro'
  return null
}
