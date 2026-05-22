'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Menu, X, Crosshair, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { SidebarNav } from './Sidebar'
import type { Profile } from '@/types/database'

interface MobileMenuProps {
  profile: Profile | null
}

export default function MobileMenu({ profile }: MobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
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
      {/* Floating hamburger button */}
      <button
        onClick={() => setIsOpen(true)}
        className="md:hidden fixed top-4 left-4 z-50 flex items-center justify-center w-10 h-10 rounded-xl bg-card border border-border text-muted-foreground hover:text-neon-green hover:border-neon-green/40 transition-all duration-150 shadow-[0_4px_12px_rgba(0,0,0,0.4)]"
        aria-label="Open navigation"
      >
        <Menu size={19} />
      </button>

      {/* Drawer overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />

          {/* Drawer panel */}
          <div className="absolute left-0 top-0 h-full w-72 bg-[hsl(222,22%,5%)] border-r border-border shadow-[4px_0_24px_rgba(0,0,0,0.5)] flex flex-col">
            {/* Atmospheric gradient */}
            <div className="absolute inset-0 bg-gradient-to-b from-neon-green/[0.025] via-transparent to-transparent pointer-events-none" />

            {/* Drawer header */}
            <div className="relative flex items-center justify-between h-16 px-4 border-b border-border/80 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-neon-green rounded-lg flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(0,255,135,0.4)]">
                  <Crosshair size={16} className="text-black" />
                </div>
                <span className="text-[14px] font-black tracking-[0.18em] text-foreground">RIVALIZE</span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-all duration-150"
                aria-label="Close menu"
              >
                <X size={17} />
              </button>
            </div>

            {/* Navigation */}
            <nav className="relative flex-1 px-2 py-3 overflow-y-auto">
              <SidebarNav onLinkClick={() => setIsOpen(false)} />
            </nav>

            {/* User section */}
            <div className="relative border-t border-border/80 p-3 space-y-1.5 shrink-0">
              <div className="flex items-center gap-3 rounded-lg px-2 py-2">
                <div className="relative shrink-0">
                  {profile?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={profile.avatar_url}
                      alt={displayName}
                      className="w-8 h-8 rounded-full object-cover ring-1 ring-neon-green/30"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-neon-green/25 to-neon-green/10 border border-neon-green/30 flex items-center justify-center">
                      <span className="text-xs font-bold text-neon-green">{initials}</span>
                    </div>
                  )}
                  <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-neon-green border-[1.5px] border-[hsl(222,22%,5%)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate leading-tight">{displayName}</p>
                  {profile?.username && (
                    <p className="text-[11px] text-muted-foreground/60 truncate">@{profile.username}</p>
                  )}
                </div>
              </div>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground/60 hover:text-red-400 hover:bg-red-400/[0.07] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <LogOut size={15} className="shrink-0" />
                <span>{loggingOut ? 'Signing out…' : 'Sign out'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
