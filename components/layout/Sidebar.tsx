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
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/opponents', label: 'Opponents', icon: Target },
  { href: '/my-team', label: 'My Team', icon: Shield },
  { href: '/ai-coach', label: 'AI Scout', icon: Brain },
  { href: '/profile', label: 'Profile', icon: User },
  { href: '/settings', label: 'Settings', icon: Settings },
]

/** Shared nav list used by both Sidebar (desktop) and MobileMenu (mobile drawer). */
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
              'relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
              isActive
                ? 'bg-neon-green/[0.08] text-neon-green'
                : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04]'
            )}
          >
            {isActive && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[18px] bg-neon-green rounded-r-full shadow-[0_0_8px_rgba(0,255,135,0.5)]" />
            )}
            <Icon
              size={17}
              className={cn('shrink-0', isActive ? 'text-neon-green' : 'text-muted-foreground/70')}
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
        'hidden md:flex flex-col h-full border-r border-border transition-all duration-300 ease-in-out shrink-0 relative overflow-hidden',
        'bg-[hsl(222,22%,5%)]',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Atmospheric gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-neon-green/[0.025] via-transparent to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-neon-blue/[0.01] pointer-events-none" />

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className={cn(
          'absolute -right-3 top-6 z-10 flex items-center justify-center',
          'w-6 h-6 rounded-full bg-[hsl(222,18%,10%)] border border-border',
          'text-muted-foreground hover:text-neon-green hover:border-neon-green/50 transition-all duration-150',
          'shadow-[0_2px_6px_rgba(0,0,0,0.4)]'
        )}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight size={11} /> : <ChevronLeft size={11} />}
      </button>

      {/* Logo */}
      <div
        className={cn(
          'relative flex items-center gap-3 px-4 h-16 border-b border-border/80 shrink-0',
          collapsed && 'justify-center px-0'
        )}
      >
        <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-neon-green shrink-0 shadow-[0_0_14px_rgba(0,255,135,0.45)]">
          <Crosshair size={17} className="text-black" />
        </div>
        {!collapsed && (
          <span className="text-[15px] font-black tracking-[0.18em] text-foreground select-none">
            RIVALIZE
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="relative flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {navLinks.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              onClick={onLinkClick}
              className={cn(
                'relative flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-150',
                collapsed ? 'justify-center px-0 py-3' : 'px-3 py-2.5',
                isActive
                  ? 'bg-neon-green/[0.08] text-neon-green'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04]'
              )}
              title={collapsed ? label : undefined}
            >
              {/* Left accent bar */}
              {isActive && !collapsed && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[18px] bg-neon-green rounded-r-full shadow-[0_0_8px_rgba(0,255,135,0.5)]" />
              )}
              {isActive && collapsed && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[18px] bg-neon-green rounded-r-full shadow-[0_0_8px_rgba(0,255,135,0.5)]" />
              )}
              <Icon
                size={17}
                className={cn(
                  'shrink-0',
                  isActive ? 'text-neon-green' : 'text-muted-foreground/70'
                )}
              />
              {!collapsed && <span>{label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* User section */}
      <div className={cn('relative border-t border-border/80 p-3 space-y-1.5 shrink-0', collapsed && 'px-0')}>
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
                className="w-8 h-8 rounded-full object-cover ring-1 ring-neon-green/30 shadow-[0_0_8px_rgba(0,255,135,0.15)]"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-neon-green/25 to-neon-green/10 border border-neon-green/30 flex items-center justify-center shadow-[0_0_8px_rgba(0,255,135,0.15)]">
                <span className="text-xs font-bold text-neon-green">{initials}</span>
              </div>
            )}
            <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-neon-green border-[1.5px] border-[hsl(222,22%,5%)]" />
          </div>

          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate leading-tight">{displayName}</p>
              {profile?.username && (
                <p className="text-[11px] text-muted-foreground/60 truncate">@{profile.username}</p>
              )}
            </div>
          )}
        </div>

        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className={cn(
            'flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm font-medium',
            'text-muted-foreground/60 hover:text-red-400 hover:bg-red-400/[0.07] transition-all duration-150',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            collapsed && 'justify-center px-0'
          )}
          title={collapsed ? 'Sign out' : undefined}
        >
          <LogOut size={15} className="shrink-0" />
          {!collapsed && <span>{loggingOut ? 'Signing out…' : 'Sign out'}</span>}
        </button>
      </div>
    </aside>
  )
}
