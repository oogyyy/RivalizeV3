'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'

/* ── Lightning bolt SVG ── */
function Bolt({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M4 3h8L9 9h7L7 18l2-6H5L4 3z" fill="currentColor" />
    </svg>
  )
}

/* ── Logo lockup ── */
function Logo() {
  return (
    <a className="lp-logo" href="#top">
      <span className="lp-logo-tile" style={{ color: '#fff' }}>
        <Bolt size={16} />
      </span>
      <span>
        <span className="lp-logo-word">RIVALIZE</span>
        <span className="lp-logo-sub">PRO · SCOUT</span>
      </span>
    </a>
  )
}

/* ── Chat widget ── */
type Msg = { role: 'ai' | 'user'; text: string; isTyping?: boolean }

const SEED_MESSAGES: Msg[] = [
  { role: 'user', text: 'How do they play eco rounds?' },
  { role: 'ai', text: '68% of ecos: stack B with pistols, fast tunnels rush, zero utility. Counter: single B anchor + 4-man A execute punishes it cleanly.' },
]

const AI_RESPONSES = [
  'Across 4 demos they default 2-1-2 on T with a mid push at 1:20. Counter: smoke mid-door at freeze-time and hold the cross with two.',
  'Their AWPer holds long 78% of round starts. Counter: flash over the top before A-main and trade the entry.',
  'Post-plant they stack apps + ninja on B. Counter: delay your retake 6s and clear default before apps.',
  'On force buys they go full A-main rush. Counter: double-stack A with a molly held for the choke.',
]

function renderAiBubble(text: string) {
  const parts = text.split(/(Counter:)/g)
  return (
    <>
      {parts.map((part, i) =>
        part === 'Counter:' ? (
          <span key={i} className="counter">Counter:</span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  )
}

function ChatWidget() {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Msg[]>(SEED_MESSAGES)
  const [respIdx, setRespIdx] = useState(0)
  const bodyRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }

  useEffect(scrollToBottom, [messages])

  const submit = () => {
    const v = input.trim()
    if (!v) return
    setInput('')
    setMessages(m => [...m, { role: 'user', text: v }])

    setTimeout(() => {
      setMessages(m => [...m, { role: 'ai', text: '', isTyping: true }])
    }, 280)

    setTimeout(() => {
      const reply = AI_RESPONSES[respIdx % AI_RESPONSES.length]
      setRespIdx(i => i + 1)
      setMessages(m => {
        const next = m.filter(msg => !msg.isTyping)
        return [...next, { role: 'ai', text: reply }]
      })
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
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v3M12 18v3M3 12h3M18 12h3M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/>
          </svg>
        </span>
        <span>
          <span className="lp-chat-title">AI Scout</span>
          <span className="lp-live">
            <span className="lp-dot" />
            LIVE · MIRAGE
          </span>
        </span>
        <span className="lp-chat-win">
          <span /><span /><span />
        </span>
      </div>

      {/* Messages */}
      <div className="lp-chat-body" ref={bodyRef}>
        {messages.map((msg, i) => (
          <div key={i} className={`lp-msg ${msg.role}`}>
            <span className="lp-msg-av">
              {msg.role === 'ai' ? (
                <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M4 3h8L9 9h7L7 18l2-6H5L4 3z"/>
                </svg>
              ) : 'M'}
            </span>
            <div className="lp-bubble">
              <span className="who">{msg.role === 'ai' ? 'AI Scout' : 'You'}</span>
              {msg.isTyping ? (
                <span className="lp-typing">
                  <i/><i/><i/>
                </span>
              ) : msg.role === 'ai' ? renderAiBubble(msg.text) : msg.text}
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
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="Ask about an opponent…"
          autoComplete="off"
        />
        <button className="lp-send" onClick={submit} aria-label="Send">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

/* ── Main Page ── */
export default function LandingPage() {
  return (
    <>
      <div className="lp-bg" />

      {/* ── NAV ── */}
      <nav className="lp-nav">
        <div className="lp-nav-in">
          <Logo />
          <div className="lp-navlinks">
            <a className="lp-navlink" href="#how">How it works</a>
            <a className="lp-navlink" href="#features">Features</a>
            <a className="lp-navlink" href="#product">Product</a>
            <Link className="lp-navlink" href="/login">Sign in</Link>
          </div>
          <Link className="lp-btn lp-btn-accent lp-btn-sm" href="/signup">Get started</Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <a id="top" />
      <div className="lp-wrap">
        <section className="lp-hero">
          {/* Left column */}
          <div>
            <span className="lp-eyebrow">
              <span className="ln" />
              <b>00</b> · CS2 opponent intelligence
            </span>
            <h1 className="lp-h1">
              Know your<br />
              <em>enemy</em> before<br />
              the match starts.
            </h1>
            <p className="lp-sub">
              Upload CS2 demos and let Scout build the anti-strat — every tendency, every map, every eco round. Walk onto the server already three rounds ahead.
            </p>
            <div className="lp-cta-row">
              <Link className="lp-btn lp-btn-accent" href="/signup">Start for free</Link>
              <a className="lp-btn lp-btn-ghost" href="#how">See how it works →</a>
            </div>
            <div className="lp-proof">
              <span className="lp-proof-label">Trusted by 120+ rosters</span>
              <div className="lp-tags">
                {['VEX', 'NOVA', 'AURA', 'K7', 'FL0W'].map(t => (
                  <span key={t} className="lp-tag">{t}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Right column — chat widget */}
          <ChatWidget />
        </section>
      </div>

      {/* ── STAT BAND ── */}
      <div className="lp-wrap" style={{ marginTop: 0 }}>
        <div className="lp-panel lp-stats">
          <div className="lp-stat">
            <div className="lp-stat-v">2.4M</div>
            <div className="lp-stat-l">Rounds parsed</div>
          </div>
          <div className="lp-stat">
            <div className="lp-stat-v">94<span style={{ fontSize: 20 }}>%</span></div>
            <div className="lp-stat-l">Demos auto-tagged</div>
          </div>
          <div className="lp-stat">
            <div className="lp-stat-v">18<span style={{ fontSize: 20 }}>s</span></div>
            <div className="lp-stat-l">Median scout time</div>
          </div>
          <div className="lp-stat">
            <div className="lp-stat-v">120+</div>
            <div className="lp-stat-l">Competitive rosters</div>
          </div>
        </div>
      </div>

      {/* ── HOW IT WORKS ── */}
      <div className="lp-wrap">
        <section className="lp-section" id="how">
          <div className="lp-section-head">
            <span className="lp-eyebrow"><span className="ln" /><b>01</b> · How it works</span>
            <h2>From raw demo to a scripted anti-strat in three steps.</h2>
            <p>No spreadsheets, no rewatching VODs at 2am. Drop the files and Scout does the reading for you.</p>
          </div>
          <div className="lp-feats" id="features">
            {/* Feature 1 */}
            <div className="lp-panel lp-feat">
              <div className="lp-feat-ix">01</div>
              <div className="lp-feat-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 16V4M12 4 7 9M12 4l5 5"/><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>
                </svg>
              </div>
              <h3>Demo parsing</h3>
              <p>Drop a .dem and Scout reconstructs every round — utility, economy, positions and timings. Every CS2 competitive format supported.</p>
            </div>
            {/* Feature 2 */}
            <div className="lp-panel lp-feat">
              <div className="lp-feat-ix">02</div>
              <div className="lp-feat-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3v3M12 18v3M3 12h3M18 12h3M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z"/>
                </svg>
              </div>
              <h3>AI scouting</h3>
              <p>Question an opponent like a coach. Scout reads their patterns across every demo and answers with the receipts — in plain language.</p>
            </div>
            {/* Feature 3 */}
            <div className="lp-panel lp-feat">
              <div className="lp-feat-ix">03</div>
              <div className="lp-feat-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5"/>
                  <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
                </svg>
              </div>
              <h3>Anti-strat</h3>
              <p>Map-specific playbooks built from their own tendencies. Veto smarter, default harder, and punish exactly what they repeat.</p>
            </div>
          </div>
        </section>
      </div>

      {/* ── PRODUCT PREVIEW ── */}
      <div className="lp-wrap">
        <section className="lp-section" id="product" style={{ paddingTop: 24 }}>
          <div className="lp-section-head">
            <span className="lp-eyebrow"><span className="ln" /><b>02</b> · The command center</span>
            <h2>Everything you scouted, on one screen.</h2>
            <p>Next match, map-pool win rates, readiness and the live AI brief — the whole prep board, ready before warmup.</p>
          </div>
          <div className="lp-window">
            <span className="lp-glow" />
            <div className="lp-window-bar">
              <span className="lp-traffic">
                <span style={{ background: 'var(--loss)' }} />
                <span style={{ background: '#E6A53D' }} />
                <span style={{ background: 'var(--win)' }} />
              </span>
              <span className="lp-url">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>
                </svg>
                app.rivalize.pro/dashboard
              </span>
            </div>
            <Image
              src="/product-dashboard.png"
              alt="Rivalize Pro dashboard — Next Match command center"
              width={1240}
              height={780}
              style={{ display: 'block', width: '100%', height: 'auto' }}
              priority
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
            <span className="ln" /><b>03</b> · Get started
          </span>
          <h2>Ready to walk in prepared?</h2>
          <p>Scout your next opponent free. Upload five demos, get the full anti-strat — no card required.</p>
          <div className="lp-cta-actions">
            <Link className="lp-btn lp-btn-accent" href="/signup">Start scouting free</Link>
            <a className="lp-btn lp-btn-ghost" href="#product">Book a demo</a>
          </div>
          <div className="lp-cta-note">NO CARD REQUIRED · 5 DEMOS FREE · CANCEL ANYTIME</div>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer className="lp-footer">
        <div className="lp-footer-in">
          <Logo />
          <div className="lp-footer-links">
            <a href="#features">Features</a>
            <a href="#product">Product</a>
            <Link href="/login">Sign in</Link>
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
          </div>
          <span className="lp-copy">© 2026 Rivalize</span>
        </div>
      </footer>
    </>
  )
}
