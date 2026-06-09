'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Bell, Menu } from 'lucide-react'

export default function MobileTopBar() {
  const [notifCount, setNotifCount] = useState(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    Promise.all([
      fetch('/api/friends/pending-count').then(r => r.ok ? r.json() : { count: 0 }),
      fetch('/api/notifications').then(r => r.ok ? r.json() : { notifications: [] }),
    ]).then(([friends, notifs]) => {
      const demoCount = (notifs.notifications ?? []).filter(
        (n: { type: string }) => n.type === 'demo_ready'
      ).length
      setNotifCount((friends.count ?? 0) + demoCount)
    }).catch(() => {})
  }, [])

  const openMenu = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('rv-open-menu'))
    }
  }

  return (
    <header
      className="md:hidden sticky top-0 z-30 flex items-center justify-between h-14 shrink-0"
      style={{
        background: 'color-mix(in srgb, var(--panel) 90%, transparent)',
        borderBottom: '1px solid var(--border)',
        paddingLeft: 'max(16px, env(safe-area-inset-left))',
        paddingRight: 'max(16px, env(safe-area-inset-right))',
        backdropFilter: 'blur(20px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
      }}
    >
      {/* Hamburger */}
      <button
        onClick={openMenu}
        aria-label="Open navigation menu"
        className="flex items-center justify-center active:scale-90"
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          background: 'transparent',
          border: 'none',
          color: 'var(--muted)',
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'color 0.15s, transform 0.1s',
          WebkitTapHighlightColor: 'transparent',
          marginLeft: -8,
        }}
      >
        <Menu size={22} strokeWidth={1.8} aria-hidden="true" />
      </button>

      {/* Logo */}
      <Link
        href="/dashboard"
        className="flex items-center gap-2"
        style={{ textDecoration: 'none' }}
        aria-label="Rivalize home"
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: 'linear-gradient(145deg, var(--accent), var(--accent-deep))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 2px 8px color-mix(in srgb, var(--accent) 40%, transparent)',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M4 3h8L9 9h7L7 18l2-6H5L4 3z" fill="#fff" />
          </svg>
        </div>
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 15,
            color: 'var(--text)',
            letterSpacing: '0.14em',
          }}
        >
          RIVALIZE
        </span>
      </Link>

      {/* Notification bell */}
      <button
        aria-label={notifCount > 0 ? `${notifCount} notifications` : 'Notifications'}
        className="flex items-center justify-center active:scale-90 relative"
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          background: 'transparent',
          border: 'none',
          color: 'var(--muted)',
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'color 0.15s, transform 0.1s',
          WebkitTapHighlightColor: 'transparent',
          marginRight: -8,
        }}
      >
        <Bell size={20} strokeWidth={1.8} aria-hidden="true" />
        {mounted && notifCount > 0 && (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              minWidth: 16,
              height: 16,
              borderRadius: 9,
              background: 'var(--loss)',
              color: '#fff',
              fontSize: 9,
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 3px',
              lineHeight: 1,
            }}
          >
            {notifCount > 9 ? '9+' : notifCount}
          </span>
        )}
      </button>
    </header>
  )
}
