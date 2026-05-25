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
      {/* Floating hamburger */}
      <button
        onClick={() => setIsOpen(true)}
        className="md:hidden fixed top-3.5 left-3.5 z-50 flex items-center justify-center w-9 h-9 bg-card border border-border text-muted-foreground hover:text-primary hover:border-primary/40 transition-all duration-150 shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
        aria-label="Open navigation"
      >
        <Menu size={18} />
      </button>

      {/* Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] md:hidden">
          <div
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />

          <div className="absolute left-0 top-0 h-full w-[200px] bg-card border-r border-border shadow-[4px_0_32px_rgba(0,0,0,0.6)] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between h-14 px-3 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
                  <Crosshair size={14} className="text-primary" strokeWidth={1.5} />
                </div>
                <span className="text-[13px] font-black tracking-widest text-foreground">RIVALIZE</span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-center w-7 h-7 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all duration-150"
                aria-label="Close menu"
              >
                <X size={15} />
              </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-2 py-3 overflow-y-auto">
              <SidebarNav onLinkClick={() => setIsOpen(false)} />
            </nav>

            {/* User section */}
            <div className="border-t border-border p-2 space-y-1 shrink-0">
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
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-semibold truncate">{displayName}</p>
                  {profile?.username && (
                    <p className="text-[10px] text-muted-foreground truncate">@{profile.username}</p>
                  )}
                </div>
              </div>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex items-center gap-2 w-full px-2 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <LogOut size={13} className="shrink-0" strokeWidth={1.5} />
                <span>{loggingOut ? 'Signing out…' : 'Sign out'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
