'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import TacticalCanvas from '@/components/rivalize/TacticalCanvas'

const features = [
  {
    icon: Upload,
    title: 'Demo Upload',
    description: 'Drag and drop your CS2 .dem files. We parse and index every round, player action, and economy state in seconds.',
    badge: 'Core',
  },
  {
    icon: Brain,
    title: 'AI Coach',
    description: 'Get real-time feedback on positioning, utility usage, decision making, and economy management from our trained AI model.',
    badge: 'AI',
  },
  {
    icon: Users,
    title: 'Team Management',
    description: 'Invite teammates, assign roles, track individual and team-wide performance trends across multiple sessions.',
    badge: 'Teams',
  },
  {
    icon: Map,
    title: 'Heatmaps',
    description: 'Visualize player positioning, death locations, and utility throw points on interactive map overlays.',
    badge: 'Visual',
  },
  {
    icon: Target,
    title: 'Anti-Strat Builder',
    description: 'Identify opponent tendencies, common setups, and predictable patterns to build effective counter-strategies.',
    badge: 'Strategy',
  },
  {
    icon: BarChart3,
    title: 'Round Analysis',
    description: 'Deep-dive into every round with timeline playback, economic breakdowns, and key moment highlights.',
    badge: 'Analytics',
  },
]

const steps = [
  {
    number: '01',
    icon: Upload,
    title: 'Upload Your Demo',
    description: 'Drop your CS2 .dem file into Rivalize. Our ingestion pipeline parses every tick, player position, and game event automatically.',
  },
  {
    number: '02',
    icon: Brain,
    title: 'AI Analyzes Everything',
    description: 'Our models process movement patterns, utility efficiency, economy decisions, and team coordination to generate actionable insights.',
  },
  {
    number: '03',
    icon: Trophy,
    title: 'Dominate Your Opponents',
    description: 'Apply targeted coaching tips, study your opponents\' tendencies, and track measurable improvement across every session.',
  },
]

const stats = [
  { value: '10K+', label: 'Demos Analyzed' },
  { value: '500+', label: 'Active Teams' },
  { value: '99.9%', label: 'Parse Accuracy' },
  { value: '24/7', label: 'AI Coach Online' },
]

export default function RivalizeProLanding() {
  const [annual, setAnnual] = useState(false)
  const [navScrolled, setNavScrolled] = useState(false)

  // Scroll reveal for [data-reveal]
  useEffect(() => {
    const els = document.querySelectorAll('[data-reveal]')
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('is-revealed') })
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' })
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  // Nav scrolled style
  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Mini dashboard mock data (from design)
  const miniWins = [true, false, true, true, false, true, false, true, false, true, true, false, true, false, false]
  const miniInsights = [
    { type: 'critical' as const, text: 'CT AWP passive on B — kira held CT spawn instead of aggressive banana angles' },
    { type: 'warning' as const, text: 'Banana control lost in 11/15 T-side rounds — invest in early incendiary' },
    { type: 'tip' as const, text: 'IGL stacks B after A sounds — a fake to A then B split is highly effective' },
    { type: 'edge' as const, text: 'Mid abandoned after round 8 — second mid player can push freely' },
  ]

  return (
    <div className="rv-landing min-h-screen overflow-x-hidden">
      {/* Navigation — exact design */}
      <nav className={`rv-nav ${navScrolled ? 'rv-nav--scrolled' : ''}`}>
        <div className="rv-nav__inner">
          <a href="#" className="rv-nav__logo">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" style={{ marginRight: 8 }}>
              <polygon points="11,2 20,7 20,15 11,20 2,15 2,7" stroke="var(--acc)" strokeWidth="1.5" fill="none" />
              <polygon points="11,6 16,9 16,13 11,16 6,13 6,9" fill="var(--acc)" opacity="0.3" />
            </svg>
            <span>RIVALIZE</span>
          </a>

          <div className="rv-nav__links hidden md:flex">
            <a href="#features" className="rv-nav__link">Features</a>
            <a href="#how-it-works" className="rv-nav__link">How It Works</a>
            <a href="#pricing" className="rv-nav__link">Pricing</a>
            <a href="#about" className="rv-nav__link">About</a>
          </div>

          <div className="rv-nav__actions ml-auto">
            <Link href="/login" className="rv-nav__btn-ghost">Sign In</Link>
            <Link href="/signup" className="rv-nav__btn-primary">Start Free</Link>
          </div>
        </div>
      </nav>

      {/* HERO — pixel match to Rivalize Pro v4 design */}
      <section className="rv-hero" id="home">
        <TacticalCanvas motionFull />
        <div className="rv-hero__glow" />
        <div className="rv-hero__vignette" />

        <div className="rv-hero__content">
          <div className="rv-hero__badge rv-hero-enter rv-hero-enter-1">
            <span className="rv-hero__badge-dot" />
            CS2 AI PLATFORM · BUILT FOR TEAMS
          </div>

          <h1 className="rv-hero__h1 rv-hero-enter rv-hero-enter-2">
            OUTPREPARE<br />
            <em className="rv-hero__h1-stroke">EVERY OPPONENT</em>
          </h1>

          <p className="rv-hero__sub rv-hero-enter rv-hero-enter-3">
            Rivalize gives competitive CS2 teams AI-powered demo analysis and match preparation in minutes — not hours.
          </p>

          <div className="rv-hero__ctas rv-hero-enter rv-hero-enter-4">
            <Link href="/signup" className="rv-btn rv-btn--primary">Start Free →</Link>
            <Link href="#how-it-works" className="rv-btn rv-btn--ghost">See How It Works</Link>
          </div>

          <div className="rv-hero__proof rv-hero-enter rv-hero-enter-5">
            <div className="rv-hero__proof-item">
              <span className="rv-hero__proof-num">12K+</span>
              <span className="rv-hero__proof-label">Demos Analyzed</span>
            </div>
            <div className="rv-hero__proof-sep" />
            <div className="rv-hero__proof-item">
              <span className="rv-hero__proof-num">94%</span>
              <span className="rv-hero__proof-label">Less Prep Time</span>
            </div>
            <div className="rv-hero__proof-sep" />
            <div className="rv-hero__proof-item">
              <span className="rv-hero__proof-num">800+</span>
              <span className="rv-hero__proof-label">Active Teams</span>
            </div>
          </div>
        </div>

        <div className="rv-hero__scroll-hint">
          <span>SCROLL</span>
          <div className="rv-hero__scroll-bar" />
        </div>
      </section>

      {/* PRODUCT PREVIEW — mini dashboard frame (exact design) */}
      <section style={{ padding: '0 32px 120px', maxWidth: 1200, margin: '0 auto' }}>
        <div className="rv-product-frame" data-reveal>
          <div className="rv-product-frame__bar">
            <div className="rv-product-frame__dots"><span /><span /><span /></div>
            <span className="rv-product-frame__url">rivalize.gg / demo-review</span>
            <Link href="/dashboard" className="rv-product-frame__open">Open dashboard →</Link>
          </div>
          <div className="rv-product-frame__body">
            <div className="rv-mini-dash">
              <div className="rv-mini-sidebar">
                <div className="rv-mini-sidebar__logo">⬡ RIVALIZE</div>
                <div className="rv-mini-sidebar__nav" style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div className="rv-mini-nav rv-mini-nav--active">Demo Review</div>
                  <div className="rv-mini-nav">Match Prep</div>
                  <div className="rv-mini-nav">Team Stats</div>
                </div>
              </div>
              <div className="rv-mini-main" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div className="rv-mini-hd">
                  <div className="rv-mini-hd__teams">
                    <span className="rv-mini-hd__team">YOUR TEAM</span>
                    <span className="rv-mini-hd__score">14 : 16</span>
                    <span className="rv-mini-hd__opp" style={{ color: 'var(--muted)' }}>NATUS VINCERE</span>
                  </div>
                  <div className="rv-mini-hd__badges" style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                    <span className="rv-mini-badge" style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--dim)', background: 'var(--surface-2)', border: '1px solid var(--border)', padding: '2px 6px', borderRadius: 3 }}>INFERNO</span>
                    <span className="rv-mini-badge" style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--dim)', background: 'var(--surface-2)', border: '1px solid var(--border)', padding: '2px 6px', borderRadius: 3 }}>ROUND 07 · FULL BUY · WIN</span>
                    <span className="rv-mini-badge" style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--dim)', background: 'var(--surface-2)', border: '1px solid var(--border)', padding: '2px 6px', borderRadius: 3 }}>MAY 10, 2026</span>
                  </div>
                  <div className="rv-mini-pips">
                    {miniWins.map((w, i) => (
                      <div key={i} className={`rv-mini-pip ${w ? 'rv-mini-pip--w' : 'rv-mini-pip--l'}`} />
                    ))}
                  </div>
                </div>
                <div className="rv-mini-content">
                  <div className="rv-mini-map">
                    <div className="rv-mini-zone" style={{ gridArea: 'ct' }}>CT SPAWN</div>
                    <div className="rv-mini-zone rv-mini-zone--site" style={{ gridArea: 'a' }}>A SITE</div>
                    <div className="rv-mini-zone" style={{ gridArea: 'mid' }}>MID</div>
                    <div className="rv-mini-zone rv-mini-zone--site" style={{ gridArea: 'b' }}>B SITE</div>
                    <div className="rv-mini-zone" style={{ gridArea: 'long' }}>LONG</div>
                    <div className="rv-mini-zone" style={{ gridArea: 'cat' }}>CATWALK</div>
                    <div className="rv-mini-zone" style={{ gridArea: 'ban' }}>BANANA</div>
                    <div className="rv-mini-zone" style={{ gridArea: 'ts' }}>T SPAWN</div>

                    {/* CT dots (cyan) */}
                    {[[22,22],[70,20],[48,32],[62,42],[38,18]].map(([x,y],i) => (
                      <div key={`ct-${i}`} className="rv-mini-dot rv-mini-dot--ct" style={{ left: `${x}%`, top: `${y}%` }}>{i+1}</div>
                    ))}
                    {/* T dots (accent) */}
                    {[[80,62],[84,68],[76,72],[82,58],[72,65]].map(([x,y],i) => (
                      <div key={`t-${i}`} className="rv-mini-dot rv-mini-dot--t" style={{ left: `${x}%`, top: `${y}%` }}>{i+1}</div>
                    ))}
                  </div>

                  <div className="rv-mini-panel">
                    <div className="rv-mini-panel__title">AI INSIGHTS · RND 07</div>
                    {miniInsights.map((ins, i) => (
                      <div key={i} className={`rv-mini-ins rv-mini-ins--${ins.type}`}>
                        <span className="rv-mini-ins__dot" />
                        <span className="rv-mini-ins__text">{ins.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES — design exact 2-col grid */}
      <section className="rv-section" id="features">
        <div className="rv-section__header" data-reveal>
          <span className="rv-section__label">Built Different</span>
          <h2 className="rv-section__title">TOOLS BUILT<br />FOR TEAMS</h2>
          <p className="rv-section__sub">Not another individual stats tracker. Rivalize is designed from the ground up for competitive team play.</p>
        </div>
        <div className="rv-features-grid">
          {[
            { num: '01', label: 'Demo Review AI', title: 'Review Demos\nIn Minutes', desc: 'Upload any CS2 demo and our AI dissects every round — positioning, utility, rotations, economy. No more scrubbing through hours of footage.', full: true },
            { num: '02', label: 'Match Preparation', title: 'Pre-Match\nIntel Reports', desc: 'Detailed briefings on upcoming opponents before you ever load in. Know their setups, tendencies, and key players cold.' },
            { num: '03', label: 'Team Analytics', title: 'Track Team\nGrowth', desc: 'Monitor performance across matches. Identify recurring mistakes and measure real improvement over time.' },
            { num: '04', label: 'Opponent Scouting', title: 'Know Their\nPlaybook', desc: 'See exactly what your opponents will run on each map. Exploit weak sides and walk in prepared.' },
          ].map((f, i) => (
            <div key={i} className={`rv-feature-card${f.full ? ' rv-feature-card--full' : ''}`} data-reveal>
              <div className="rv-feature-card__num">{f.num}</div>
              <div className="rv-feature-card__label">{f.label}</div>
              <div className="rv-feature-card__title">{f.title.split('\n').map((l, idx) => <span key={idx}>{l}{idx === 0 && <br />}</span>)}</div>
              <p className="rv-feature-card__desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS — 4 step with connecting line */}
      <section className="rv-section rv-section--alt" id="how-it-works">
        <div className="rv-section__header" data-reveal>
          <span className="rv-section__label">Process</span>
          <h2 className="rv-section__title">FROM DEMO TO<br />DOMINATION</h2>
        </div>
        <div className="rv-hiw-steps">
          <div className="rv-hiw-line" />
          {[
            { num: '01', title: 'Connect', desc: 'Link Steam or FACEIT, or upload demos directly from your local drive.' },
            { num: '02', title: 'AI Analyzes', desc: 'Our AI processes every round — positions, utility, rotations, economy.' },
            { num: '03', title: 'Get Report', desc: 'Receive a full match analysis and pre-match briefing document instantly.' },
            { num: '04', title: 'Win More', desc: "Walk into every match with the full picture. Your opponents won't know what hit them." },
          ].map((s, i) => (
            <div key={i} className="rv-hiw-step" data-reveal style={{ '--delay': `${i * 0.1}s` } as any}>
              <div className="rv-hiw-step__num">{s.num}</div>
              <div className="rv-hiw-step__title">{s.title}</div>
              <p className="rv-hiw-step__desc">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* STATS — 4 blocks row */}
      <section style={{ padding: '0 32px 120px', maxWidth: 1200, margin: '0 auto' }} data-reveal>
        <div className="rv-stats-row">
          <div className="rv-stat-block"><div className="rv-stat-block__num">12,400<span className="rv-stat-block__suf">+</span></div><div className="rv-stat-block__label">Demos Analyzed</div></div>
          <div className="rv-stat-block"><div className="rv-stat-block__num">800<span className="rv-stat-block__suf">+</span></div><div className="rv-stat-block__label">Active Teams</div></div>
          <div className="rv-stat-block"><div className="rv-stat-block__num">94<span className="rv-stat-block__suf">%</span></div><div className="rv-stat-block__label">Less Prep Time</div></div>
          <div className="rv-stat-block"><div className="rv-stat-block__num">32<span className="rv-stat-block__suf">hrs</span></div><div className="rv-stat-block__label">Saved Per Match</div></div>
        </div>
      </section>

      {/* PRICING — toggle + 3 cards (Pro v4 focus) */}
      <section className="rv-section" id="pricing">
        <div className="rv-section__header" style={{ textAlign: 'center' }} data-reveal>
          <span className="rv-section__label">Pricing</span>
          <h2 className="rv-section__title">PLANS FOR EVERY<br />LEVEL OF PLAY</h2>
          <div className="rv-pricing-toggle" style={{ marginTop: 32 }}>
            <button className={`rv-pricing-toggle__btn ${!annual ? 'rv-pricing-toggle__btn--active' : ''}`} onClick={() => setAnnual(false)}>Monthly</button>
            <button className={`rv-pricing-toggle__btn ${annual ? 'rv-pricing-toggle__btn--active' : ''}`} onClick={() => setAnnual(true)}>Annual <span style={{ color: 'var(--acc)', fontSize: 11, marginLeft: 4 }}>−25%</span></button>
          </div>
        </div>
        <div className="rv-pricing-cards">
          {[
            { name: 'Starter', priceM: 0, priceA: 0, desc: 'For solo players and small teams just getting started.', features: ['3 demos/month', 'Basic match stats', '1 team member', 'AI summary reports', 'Community support'], cta: 'Start Free', featured: false },
            { name: 'Team Pro', priceM: 29, priceA: 22, desc: 'For competitive teams serious about improving and winning.', features: ['Unlimited demos', 'Full AI analysis', 'Up to 10 members', 'Pre-match intel reports', 'Opponent scouting', 'Priority support'], cta: 'Start Free Trial', featured: true },
            { name: 'Organization', priceM: 99, priceA: 79, desc: 'For orgs managing multiple teams and rosters.', features: ['Everything in Pro', 'Unlimited members', 'Multi-team management', 'API access', 'Custom reports', 'Dedicated support'], cta: 'Contact Sales', featured: false },
          ].map((p, i) => (
            <div key={i} className={`rv-price-card ${p.featured ? 'rv-price-card--featured' : ''}`} data-reveal>
              {p.featured && <div className="rv-price-card__badge">Most Popular</div>}
              <div className="rv-price-card__name">{p.name}</div>
              <div className="rv-price-card__price">
                {p.priceM === 0 ? <span style={{ fontSize: 36, fontFamily: 'var(--font-display)' }}>FREE</span> : <><sup>$</sup>{annual ? p.priceA : p.priceM}<span className="rv-price-card__per">/mo</span></>}
              </div>
              <p className="rv-price-card__desc">{p.desc}</p>
              <hr className="rv-price-card__hr" />
              <ul className="rv-price-card__features">
                {p.features.map((f, fi) => <li key={fi} className="rv-price-card__feature"><span className="rv-price-card__check">✓</span>{f}</li>)}
              </ul>
              <a href={p.name === 'Organization' ? '#contact' : '/signup'} className={`rv-price-card__cta ${p.featured ? 'rv-price-card__cta--primary' : 'rv-price-card__cta--ghost'}`}>{p.cta}</a>
            </div>
          ))}
        </div>
      </section>

      {/* ABOUT */}
      <section className="rv-section rv-section--alt" id="about">
        <div className="rv-about-grid" data-reveal>
          <div>
            <span className="rv-section__label">Our Story</span>
            <h2 className="rv-section__title" style={{ fontSize: 'clamp(36px, 5vw, 64px)' }}>BUILT BY<br />COMPETITORS,<br />FOR COMPETITORS</h2>
            <p style={{ fontSize: 16, color: 'var(--muted)', lineHeight: 1.7, marginTop: 20, maxWidth: 480 }}>
              We were tired of spending three hours reviewing demos for a two-hour match. Rivalize was built to solve exactly that — giving competitive CS2 teams the analytical edge that pro orgs have had for years, automated and accessible.
            </p>
            <p style={{ fontSize: 16, color: 'var(--muted)', lineHeight: 1.7, marginTop: 16, maxWidth: 480 }}>
              Every feature exists because a real team needed it. We're active CS2 players, and Rivalize is the tool we always wished existed.
            </p>
          </div>
          <div className="rv-about-values">
            {[
              { title: 'Team-First', desc: 'Every feature is designed around team workflows, not solo stats.' },
              { title: 'Speed Matters', desc: 'Analysis in minutes. Prep reports before you queue up.' },
              { title: 'Actually Useful', desc: 'No fluff metrics. Just the insights that win rounds.' },
            ].map((v, i) => (
              <div key={i} className="rv-about-value">
                <div className="rv-about-value__title">{v.title}</div>
                <p className="rv-about-value__desc">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA BAND */}
      <div className="rv-cta-band">
        <div className="rv-cta-band__glow" />
        <div className="rv-cta-band__inner" data-reveal>
          <div className="rv-cta-band__eyebrow">Ready to dominate?</div>
          <h2 className="rv-cta-band__h2">PREP SMARTER.<br />WIN MORE.</h2>
          <p className="rv-cta-band__sub">Join 800+ competitive teams already using Rivalize to outprepare their opponents.</p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/signup" className="rv-btn rv-btn--primary">Start Free →</Link>
            <Link href="/login" className="rv-btn rv-btn--ghost">Talk to Sales</Link>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="rv-footer-wrap">
        <div className="rv-footer">
          <div className="rv-footer__top">
            <div className="rv-footer__brand">
              <div className="rv-footer__brand-name">
                <svg width="18" height="18" viewBox="0 0 22 22" fill="none" style={{ marginRight: 8, verticalAlign: 'middle' }}>
                  <polygon points="11,2 20,7 20,15 11,20 2,15 2,7" stroke="var(--acc)" strokeWidth="1.5" fill="none" />
                  <polygon points="11,6 16,9 16,13 11,16 6,13 6,9" fill="var(--acc)" opacity="0.3" />
                </svg>
                RIVALIZE
              </div>
              <p className="rv-footer__tagline">CS2 AI coaching and analysis for competitive teams.</p>
            </div>
            <div className="rv-footer__cols">
              {[
                { title: 'Product', links: ['Features', 'Pricing', 'Changelog', 'Roadmap'] },
                { title: 'Use Cases', links: ['Demo Review', 'Match Prep', 'Team Analytics', 'Scouting'] },
                { title: 'Company', links: ['About', 'Blog', 'Careers', 'Press'] },
                { title: 'Support', links: ['Docs', 'Discord', 'Contact', 'Status'] },
              ].map((col, i) => (
                <div key={i} className="rv-footer__col">
                  <div className="rv-footer__col-title">{col.title}</div>
                  <div className="rv-footer__links">
                    {col.links.map((l, li) => <a key={li} href="#" className="rv-footer__link">{l}</a>)}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rv-footer__bottom">
            <span className="rv-footer__copy">© 2026 Rivalize. All rights reserved.</span>
            <div style={{ display: 'flex', gap: 24 }}>
              <a href="#" className="rv-footer__link">Privacy</a>
              <a href="#" className="rv-footer__link">Terms</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
