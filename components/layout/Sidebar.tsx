'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { Profile } from '@/types/database'

interface SidebarProps {
  profile: Profile | null
  onLinkClick?: () => void
}

const navGroups = [
  {
    label: 'WORKSPACE',
    items: [
      { href: '/dashboard', label: 'DASHBOARD' },
      { href: '/my-team',   label: 'MY TEAM' },
    ],
  },
  {
    label: 'SCOUTING',
    items: [
      { href: '/opponents', label: 'OPPONENTS' },
      { href: '/ai-coach',  label: 'AI SCOUT', badge: 'AI' },
    ],
  },
  {
    label: 'ACCOUNT',
    items: [
      { href: '/profile',  label: 'PROFILE' },
      { href: '/settings', label: 'SETTINGS' },
    ],
  },
]

export const navLinks = [
  { href: '/dashboard', label: 'DASHBOARD' },
  { href: '/my-team',   label: 'MY TEAM' },
  { href: '/opponents', label: 'OPPONENTS' },
  { href: '/ai-coach',  label: 'AI SCOUT' },
  { href: '/profile',   label: 'PROFILE' },
  { href: '/settings',  label: 'SETTINGS' },
]

/** Shared nav list used by MobileMenu (mobile drawer). */
export function SidebarNav({ onLinkClick }: { onLinkClick?: () => void }) {
  const pathname = usePathname()
  return (
    <div className="flex flex-col gap-4">
      {navGroups.map(({ label, items }) => (
        <div key={label}>
          <div
            style={{
              fontFamily: 'var(--font-pixel), monospace',
              fontSize: '6px',
              letterSpacing: '0.12em',
              color: '#5a2880',
              padding: '0 8px 6px 8px',
              textTransform: 'uppercase',
            }}
          >
            {label}
          </div>
          {items.map(({ href, label: itemLabel, badge }) => {
            const isActive = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                onClick={onLinkClick}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 10px',
                  fontFamily: 'var(--font-pixel), monospace',
                  fontSize: '7px',
                  letterSpacing: '0.08em',
                  textDecoration: 'none',
                  borderLeft: isActive ? '4px solid #ff00cc' : '4px solid transparent',
                  background: isActive ? 'rgba(255, 0, 204, 0.12)' : 'transparent',
                  color: isActive ? '#ff00cc' : '#9060c8',
                  transition: 'background 120ms ease, color 120ms ease',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'rgba(255, 0, 204, 0.06)'
                    e.currentTarget.style.color = '#f0e0ff'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color = '#9060c8'
                  }
                }}
              >
                {isActive && (
                  <span style={{ color: '#ff00cc', marginRight: '2px' }}>►</span>
                )}
                <span>{itemLabel}</span>
                {badge && (
                  <span
                    style={{
                      fontFamily: 'var(--font-pixel), monospace',
                      fontSize: '5px',
                      background: 'linear-gradient(90deg, #ff00cc, #00aaff)',
                      color: '#000',
                      padding: '2px 4px',
                      marginLeft: '2px',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {badge}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      ))}
    </div>
  )
}

export default function Sidebar({ profile, onLinkClick }: SidebarProps) {
  const router = useRouter()
  const [loggingOut, setLoggingOut] = useState(false)

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
    .map((w: string) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <aside
      className="hidden md:flex flex-col h-full shrink-0"
      style={{
        width: '224px',
        background: '#0f0420',
        borderRight: '3px solid #2d0d55',
        boxShadow: '4px 0 0 #000',
      }}
    >
      {/* Logo */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '0 14px',
          height: '56px',
          borderBottom: '3px solid #2d0d55',
          flexShrink: 0,
        }}
      >
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

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto" style={{ padding: '14px 0' }}>
        <SidebarNav onLinkClick={onLinkClick} />
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
    </aside>
  )
}
