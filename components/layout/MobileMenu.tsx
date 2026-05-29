'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Menu, X, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { SidebarNav } from './Sidebar'
import type { Profile } from '@/types/database'

interface MobileMenuProps {
  profile: Profile | null
}

export default function MobileMenu({ profile }: MobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/friends/pending-count')
      .then(r => r.ok ? r.json() : { count: 0 })
      .then((d: { count: number }) => setPendingCount(d.count))
      .catch(() => {})
  }, [])

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
          background: 'rgba(6,5,18,0.97)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 8,
          color: 'rgba(255,255,255,0.5)',
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
              background: 'rgba(6,5,18,0.98)',
              borderRight: '1px solid rgba(255,255,255,0.07)',
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '18px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
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
                  fontWeight: 800, fontSize: 15, color: '#fff', letterSpacing: '0.05em',
                }}>
                  RIVALIZE
                </span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 28, height: 28, borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'transparent', color: 'rgba(255,255,255,0.5)', cursor: 'pointer',
                }}
                aria-label="Close menu"
              >
                <X size={14}/>
              </button>
            </div>

            {/* Navigation */}
            <nav style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
              <SidebarNav onLinkClick={() => setIsOpen(false)} badges={{ '/friends': pendingCount }}/>
            </nav>

            {/* User section */}
            <div style={{ padding: '10px 8px 16px', borderTop: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 12px 8px' }}>
                {profile?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.avatar_url}
                    alt={displayName}
                    style={{
                      width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', flexShrink: 0,
                      border: '2px solid rgba(255,45,120,0.45)',
                    }}
                  />
                ) : (
                  <div style={{
                    width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                    background: 'rgba(255,45,120,0.16)', border: '2px solid rgba(255,45,120,0.45)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-sora, Sora), sans-serif',
                    fontWeight: 700, fontSize: 13, color: '#ff2d78',
                  }}>
                    {initials}
                  </div>
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 600, color: '#fff',
                    fontFamily: 'var(--font-inter, Inter), sans-serif',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {displayName}
                  </div>
                  {profile?.username && (
                    <div style={{
                      fontSize: 11, color: 'rgba(255,255,255,0.36)',
                      fontFamily: 'var(--font-inter, Inter), sans-serif',
                    }}>
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
                  padding: '7px 12px', borderRadius: 7,
                  background: 'transparent', border: 'none',
                  color: 'rgba(255,255,255,0.33)',
                  cursor: loggingOut ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-inter, Inter), sans-serif', fontSize: 13,
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
