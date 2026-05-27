'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, Target, Shield, Brain,
  User, Settings, LogOut, ChevronLeft, ChevronRight, BookOpen, Swords,
} from 'lucide-react'
import type { Profile } from '@/types/database'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { href: '/opponents', label: 'Opponents', Icon: Target },
  { href: '/my-team',   label: 'My Team',   Icon: Shield },
  { href: '/ai-coach',  label: 'AI Scout',  Icon: Brain },
  { href: '/playbook',  label: 'Playbooks', Icon: BookOpen },
  { href: '/veto',      label: 'Veto',      Icon: Swords },
  { href: '/profile',   label: 'Profile',   Icon: User },
  { href: '/settings',  label: 'Settings',  Icon: Settings },
]

interface SidebarNavProps {
  onLinkClick?: () => void
  collapsed?: boolean
}

export function SidebarNav({ onLinkClick, collapsed }: SidebarNavProps) {
  const pathname = usePathname()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {NAV_ITEMS.map(({ href, label, Icon }) => {
        const isActive = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            onClick={onLinkClick}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: collapsed ? '10px 0' : '9px 12px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              borderRadius: 7,
              background: isActive ? 'rgba(255,45,120,0.1)' : 'transparent',
              borderLeft: isActive ? '3px solid #ff2d78' : '3px solid transparent',
              color: isActive ? '#ff2d78' : 'rgba(255,255,255,0.48)',
              textDecoration: 'none',
              fontFamily: 'var(--font-inter, Inter), sans-serif',
              fontSize: 13.5,
              fontWeight: isActive ? 600 : 400,
              transition: 'all 0.12s',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}
            onMouseEnter={e => {
              if (!isActive) {
                e.currentTarget.style.color = 'rgba(255,255,255,0.8)'
                e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
              }
            }}
            onMouseLeave={e => {
              if (!isActive) {
                e.currentTarget.style.color = 'rgba(255,255,255,0.48)'
                e.currentTarget.style.background = 'transparent'
              }
            }}
          >
            <span style={{ flexShrink: 0 }}><Icon size={17}/></span>
            {!collapsed && label}
          </Link>
        )
      })}
    </div>
  )
}

interface SidebarProps {
  profile: Profile | null
  onLinkClick?: () => void
}

export default function Sidebar({ profile }: SidebarProps) {
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const W = collapsed ? 62 : 200

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
    <aside
      className="hidden md:flex flex-col h-full shrink-0"
      style={{
        width: W,
        minWidth: W,
        background: 'rgba(6,5,18,0.97)',
        borderRight: '1px solid rgba(255,255,255,0.07)',
        position: 'relative',
        zIndex: 10,
        transition: 'width 0.22s ease, min-width 0.22s ease',
      }}
    >
      {/* Logo */}
      <div style={{ padding: '18px 16px 12px' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: 'linear-gradient(135deg, #ff2d78 0%, #9b1dff 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 16px rgba(255,45,120,0.5)',
          }}>
            <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
              <path d="M4 3h8L9 9h7L7 18l2-6H5L4 3z" fill="white"/>
            </svg>
          </div>
          {!collapsed && (
            <span style={{
              fontFamily: 'var(--font-sora, Sora), sans-serif',
              fontWeight: 800, fontSize: 16, color: '#fff', letterSpacing: '0.05em',
            }}>
              RIVALIZE
            </span>
          )}
        </Link>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        style={{
          position: 'absolute', top: 20, right: -11,
          width: 22, height: 22, borderRadius: '50%',
          background: '#14142a', border: '1px solid rgba(255,255,255,0.18)',
          color: 'rgba(255,255,255,0.5)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 20, padding: 0,
        }}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight size={11}/> : <ChevronLeft size={11}/>}
      </button>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <SidebarNav collapsed={collapsed}/>
      </nav>

      {/* User section */}
      <div style={{ padding: '10px 8px 14px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        {!collapsed && (
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
        )}
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
            padding: collapsed ? '8px 0' : '7px 12px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            borderRadius: 7, background: 'transparent', border: 'none',
            color: 'rgba(255,255,255,0.33)', cursor: loggingOut ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--font-inter, Inter), sans-serif', fontSize: 13,
            outline: 'none', opacity: loggingOut ? 0.5 : 1, transition: 'color 0.12s',
          }}
          onMouseEnter={e => { if (!loggingOut) e.currentTarget.style.color = 'rgba(255,255,255,0.6)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.33)' }}
        >
          <LogOut size={16}/>
          {!collapsed && (loggingOut ? 'Signing out…' : 'Sign out')}
        </button>
      </div>
    </aside>
  )
}
