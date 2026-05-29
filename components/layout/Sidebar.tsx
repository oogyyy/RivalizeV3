'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard, Target, Shield, Brain,
  User, Settings, ChevronLeft, ChevronRight, BookOpen, Swords, BookMarked, Film, Users,
} from 'lucide-react'
import { useEffect } from 'react'
import type { Profile } from '@/types/database'

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { href: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
    ]
  },
  {
    label: 'Scout',
    items: [
      { href: '/opponents',           label: 'Opponents', Icon: Target },
      { href: '/opponents/pro-demos', label: 'Pro Demos', Icon: Film },
    ]
  },
  {
    label: 'Prepare',
    items: [
      { href: '/my-team',  label: 'My Team',  Icon: Shield },
      { href: '/ai-coach', label: 'AI Scout', Icon: Brain },
      { href: '/playbook', label: 'Playbook', Icon: BookOpen },
      { href: '/veto',     label: 'Veto',     Icon: Swords },
      { href: '/lineups',  label: 'Lineups',  Icon: BookMarked },
    ]
  },
  {
    label: 'Social',
    items: [
      { href: '/friends', label: 'Friends', Icon: Users },
    ]
  },
  {
    label: 'Account',
    items: [
      { href: '/profile',  label: 'Profile',  Icon: User },
      { href: '/settings', label: 'Settings', Icon: Settings },
    ]
  }
]

interface SidebarNavProps {
  onLinkClick?: () => void
  collapsed?: boolean
  badges?: Record<string, number>
}

export function SidebarNav({ onLinkClick, collapsed, badges = {} }: SidebarNavProps) {
  const pathname = usePathname()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: collapsed ? 2 : 4 }}>
      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          {!collapsed && (
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 px-3 mb-1 mt-2">
              {group.label}
            </p>
          )}
          {group.items.map(({ href, label, Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + '/')
            const badge = badges[href] ?? 0
            return (
              <div key={href} className="relative group">
                <Link
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
                  <span style={{ flexShrink: 0, position: 'relative' }}>
                    <Icon size={17}/>
                    {badge > 0 && collapsed && (
                      <span style={{
                        position: 'absolute', top: -4, right: -4,
                        width: 8, height: 8, borderRadius: '50%',
                        background: '#00ffc8', border: '1.5px solid #060512',
                      }} />
                    )}
                  </span>
                  {!collapsed && label}
                  {!collapsed && badge > 0 && (
                    <span style={{
                      marginLeft: 'auto', minWidth: 18, height: 18,
                      borderRadius: 9, background: '#00ffc8',
                      color: '#060512', fontSize: 10, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: '0 5px',
                    }}>
                      {badge}
                    </span>
                  )}
                </Link>
                {collapsed && (
                  <div
                    role="tooltip"
                    className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1.5 rounded-md bg-popover border border-border text-xs font-medium text-foreground whitespace-nowrap z-50 shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-100"
                  >
                    {label}{badge > 0 ? ` (${badge})` : ''}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

interface SidebarProps {
  profile: Profile | null
  onLinkClick?: () => void
}

export default function Sidebar({ profile: _profile }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const W = collapsed ? 62 : 200

  useEffect(() => {
    fetch('/api/friends/pending-count')
      .then(r => r.ok ? r.json() : { count: 0 })
      .then((d: { count: number }) => setPendingCount(d.count))
      .catch(() => {})
  }, [])

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
        <SidebarNav collapsed={collapsed} badges={{ '/friends': pendingCount }}/>
      </nav>

    </aside>
  )
}
