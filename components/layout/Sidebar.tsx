'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard, Target, Shield, Brain,
  ChevronLeft, ChevronRight, BookOpen, Swords, BookMarked, Film, Settings, Activity, Puzzle,
} from 'lucide-react'
import type { Profile } from '@/types/database'

const EXTENSION_URL = 'https://github.com/oogyyy/rivalizev3/tree/main/extension'
const DETECTED_KEY  = 'rv-ext-detected'

const NAV_GROUPS = [
  {
    index: '01',
    label: 'Analyze',
    items: [
      { href: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
    ],
  },
  {
    index: '02',
    label: 'Scout',
    items: [
      { href: '/opponents',           label: 'Opponents', Icon: Target },
      { href: '/opponents/pro-demos', label: 'Pro Demos', Icon: Film },
      { href: '/scout',               label: 'Tactical Hub', Icon: Compass, live: true },
    ],
  },
  {
    index: '03',
    label: 'Prepare',
    items: [
      { href: '/ai-coach', label: 'AI Scout', Icon: Brain, live: true },
      { href: '/my-team',  label: 'My Teams', Icon: Shield },
      { href: '/playbook', label: 'Playbook', Icon: BookOpen },
      { href: '/veto',     label: 'Veto',     Icon: Swords },
      { href: '/lineups',  label: 'Lineups',  Icon: BookMarked },
    ],
  },
  {
    index: '04',
    label: 'Improve',
    items: [
      { href: '/improve', label: 'My Matches', Icon: Activity },
    ],
  },
]

interface NavItemProps {
  href: string
  label: string
  Icon: React.ElementType
  live?: boolean
  isActive: boolean
  collapsed: boolean
  onLinkClick?: () => void
}

function NavItem({ href, label, Icon, live, isActive, collapsed, onLinkClick }: NavItemProps) {
  return (
    <div className="relative group">
      <Link
        href={href}
        onClick={onLinkClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: collapsed ? '10px 0' : '9px 12px',
          justifyContent: collapsed ? 'center' : 'flex-start',
          borderRadius: 9,
          background: isActive ? 'var(--accent-soft)' : 'transparent',
          color: isActive ? 'var(--text)' : 'var(--muted)',
          textDecoration: 'none',
          fontFamily: 'var(--font-ui)',
          fontSize: 13.5,
          fontWeight: isActive ? 600 : 450,
          transition: 'all 0.14s ease',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          position: 'relative',
        }}
        onMouseEnter={e => {
          if (!isActive) {
            e.currentTarget.style.color = 'var(--text)'
            e.currentTarget.style.background = 'var(--hairline)'
          }
        }}
        onMouseLeave={e => {
          if (!isActive) {
            e.currentTarget.style.color = 'var(--muted)'
            e.currentTarget.style.background = 'transparent'
          }
        }}
      >
        {/* Active left bar */}
        {isActive && !collapsed && (
          <span style={{
            position: 'absolute', left: 0, top: '22%', bottom: '22%',
            width: 2.5, borderRadius: 3,
            background: 'var(--accent)',
            boxShadow: '0 0 8px var(--accent)',
          }} />
        )}

        <Icon
          size={17.5}
          strokeWidth={isActive ? 1.9 : 1.6}
          style={{ color: isActive ? 'var(--accent)' : 'inherit', flexShrink: 0 }}
        />

        {!collapsed && label}

        {/* Live pulse dot for AI Scout */}
        {live && !collapsed && (
          <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center' }}>
            <span
              className="rv-pulse"
              style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--signal)', display: 'block' }}
            />
          </span>
        )}

        {/* Collapsed live dot */}
        {live && collapsed && (
          <span style={{
            position: 'absolute', top: 8, right: 8,
            width: 6, height: 6, borderRadius: '50%',
            background: 'var(--signal)', boxShadow: '0 0 6px var(--signal)',
          }} />
        )}
      </Link>

      {/* Tooltip for collapsed mode */}
      {collapsed && (
        <div
          role="tooltip"
          style={{
            position: 'absolute', left: 'calc(100% + 12px)', top: '50%',
            transform: 'translateY(-50%)',
            padding: '6px 10px', borderRadius: 8,
            background: 'var(--elevated)',
            border: '1px solid var(--border-2)',
            fontSize: 12, fontWeight: 500, color: 'var(--text)',
            whiteSpace: 'nowrap', zIndex: 50,
            boxShadow: '0 8px 20px rgba(0,0,0,0.4)',
            opacity: 0, pointerEvents: 'none',
            transition: 'opacity 0.1s',
          }}
          className="group-hover:opacity-100"
        >
          {label}
        </div>
      )}
    </div>
  )
}

export interface SidebarNavProps {
  onLinkClick?: () => void
  collapsed?: boolean
}

export function SidebarNav({ onLinkClick, collapsed }: SidebarNavProps) {
  const pathname = usePathname()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: collapsed ? 2 : 18 }}>
      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          {/* Group heading */}
          {!collapsed && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '0 12px', marginBottom: 6,
            }}>
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.18em',
                textTransform: 'uppercase', color: 'var(--faint)',
                fontFamily: 'var(--font-mono)',
              }}>
                {group.label}
              </span>
              <span style={{ flex: 1, height: 1, background: 'var(--hairline)' }} />
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {group.items.map(({ href, label, Icon, live }) => {
              const isActive = pathname === href || pathname.startsWith(href + '/')
              return (
                <NavItem
                  key={href}
                  href={href}
                  label={label}
                  Icon={Icon}
                  live={live}
                  isActive={isActive}
                  collapsed={!!collapsed}
                  onLinkClick={onLinkClick}
                />
              )
            })}
          </div>
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
  const [extInstalled, setExtInstalled] = useState(true) // optimistic: hide until we know
  const pathname = usePathname()
  const W = collapsed ? 62 : 220

  const isSettingsActive = pathname === '/settings' || pathname.startsWith('/settings/')

  useEffect(() => {
    const stored = localStorage.getItem('rv-sidebar-collapsed')
    if (stored === '1') setCollapsed(true)

    // Show button unless extension is already detected
    if (localStorage.getItem(DETECTED_KEY) !== '1') setExtInstalled(false)

    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'RIVALIZE_EXT_INSTALLED') {
        localStorage.setItem(DETECTED_KEY, '1')
        setExtInstalled(true)
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  const toggle = () => {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('rv-sidebar-collapsed', next ? '1' : '0')
  }

  return (
    <aside
      className="hidden md:flex flex-col h-full shrink-0"
      style={{
        width: W,
        minWidth: W,
        background: 'var(--panel)',
        borderRight: '1px solid var(--border)',
        position: 'relative',
        zIndex: 10,
        transition: 'width 0.22s ease, min-width 0.22s ease',
      }}
    >
      {/* Logo */}
      <div style={{ padding: '20px 18px 16px', borderBottom: '1px solid var(--border)' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 11, textDecoration: 'none' }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9, flexShrink: 0, position: 'relative',
            background: 'linear-gradient(145deg, var(--accent), var(--accent-deep))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 10px color-mix(in srgb, var(--accent) 40%, transparent), inset 0 1px 0 rgba(255,255,255,0.25)',
          }}>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
              <path d="M4 3h8L9 9h7L7 18l2-6H5L4 3z" fill="#fff" />
            </svg>
          </div>
          {!collapsed && (
            <div style={{ lineHeight: 1 }}>
              <div style={{
                fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15,
                color: 'var(--text)', letterSpacing: '0.14em',
              }}>
                RIVALIZE
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)', fontWeight: 500, fontSize: 7.5,
                color: 'var(--signal)', letterSpacing: '0.34em', marginTop: 4,
              }}>
                PRO · SCOUT
              </div>
            </div>
          )}
        </Link>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={toggle}
        style={{
          position: 'absolute', top: 22, right: -11,
          width: 22, height: 22, borderRadius: '50%',
          background: 'var(--elevated)', border: '1px solid var(--border-2)',
          color: 'var(--muted)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 20, padding: 0,
          transition: 'background 0.13s, color 0.13s',
        }}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'var(--accent-soft)'
          e.currentTarget.style.color = 'var(--accent)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'var(--elevated)'
          e.currentTarget.style.color = 'var(--muted)'
        }}
      >
        {collapsed ? <ChevronRight size={11} /> : <ChevronLeft size={11} />}
      </button>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '14px 12px', overflowY: 'auto' }}>
        <SidebarNav collapsed={collapsed} />
      </nav>

      {/* Extension button */}
      {!extInstalled && (
        <div style={{ padding: '0 12px 8px' }}>
          <a
            href={EXTENSION_URL}
            target="_blank"
            rel="noopener noreferrer"
            title="Get the Rivalize browser extension"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: collapsed ? '9px 0' : '8px 10px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              borderRadius: 8,
              border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
              background: 'color-mix(in srgb, var(--accent) 6%, transparent)',
              color: 'var(--accent)',
              textDecoration: 'none',
              fontSize: 12.5,
              fontWeight: 600,
              transition: 'background 0.14s',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'color-mix(in srgb, var(--accent) 12%, transparent)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'color-mix(in srgb, var(--accent) 6%, transparent)' }}
          >
            <Puzzle size={14} strokeWidth={1.8} style={{ flexShrink: 0 }} />
            {!collapsed && 'Get Extension'}
          </a>
        </div>
      )}

      {/* Settings footer */}
      <div style={{ padding: 12, borderTop: '1px solid var(--border)' }}>
        <NavItem
          href="/settings"
          label="Settings"
          Icon={Settings}
          isActive={isSettingsActive}
          collapsed={collapsed}
        />
      </div>
    </aside>
  )
}
