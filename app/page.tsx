'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'

/* ── Bolt logo SVG ─────────────────────────────────────────── */
function Bolt({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M4 3h8L9 9h7L7 18l2-6H5L4 3z" fill="currentColor" />
    </svg>
  )
}

function Logo() {
  return (
    <a className="lp-logo" href="#top">
      <span className="lp-logo-tile">
        <Bolt size={16} />
      </span>
      <span>
        <span className="lp-logo-word">RIVALIZE</span>
        <span className="lp-logo-sub">PRO · SCOUT</span>
      </span>
    </a>
  )
}

/* ── Interactive AI chat widget ────────────────────────────── */
type Msg = { role: 'ai' | 'user'; text: string; isTyping?: boolean }

const SEED: Msg[] = [
  { role: 'user', text: 'How do they play eco rounds?' },
  {
    role: 'ai',
    text: '68% of ecos: stack B with pistols, fast tunnels rush, zero utility. Counter: single B anchor + 4-man A execute punishes it cleanly.',
  },
]

const REPLIES = [
  'Across 4 demos they default 2-1-2 on T with a mid push at 1:20. Counter: smoke mid-door at freeze-time and hold the cross with two.',
  'Their AWPer holds long 78% of round starts. Counter: flash over the top before A-main and trade the entry.',
  'Post-plant they stack apps + ninja on B. Counter: delay your retake 6 s and clear default before apps.',
  'On force buys they go full A-main rush. Counter: double-stack A with a molly held for the choke.',
]

function AiBubble({ text }: { text: string }) {
  const parts = text.split(/(Counter:)/g)
  return (
    <>
      {parts.map((p, i) =>
        p === 'Counter:' ? (
          <span key={i} className="lp-bubble-counter">
            Counter:
          </span>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  )
}

function ChatWidget() {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Msg[]>(SEED)
  const [idx, setIdx] = useState(0)
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [messages])

  const send = () => {
    const v = input.trim()
    if (!v) return
    setInput('')
    setMessages(m => [...m, { role: 'user', text: v }])
    setTimeout(() => setMessages(m => [...m, { role: 'ai', text: '', isTyping: true }]), 280)
    setTimeout(() => {
      const reply = REPLIES[idx % REPLIES.length]
      setIdx(i => i + 1)
      setMessages(m => [...m.filter(x => !x.isTyping), { role: 'ai', text: reply }])
    }, 1100)
  }

  return (
    <div className="lp-panel lp-signal lp-chat">
      <span className="lp-topbar" />
      <span className="lp-tick lp-tick-tl" />
      <span className="lp-tick lp-tick-br" />

      {/* Header */}
      <div className="lp-chat-head">
        <span className="lp-chat-aitile">
          <Bolt size={13} />
        </span>
        <span>
          <span className="lp-chat-title">AI Scout</span>
          <span className="lp-live">
            <span className="lp-dot" />
            LIVE · MIRAGE
          </span>
        </span>
        <span className="lp-chat-win">
          <span style={{ background: 'var(--loss)', opacity: 0.7 }} />
          <span style={{ background: 'var(--tside)', opacity: 0.7 }} />
          <span style={{ background: 'var(--win)', opacity: 0.7 }} />
        </span>
      </div>

      {/* Messages */}
      <div className="lp-chat-body" ref={bodyRef}>
        {messages.map((msg, i) => (
          <div key={i} className={`lp-msg ${msg.role}`}>
            <span className="lp-msg-av">
              {msg.role === 'ai' ? <Bolt size={12} /> : 'M'}
            </span>
            <div className="lp-bubble">
              <span className="who">{msg.role === 'ai' ? 'AI Scout' : 'You'}</span>
              {msg.isTyping ? (
                <span className="lp-typing">
                  <i />
                  <i />
                  <i />
                </span>
              ) : msg.role === 'ai' ? (
                <AiBubble text={msg.text} />
              ) : (
                msg.text
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="lp-chat-input">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Ask about an opponent…"
          autoComplete="off"
        />
        <button className="lp-send" onClick={send} aria-label="Send">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" />
          </svg>
        </button>
      </div>
    </div>
  )
}

/* ── Platform stats (live counters) ───────────────────────── */
interface PlatformStats {
  teams: number
  demos: number
  rounds: number
  parse_time_avg_seconds: number | null
}

function formatStat(value: number, key: keyof PlatformStats): string {
  if (key === 'parse_time_avg_seconds') {
    if (value === 0) return '< 3 min'
    const mins = value / 60
    if (mins < 1) return `< 1 min`
    return `< ${Math.ceil(mins)} min`
  }
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(0)} M+`
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)} K+`
  return `${value.toLocaleString()}+`
}

function useCountUp(target: number, duration = 1500, active = false) {
  const [display, setDisplay] = useState(0)
  const raf = useRef<number | null>(null)
  const start = useRef<number | null>(null)

  useEffect(() => {
    if (!active || target === 0) { setDisplay(target); return }
    start.current = null
    const step = (ts: number) => {
      if (start.current === null) start.current = ts
      const progress = Math.min((ts - start.current) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(eased * target))
      if (progress < 1) raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
  }, [target, duration, active])

  return display
}

function StatNumber({ value, statKey }: { value: number; statKey: keyof PlatformStats }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const count = useCountUp(value, 1400, visible)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold: 0.3 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const formatted = statKey === 'parse_time_avg_seconds'
    ? formatStat(value, statKey)
    : formatStat(count, statKey)

  return <div ref={ref} className="lp-stat-v">{formatted}</div>
}

function StatsBand() {
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const fetched = useRef(false)

  const fetchStats = useCallback(async () => {
    if (fetched.current) return
    fetched.current = true
    try {
      const res = await fetch('/api/stats')
      if (res.ok) setStats(await res.json())
    } catch {}
  }, [])

  useEffect(() => { fetchStats() }, [fetchStats])

  const items: { key: keyof PlatformStats; label: string; fallback: string }[] = [
    { key: 'teams',                  label: 'Teams active',    fallback: '—'      },
    { key: 'rounds',                 label: 'Rounds parsed',   fallback: '—'      },
    { key: 'demos',                  label: 'Demos analysed',  fallback: '—'      },
    { key: 'parse_time_avg_seconds', label: 'Parse time avg',  fallback: '< 3 min' },
  ]

  return (
    <div className="lp-wrap">
      <div className="lp-panel lp-stats-band">
        <div className="lp-stats">
          {items.map(({ key, label, fallback }) => (
            <div key={label} className="lp-stat">
              {stats ? (
                <StatNumber value={stats[key] ?? 0} statKey={key} />
              ) : (
                <div className="lp-stat-v">{fallback}</div>
              )}
              <div className="lp-stat-l">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Page ──────────────────────────────────────────────────── */
export default function LandingPage() {
  return (
    <>
      {/* Ambient background */}
      <div className="lp-bg" />

      {/* ── NAV ── */}
      <nav className="lp-nav">
        <div className="lp-nav-in">
          <Logo />
          <div className="lp-navlinks">
            <a className="lp-navlink" href="#how">
              How it works
            </a>
            <a className="lp-navlink" href="#features">
              Features
            </a>
            <a className="lp-navlink" href="#product">
              Product
            </a>
            <Link className="lp-navlink" href="/login">
              Sign in
            </Link>
          </div>
          <Link className="lp-btn lp-btn-accent lp-btn-sm" href="/signup">
            Get started
          </Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <a id="top" />
      <div className="lp-wrap">
        <section className="lp-hero">
          {/* Left */}
          <div>
            <span className="lp-eyebrow">
              <span className="ln" />
              <b>00</b> · CS2 opponent intelligence
            </span>

            <h1 className="lp-h1">
              Know your
              <br />
              <em>enemy</em> before
              <br />
              the match.
            </h1>

            <p className="lp-sub">
              Upload CS2 demos and let Scout build the anti-strat — every tendency, every map,
              every eco round. Walk onto the server already three rounds ahead.
            </p>

            <div className="lp-cta-row">
              <Link className="lp-btn lp-btn-accent" href="/signup">
                Start for free
              </Link>
              <a className="lp-btn lp-btn-ghost" href="#how">
                See how it works →
              </a>
            </div>

            {/* Platform proof */}
            <div className="lp-proof">
              <span className="lp-proof-label">Works with</span>
              <div className="lp-tags">
                {['ESEA', 'FACEIT', 'CS2 Premier', 'HLTV demos'].map(t => (
                  <span key={t} className="lp-tag">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Right — interactive chat */}
          <ChatWidget />
        </section>
      </div>

      {/* ── STATS BAND ── */}
      <StatsBand />

      {/* ── HOW IT WORKS ── */}
      <div className="lp-wrap">
        <section className="lp-section" id="how">
          <div className="lp-section-head">
            <span className="lp-eyebrow">
              <span className="ln" />
              <b>01</b> · How it works
            </span>
            <h2>From raw demo to a scripted anti-strat in three steps.</h2>
            <p>
              No spreadsheets, no rewatching VODs at 2 am. Drop the files and Scout does the
              reading for you.
            </p>
          </div>

          <div className="lp-feats" id="features">
            {/* 01 — Upload */}
            <div className="lp-panel lp-feat lp-feat-v1">
              <span className="lp-topbar" />
              <span className="lp-tick lp-tick-tl" />
              <span className="lp-tick lp-tick-br" />
              <div className="lp-feat-ix">01</div>
              <div className="lp-feat-icon">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 16V4M12 4 7 9M12 4l5 5" />
                  <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
                </svg>
              </div>
              <h3>Demo parsing</h3>
              <p>
                Drop a .dem and Scout reconstructs every round — utility, economy, positions and
                timings. Every CS2 competitive format supported.
              </p>
            </div>

            {/* 02 — AI */}
            <div className="lp-panel lp-feat lp-feat-v2">
              <span className="lp-topbar" />
              <span className="lp-tick lp-tick-tl" />
              <span className="lp-tick lp-tick-br" />
              <div className="lp-feat-ix">02</div>
              <div className="lp-feat-icon">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 3v3M12 18v3M3 12h3M18 12h3M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z" />
                </svg>
              </div>
              <h3>AI scouting</h3>
              <p>
                Question an opponent like a coach. Scout reads their patterns across every demo and
                answers with the receipts — in plain language.
              </p>
            </div>

            {/* 03 — Anti-strat */}
            <div className="lp-panel lp-feat lp-feat-v3">
              <span className="lp-topbar" />
              <span className="lp-tick lp-tick-tl" />
              <span className="lp-tick lp-tick-br" />
              <div className="lp-feat-ix">03</div>
              <div className="lp-feat-icon">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="8" />
                  <circle cx="12" cy="12" r="2.5" />
                  <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                </svg>
              </div>
              <h3>Anti-strat</h3>
              <p>
                Map-specific playbooks built from their own tendencies. Veto smarter, default
                harder, and punish exactly what they repeat.
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* ── PRODUCT PREVIEW ── */}
      <div className="lp-wrap">
        <section className="lp-section" id="product" style={{ paddingTop: 24 }}>
          <div className="lp-section-head">
            <span className="lp-eyebrow">
              <span className="ln" />
              <b>02</b> · The command center
            </span>
            <h2>Everything you scouted, on one screen.</h2>
            <p>
              Next match, map-pool win rates, readiness and the live AI brief — the whole prep
              board, ready before warmup.
            </p>
          </div>

          <div className="lp-window">
            <span className="lp-glow" />
            <div className="lp-window-bar">
              <span className="lp-traffic">
                <span style={{ background: 'var(--loss)', opacity: 0.7 }} />
                <span style={{ background: 'var(--tside)', opacity: 0.7 }} />
                <span style={{ background: 'var(--win)', opacity: 0.7 }} />
              </span>
              <span className="lp-url">
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <rect x="5" y="11" width="14" height="10" rx="2" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
                app.rivalize.pro/dashboard
              </span>
            </div>
            <Image
              src="/product-dashboard.png"
              alt="Rivalize dashboard — opponent scouting and map veto"
              width={1240}
              height={780}
              style={{ display: 'block', width: '100%', height: 'auto' }}
              priority
            />
          </div>
        </section>
      </div>

      {/* ── AI INSIGHT CARDS ── */}
      <div className="lp-wrap">
        <section className="lp-section" style={{ paddingTop: 0 }}>
          <div className="lp-section-head" style={{ marginBottom: 32 }}>
            <span className="lp-eyebrow">
              <span className="ln" />
              <b>03</b> · AI insights
            </span>
            <h2>Scout surfaces what matters, automatically.</h2>
          </div>

          <div className="lp-feats">
            {/* Signal card */}
            <InsightCard
              color="var(--signal)"
              tag="✦ AI INSIGHT"
              title="Pistol Round Tendency"
              body="They layer fast mid control on Mirage CT side: pistols, fast tunnels rush, zero utility. Counter: single B anchor + 4-man A execute punishes it cleanly."
            />
            {/* Amber card */}
            <InsightCard
              color="var(--tside)"
              tag="PATTERN"
              title="Eco Force-Buy on Round 6"
              body="After losing two consecutive buy rounds, they force buy with MP9s and Deagles — stacking A-site or pushing Underpass to disrupt B executes."
            />
            {/* Loss card */}
            <InsightCard
              color="var(--loss)"
              tag="WARNING"
              title="AWPer Position Rotated"
              body="Their primary AWPer has shifted from long to mid-doors in recent demos. Your mid-push setups may need adjustment — check the new angle data."
            />
          </div>
        </section>
      </div>

      {/* ── FINAL CTA ── */}
      <div className="lp-wrap" style={{ paddingBottom: 0 }}>
        <div className="lp-panel lp-cta-panel" id="start">
          <span className="lp-tick lp-tick-tl" />
          <span className="lp-tick lp-tick-br" />
          <span className="lp-eyebrow" style={{ justifyContent: 'center' }}>
            <span className="ln" />
            <b>04</b> · Get started
          </span>
          <h2>Ready to walk in prepared?</h2>
          <p>
            Scout your next opponent free. Upload five demos, get the full anti-strat — no card
            required.
          </p>
          <div className="lp-cta-actions">
            <Link className="lp-btn lp-btn-accent" href="/signup" style={{ height: 50, fontSize: 15 }}>
              Start scouting free
            </Link>
            <a className="lp-btn lp-btn-ghost" href="#product">
              See the product
            </a>
          </div>
          <div className="lp-cta-note">NO CARD REQUIRED · 5 DEMOS FREE · CANCEL ANYTIME</div>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer className="lp-footer">
        <div className="lp-footer-in">
          {/* Left: logo + tagline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Logo />
            <p
              style={{
                fontSize: 12,
                color: 'var(--faint)',
                maxWidth: 220,
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              CS2 demo intelligence and AI coaching for competitive teams.
            </p>
          </div>

          {/* Link columns */}
          <div className="lp-footer-cols">
            <FooterCol
              label="Product"
              links={[
                { text: 'Features', href: '#features' },
                { text: 'Product', href: '#product' },
                { text: 'How it works', href: '#how' },
                { text: 'Pricing', href: '#start' },
              ]}
            />
            <FooterCol
              label="Resources"
              links={[
                { text: 'Documentation', href: '#' },
                { text: 'Changelog', href: '#' },
                { text: 'Status', href: '#' },
                { text: 'Support', href: '#' },
              ]}
            />
            <FooterCol
              label="Company"
              links={[
                { text: 'About', href: '#' },
                { text: 'Privacy', href: '#' },
                { text: 'Terms', href: '#' },
                { text: 'Contact', href: '#' },
              ]}
            />
          </div>
        </div>

        <div className="lp-footer-bottom">
          <div className="lp-footer-bottom-in">
            <span className="lp-copy">© 2026 Rivalize. All rights reserved.</span>
            <div style={{ display: 'flex', gap: 20 }}>
              <Link href="/login" className="lp-navlink" style={{ fontSize: 12 }}>
                Sign in
              </Link>
              <Link
                href="/signup"
                className="lp-navlink"
                style={{ fontSize: 12, color: 'var(--accent)' }}
              >
                Get started →
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </>
  )
}

/* ── Sub-components ──────────────────────────────────────────── */

function InsightCard({
  color,
  tag,
  title,
  body,
}: {
  color: string
  tag: string
  title: string
  body: string
}) {
  return (
    <div
      className="lp-panel lp-insight-card"
      style={
        {
          '--ic': color,
          borderColor: `color-mix(in srgb, ${color} 20%, var(--border))`,
        } as React.CSSProperties
      }
    >
      <span
        className="lp-topbar"
        style={{
          background: `linear-gradient(90deg, ${color}, color-mix(in srgb, ${color} 28%, transparent) 42%, transparent 70%)`,
        }}
      />
      <span
        className="lp-tick lp-tick-tl"
        style={{ borderColor: `color-mix(in srgb, ${color} 45%, transparent)` }}
      />
      <span
        className="lp-tick lp-tick-br"
        style={{ borderColor: `color-mix(in srgb, ${color} 45%, transparent)` }}
      />
      <div
        className="lp-ic-tag"
        style={{
          background: `color-mix(in srgb, ${color} 10%, transparent)`,
          border: `1px solid color-mix(in srgb, ${color} 28%, transparent)`,
          color,
        }}
      >
        {tag}
      </div>
      <h3 className="lp-ic-title">{title}</h3>
      <p className="lp-ic-body">{body}</p>
      <a href="/signup" className="lp-ic-link" style={{ color }}>
        View full analysis →
      </a>
    </div>
  )
}

function FooterCol({
  label,
  links,
}: {
  label: string
  links: { text: string; href: string }[]
}) {
  return (
    <div className="lp-footer-col">
      <span className="lp-footer-col-label">{label}</span>
      {links.map(l => (
        <a key={l.text} href={l.href} className="lp-footer-col-link">
          {l.text}
        </a>
      ))}
    </div>
  )
}
