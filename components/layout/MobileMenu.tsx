'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  X, Menu, Crosshair, LogOut,
  LayoutDashboard, Users, Brain, User, Settings,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { Profile } from '@/types/database'

interface MobileMenuProps {
  profile: Profile | null
}

const navLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/teams', label: 'Teams', icon: Users },
  { href: '/ai-coach', label: 'AI Scout', icon: Brain },
  { href: '/profile', label: 'Profile', icon: User },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export default function MobileMenu({ profile }: MobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

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
    <>
      {/* Mobile top bar — occupies layout space, invisible on md+ */}
      <div className="md:hidden flex items-center gap-3 h-14 px-4 border-b border-border bg-card shrink-0">
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center justify-center w-9 h-9 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label="Open navigation"
        >
          <Menu size={20} />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-neon-green rounded flex items-center justify-center shrink-0">
            <Crosshair size={14} className="text-black" />
          </div>
          <span className="text-base font-bold tracking-widest text-foreground">RIVALIZE</span>
        </div>
      </div>

      {/* Drawer overlay — fixed, shown only when open */}
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setIsOpen(false)}
          />

          {/* Drawer panel */}
          <div className="absolute left-0 top-0 h-full w-72 bg-card border-r border-border flex flex-col">
            {/* Drawer header */}
            <div className="flex items-center justify-between h-14 px-4 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-neon-green rounded flex items-center justify-center shrink-0">
                  <Crosshair size={14} className="text-black" />
                </div>
                <span className="text-base font-bold tracking-widest text-foreground">RIVALIZE</span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                aria-label="Close menu"
              >
                <X size={18} />
              </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
              {navLinks.map(({ href, label, icon: Icon }) => {
                const isActive = pathname === href || pathname.startsWith(href + '/')
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all duration-150',
                      isActive
                        ? 'bg-neon-green/10 text-neon-green border border-neon-green/20'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    )}
                  >
                    <Icon
                      size={18}
                      className={cn('shrink-0', isActive ? 'text-neon-green' : 'text-muted-foreground')}
                    />
                    <span>{label}</span>
                    {isActive && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-neon-green" />
                    )}
                  </Link>
                )
              })}
            </nav>

            {/* User section */}
            <div className="border-t border-border p-3 space-y-2 shrink-0">
              <div className="flex items-center gap-3 rounded-md px-2 py-2">
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
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
                  {profile?.username && (
                    <p className="text-xs text-muted-foreground truncate">@{profile.username}</p>
                  )}
                </div>
              </div>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex items-center gap-2 w-full rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <LogOut size={16} className="shrink-0" />
                <span>{loggingOut ? 'Signing out…' : 'Sign out'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
