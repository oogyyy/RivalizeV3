'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Target, Brain, User, Settings,
  LogOut, ChevronLeft, ChevronRight, Crosshair, Shield,
} from 'lucide-react'
import type { Profile } from '@/types/database'

interface SidebarProps {
  profile: Profile | null
  onLinkClick?: () => void
}

export const navLinks = [
  { href: '/dashboard', label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/opponents', label: 'Opponents',   icon: Target },
  { href: '/my-team',   label: 'My Team',     icon: Shield },
  { href: '/ai-coach',  label: 'AI Scout',    icon: Brain },
  { href: '/profile',   label: 'Profile',     icon: User },
  { href: '/settings',  label: 'Settings',    icon: Settings },
]

/** Shared nav list used by Sidebar (desktop) and MobileMenu (mobile drawer). */
export function SidebarNav({ onLinkClick }: { onLinkClick?: () => void }) {
  const pathname = usePathname()
  return (
    <div className="space-y-0.5">
      {navLinks.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            onClick={onLinkClick}
            className={cn(
              'relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-120',
              isActive
                ? 'bg-[rgba(16,217,160,0.09)] text-[#10D9A0]'
                : 'text-muted-foreground hover:text-foreground hover:bg-[rgba(255,255,255,0.035)]'
            )}
          >
            {isActive && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[18px] bg-[#10D9A0] rounded-r-full shadow-[0_0_8px_rgba(16,217,160,0.45)]" />
            )}
            <Icon
              size={17}
              className={cn('shrink-0', isActive ? 'text-[#10D9A0]' : 'text-muted-foreground/60')}
            />
            <span>{label}</span>
          </Link>
        )
      })}
    </div>
  )
}

export default function Sidebar({ profile, onLinkClick }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
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
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col h-full border-r border-border transition-all duration-300 ease-in-out shrink-0 relative',
        'bg-[hsl(228,22%,8%)]',
        collapsed ? 'w-[60px]' : 'w-[240px]'
      )}
    >
      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className={cn(
          'absolute -right-3 top-7 z-10 flex items-center justify-center',
          'w-6 h-6 rounded-full bg-[hsl(229,23%,12%)] border border-border',
          'text-muted-foreground/60 hover:text-[#10D9A0] hover:border-[rgba(16,217,160,0.4)]',
          'transition-all duration-150 shadow-[0_2px_8px_rgba(0,0,0,0.5)]'
        )}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight size={11} /> : <ChevronLeft size={11} />}
      </button>

      {/* Logo */}
      <div
        className={cn(
          'flex items-center gap-3 h-[60px] border-b border-border shrink-0',
          collapsed ? 'justify-center px-0' : 'px-4'
        )}
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#10D9A0] shrink-0 shadow-[0_0_16px_rgba(16,217,160,0.35)]">
          <Crosshair size={16} className="text-[#0B0D14]" />
        </div>
        {!collapsed && (
          <span className="text-[14px] font-black tracking-[0.2em] text-foreground select-none">
            RIVALIZE
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {navLinks.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              onClick={onLinkClick}
              className={cn(
                'relative flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-120',
                collapsed ? 'justify-center px-0 py-3' : 'px-3 py-2.5',
                isActive
                  ? 'bg-[rgba(16,217,160,0.09)] text-[#10D9A0]'
                  : 'text-muted-foreground hover:text-foreground hover:bg-[rgba(255,255,255,0.035)]'
              )}
              title={collapsed ? label : undefined}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[18px] bg-[#10D9A0] rounded-r-full shadow-[0_0_8px_rgba(16,217,160,0.4)]" />
              )}
              <Icon
                size={17}
                className={cn(
                  'shrink-0',
                  isActive ? 'text-[#10D9A0]' : 'text-muted-foreground/60'
                )}
              />
              {!collapsed && <span>{label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* User section */}
      <div className={cn('border-t border-border p-3 space-y-1 shrink-0', collapsed && 'px-0')}>
        <div
          className={cn(
            'flex items-center gap-3 rounded-lg px-2 py-2',
            collapsed && 'justify-center px-0'
          )}
        >
          <div className="relative shrink-0">
            {profile?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar_url}
                alt={displayName}
                className="w-8 h-8 rounded-full object-cover ring-1 ring-[rgba(16,217,160,0.25)]"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[rgba(16,217,160,0.12)] border border-[rgba(16,217,160,0.25)] flex items-center justify-center">
                <span className="text-xs font-bold text-[#10D9A0]">{initials}</span>
              </div>
            )}
            <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-[#10D9A0] border-[1.5px] border-[hsl(228,22%,8%)]" />
          </div>

          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-foreground truncate leading-tight">{displayName}</p>
              {profile?.username && (
                <p className="text-[11px] text-muted-foreground/50 truncate">@{profile.username}</p>
              )}
            </div>
          )}
        </div>

        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className={cn(
            'flex items-center gap-2 w-full rounded-lg px-3 py-2 text-[13px] font-medium',
            'text-muted-foreground/50 hover:text-red-400 hover:bg-red-400/[0.07]',
            'transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed',
            collapsed && 'justify-center px-0'
          )}
          title={collapsed ? 'Sign out' : undefined}
        >
          <LogOut size={14} className="shrink-0" />
          {!collapsed && <span>{loggingOut ? 'Signing out…' : 'Sign out'}</span>}
        </button>
      </div>
    </aside>
  )
}
