'use client'

import Link from 'next/link'
import { useState } from 'react'
import { PLANS } from '@/lib/stripe'

/* ── Shared layout atoms ─────────────────────────────────────── */
function Bolt({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M4 3h8L9 9h7L7 18l2-6H5L4 3z" fill="currentColor" />
    </svg>
  )
}

function Logo() {
  return (
    <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
      <span className="lp-logo-tile" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-deep) 100%)', color: '#fff', flexShrink: 0 }}>
        <Bolt size={16} />
      </span>
      <span>
        <span style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 800, letterSpacing: '0.06em', color: 'var(--text)' }}>RIVALIZE</span>
        <span style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.14em', color: 'var(--faint)', marginTop: -2 }}>PRO · SCOUT</span>
      </span>
    </Link>
  )
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
      <circle cx="7" cy="7" r="7" fill="color-mix(in srgb, var(--win) 18%, transparent)" />
      <path d="M4.5 7l2 2 3-3" stroke="var(--win)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CrossIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
      <circle cx="7" cy="7" r="7" fill="rgba(255,255,255,0.05)" />
      <path d="M5 5l4 4M9 5l-4 4" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

const FAQS = [
  {
    q: 'Can I use Rivalize for free?',
    a: 'Yes — the Free plan is unlimited in time and needs no credit card. You get 2 demo uploads per month, full stats & timelines, and 1 team.',
  },
  {
    q: 'What counts as a demo upload?',
    a: 'Each .dem file you upload counts as one demo. Demo slots reset on the 1st of every month. Pro and Team plans have no limit.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Absolutely. Cancel from Settings → Billing at any time and your plan stays active until the end of the billing period — no questions asked.',
  },
  {
    q: 'What is the Discord bot?',
    a: 'The Team plan includes a Discord bot you can invite to your server. It delivers scouting briefs, match reminders, and demo-ready alerts directly in your channels.',
  },
  {
    q: 'Do you offer refunds?',
    a: "If you're not satisfied within the first 7 days of a new subscription, contact us and we'll refund you in full.",
  },
  {
    q: 'Can I upgrade or downgrade later?',
    a: 'Yes. Upgrades take effect immediately (prorated). Downgrades apply at the end of your current billing period.',
  },
]

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div
      style={{
        borderBottom: '1px solid var(--border)',
        padding: '0',
      }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 16, padding: '18px 0', background: 'none', border: 'none', cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', lineHeight: 1.4 }}>{q}</span>
        <span style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 24, height: 24, borderRadius: 6, background: 'var(--track)',
          color: 'var(--muted)', flexShrink: 0, transition: 'transform .18s ease',
          transform: open ? 'rotate(45deg)' : 'rotate(0deg)',
          fontSize: 18, fontWeight: 300,
        }}>+</span>
      </button>
      {open && (
        <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.7, margin: '0 0 18px', paddingRight: 40 }}>
          {a}
        </p>
      )}
    </div>
  )
}

/* ── Pricing card ────────────────────────────────────────────── */
interface PlanCardProps {
  id: 'free' | 'pro' | 'team'
  recommended?: boolean
}

const PLAN_DETAILS = {
  free: {
    tagline: 'Get started, no card needed.',
    color: 'var(--muted)',
    rows: [
      { text: '2 demo uploads per month', included: true },
      { text: '1 team', included: true },
      { text: 'Basic stats & round timelines', included: true },
      { text: 'AI coaching & scouting briefs', included: false },
      { text: 'Economy & heatmap analysis', included: false },
      { text: 'Playbook & strategy board', included: false },
      { text: 'Discord bot integration', included: false },
      { text: 'PDF scouting report exports', included: false },
    ],
  },
  pro: {
    tagline: 'The full toolkit for serious teams.',
    color: 'var(--accent)',
    rows: [
      { text: 'Unlimited demo uploads', included: true },
      { text: 'Up to 3 teams', included: true },
      { text: 'Full stats & round timelines', included: true },
      { text: 'AI coaching & scouting briefs', included: true },
      { text: 'Economy & heatmap analysis', included: true },
      { text: 'Playbook & strategy board', included: true },
      { text: 'Discord bot integration', included: false },
      { text: 'PDF scouting report exports', included: false },
    ],
  },
  team: {
    tagline: 'For orgs and multi-team setups.',
    color: 'var(--signal)',
    rows: [
      { text: 'Unlimited demo uploads', included: true },
      { text: 'Unlimited teams', included: true },
      { text: 'Full stats & round timelines', included: true },
      { text: 'AI coaching & scouting briefs', included: true },
      { text: 'Economy & heatmap analysis', included: true },
      { text: 'Playbook & strategy board', included: true },
      { text: 'Discord bot integration', included: true },
      { text: 'PDF scouting report exports', included: true },
    ],
  },
}

function PlanCard({ id, recommended }: PlanCardProps) {
  const plan = PLANS[id]
  const detail = PLAN_DETAILS[id]

  return (
    <div style={{
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      borderRadius: 16,
      border: recommended
        ? '1px solid color-mix(in srgb, var(--accent) 50%, transparent)'
        : '1px solid var(--border)',
      background: recommended
        ? 'linear-gradient(180deg, color-mix(in srgb, var(--accent) 6%, var(--card)) 0%, var(--card) 100%)'
        : 'var(--card)',
      padding: '28px 28px 32px',
      boxShadow: recommended
        ? '0 0 0 1px color-mix(in srgb, var(--accent) 20%, transparent), 0 20px 60px -20px rgba(139,124,255,0.25)'
        : '0 4px 20px -8px rgba(0,0,0,0.4)',
      flex: 1,
    }}>
      {/* Top accent bar */}
      <div style={{
        position: 'absolute', top: 0, left: 20, right: 20, height: 1,
        background: `linear-gradient(90deg, transparent, ${detail.color} 40%, ${detail.color} 60%, transparent)`,
        opacity: recommended ? 0.7 : 0.3,
        borderRadius: '0 0 2px 2px',
      }} />

      {recommended && (
        <div style={{
          position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
          background: 'linear-gradient(135deg, var(--accent), var(--accent-deep))',
          color: '#fff', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
          padding: '3px 12px', borderRadius: 999,
          fontFamily: 'var(--font-mono)', textTransform: 'uppercase',
          boxShadow: '0 4px 14px -4px rgba(139,124,255,0.6)',
        }}>
          Most Popular
        </div>
      )}

      {/* Plan name + price */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{
            fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700,
            color: 'var(--text)',
          }}>{plan.name}</span>
          {id !== 'free' && (
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
              letterSpacing: '0.08em', color: detail.color,
              background: `color-mix(in srgb, ${detail.color} 14%, transparent)`,
              border: `1px solid color-mix(in srgb, ${detail.color} 30%, transparent)`,
              padding: '2px 8px', borderRadius: 5, textTransform: 'uppercase',
            }}>
              {id === 'pro' ? 'POPULAR' : 'FULL'}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6 }}>
          {plan.price === 0 ? (
            <span style={{ fontSize: 36, fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--text)' }}>
              Free
            </span>
          ) : (
            <>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>$</span>
              <span style={{ fontSize: 42, fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--text)', lineHeight: 1 }}>
                {plan.price}
              </span>
              <span style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>/mo</span>
            </>
          )}
        </div>

        <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>
          {detail.tagline}
        </p>
      </div>

      {/* CTA */}
      {id === 'free' ? (
        <Link href="/signup" className="lp-btn lp-btn-ghost" style={{ width: '100%', marginBottom: 24, justifyContent: 'center' }}>
          Start for free
        </Link>
      ) : (
        <Link
          href="/signup"
          className="lp-btn lp-btn-accent"
          style={{
            width: '100%', marginBottom: 24, justifyContent: 'center',
            background: recommended
              ? 'linear-gradient(160deg, var(--accent), var(--accent-deep))'
              : `linear-gradient(160deg, ${detail.color}, color-mix(in srgb, ${detail.color} 60%, #0a0a12))`,
          }}
        >
          Get {plan.name}
        </Link>
      )}

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--border)', marginBottom: 20 }} />

      {/* Feature rows */}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 11 }}>
        {detail.rows.map(row => (
          <li key={row.text} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: row.included ? 'var(--text)' : 'var(--faint)', lineHeight: 1.45 }}>
            {row.included ? <CheckIcon /> : <CrossIcon />}
            {row.text}
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ── Page ──────────────────────────────────────────────────────── */
export default function PricingPage() {
  return (
    <>
      <div className="lp-bg" />

      {/* Nav */}
      <nav className="lp-nav">
        <div className="lp-nav-in">
          <Logo />
          <div className="lp-navlinks">
            <Link className="lp-navlink" href="/#how">How it works</Link>
            <Link className="lp-navlink" href="/#features">Features</Link>
            <Link className="lp-navlink" href="/pricing" style={{ color: 'var(--text)' }}>Pricing</Link>
            <Link className="lp-navlink" href="/login">Sign in</Link>
          </div>
          <Link className="lp-btn lp-btn-accent lp-btn-sm" href="/signup">Get started</Link>
        </div>
      </nav>

      {/* Hero */}
      <div className="lp-wrap">
        <section style={{ paddingTop: 72, paddingBottom: 64, textAlign: 'center' }}>
          <span className="lp-eyebrow" style={{ justifyContent: 'center', marginBottom: 20 }}>
            <span className="ln" />
            <b>Pricing</b> · Honest & simple
          </span>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: 'clamp(36px, 5vw, 58px)',
            fontWeight: 800, color: 'var(--text)', margin: '0 0 16px',
            letterSpacing: '-0.02em', lineHeight: 1.12,
          }}>
            Pick your plan.<br />
            <span style={{ background: 'linear-gradient(135deg, var(--accent) 0%, var(--signal) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Upgrade when ready.
            </span>
          </h1>
          <p style={{
            fontSize: 16, color: 'var(--muted)', maxWidth: 480,
            margin: '0 auto', lineHeight: 1.65,
          }}>
            Start free with no card required. Every plan includes full demo analysis and round timelines.
          </p>
        </section>
      </div>

      {/* Plan cards */}
      <div className="lp-wrap" style={{ paddingBottom: 80 }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 20,
          alignItems: 'start',
        }}>
          <PlanCard id="free" />
          <PlanCard id="pro" recommended />
          <PlanCard id="team" />
        </div>

        <p style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--faint)', marginTop: 28 }}>
          All prices in USD. Billed monthly. Cancel anytime — no lock-in.
        </p>
      </div>

      {/* Comparison callout */}
      <div className="lp-wrap" style={{ paddingBottom: 80 }}>
        <div className="lp-panel" style={{ padding: '36px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 32, flexWrap: 'wrap' }}>
          <span className="lp-tick lp-tick-tl" />
          <span className="lp-tick lp-tick-br" />
          <div>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: '0 0 6px' }}>
              Not sure which plan is right?
            </p>
            <p style={{ fontSize: 13.5, color: 'var(--muted)', margin: 0, maxWidth: 460, lineHeight: 1.6 }}>
              Start on Free — no card needed. Upgrade to Pro when you want AI coaching and unlimited demos, or jump to Team for multi-coach access and Discord alerts.
            </p>
          </div>
          <Link className="lp-btn lp-btn-accent" href="/signup" style={{ flexShrink: 0 }}>
            Start for free
          </Link>
        </div>
      </div>

      {/* FAQ */}
      <div className="lp-wrap" style={{ paddingBottom: 100 }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <span className="lp-eyebrow" style={{ justifyContent: 'center', marginBottom: 14 }}>
              <span className="ln" />
              FAQ
            </span>
            <h2 style={{
              fontFamily: 'var(--font-display)', fontSize: 'clamp(26px, 3vw, 36px)',
              fontWeight: 800, color: 'var(--text)', margin: 0, letterSpacing: '-0.02em',
            }}>Frequently asked questions</h2>
          </div>
          <div>
            {FAQS.map(faq => <FAQItem key={faq.q} {...faq} />)}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="lp-footer">
        <div className="lp-footer-in">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Logo />
            <p style={{ fontSize: 12, color: 'var(--faint)', maxWidth: 220, lineHeight: 1.6, margin: 0 }}>
              CS2 demo intelligence and AI coaching for competitive teams.
            </p>
          </div>
          <div className="lp-footer-cols">
            <div className="lp-footer-col">
              <span className="lp-footer-col-label">Product</span>
              <Link href="/#features" className="lp-footer-col-link">Features</Link>
              <Link href="/#product" className="lp-footer-col-link">Product</Link>
              <Link href="/pricing" className="lp-footer-col-link">Pricing</Link>
            </div>
            <div className="lp-footer-col">
              <span className="lp-footer-col-label">Account</span>
              <Link href="/login" className="lp-footer-col-link">Sign in</Link>
              <Link href="/signup" className="lp-footer-col-link">Sign up free</Link>
            </div>
          </div>
        </div>
        <div className="lp-footer-bottom">
          <div className="lp-footer-bottom-in">
            <span className="lp-copy" style={{ fontSize: 12, color: 'var(--faint)' }}>© 2026 Rivalize. All rights reserved.</span>
            <div style={{ display: 'flex', gap: 20 }}>
              <Link href="/login" className="lp-navlink" style={{ fontSize: 12 }}>Sign in</Link>
              <Link href="/signup" className="lp-navlink" style={{ fontSize: 12, color: 'var(--accent)' }}>Get started →</Link>
            </div>
          </div>
        </div>
      </footer>
    </>
  )
}
