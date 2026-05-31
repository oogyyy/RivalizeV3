'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Menu, X, LogOut } from 'lucide-react'
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

  const handleLogout = async () => {
    setLoggingOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const displayName = profile?.display_name || profile?.username || 'Player'
  const initials = displayName[0].toUpperCase()

  return (
    <>
      {/* Floating hamburger */}
      <button
        onClick={() => setIsOpen(true)}
        className="md:hidden fixed top-3.5 left-3.5 z-50 flex items-center justify-center w-9 h-9"
        style={{
          background: 'var(--panel)',
          border: '1px solid var(--border-2)',
          borderRadius: 9,
          color: 'var(--muted)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}
        aria-label="Open navigation"
      >
        <Menu size={18}/>
      </button>

      {/* Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] md:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />

          <div
            className="absolute left-0 top-0 h-full w-[220px] flex flex-col animate-slide-in"
            style={{
              background: 'var(--panel)',
              borderRight: '1px solid var(--border)',
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
                }}>
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
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
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 28, height: 28, borderRadius: 7,
                  border: '1px solid var(--border-2)',
                  background: 'transparent', color: 'var(--muted)', cursor: 'pointer',
                }}
                aria-label="Close menu"
              >
                <X size={14}/>
              </button>
            </div>

            {/* Navigation */}
            <nav style={{ flex: 1, overflowY: 'auto', padding: '14px 12px' }}>
              <SidebarNav onLinkClick={() => setIsOpen(false)} />
            </nav>

            {/* User section */}
            <div style={{ padding: '10px 8px 16px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
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
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: '7px 12px', borderRadius: 8,
                  background: 'transparent', border: 'none',
                  color: 'var(--loss)',
                  cursor: loggingOut ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-ui)', fontSize: 13,
                  outline: 'none', opacity: loggingOut ? 0.5 : 1,
                }}
              >
                <LogOut size={16}/>
                {loggingOut ? 'Signing out…' : 'Sign out'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
