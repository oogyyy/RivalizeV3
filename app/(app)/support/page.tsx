'use client'

import { useState } from 'react'
import { MessageSquare, BookOpen, Bug, Lightbulb, CreditCard, Terminal, ChevronRight, Send } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'

const CONTACT_CATEGORIES = [
  { id: 'general',   icon: MessageSquare, label: 'General Help',      desc: 'Questions about using Rivalize',         color: 'var(--accent)' },
  { id: 'bug',       icon: Bug,           label: 'Report a Bug',      desc: 'Something is not working correctly',      color: 'var(--loss)' },
  { id: 'feature',   icon: Lightbulb,     label: 'Feature Request',   desc: 'Suggest a new feature or improvement',    color: 'var(--tside)' },
  { id: 'billing',   icon: CreditCard,    label: 'Billing & Account', desc: 'Subscription or account issues',          color: 'var(--signal)' },
  { id: 'technical', icon: Terminal,      label: 'Technical Support', desc: 'API or integration help',                 color: 'var(--win)' },
]

const FAQ = [
  { q: 'How do I upload a demo?',                      a: 'Go to Opponents page, select a team folder, and use the Upload Demo button to add a .dem file.' },
  { q: 'How long does demo analysis take?',             a: 'Demo analysis typically takes 1–3 minutes depending on file size and server load.' },
  { q: 'How do I create a team?',                       a: 'Navigate to My Team and use the Create Team button in the header actions.' },
  { q: 'Can I share scouting data with teammates?',     a: 'Yes — invite teammates from My Team and they will have access to all shared scouting data.' },
  { q: 'What demo formats are supported?',              a: 'Rivalize supports CS2 .dem files from Matchmaking, FACEIT, and ESL platforms.' },
]

export default function SupportPage() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  const handleSend = () => {
    if (!message.trim()) return
    setSent(true)
    setMessage('')
    setTimeout(() => setSent(false), 3000)
  }

  return (
    <div className="p-5 md:p-7 space-y-6 max-w-4xl">
      <PageHeader
        label="Support"
        title="Help & Contact"
        description="Get help with Rivalize or contact our support team"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Contact form */}
        <div className="space-y-4">
          {/* Categories */}
          <div className="rv-panel overflow-hidden">
            <div className="al-accent" style={{ position: 'absolute', top: 0, left: 0, right: 0 }} />
            <div className="p-5">
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>Get in Touch</p>
              <div className="space-y-2">
                {CONTACT_CATEGORIES.map((cat) => {
                  const Icon = cat.icon
                  const isSelected = selectedCategory === cat.id
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(isSelected ? null : cat.id)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                        background: isSelected ? `color-mix(in srgb, ${cat.color} 12%, transparent)` : 'transparent',
                        border: `1px solid ${isSelected ? `color-mix(in srgb, ${cat.color} 35%, transparent)` : 'var(--border)'}`,
                        transition: 'all 0.14s ease', textAlign: 'left',
                      }}
                      onMouseEnter={e => { if (!isSelected) { (e.currentTarget as HTMLButtonElement).style.background = 'var(--hairline)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-2)' } }}
                      onMouseLeave={e => { if (!isSelected) { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)' } }}
                    >
                      <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `color-mix(in srgb, ${cat.color} 15%, transparent)`, border: `1px solid color-mix(in srgb, ${cat.color} 30%, transparent)` }}>
                        <Icon size={15} style={{ color: cat.color }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{cat.label}</p>
                        <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{cat.desc}</p>
                      </div>
                      <ChevronRight size={14} style={{ color: 'var(--faint)', flexShrink: 0 }} />
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Message form */}
          <div className="rv-panel p-5">
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>Send a Message</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Describe your issue or question…"
                rows={5}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 10, background: 'var(--card-2)', border: '1px solid var(--border-2)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }}
              />
              <button
                onClick={handleSend}
                disabled={!message.trim()}
                style={{
                  height: 40, padding: '0 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                  cursor: message.trim() ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center',
                  background: message.trim() ? 'linear-gradient(180deg, var(--accent), var(--accent-deep))' : 'var(--elevated)',
                  color: message.trim() ? '#fff' : 'var(--faint)', border: 'none', transition: 'all 0.14s',
                }}
              >
                <Send size={14} />
                {sent ? 'Message sent!' : 'Send Message'}
              </button>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="rv-panel overflow-hidden" style={{ position: 'relative' }}>
          <div className="al-signal" style={{ position: 'absolute', top: 0, left: 0, right: 0 }} />
          <div className="p-5">
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>Frequently Asked Questions</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {FAQ.map((item, i) => (
                <div key={i} style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 14px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--hairline)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{item.q}</span>
                    <ChevronRight size={14} style={{ color: 'var(--faint)', transform: openFaq === i ? 'rotate(90deg)' : 'none', transition: 'transform 0.14s', flexShrink: 0 }} />
                  </button>
                  {openFaq === i && (
                    <div style={{ padding: '0 14px 12px', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>
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
        {[
          { label: 'Documentation', desc: 'Guides and reference', color: 'var(--accent)',  Icon: BookOpen },
          { label: 'Community',     desc: 'Discord & forums',     color: 'var(--signal)', Icon: MessageSquare },
          { label: 'Status Page',   desc: 'Uptime & incidents',   color: 'var(--win)',    Icon: Terminal },
        ].map(({ label, desc, color, Icon }) => (
          <div key={label} className="rv-panel lift p-4 cursor-pointer">
            <div style={{ width: 36, height: 36, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `color-mix(in srgb, ${color} 15%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`, marginBottom: 12 }}>
              <Icon size={16} style={{ color }} />
            </div>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{label}</p>
            <p style={{ fontSize: 11.5, color: 'var(--muted)' }}>{desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
