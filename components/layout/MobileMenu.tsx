'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { X, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { SidebarNav } from '@/components/layout/Sidebar'
import type { Profile } from '@/types/database'

interface MobileMenuProps {
  profile: Profile | null
}

export default function MobileMenu({ profile }: MobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const router = useRouter()

  // Listen for open trigger from BottomNav or MobileTopBar
  useEffect(() => {
    const handler = () => setIsOpen(true)
    window.addEventListener('rv-open-menu', handler)
    return () => window.removeEventListener('rv-open-menu', handler)
  }, [])

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    if (isOpen) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen])

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  const handleLogout = async () => {
    setLoggingOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const displayName = profile?.display_name || profile?.username || 'Player'
  const initials = displayName[0].toUpperCase()

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] md:hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className="absolute left-0 top-0 h-full w-[240px] flex flex-col animate-slide-in"
        style={{
          background: 'var(--panel)',
          borderRight: '1px solid var(--border)',
          paddingTop: 'env(safe-area-inset-top, 0px)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 18px 16px', borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 9,
              background: 'linear-gradient(145deg, var(--accent), var(--accent-deep))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 10px color-mix(in srgb, var(--accent) 40%, transparent)',
              flexShrink: 0,
            }}>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M4 3h8L9 9h7L7 18l2-6H5L4 3z" fill="white"/>
              </svg>
            </div>
            <div style={{ lineHeight: 1 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: 'var(--text)', letterSpacing: '0.14em' }}>RIVALIZE</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: 'var(--signal)', letterSpacing: '0.34em', marginTop: 4 }}>PRO · SCOUT</div>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            aria-label="Close navigation menu"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 36, height: 36, borderRadius: 9,
              border: '1px solid var(--border-2)',
              background: 'transparent', color: 'var(--muted)', cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {/* Navigation */}
        <nav aria-label="App navigation" style={{ flex: 1, overflowY: 'auto', padding: '14px 12px' }}>
          <SidebarNav onLinkClick={() => setIsOpen(false)} />
        </nav>

        {/* User section */}
        <div style={{
          padding: '10px 8px',
          paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))',
          borderTop: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 12px 8px' }}>
            {profile?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar_url}
                alt={displayName}
                style={{
                  width: 32, height: 32, borderRadius: 9, objectFit: 'cover', flexShrink: 0,
                  border: '1px solid var(--accent-line)',
                }}
              />
            ) : (
              <div style={{
                width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                background: 'var(--accent-soft)', border: '1px solid var(--accent-line)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-display)',
                fontWeight: 700, fontSize: 13, color: 'var(--accent)',
              }}>
                {initials}
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: 13, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-ui)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {displayName}
              </div>
              {profile?.username && (
                <div style={{ fontSize: 11, color: 'var(--faint)', fontFamily: 'var(--font-mono)' }}>
                  @{profile.username}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            aria-label="Sign out"
            style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: '9px 12px', borderRadius: 8,
              background: 'transparent', border: 'none',
              color: 'var(--loss)',
              cursor: loggingOut ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-ui)', fontSize: 13,
              outline: 'none', opacity: loggingOut ? 0.5 : 1,
              minHeight: 44,
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <LogOut size={16} aria-hidden="true" />
            {loggingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </div>
    </div>
  )
}
