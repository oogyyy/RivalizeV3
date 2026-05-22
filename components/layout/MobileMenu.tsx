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
        className="md:hidden fixed top-3.5 left-3.5 z-50 flex items-center justify-center w-9 h-9 rounded-lg bg-[hsl(229,23%,10%)] border border-border text-muted-foreground hover:text-[#10D9A0] hover:border-[rgba(16,217,160,0.35)] transition-all duration-150 shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
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

          <div className="absolute left-0 top-0 h-full w-[260px] bg-[hsl(228,22%,8%)] border-r border-border shadow-[4px_0_32px_rgba(0,0,0,0.6)] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between h-[60px] px-4 border-b border-border shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 bg-[#10D9A0] rounded-lg flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(16,217,160,0.35)]">
                  <Crosshair size={15} className="text-[#0B0D14]" />
                </div>
                <span className="text-[13px] font-black tracking-[0.2em] text-foreground">RIVALIZE</span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-center w-7 h-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-150"
                aria-label="Close menu"
              >
                <X size={16} />
              </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-2 py-3 overflow-y-auto">
              <SidebarNav onLinkClick={() => setIsOpen(false)} />
            </nav>

            {/* User section */}
            <div className="border-t border-border p-3 space-y-1 shrink-0">
              <div className="flex items-center gap-3 rounded-lg px-2 py-2">
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
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-foreground truncate leading-tight">{displayName}</p>
                  {profile?.username && (
                    <p className="text-[11px] text-muted-foreground/50 truncate">@{profile.username}</p>
                  )}
                </div>
              </div>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-[13px] font-medium text-muted-foreground/50 hover:text-red-400 hover:bg-red-400/[0.07] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <LogOut size={14} className="shrink-0" />
                <span>{loggingOut ? 'Signing out…' : 'Sign out'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
