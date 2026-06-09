'use client'

import { useState } from 'react'
import { MessageSquare, BookOpen, Bug, Lightbulb, CreditCard, Terminal,
         ChevronRight, Send, CheckCircle, AlertCircle, Loader2, ExternalLink } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'

const CATEGORIES = [
  { id: 'general',   apiType: 'other',       icon: MessageSquare, label: 'General Help',      desc: 'Questions about using Rivalize',       color: 'var(--accent)' },
  { id: 'bug',       apiType: 'bug',          icon: Bug,           label: 'Report a Bug',      desc: 'Something is not working correctly',    color: 'var(--loss)' },
  { id: 'feature',   apiType: 'suggestion',   icon: Lightbulb,     label: 'Feature Request',   desc: 'Suggest a new feature or improvement',  color: 'var(--tside)' },
  { id: 'billing',   apiType: 'other',        icon: CreditCard,    label: 'Billing & Account', desc: 'Subscription or account issues',        color: 'var(--signal)' },
  { id: 'technical', apiType: 'other',        icon: Terminal,      label: 'Technical Support', desc: 'Demo upload, parsing, or API issues',   color: 'var(--win)' },
] as const

type CategoryId = typeof CATEGORIES[number]['id']

const FAQ = [
  { q: 'How do I upload a demo?',                   a: 'Go to Opponents, open or create a folder, then click the Upload Demo button to add a .dem or .zst file.' },
  { q: 'How long does demo analysis take?',          a: "Analysis typically takes 1–3 minutes depending on file size and server load. You'll get a notification when it's ready." },
  { q: 'How do I create a team?',                   a: 'Navigate to My Team and use the Create Team button. You can then invite teammates via their username.' },
  { q: 'Can I share scouting data with teammates?', a: 'Yes — teammates added to your team can view all shared demos, maps, and scouting reports.' },
  { q: 'What demo formats are supported?',          a: 'Rivalize supports CS2 .dem files from Matchmaking, FACEIT, and ESL. Compressed .zst files are also accepted.' },
  { q: 'Why is my demo stuck in "Queued"?',         a: 'The parsing queue processes demos in order. High traffic can cause short delays — usually under 5 minutes. Refresh the page to see the latest status.' },
]

const RESOURCES = [
  { label: 'Discord Community', desc: 'Get help & share clips',  color: 'var(--accent)',  Icon: MessageSquare, href: 'https://discord.gg/rivalize' },
  { label: 'Documentation',     desc: 'Guides and how-tos',      color: 'var(--signal)',  Icon: BookOpen,      href: 'https://rivalize.pro' },
  { label: 'Status Page',       desc: 'Uptime & incidents',      color: 'var(--win)',     Icon: Terminal,      href: 'https://rivalize.pro' },
]

type SendState = 'idle' | 'loading' | 'success' | 'error'

export default function SupportPage() {
  const [selectedCategory, setSelectedCategory] = useState<CategoryId>('general')
  const [message, setMessage]     = useState('')
  const [email, setEmail]         = useState('')
  const [sendState, setSendState] = useState<SendState>('idle')
  const [errorMsg, setErrorMsg]   = useState('')
  const [openFaq, setOpenFaq]     = useState<number | null>(null)

  const selectedCat = CATEGORIES.find(c => c.id === selectedCategory)!

  const handleSend = async () => {
    if (!message.trim() || sendState === 'loading') return
    setSendState('loading')
    setErrorMsg('')

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type:        selectedCat.apiType,
          title:       selectedCat.label,
          description: message.trim(),
          email:       email.trim() || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `Server error (${res.status})`)
      }

      setSendState('success')
      setMessage('')
      setEmail('')
    } catch (err) {
      setSendState('error')
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    }
  }

  return (
    <div className="p-5 md:p-7 space-y-6 max-w-4xl">
      <PageHeader
        label="Support"
        title="Help & Contact"
        description="Get help with Rivalize or send a message to the team"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Contact form */}
        <div className="space-y-4">
          {/* Category picker */}
          <div className="rv-panel overflow-hidden">
            <div className="al-accent" style={{ position: 'absolute', top: 0, left: 0, right: 0 }} />
            <div className="p-5">
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>
                What do you need help with?
              </p>
              <div className="space-y-2">
                {CATEGORIES.map((cat) => {
                  const Icon = cat.icon
                  const isSelected = selectedCategory === cat.id
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      aria-pressed={isSelected}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                        background: isSelected ? `color-mix(in srgb, ${cat.color} 12%, transparent)` : 'transparent',
                        border: `1px solid ${isSelected ? `color-mix(in srgb, ${cat.color} 35%, transparent)` : 'var(--border)'}`,
                        transition: 'all 0.14s ease', textAlign: 'left',
                        WebkitTapHighlightColor: 'transparent',
                      }}
                    >
                      <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `color-mix(in srgb, ${cat.color} 15%, transparent)`, border: `1px solid color-mix(in srgb, ${cat.color} 30%, transparent)` }}>
                        <Icon size={15} style={{ color: cat.color }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{cat.label}</p>
                        <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{cat.desc}</p>
                      </div>
                      <ChevronRight size={14} style={{ color: isSelected ? cat.color : 'var(--faint)', flexShrink: 0, transform: isSelected ? 'rotate(90deg)' : 'none', transition: 'transform 0.14s' }} />
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Message form */}
          <div className="rv-panel p-5">
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>
              Send a Message
            </p>

            {sendState === 'success' ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '24px 0', textAlign: 'center' }}>
                <CheckCircle size={36} style={{ color: 'var(--win)' }} />
                <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>Message received!</p>
                <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, maxWidth: 280 }}>
                  We'll get back to you as soon as possible. Check your email if you provided one.
                </p>
                <button
                  onClick={() => setSendState('idle')}
                  style={{ marginTop: 8, fontSize: 13, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                >
                  Send another message
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <textarea
                  value={message}
                  onChange={e => { setMessage(e.target.value); if (sendState === 'error') setSendState('idle') }}
                  placeholder={`Describe your ${selectedCat.label.toLowerCase()} in detail…`}
                  rows={5}
                  disabled={sendState === 'loading'}
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 10, background: 'var(--card-2)', border: '1px solid var(--border-2)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none', opacity: sendState === 'loading' ? 0.6 : 1 }}
                />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Your email (optional — for follow-up)"
                  disabled={sendState === 'loading'}
                  style={{ width: '100%', height: 40, padding: '0 14px', borderRadius: 10, background: 'var(--card-2)', border: '1px solid var(--border-2)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none', opacity: sendState === 'loading' ? 0.6 : 1 }}
                />

                {sendState === 'error' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 9, background: 'color-mix(in srgb, var(--loss) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--loss) 30%, transparent)' }}>
                    <AlertCircle size={14} style={{ color: 'var(--loss)', flexShrink: 0 }} />
                    <span style={{ fontSize: 12.5, color: 'var(--loss)' }}>{errorMsg}</span>
                  </div>
                )}

                <button
                  onClick={handleSend}
                  disabled={!message.trim() || sendState === 'loading'}
                  style={{
                    height: 40, padding: '0 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                    cursor: message.trim() && sendState !== 'loading' ? 'pointer' : 'default',
                    display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center',
                    background: message.trim() ? 'linear-gradient(180deg, var(--accent), var(--accent-deep))' : 'var(--elevated)',
                    color: message.trim() ? '#fff' : 'var(--faint)', border: 'none',
                    transition: 'all 0.14s', opacity: sendState === 'loading' ? 0.8 : 1,
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  {sendState === 'loading'
                    ? <><Loader2 size={14} className="animate-spin" /> Sending…</>
                    : <><Send size={14} /> Send Message</>
                  }
                </button>
              </div>
            )}
          </div>
        </div>

        {/* FAQ */}
        <div className="rv-panel overflow-hidden" style={{ position: 'relative', alignSelf: 'start' }}>
          <div className="al-signal" style={{ position: 'absolute', top: 0, left: 0, right: 0 }} />
          <div className="p-5">
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>
              Frequently Asked Questions
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {FAQ.map((item, i) => (
                <div key={i} style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    aria-expanded={openFaq === i}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 14px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', minHeight: 44, WebkitTapHighlightColor: 'transparent' }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{item.q}</span>
                    <ChevronRight size={14} style={{ color: 'var(--faint)', transform: openFaq === i ? 'rotate(90deg)' : 'none', transition: 'transform 0.14s', flexShrink: 0 }} />
                  </button>
                  {openFaq === i && (
                    <div style={{ padding: '0 14px 13px', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.65 }}>
                      {item.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Resource links */}
      <div className="grid grid-cols-3 gap-4">
        {RESOURCES.map(({ label, desc, color, Icon, href }) => (
          <a
            key={label}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="rv-panel lift p-4 block"
            style={{ textDecoration: 'none', cursor: 'pointer' }}
            aria-label={label}
          >
            <div style={{ width: 36, height: 36, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `color-mix(in srgb, ${color} 15%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`, marginBottom: 12 }}>
              <Icon size={16} style={{ color }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{label}</p>
              <ExternalLink size={11} style={{ color: 'var(--faint)', flexShrink: 0 }} />
            </div>
            <p style={{ fontSize: 11.5, color: 'var(--muted)' }}>{desc}</p>
          </a>
        ))}
      </div>
    </div>
  )
}
