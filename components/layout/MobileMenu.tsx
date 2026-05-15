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
        className="md:hidden fixed top-4 left-4 z-50 flex items-center justify-center w-10 h-10 rounded-lg bg-card border border-border text-muted-foreground hover:text-foreground hover:border-neon-green/50 transition-colors shadow-lg"
        aria-label="Open navigation"
      >
        <Menu size={20} />
      </button>

      {/* Drawer overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />

          {/* Drawer panel */}
          <div className="absolute left-0 top-0 h-full w-72 bg-zinc-950 border-r border-zinc-800 shadow-2xl flex flex-col">
            {/* Drawer header */}
            <div className="flex items-center justify-between h-16 px-4 border-b border-zinc-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-neon-green rounded flex items-center justify-center shrink-0">
                  <Crosshair size={16} className="text-black" />
                </div>
                <span className="text-base font-bold tracking-widest text-white">RIVALIZE</span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-center w-8 h-8 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                aria-label="Close menu"
              >
                <X size={18} />
              </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-2 py-4 overflow-y-auto">
              <SidebarNav onLinkClick={() => setIsOpen(false)} />
            </nav>

            {/* User section */}
            <div className="border-t border-zinc-800 p-3 space-y-2 shrink-0">
              <div className="flex items-center gap-3 rounded-md px-2 py-2">
                <div className="relative shrink-0">
                  {profile?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={profile.avatar_url}
                      alt={displayName}
                      className="w-8 h-8 rounded-full object-cover ring-1 ring-zinc-700"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-neon-green/20 border border-neon-green/30 flex items-center justify-center">
                      <span className="text-xs font-bold text-neon-green">{initials}</span>
                    </div>
                  )}
                  <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-neon-green border border-zinc-950" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{displayName}</p>
                  {profile?.username && (
                    <p className="text-xs text-zinc-400 truncate">@{profile.username}</p>
                  )}
                </div>
              </div>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex items-center gap-2 w-full rounded-md px-3 py-2 text-sm font-medium text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
