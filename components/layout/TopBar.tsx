'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { LogOut, User, Settings, ChevronDown } from 'lucide-react'
import type { Profile } from '@/types/database'

export default function TopBar({ profile }: { profile: Profile | null }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const displayName = profile?.display_name || profile?.username || 'Player'
  const initials = displayName[0].toUpperCase()

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLogout = async () => {
    setLoggingOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const menuItem = (href: string, Icon: React.ElementType, label: string) => (
    <Link
      href={href}
      onClick={() => setOpen(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 9,
        padding: '8px 14px', textDecoration: 'none',
        color: 'rgba(255,255,255,0.6)', fontSize: 13,
        fontFamily: 'var(--font-inter, Inter), sans-serif',
        transition: 'color 0.12s, background 0.12s',
        borderRadius: 6,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.color = '#fff'
        e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.color = 'rgba(255,255,255,0.6)'
        e.currentTarget.style.background = 'transparent'
      }}
    >
      <Icon size={14} />
      {label}
    </Link>
  )

  return (
    <div
      className="hidden md:flex"
      style={{
        alignItems: 'center',
        justifyContent: 'flex-end',
        padding: '0 20px',
        height: 52,
        flexShrink: 0,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(9,9,26,0.80)',
        backdropFilter: 'blur(12px)',
        position: 'sticky',
        top: 0,
        zIndex: 20,
      }}
    >
      {/* Dropdown trigger */}
      <div ref={ref} style={{ position: 'relative' }}>
        <button
          onClick={() => setOpen(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 9,
            background: open ? 'rgba(255,255,255,0.06)' : 'transparent',
            border: '1px solid',
            borderColor: open ? 'rgba(255,255,255,0.12)' : 'transparent',
            borderRadius: 8, padding: '5px 10px 5px 6px',
            cursor: 'pointer', transition: 'all 0.12s', outline: 'none',
          }}
          onMouseEnter={e => {
            if (!open) {
              e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
            }
          }}
          onMouseLeave={e => {
            if (!open) {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.borderColor = 'transparent'
            }
          }}
        >
          {/* Avatar */}
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

          {/* Name */}
          <div style={{ textAlign: 'left' }}>
            <div style={{
              fontSize: 13, fontWeight: 600, color: '#fff', lineHeight: 1.25,
              fontFamily: 'var(--font-inter, Inter), sans-serif',
            }}>
              {displayName}
            </div>
            {profile?.username && (
              <div style={{
                fontSize: 11, color: 'rgba(255,255,255,0.36)', lineHeight: 1.25,
                fontFamily: 'var(--font-inter, Inter), sans-serif',
              }}>
                @{profile.username}
              </div>
            )}
          </div>

          <ChevronDown
            size={13}
            style={{
              color: 'rgba(255,255,255,0.35)',
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.15s',
              flexShrink: 0,
            }}
          />
        </button>

        {/* Dropdown menu */}
        {open && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', right: 0,
            minWidth: 180,
            background: 'rgba(14,13,35,0.98)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            backdropFilter: 'blur(16px)',
            padding: '6px',
            zIndex: 50,
          }}>
            {/* User header */}
            <div style={{
              padding: '8px 14px 10px',
              borderBottom: '1px solid rgba(255,255,255,0.07)',
              marginBottom: 4,
            }}>
              <div style={{
                fontSize: 13, fontWeight: 600, color: '#fff',
                fontFamily: 'var(--font-inter, Inter), sans-serif',
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

            {menuItem('/profile', User, 'Profile')}
            {menuItem('/settings', Settings, 'Settings')}

            <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '4px 0' }} />

            {/* Sign out */}
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              style={{
                display: 'flex', alignItems: 'center', gap: 9, width: '100%',
                padding: '8px 14px', background: 'transparent', border: 'none',
                color: 'rgba(255,80,80,0.7)', fontSize: 13, borderRadius: 6,
                fontFamily: 'var(--font-inter, Inter), sans-serif',
                cursor: loggingOut ? 'not-allowed' : 'pointer',
                opacity: loggingOut ? 0.5 : 1,
                transition: 'color 0.12s, background 0.12s',
                outline: 'none',
              }}
              onMouseEnter={e => {
                if (!loggingOut) {
                  e.currentTarget.style.color = 'rgba(255,80,80,1)'
                  e.currentTarget.style.background = 'rgba(255,80,80,0.08)'
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = 'rgba(255,80,80,0.7)'
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <LogOut size={14} />
              {loggingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
