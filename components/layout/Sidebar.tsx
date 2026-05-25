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
              'relative flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-all duration-150',
              isActive
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
            )}
          >
            {isActive && (
              <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-primary shadow-[0_0_8px_rgba(0,212,255,0.5)]" />
            )}
            <Icon
              size={16}
              className={cn('shrink-0', isActive ? 'text-primary' : 'text-muted-foreground/60')}
              strokeWidth={1.5}
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
        'hidden md:flex flex-col h-full border-r border-border transition-all duration-200 ease-in-out shrink-0 relative',
        'bg-card',
        collapsed ? 'w-[56px]' : 'w-[200px]'
      )}
    >
      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className={cn(
          'absolute -right-3 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center',
          'w-6 h-6 bg-card border border-border',
          'text-muted-foreground hover:text-foreground',
          'transition-all duration-150 shadow-[0_2px_8px_rgba(0,0,0,0.5)]'
        )}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      {/* Logo */}
      <div
        className={cn(
          'flex items-center gap-2 h-14 border-b border-border shrink-0',
          collapsed ? 'justify-center px-0' : 'px-3'
        )}
      >
        <div className="w-7 h-7 bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
          <Crosshair size={14} className="text-primary" strokeWidth={1.5} />
        </div>
        {!collapsed && (
          <span className="text-[13px] font-black tracking-widest text-foreground select-none">
            RIVALIZE
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 flex flex-col gap-0.5 px-2 overflow-y-auto">
        {navLinks.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              onClick={onLinkClick}
              className={cn(
                'relative flex items-center gap-3 px-2 py-2 text-sm transition-all duration-150',
                collapsed ? 'justify-center' : '',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
              )}
              title={collapsed ? label : undefined}
            >
              {isActive && (
                <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-primary shadow-[0_0_8px_rgba(0,212,255,0.4)]" />
              )}
              <Icon
                size={16}
                className={cn('shrink-0', isActive ? 'text-primary' : 'text-muted-foreground/60')}
                strokeWidth={1.5}
              />
              {!collapsed && <span className="text-sm font-medium">{label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* User section */}
      <div className={cn('border-t border-border p-2 flex flex-col gap-1 shrink-0', collapsed && 'px-0')}>
        {!collapsed && (
          <div className="flex items-center gap-2 px-2 py-2">
            <div className="relative shrink-0">
              {profile?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatar_url}
                  alt={displayName}
                  className="w-6 h-6 rounded-full object-cover ring-1 ring-primary/25"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center">
                  <span className="text-accent text-[10px] font-bold">{initials}</span>
                </div>
              )}
              <span className="absolute bottom-0 right-0 w-1.5 h-1.5 rounded-full bg-accent border border-card" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white text-xs font-semibold truncate">{displayName}</p>
              {profile?.username && (
                <p className="text-[10px] text-muted-foreground truncate">@{profile.username}</p>
              )}
            </div>
          </div>
        )}

        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className={cn(
            'flex items-center gap-2 px-2 py-2 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors text-xs',
            collapsed ? 'justify-center' : '',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
          title={collapsed ? 'Sign out' : undefined}
        >
          <LogOut size={14} className="shrink-0" strokeWidth={1.5} />
          {!collapsed && <span>{loggingOut ? 'Signing out…' : 'Sign out'}</span>}
        </button>
      </div>
    </aside>
  )
}
