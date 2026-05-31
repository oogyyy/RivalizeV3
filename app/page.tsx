'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Send, Minus, X, Upload, Brain, ArrowRight } from 'lucide-react'
import dynamic from 'next/dynamic'

/* ── Background ── */
function Background() {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden',
      background: 'linear-gradient(175deg, #09091a 0%, #0d0b24 45%, #090915 100%)',
    }}>
      <div style={{
        position: 'absolute', top: '38%', left: 0, right: 0, height: 160,
        background: 'radial-gradient(ellipse 70% 100% at 50% 50%, rgba(130,20,255,0.14) 0%, rgba(255,45,120,0.07) 60%, transparent 100%)',
        filter: 'blur(24px)',
      }}/>
      <div style={{
        position: 'absolute', bottom: '-12%', left: '-40%', right: '-40%', height: '62%',
        backgroundImage: `linear-gradient(rgba(255,45,120,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(255,45,120,0.1) 1px, transparent 1px)`,
        backgroundSize: '80px 80px',
        transform: 'perspective(650px) rotateX(65deg)',
        transformOrigin: '50% 0',
        maskImage: 'linear-gradient(to bottom, transparent 0%, black 28%)',
        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 28%)',
      }}/>
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
        <polyline points="0,600 60,440 140,360 210,420 280,310 340,390 280,530 180,570 0,720" fill="none" stroke="rgba(155,29,255,0.22)" strokeWidth="1.2"/>
        <polyline points="0,720 55,510 130,390 190,450 245,340 305,410 245,560 130,610 0,830" fill="none" stroke="rgba(155,29,255,0.1)" strokeWidth="0.8"/>
        <polyline points="1440,600 1380,440 1300,360 1230,420 1160,310 1100,390 1160,530 1260,570 1440,720" fill="none" stroke="rgba(255,45,120,0.18)" strokeWidth="1.2"/>
        <polyline points="1440,720 1385,510 1310,390 1250,450 1195,340 1135,410 1195,560 1310,610 1440,830" fill="none" stroke="rgba(255,45,120,0.09)" strokeWidth="0.8"/>
      </svg>
    </div>
  )
}

/* ── Logo ── */
function RivalizeLogo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        background: 'linear-gradient(135deg, #ff2d78 0%, #9b1dff 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 0 16px rgba(255,45,120,0.5)',
      }}>
        <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
          <path d="M4 3h8L9 9h7L7 18l2-6H5L4 3z" fill="white"/>
        </svg>
      </div>
      <span style={{
        fontFamily: 'var(--font-sora, Sora), sans-serif',
        fontWeight: 800, fontSize: 16, color: '#fff', letterSpacing: '0.05em',
      }}>RIVALIZE</span>
    </div>
  )
}

/* ── Hero Chat Widget (dynamically imported for faster initial load) ── */
const HeroChatWidget = dynamic(() => Promise.resolve(HeroChatWidgetInner), {
  ssr: false,
  loading: () => <div style={{ width: 348, height: 320, background: 'rgba(10,8,28,0.6)', borderRadius: 14 }} />,
})

function HeroChatWidgetInner() {
  const [chatInput, setChatInput] = useState('')
  const [messages, setMessages] = useState([
    { role: 'user', text: 'How do they play eco rounds?' },
    { role: 'ai', text: '68% of eco rounds: stack B with pistols, fast rush through tunnels, zero utility. Counter: single B anchor + 4-man A execute.' },
  ])

  const AI_RESPONSES = [
    'Based on 4 recorded demos, they run a default 2-1-2 on T-side with an aggressive mid-push at 1:20. Stack B with 3 players and smoke mid-door at round start.',
    "Their AWPer holds long-A at round start 78% of the time. Flash over the top before your A-main push and they'll be caught off-guard.",
    'On eco rounds they stack B tunnels with pistols. A single anchor on B + 4-man A execute counters them reliably.',
  ]

  const sendMsg = () => {
    if (!chatInput.trim()) return
    const q = chatInput
    setChatInput('')
    setMessages(m => [...m, { role: 'user', text: q }])
    setTimeout(() => {
      const resp = AI_RESPONSES[messages.length % AI_RESPONSES.length]
      setMessages(m => [...m, { role: 'ai', text: resp }])
    }, 900)
  }

  return (
    <div style={{
      width: 348, flexShrink: 0,
      background: 'rgba(10,8,28,0.92)',
      border: '1px solid rgba(255,45,120,0.22)',
      borderRadius: 14,
      boxShadow: '0 0 50px rgba(255,45,120,0.12), 0 24px 64px rgba(0,0,0,0.55)',
      backdropFilter: 'blur(16px)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '11px 16px',
        background: 'rgba(255,255,255,0.04)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 26, height: 26, borderRadius: 6,
          background: 'linear-gradient(135deg, #ff2d78, #9b1dff)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-space, Space Grotesk), sans-serif',
          fontWeight: 700, fontSize: 11, color: '#fff',
        }}>AI</div>
        <span style={{ fontFamily: 'var(--font-inter, Inter), sans-serif', fontSize: 13.5, fontWeight: 600, color: '#fff', flex: 1 }}>
          AI Scouting Chat
        </span>
        <Minus size={14} style={{ color: 'rgba(255,255,255,0.35)', cursor: 'pointer' }}/>
        <X size={14} style={{ color: 'rgba(255,255,255,0.35)', cursor: 'pointer', marginLeft: 6 }}/>
      </div>

      {/* Messages */}
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 190 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{
            display: 'flex', gap: 8, alignItems: 'flex-start',
            flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
          }}>
            {msg.role === 'ai' && (
              <div style={{
                width: 26, height: 26, borderRadius: 6, flexShrink: 0, marginTop: 2,
                background: 'linear-gradient(135deg, #ff2d78, #9b1dff)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                  <path d="M4 3h8L9 9h7L7 18l2-6H5L4 3z" fill="white"/>
                </svg>
              </div>
            )}
            <div style={{
              padding: '9px 12px', borderRadius: 10, maxWidth: '84%',
              background: msg.role === 'user' ? 'rgba(255,255,255,0.07)' : 'rgba(255,45,120,0.09)',
              border: msg.role === 'ai' ? '1px solid rgba(255,45,120,0.2)' : '1px solid rgba(255,255,255,0.07)',
            }}>
              {msg.role === 'user' && (
                <div style={{ fontFamily: 'var(--font-space, Space Grotesk), sans-serif', fontSize: 10.5, color: 'rgba(255,255,255,0.38)', marginBottom: 3 }}>
                  You:
                </div>
              )}
              <p style={{ fontFamily: 'var(--font-inter, Inter), sans-serif', fontSize: 12.5, color: 'rgba(255,255,255,0.85)', margin: 0, lineHeight: 1.6 }}>
                {msg.role === 'ai' ? (
                  <>
                    <span style={{ color: '#fff', fontWeight: 500 }}>AI Scout: </span>
                    {msg.text.split('Counter:')[0]}
                    {msg.text.includes('Counter:') && (
                      <><span style={{ color: '#00ffc8', fontWeight: 600 }}>Counter:</span>{msg.text.split('Counter:')[1]}</>
                    )}
                  </>
                ) : msg.text}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          value={chatInput}
          onChange={e => setChatInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMsg()}
          placeholder="Send a message…"
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            fontFamily: 'var(--font-inter, Inter), sans-serif',
            fontSize: 13, color: 'rgba(255,255,255,0.7)',
            boxShadow: 'none',
          }}
        />
        <button onClick={sendMsg} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', display: 'flex', padding: 4 }}>
          <Send size={16}/>
        </button>
      </div>
    </div>
  )
}

/* ── Main Page ── */
export default function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden', background: 'linear-gradient(175deg, #09091a 0%, #0d0b24 45%, #090915 100%)' }}>
      <Background/>

      {/* ── Nav ── */}
      <nav style={{
        position: 'relative', zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '18px 52px',
      }}>
        <RivalizeLogo/>
        <div style={{ display: 'flex', alignItems: 'center', gap: 36 }}>
          {[['HOW IT WORKS', '#how-it-works'], ['FEATURES', '#features']].map(([label, href]) => (
            <a key={label} href={href} style={{
              fontFamily: 'var(--font-space, Space Grotesk), sans-serif',
              fontSize: 12.5, fontWeight: 600, color: 'rgba(255,255,255,0.58)',
              textDecoration: 'none', letterSpacing: '0.08em',
            }}>
              {label}
            </a>
          ))}
          <Link href="/login" style={{
            fontFamily: 'var(--font-space, Space Grotesk), sans-serif',
            fontSize: 12.5, fontWeight: 600, color: 'rgba(255,255,255,0.58)',
            textDecoration: 'none', letterSpacing: '0.08em',
          }}>
            SIGN IN
          </Link>
        </div>
        <Link href="/signup" style={{
          padding: '10px 20px', borderRadius: 6, cursor: 'pointer',
          background: 'linear-gradient(135deg, #ff2d78, #cc0060)',
          border: 'none', color: '#fff',
          fontFamily: 'var(--font-space, Space Grotesk), sans-serif',
          fontSize: 13, fontWeight: 600, letterSpacing: '0.04em',
          display: 'inline-flex', alignItems: 'center', gap: 7,
          boxShadow: '0 0 18px rgba(255,45,120,0.32)',
          textDecoration: 'none', whiteSpace: 'nowrap',
        }}>
          GET STARTED
        </Link>
      </nav>

      {/* ── Hero ── */}
      <section style={{ position: 'relative', zIndex: 2, padding: '60px 52px 80px', display: 'flex', alignItems: 'center', gap: 56 }}>
        <div style={{ flex: 1, maxWidth: 520 }}>
          <h1 style={{
            fontFamily: 'var(--font-sora, Sora), sans-serif',
            fontWeight: 800,
            fontSize: 'clamp(54px, 7.5vw, 92px)',
            lineHeight: 0.95,
            color: '#ff2d78',
            textShadow: '0 0 50px rgba(255,45,120,0.38)',
            margin: '0 0 24px',
            letterSpacing: '-1.5px',
            textTransform: 'uppercase',
          }}>
            KNOW YOUR<br/>ENEMY
          </h1>
          <p style={{
            fontFamily: 'var(--font-inter, Inter), sans-serif',
            fontSize: 16, color: 'rgba(255,255,255,0.62)',
            lineHeight: 1.75, margin: '0 0 38px', maxWidth: 400,
          }}>
            Every demo. Every pattern. Before the match starts. Upload CS2 demos, let AI build the anti-strat, and walk into every match prepared.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
            <Link href="/signup" style={{
              padding: '13px 30px', borderRadius: 6,
              background: 'linear-gradient(135deg, #ff2d78, #cc0060)',
              color: '#fff', fontFamily: 'var(--font-space, Space Grotesk), sans-serif',
              fontSize: 14, fontWeight: 600, letterSpacing: '0.04em',
              display: 'inline-flex', alignItems: 'center',
              boxShadow: '0 0 18px rgba(255,45,120,0.32)',
              textDecoration: 'none', whiteSpace: 'nowrap',
            }}>
              START FOR FREE
            </Link>
            <a href="#how-it-works" style={{
              fontFamily: 'var(--font-space, Space Grotesk), sans-serif',
              fontSize: 13, fontWeight: 500,
              color: 'rgba(255,255,255,0.5)',
              textDecoration: 'none', letterSpacing: '0.05em',
            }}>
              SEE HOW IT WORKS →
            </a>
          </div>
        </div>

        <HeroChatWidget/>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" style={{ position: 'relative', zIndex: 2, padding: '60px 52px' }}>
        <h2 style={{
          fontFamily: 'var(--font-sora, Sora), sans-serif',
          fontWeight: 800, fontSize: 38, color: '#fff',
          textAlign: 'center', letterSpacing: '0.06em',
          marginBottom: 48, textTransform: 'uppercase',
        }}>
          HOW IT WORKS
        </h2>
        <div id="features" style={{ display: 'flex', gap: 20 }}>
          {[
            {
              Icon: Upload,
              title: 'DEMO PARSING',
              desc: 'Upload .dem files and get instant structural analysis. Supports all CS2 competitive demo formats.',
            },
            {
              Icon: Brain,
              title: 'AI SCOUTING',
              desc: "Ask tactical questions in plain language. The AI reads your opponent's patterns and answers in seconds.",
            },
            {
              Icon: ArrowRight,
              title: 'ANTI-STRAT',
              desc: 'Get counter-strategies for every opponent. Map-specific playbooks built from their own demo data.',
            },
          ].map(({ Icon, title, desc }, i) => (
            <div key={i} style={{
              flex: 1, padding: '28px 24px', borderRadius: 12,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.09)',
            }}>
              <div style={{
                color: '#ff2d78', marginBottom: 16, display: 'inline-block',
                padding: 8, background: 'rgba(255,45,120,0.1)', borderRadius: 8,
              }}>
                <Icon size={26}/>
              </div>
              <h3 style={{
                fontFamily: 'var(--font-space, Space Grotesk), sans-serif',
                fontWeight: 700, fontSize: 14.5, color: '#fff',
                margin: '0 0 10px', letterSpacing: '0.06em',
              }}>
                {title}
              </h3>
              <p style={{
                fontFamily: 'var(--font-inter, Inter), sans-serif',
                fontSize: 13.5, color: 'rgba(255,255,255,0.52)',
                lineHeight: 1.7, margin: 0,
              }}>
                {desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ position: 'relative', zIndex: 2, padding: '20px 52px 80px' }}>
        <div style={{
          padding: '56px 48px', borderRadius: 16, textAlign: 'center',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,45,120,0.18)',
          boxShadow: 'inset 0 0 50px rgba(255,45,120,0.05)',
        }}>
          <h2 style={{
            fontFamily: 'var(--font-sora, Sora), sans-serif',
            fontWeight: 800, fontSize: 36, color: '#fff',
            margin: '0 0 30px', letterSpacing: '0.05em', textTransform: 'uppercase',
          }}>
            READY TO WIN?
          </h2>
          <Link href="/signup" style={{
            display: 'inline-flex', margin: '0 auto',
            padding: '13px 34px', borderRadius: 6,
            background: 'linear-gradient(135deg, #ff2d78, #cc0060)',
            color: '#fff', fontFamily: 'var(--font-space, Space Grotesk), sans-serif',
            fontSize: 14, fontWeight: 600, letterSpacing: '0.04em',
            boxShadow: '0 0 18px rgba(255,45,120,0.32)',
            textDecoration: 'none',
          }}>
            GET STARTED FREE
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{
        position: 'relative', zIndex: 2,
        padding: '22px 52px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <RivalizeLogo/>
        <div style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
          {['PRIVACY', 'TERMS'].map(l => (
            <a key={l} href="#" style={{
              fontFamily: 'var(--font-space, Space Grotesk), sans-serif',
              fontSize: 12, color: 'rgba(255,255,255,0.38)',
              textDecoration: 'none', letterSpacing: '0.06em',
            }}>
              {l}
            </a>
          ))}
          <span style={{
            fontFamily: 'var(--font-space, Space Grotesk), sans-serif',
            fontSize: 12, color: 'rgba(255,255,255,0.22)',
          }}>
            © 2026 Rivalize
          </span>
        </div>
      </footer>
    </div>
  )
}
