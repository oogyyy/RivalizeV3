'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

const HERO_CONVOS = [
  {
    q: "What's their B-rush frequency?",
    a: "B-rushes account for 22% of T-rounds — usually round 3 after a pistol loss. They commit 4–5 players with no utility. Stack B early and you win it for free.",
  },
  {
    q: "Where does their AWPer default?",
    a: "CT-side, they hold aggressive mid from window 74% of rounds. Flash from jungle before crossing. On T-side the AWPer plays support — smoke CT, hold retake.",
  },
  {
    q: "How do they play eco rounds?",
    a: "68% of eco rounds: stack B with pistols, fast rush through tunnels, zero utility. Counter: single B anchor + 4-man A execute. They almost never save.",
  },
  {
    q: "What's their biggest weak spot?",
    a: "Mid control. They never contest mid early, leaving CT exposed to splits. A mid-to-B split with one smoke on doors wins the round before it starts.",
  },
  {
    q: "How does their IGL react to losing sites?",
    a: "Very reactive. After two A losses they force B the next round 80% of the time. Pre-position for the switch and you farm the mistake every time.",
  },
]

function HeroChatMock() {
  const [idx] = useState(() => Math.floor(Math.random() * HERO_CONVOS.length))
  const [displayed, setDisplayed] = useState('')
  const [showUser, setShowUser] = useState(false)
  const [typing, setTyping] = useState(false)
  const convo = HERO_CONVOS[idx]

  useEffect(() => {
    setDisplayed('')
    setShowUser(false)
    setTyping(false)

    const t1 = setTimeout(() => setShowUser(true), 600)
    const t2 = setTimeout(() => {
      setTyping(true)
      let i = 0
      const iv = setInterval(() => {
        i++
        setDisplayed(convo.a.slice(0, i))
        if (i >= convo.a.length) {
          clearInterval(iv)
          setTyping(false)
        }
      }, 22)
      return () => clearInterval(iv)
    }, 1400)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [convo.a])

  return (
    <div
      style={{
        background: '#14082a',
        border: '3px solid #2d0d55',
        boxShadow: '6px 6px 0 #000, 0 0 40px rgba(255,0,204,0.2)',
        width: '100%',
        maxWidth: '420px',
        padding: '0',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          background: '#1a0c34',
          borderBottom: '3px solid #2d0d55',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <div
          style={{
            width: '8px',
            height: '8px',
            background: '#ff00cc',
            boxShadow: '0 0 8px #ff00cc',
          }}
        />
        <span style={{ fontFamily: 'var(--font-pixel), monospace', fontSize: '7px', color: '#9060c8', letterSpacing: '0.1em' }}>
          AI SCOUT — NIGHTFALL ANALYSIS
        </span>
      </div>

      {/* Messages */}
      <div style={{ padding: '16px', minHeight: '160px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {showUser && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              animation: 'fadeSlideUp 0.3s ease-out',
            }}
          >
            <div
              style={{
                background: 'rgba(255,0,204,0.15)',
                border: '2px solid rgba(255,0,204,0.4)',
                padding: '8px 12px',
                maxWidth: '80%',
                fontFamily: 'var(--font-sans, "Plus Jakarta Sans"), sans-serif',
                fontSize: '12px',
                color: '#f0e0ff',
                lineHeight: 1.5,
              }}
            >
              {convo.q}
            </div>
          </div>
        )}

        {(displayed || typing) && (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <div
              style={{
                width: '24px',
                height: '24px',
                background: 'rgba(0,170,255,0.15)',
                border: '2px solid #00aaff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <span style={{ fontFamily: 'var(--font-pixel), monospace', fontSize: '7px', color: '#00aaff' }}>AI</span>
            </div>
            <div
              style={{
                background: '#1a0c34',
                border: '2px solid #2d0d55',
                padding: '8px 12px',
                fontFamily: 'var(--font-sans, "Plus Jakarta Sans"), sans-serif',
                fontSize: '12px',
                color: '#f0e0ff',
                lineHeight: 1.5,
                flex: 1,
              }}
            >
              {typing && !displayed ? (
                <span style={{ color: '#00aaff' }}>▋</span>
              ) : (
                <>
                  {displayed}
                  {typing && <span style={{ color: '#ff00cc', animation: 'blink 0.7s step-end infinite' }}>▋</span>}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const FEATURES = [
  {
    tag: 'INGESTION',
    title: 'DEMO PARSING',
    desc: 'Upload .dem files and get instant structural analysis. Supports all CS2 competitive demo formats.',
  },
  {
    tag: 'INTELLIGENCE',
    title: 'AI SCOUTING',
    desc: 'Ask tactical questions in plain language. The AI reads your opponent\'s patterns and answers in seconds.',
  },
  {
    tag: 'STRATEGY',
    title: 'ANTI-STRAT',
    desc: 'Get counter-strategies for every opponent. Map-specific playbooks built from their own demo data.',
  },
]

const TICKER_ITEMS = [
  'DEMO ANALYSIS', 'MAP CONTROL', 'AI SCOUTING', 'ANTI-STRATS',
  'PLAYER TRACKING', 'WIN RATES', 'PATTERN RECOGNITION', 'CS2 READY',
]

export default function LandingPage() {
  return (
    <>
      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes ticker {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @keyframes scanlines {
          from { background-position: 0 0; }
          to   { background-position: 0 4px; }
        }
        .landing-nav-link {
          font-family: var(--font-pixel), monospace;
          font-size: 7px;
          color: #9060c8;
          text-decoration: none;
          letter-spacing: 0.1em;
          transition: color 120ms ease;
        }
        .landing-nav-link:hover { color: #ff00cc; }
        .feature-card {
          background: #14082a;
          border: 3px solid #2d0d55;
          box-shadow: 4px 4px 0 #000;
          padding: 24px;
          transition: border-color 150ms ease;
        }
        .feature-card:hover {
          border-color: #ff00cc;
        }
        .pixel-btn-primary {
          font-family: var(--font-pixel), monospace;
          font-size: 9px;
          letter-spacing: 0.08em;
          background: #ff00cc;
          color: #000;
          border: 3px solid #ff66ee;
          box-shadow: 4px 4px 0 #000;
          padding: 12px 22px;
          cursor: pointer;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          transition: transform 80ms ease, box-shadow 80ms ease;
        }
        .pixel-btn-primary:active {
          transform: translate(3px, 3px);
          box-shadow: 1px 1px 0 #000;
        }
        .pixel-btn-secondary {
          font-family: var(--font-pixel), monospace;
          font-size: 9px;
          letter-spacing: 0.08em;
          background: transparent;
          color: #9060c8;
          border: 3px solid #2d0d55;
          box-shadow: 4px 4px 0 #000;
          padding: 12px 22px;
          cursor: pointer;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          transition: border-color 120ms ease, color 120ms ease, transform 80ms ease, box-shadow 80ms ease;
        }
        .pixel-btn-secondary:hover {
          border-color: #3d1468;
          color: #f0e0ff;
        }
        .pixel-btn-secondary:active {
          transform: translate(3px, 3px);
          box-shadow: 1px 1px 0 #000;
        }
      `}</style>

      <div style={{ background: '#08000f', color: '#f0e0ff', minHeight: '100vh', overflowX: 'hidden' }}>

        {/* ── Nav ─────────────────────────────────────────────────────── */}
        <nav
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 48px',
            height: '60px',
            borderBottom: '3px solid #2d0d55',
            background: '#08000f',
            position: 'sticky',
            top: 0,
            zIndex: 50,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                background: 'linear-gradient(90deg, #ff00cc, #00aaff)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <span style={{ fontFamily: 'var(--font-pixel), monospace', fontSize: '10px', color: '#000' }}>R</span>
            </div>
            <span style={{ fontFamily: 'var(--font-pixel), monospace', fontSize: '9px', color: '#f0e0ff', letterSpacing: '0.12em' }}>
              RIVALIZE
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
            <a href="#how-it-works" className="landing-nav-link">HOW IT WORKS</a>
            <a href="#features" className="landing-nav-link">FEATURES</a>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Link href="/login" className="landing-nav-link">SIGN IN</Link>
            <Link href="/signup" className="pixel-btn-primary" style={{ fontSize: '7px', padding: '8px 14px' }}>
              GET STARTED
            </Link>
          </div>
        </nav>

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section
          style={{
            position: 'relative',
            overflow: 'hidden',
            minHeight: '600px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '64px 48px',
            gap: '48px',
          }}
        >
          {/* Synthwave sky bg */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(180deg, #000010 0%, #0d0020 40%, #1a003a 70%, #14082a 100%)',
              zIndex: 0,
            }}
          />

          {/* Pixel sun */}
          <div
            style={{
              position: 'absolute',
              top: '60px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '160px',
              height: '80px',
              background: 'linear-gradient(180deg, #ffaa00 0%, #ff6600 100%)',
              boxShadow: '0 0 60px rgba(255,150,0,0.5), 0 0 120px rgba(255,100,0,0.2)',
              zIndex: 1,
              overflow: 'hidden',
            }}
          >
            {/* Scanline bands */}
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  height: '6px',
                  background: 'rgba(0,0,0,0.5)',
                  top: `${i * 12 + 6}px`,
                }}
              />
            ))}
          </div>

          {/* Perspective grid floor */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '260px',
              zIndex: 1,
              overflow: 'hidden',
            }}
          >
            <svg
              width="100%"
              height="100%"
              viewBox="0 0 1200 260"
              preserveAspectRatio="none"
              style={{ display: 'block' }}
            >
              {/* Horizontal lines */}
              {[0.1, 0.2, 0.35, 0.5, 0.65, 0.8, 1.0].map((t, i) => {
                const y = 10 + t * 240
                return (
                  <line key={`h${i}`} x1="0" y1={y} x2="1200" y2={y}
                    stroke="#ff00cc" strokeWidth={i < 3 ? 1 : 2}
                    strokeOpacity={0.3 + t * 0.4} />
                )
              })}
              {/* Vertical lines converging to vanishing point */}
              {Array.from({ length: 16 }, (_, i) => {
                const x = (i / 15) * 1200
                return (
                  <line key={`v${i}`} x1="600" y1="10" x2={x} y2="260"
                    stroke="#ff00cc" strokeWidth="1.5"
                    strokeOpacity={0.35} />
                )
              })}
              {/* Horizon glow line */}
              <line x1="0" y1="10" x2="1200" y2="10"
                stroke="#ff00cc" strokeWidth="3" strokeOpacity="0.8" />
            </svg>
          </div>

          {/* CRT scanlines overlay */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.08) 3px, rgba(0,0,0,0.08) 4px)',
              zIndex: 2,
              pointerEvents: 'none',
            }}
          />

          {/* Left: Headline + CTAs */}
          <div style={{ position: 'relative', zIndex: 3, maxWidth: '520px', flex: '1 1 auto' }}>
            <div
              style={{
                fontFamily: 'var(--font-pixel), monospace',
                fontSize: '8px',
                color: '#ff00cc',
                letterSpacing: '0.16em',
                marginBottom: '16px',
                textShadow: '0 0 10px rgba(255,0,204,0.6)',
              }}
            >
              CS2 DEMO ANALYSIS
            </div>

            <h1
              style={{
                fontFamily: 'var(--font-display), "VT323", monospace',
                fontSize: 'clamp(52px, 6vw, 80px)',
                color: '#f0e0ff',
                lineHeight: 1.05,
                marginBottom: '16px',
                textShadow: '0 0 30px rgba(255,0,204,0.4), 4px 4px 0 #000',
              }}
            >
              KNOW YOUR<br />
              <span style={{ background: 'linear-gradient(90deg, #ff00cc, #00aaff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                ENEMY.
              </span>
            </h1>

            <p
              style={{
                fontFamily: 'var(--font-sans, "Plus Jakarta Sans"), sans-serif',
                fontSize: '15px',
                color: '#9060c8',
                lineHeight: 1.6,
                marginBottom: '32px',
                maxWidth: '400px',
              }}
            >
              Upload CS2 demos. Let AI build the anti-strat.
              Study opponents, find their patterns, and walk into every match prepared.
            </p>

            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
              <Link href="/signup" className="pixel-btn-primary">
                START FOR FREE
              </Link>
              <a href="#how-it-works" className="pixel-btn-secondary">
                SEE HOW IT WORKS
              </a>
            </div>
          </div>

          {/* Right: Chat mock */}
          <div style={{ position: 'relative', zIndex: 3, flexShrink: 0, width: '100%', maxWidth: '420px' }}>
            <HeroChatMock />
          </div>
        </section>

        {/* ── Ticker ───────────────────────────────────────────────────── */}
        <div
          style={{
            borderTop: '3px solid #2d0d55',
            borderBottom: '3px solid #2d0d55',
            background: '#0f0420',
            overflow: 'hidden',
            padding: '12px 0',
          }}
        >
          <div
            style={{
              display: 'flex',
              animation: 'ticker 20s linear infinite',
              whiteSpace: 'nowrap',
              width: 'max-content',
            }}
          >
            {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-pixel), monospace',
                    fontSize: '8px',
                    color: '#9060c8',
                    letterSpacing: '0.12em',
                    padding: '0 24px',
                  }}
                >
                  {item}
                </span>
                <span style={{ color: '#ff00cc', fontSize: '10px', textShadow: '0 0 8px #ff00cc' }}>·</span>
              </span>
            ))}
          </div>
        </div>

        {/* ── How It Works ─────────────────────────────────────────────── */}
        <section id="how-it-works" style={{ padding: '80px 48px' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <div
              style={{
                fontFamily: 'var(--font-pixel), monospace',
                fontSize: '7px',
                color: '#5a2880',
                letterSpacing: '0.14em',
                marginBottom: '12px',
                textTransform: 'uppercase',
              }}
            >
              PLATFORM
            </div>
            <h2
              style={{
                fontFamily: 'var(--font-display), "VT323", monospace',
                fontSize: '52px',
                color: '#f0e0ff',
                textShadow: '0 0 20px rgba(255,0,204,0.3)',
                lineHeight: 1,
              }}
            >
              HOW IT WORKS
            </h2>
          </div>

          <div
            id="features"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '16px',
              maxWidth: '1000px',
              margin: '0 auto',
            }}
          >
            {FEATURES.map(({ tag, title, desc }) => (
              <div key={title} className="feature-card">
                <div
                  style={{
                    fontFamily: 'var(--font-pixel), monospace',
                    fontSize: '6px',
                    color: '#ff00cc',
                    letterSpacing: '0.1em',
                    background: 'rgba(255,0,204,0.1)',
                    border: '2px solid rgba(255,0,204,0.3)',
                    padding: '3px 7px',
                    display: 'inline-block',
                    marginBottom: '14px',
                  }}
                >
                  {tag}
                </div>
                <h3
                  style={{
                    fontFamily: 'var(--font-pixel), monospace',
                    fontSize: '9px',
                    color: '#f0e0ff',
                    letterSpacing: '0.06em',
                    marginBottom: '12px',
                    lineHeight: 1.6,
                  }}
                >
                  {title}
                </h3>
                <p
                  style={{
                    fontFamily: 'var(--font-sans, "Plus Jakarta Sans"), sans-serif',
                    fontSize: '13px',
                    color: '#9060c8',
                    lineHeight: 1.6,
                  }}
                >
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA ──────────────────────────────────────────────────────── */}
        <section
          style={{
            padding: '80px 48px',
            textAlign: 'center',
            borderTop: '3px solid #2d0d55',
            background: '#0f0420',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Radial glow */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(ellipse at 50% 50%, rgba(255,0,204,0.08) 0%, transparent 70%)',
              pointerEvents: 'none',
            }}
          />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <h2
              style={{
                fontFamily: 'var(--font-display), "VT323", monospace',
                fontSize: '56px',
                color: '#f0e0ff',
                textShadow: '0 0 24px rgba(255,0,204,0.4)',
                marginBottom: '16px',
                lineHeight: 1,
              }}
            >
              READY TO WIN?
            </h2>
            <p
              style={{
                fontFamily: 'var(--font-sans, "Plus Jakarta Sans"), sans-serif',
                fontSize: '15px',
                color: '#9060c8',
                maxWidth: '480px',
                margin: '0 auto 32px',
                lineHeight: 1.6,
              }}
            >
              Rivalize gives your team the intel to prepare smarter, react faster, and dominate every match.
            </p>
            <Link href="/signup" className="pixel-btn-primary" style={{ fontSize: '9px', padding: '14px 28px' }}>
              GET STARTED FREE
            </Link>
          </div>
        </section>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <footer
          style={{
            borderTop: '3px solid #2d0d55',
            padding: '24px 48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '22px',
                height: '22px',
                background: 'linear-gradient(90deg, #ff00cc, #00aaff)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ fontFamily: 'var(--font-pixel), monospace', fontSize: '8px', color: '#000' }}>R</span>
            </div>
            <span style={{ fontFamily: 'var(--font-pixel), monospace', fontSize: '7px', color: '#5a2880', letterSpacing: '0.1em' }}>
              RIVALIZE
            </span>
          </div>

          <div style={{ display: 'flex', gap: '24px' }}>
            {['Privacy', 'Terms'].map((l) => (
              <a
                key={l}
                href="#"
                style={{
                  fontFamily: 'var(--font-pixel), monospace',
                  fontSize: '6px',
                  color: '#5a2880',
                  textDecoration: 'none',
                  letterSpacing: '0.08em',
                }}
              >
                {l.toUpperCase()}
              </a>
            ))}
          </div>

          <span style={{ fontFamily: 'var(--font-sans, "Plus Jakarta Sans"), sans-serif', fontSize: '11px', color: '#5a2880' }}>
            © 2026 Rivalize
          </span>
        </footer>
      </div>
    </>
  )
}
