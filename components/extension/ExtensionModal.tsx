'use client'

import { useEffect, useState } from 'react'
import { X, Download, Puzzle } from 'lucide-react'

const DISMISSED_KEY = 'rv-ext-modal-dismissed'
const DETECTED_KEY  = 'rv-ext-detected'

const CHROME_URL = 'https://github.com/oogyyy/rivalizev3/tree/main/extension'
const FIREFOX_URL = 'https://github.com/oogyyy/rivalizev3/tree/main/extension'

export default function ExtensionModal() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    // Hide if already installed
    if (localStorage.getItem(DETECTED_KEY) === '1') return
    // Hide if already dismissed
    if (localStorage.getItem(DISMISSED_KEY) === '1') return
    // Show after a short delay so the page settles first
    const t = setTimeout(() => setOpen(true), 1500)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'RIVALIZE_EXT_INSTALLED') {
        localStorage.setItem(DETECTED_KEY, '1')
        setOpen(false)
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1')
    setOpen(false)
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={dismiss}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-[420px] rounded-2xl border overflow-hidden"
        style={{ background: 'var(--panel)', borderColor: 'var(--border-2)' }}
      >
        {/* Close */}
        <button
          onClick={dismiss}
          className="absolute top-4 right-4 text-[var(--muted)] hover:text-[var(--text)] transition-colors"
        >
          <X size={16} />
        </button>

        {/* Header strip */}
        <div className="px-6 pt-6 pb-5 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4"
            style={{ background: 'color-mix(in srgb, var(--accent) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)' }}>
            <Puzzle size={22} style={{ color: 'var(--accent)' }} />
          </div>
          <h2 className="text-[17px] font-bold tracking-tight mb-2" style={{ color: 'var(--text)' }}>
            Import demos straight from FACEIT
          </h2>
          <p className="text-[13px] leading-relaxed" style={{ color: 'var(--muted)' }}>
            The Rivalize browser extension adds an <strong style={{ color: 'var(--text)' }}>Import to Rivalize</strong> button
            directly on FACEIT match pages — send any demo to your personal library, team, or opponents folder in one click.
          </p>
        </div>

        {/* Feature list */}
        <div className="mx-6 mb-5 rounded-xl p-4 space-y-2.5" style={{ background: 'var(--elevated)', border: '1px solid var(--border)' }}>
          {[
            'Import demos directly from any FACEIT match page',
            'Choose: Personal library, My Team, or Opponents',
            'Works in Chrome, Firefox, Edge, and Brave',
          ].map(f => (
            <div key={f} className="flex items-start gap-2.5">
              <span className="mt-0.5 text-[11px] font-bold shrink-0" style={{ color: 'var(--accent)' }}>✓</span>
              <span className="text-[12.5px]" style={{ color: 'var(--muted)' }}>{f}</span>
            </div>
          ))}
        </div>

        {/* Buttons */}
        <div className="px-6 pb-6 flex flex-col gap-2.5">
          <div className="grid grid-cols-2 gap-2">
            <a
              href={CHROME_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-lg py-2.5 text-[13px] font-semibold transition-opacity hover:opacity-80"
              style={{ background: 'var(--accent)', color: '#000' }}
            >
              <Download size={14} />
              Chrome / Edge
            </a>
            <a
              href={FIREFOX_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-lg py-2.5 text-[13px] font-semibold transition-colors"
              style={{ background: 'var(--elevated)', color: 'var(--text)', border: '1px solid var(--border-2)' }}
            >
              <Download size={14} />
              Firefox
            </a>
          </div>
          <button
            onClick={dismiss}
            className="text-[12px] transition-colors hover:text-[var(--text)]"
            style={{ color: 'var(--faint)' }}
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  )
}
