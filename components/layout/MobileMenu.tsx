'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { SidebarNav } from './Sidebar'
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
  const initials = displayName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <>
      {/* Floating hamburger */}
      <button
        onClick={() => setIsOpen(true)}
        className="md:hidden fixed top-3.5 left-3.5 z-50 flex items-center justify-center w-9 h-9"
        style={{
          background: '#0f0420',
          border: '3px solid #2d0d55',
          boxShadow: '3px 3px 0 #000',
          color: '#9060c8',
        }}
        aria-label="Open navigation"
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = '#ff00cc'
          e.currentTarget.style.color = '#ff00cc'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = '#2d0d55'
          e.currentTarget.style.color = '#9060c8'
        }}
      >
        <Menu size={16} />
      </button>

      {/* Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] md:hidden">
          <div
            className="absolute inset-0 bg-black/80"
            onClick={() => setIsOpen(false)}
          />

          <div
            className="absolute left-0 top-0 h-full w-[224px] flex flex-col"
            style={{
              background: '#0f0420',
              borderRight: '3px solid #2d0d55',
              boxShadow: '4px 0 0 #000',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                height: '56px',
                padding: '0 14px',
                borderBottom: '3px solid #2d0d55',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
                  <span
                    style={{
                      fontFamily: 'var(--font-pixel), monospace',
                      fontSize: '10px',
                      color: '#000',
                      fontWeight: 400,
                      lineHeight: 1,
                    }}
                  >
                    R
                  </span>
                </div>
                <span
                  style={{
                    fontFamily: 'var(--font-pixel), monospace',
                    fontSize: '8px',
                    color: '#f0e0ff',
                    letterSpacing: '0.12em',
                    userSelect: 'none',
                  }}
                >
                  RIVALIZE
                </span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '28px',
                  height: '28px',
                  border: '2px solid #2d0d55',
                  background: 'transparent',
                  color: '#9060c8',
                  cursor: 'pointer',
                }}
                aria-label="Close menu"
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#ff00cc'
                  e.currentTarget.style.borderColor = '#ff00cc'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#9060c8'
                  e.currentTarget.style.borderColor = '#2d0d55'
                }}
              >
                <X size={14} />
              </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto" style={{ padding: '14px 0' }}>
              <SidebarNav onLinkClick={() => setIsOpen(false)} />
            </nav>

            {/* User section */}
            <div
              style={{
                borderTop: '3px solid #2d0d55',
                padding: '10px',
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 4px' }}>
                {/* Avatar */}
                {profile?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.avatar_url}
                    alt={displayName}
                    style={{
                      width: '28px',
                      height: '28px',
                      objectFit: 'cover',
                      border: '3px solid #00aaff',
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      background: 'rgba(0, 170, 255, 0.15)',
                      border: '3px solid #00aaff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--font-pixel), monospace',
                        fontSize: '7px',
                        color: '#00aaff',
                      }}
                    >
                      {initials}
                    </span>
                  </div>
                )}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p
                    style={{
                      fontFamily: 'var(--font-pixel), monospace',
                      fontSize: '7px',
                      color: '#f0e0ff',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      letterSpacing: '0.06em',
                    }}
                  >
                    {displayName.toUpperCase()}
                  </p>
                  {profile?.username && (
                    <p
                      style={{
                        fontSize: '10px',
                        color: '#5a2880',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        marginTop: '2px',
                      }}
                    >
                      @{profile.username}
                    </p>
                  )}
                </div>
              </div>

              <button
                onClick={handleLogout}
                disabled={loggingOut}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  width: '100%',
                  padding: '7px 10px',
                  fontFamily: 'var(--font-pixel), monospace',
                  fontSize: '7px',
                  letterSpacing: '0.1em',
                  color: '#9060c8',
                  background: 'transparent',
                  border: '3px solid #2d0d55',
                  boxShadow: '3px 3px 0 #000',
                  cursor: loggingOut ? 'not-allowed' : 'pointer',
                  opacity: loggingOut ? 0.5 : 1,
                  transition: 'color 120ms ease, border-color 120ms ease',
                }}
                onMouseEnter={(e) => {
                  if (!loggingOut) {
                    e.currentTarget.style.color = '#ff0066'
                    e.currentTarget.style.borderColor = '#ff0066'
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#9060c8'
                  e.currentTarget.style.borderColor = '#2d0d55'
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.boxShadow = '1px 1px 0 #000'
                  e.currentTarget.style.transform = 'translate(2px, 2px)'
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.boxShadow = '3px 3px 0 #000'
                  e.currentTarget.style.transform = 'none'
                }}
              >
                {loggingOut ? 'EXITING...' : 'EXIT'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
