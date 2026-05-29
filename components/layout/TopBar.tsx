'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { LogOut } from 'lucide-react'
import type { Profile } from '@/types/database'

export default function TopBar({ profile }: { profile: Profile | null }) {
  const router = useRouter()
  const [loggingOut, setLoggingOut] = useState(false)

  const displayName = profile?.display_name || profile?.username || 'Player'
  const initials = displayName[0].toUpperCase()

  const handleLogout = async () => {
    setLoggingOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Avatar + name */}
        <Link
          href="/profile"
          style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none' }}
        >
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
          <div>
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
        </Link>

        <div style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.1)', flexShrink: 0 }} />

        {/* Sign out */}
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none',
            color: 'rgba(255,255,255,0.35)',
            cursor: loggingOut ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--font-inter, Inter), sans-serif',
            fontSize: 12, opacity: loggingOut ? 0.5 : 1,
            padding: '4px 6px', borderRadius: 6,
            transition: 'color 0.12s',
            outline: 'none',
          }}
          onMouseEnter={e => { if (!loggingOut) e.currentTarget.style.color = 'rgba(255,255,255,0.65)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.35)' }}
        >
          <LogOut size={14} />
          {loggingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </div>
  )
}
