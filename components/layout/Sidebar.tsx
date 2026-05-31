'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Users, Brain, User, Settings,
  LogOut, ChevronLeft, ChevronRight, Crosshair,
} from 'lucide-react'
import type { Profile } from '@/types/database'

interface SidebarProps {
  profile: Profile | null
}

const navLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/teams', label: 'Teams', icon: Users },
  { href: '/ai-coach', label: 'AI Coach', icon: Brain },
  { href: '/profile', label: 'Profile', icon: User },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export default function Sidebar({ profile }: SidebarProps) {
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
        'relative flex flex-col h-full bg-card border-r border-border transition-all duration-300 ease-in-out shrink-0',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className={cn(
          'absolute -right-3 top-6 z-10 flex items-center justify-center',
          'w-6 h-6 rounded-full bg-card border border-border',
          'text-muted-foreground hover:text-neon-green hover:border-neon-green transition-colors'
        )}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      {/* Logo */}
      <div
        className={cn(
          'flex items-center gap-3 px-4 h-16 border-b border-border shrink-0',
          collapsed && 'justify-center px-0'
        )}
      >
        <div className="flex items-center justify-center w-8 h-8 rounded bg-[var(--rv-acc,#dc2626)] shrink-0">
          <Crosshair size={18} className="text-white font-bold" />
        </div>
        {!collapsed && (
          <span className="text-lg font-bold tracking-widest text-foreground">
            RIVALIZE
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {navLinks.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all duration-150',
                collapsed ? 'justify-center px-0 py-3' : '',
                isActive
                  ? 'bg-[var(--rv-acc,#dc2626)]/10 text-[var(--rv-acc,#dc2626)] border border-[var(--rv-acc,#dc2626)]/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
              title={collapsed ? label : undefined}
            >
              <Icon
                size={18}
                className={cn(
                  'shrink-0',
                  isActive ? 'text-neon-green' : 'text-muted-foreground group-hover:text-foreground'
                )}
              />
              {!collapsed && <span>{label}</span>}
              {!collapsed && isActive && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-neon-green" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* User section */}
      <div className={cn('border-t border-border p-3 space-y-2 shrink-0', collapsed && 'px-0')}>
        <div
          className={cn(
            'flex items-center gap-3 rounded-md px-2 py-2',
            collapsed && 'justify-center px-0'
          )}
        >
          {/* Avatar */}
          <div className="relative shrink-0">
            {profile?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar_url}
                alt={displayName}
                className="w-8 h-8 rounded-full object-cover ring-1 ring-border"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-neon-green/20 border border-neon-green/30 flex items-center justify-center">
                <span className="text-xs font-bold text-neon-green">{initials}</span>
              </div>
            )}
            <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-neon-green border border-card" />
          </div>

          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
              {profile?.username && (
                <p className="text-xs text-muted-foreground truncate">@{profile.username}</p>
              )}
            </div>
          )}
        </div>

        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className={cn(
            'flex items-center gap-2 w-full rounded-md px-3 py-2 text-sm font-medium',
            'text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            collapsed && 'justify-center px-0'
          )}
          title={collapsed ? 'Sign out' : undefined}
        >
          <LogOut size={16} className="shrink-0" />
          {!collapsed && <span>{loggingOut ? 'Signing out…' : 'Sign out'}</span>}
        </button>
      </div>
    </aside>
  )
}
