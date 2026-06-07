'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Target, LayoutDashboard, Users, Trophy, Brain, Map, BookOpen, Loader2 } from 'lucide-react'

interface Opponent {
  id: string
  opponent_display_name: string
  opponent_slug: string
}

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  description?: string
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, description: 'Overview & recent activity' },
  { label: 'Opponents', href: '/opponents', icon: Target, description: 'Scouting library' },
  { label: 'Pro Library', href: '/opponents/pro-demos', icon: Trophy, description: 'Professional demos' },
  { label: 'AI Scout', href: '/ai-coach', icon: Brain, description: 'AI-powered analysis' },
  { label: 'My Teams', href: '/my-team', icon: Users, description: 'Team roster & stats' },
  { label: 'PUGS', href: '/improve', icon: Users, description: 'Personal demos & individual coaching' },
  { label: 'Veto', href: '/veto', icon: Map, description: 'Map veto planner' },
  { label: 'Playbook', href: '/playbook', icon: BookOpen, description: 'Strategy playbook' },
  { label: 'Friends', href: '/friends', icon: Users, description: 'Manage friends' },
]

interface Props {
  open: boolean
  onClose: () => void
}

export default function CommandPalette({ open, onClose }: Props) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [opponents, setOpponents] = useState<Opponent[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const loadOpponents = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/opponents')
      if (res.ok) {
        const data = await res.json() as Opponent[]
        setOpponents(data)
      }
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIndex(0)
      loadOpponents()
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open, loadOpponents])

  const q = query.toLowerCase().trim()

  const filteredNav = q
    ? NAV_ITEMS.filter(n => n.label.toLowerCase().includes(q) || n.description?.toLowerCase().includes(q))
    : NAV_ITEMS

  const filteredOpponents = opponents.filter(o =>
    !q || o.opponent_display_name.toLowerCase().includes(q) || o.opponent_slug.toLowerCase().includes(q)
  )

  type Result =
    | { kind: 'nav'; item: NavItem }
    | { kind: 'opponent'; item: Opponent }

  const results: Result[] = [
    ...filteredNav.map(item => ({ kind: 'nav' as const, item })),
    ...filteredOpponents.map(item => ({ kind: 'opponent' as const, item })),
  ]

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  const navigate = useCallback((result: Result) => {
    if (result.kind === 'nav') {
      router.push(result.item.href)
    } else {
      router.push(`/opponents/${result.item.id}`)
    }
    onClose()
  }, [router, onClose])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex(i => Math.min(i + 1, results.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex(i => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (results[activeIndex]) navigate(results[activeIndex])
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, results, activeIndex, navigate, onClose])

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${activeIndex}"]`) as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '14vh',
      }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          width: '100%', maxWidth: 580,
          background: 'var(--elevated)',
          border: '1px solid var(--border-2)',
          borderRadius: 14,
          boxShadow: '0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)',
          overflow: 'hidden',
          margin: '0 16px',
        }}
      >
        {/* Input */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '0 16px', height: 52,
          borderBottom: '1px solid var(--border)',
        }}>
          {loading
            ? <Loader2 size={16} style={{ color: 'var(--faint)', flexShrink: 0, animation: 'spin 1s linear infinite' }} />
            : <Search size={16} style={{ color: 'var(--faint)', flexShrink: 0 }} />
          }
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search opponents, pages, players…"
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--text)', fontSize: 14, fontFamily: 'var(--font-ui)',
            }}
          />
          <kbd style={{
            fontSize: 10, fontFamily: 'var(--font-mono)',
            color: 'var(--faint)', border: '1px solid var(--border)',
            borderRadius: 5, padding: '2px 6px', flexShrink: 0,
          }}>ESC</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} style={{ maxHeight: 400, overflowY: 'auto', padding: '8px 0' }}>
          {results.length === 0 && !loading ? (
            <div style={{
              padding: '32px 16px', textAlign: 'center',
              color: 'var(--faint)', fontSize: 13, fontFamily: 'var(--font-ui)',
            }}>
              No results for &ldquo;{query}&rdquo;
            </div>
          ) : (
            <>
              {/* Nav section */}
              {filteredNav.length > 0 && (
                <>
                  <div style={{
                    padding: '2px 16px 4px',
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
                    textTransform: 'uppercase', color: 'var(--faint)',
                    fontFamily: 'var(--font-ui)',
                  }}>
                    Navigation
                  </div>
                  {filteredNav.map((item, i) => {
                    const idx = i
                    const active = idx === activeIndex
                    const Icon = item.icon
                    return (
                      <button
                        key={item.href}
                        data-idx={idx}
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={() => navigate({ kind: 'nav', item })}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          width: '100%', padding: '8px 16px',
                          background: active ? 'var(--hairline)' : 'transparent',
                          border: 'none', cursor: 'pointer',
                          textAlign: 'left', transition: 'background 0.1s',
                        }}
                      >
                        <div style={{
                          width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                          background: active ? 'var(--accent-soft)' : 'var(--card)',
                          border: '1px solid var(--border)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Icon size={14} style={{ color: active ? 'var(--accent)' : 'var(--muted)' }} />
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-ui)' }}>
                            {item.label}
                          </div>
                          {item.description && (
                            <div style={{ fontSize: 11, color: 'var(--faint)', fontFamily: 'var(--font-ui)' }}>
                              {item.description}
                            </div>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </>
              )}

              {/* Opponents section */}
              {filteredOpponents.length > 0 && (
                <>
                  <div style={{
                    padding: `${filteredNav.length > 0 ? '10px' : '2px'} 16px 4px`,
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
                    textTransform: 'uppercase', color: 'var(--faint)',
                    fontFamily: 'var(--font-ui)',
                  }}>
                    Opponents
                  </div>
                  {filteredOpponents.map((item, i) => {
                    const idx = filteredNav.length + i
                    const active = idx === activeIndex
                    return (
                      <button
                        key={item.id}
                        data-idx={idx}
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={() => navigate({ kind: 'opponent', item })}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          width: '100%', padding: '8px 16px',
                          background: active ? 'var(--hairline)' : 'transparent',
                          border: 'none', cursor: 'pointer',
                          textAlign: 'left', transition: 'background 0.1s',
                        }}
                      >
                        <div style={{
                          width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                          background: active ? 'rgba(255,50,50,0.12)' : 'var(--card)',
                          border: '1px solid var(--border)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Target size={14} style={{ color: active ? '#ff6060' : 'var(--muted)' }} />
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-ui)' }}>
                            {item.opponent_display_name}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--faint)', fontFamily: 'var(--font-ui)' }}>
                            {item.opponent_slug}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </>
              )}
            </>
          )}
        </div>

        {/* Footer hint */}
        <div style={{
          padding: '8px 16px',
          borderTop: '1px solid var(--border)',
          display: 'flex', gap: 14, alignItems: 'center',
        }}>
          {[
            ['↑↓', 'navigate'],
            ['↵', 'open'],
            ['esc', 'close'],
          ].map(([key, label]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <kbd style={{
                fontSize: 10, fontFamily: 'var(--font-mono)',
                color: 'var(--faint)', border: '1px solid var(--border)',
                borderRadius: 4, padding: '1px 5px',
              }}>{key}</kbd>
              <span style={{ fontSize: 11, color: 'var(--faint)', fontFamily: 'var(--font-ui)' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
