'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Target, Brain, Shield, MoreHorizontal } from 'lucide-react'

const BOTTOM_NAV = [
  { href: '/dashboard',  label: 'Dashboard', Icon: LayoutDashboard },
  { href: '/opponents',  label: 'Scout',      Icon: Target },
  { href: '/ai-coach',   label: 'AI',         Icon: Brain,   live: true },
  { href: '/my-team',    label: 'Team',       Icon: Shield },
] as const

export default function BottomNav() {
  const pathname = usePathname()

  const openMenu = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('rv-open-menu'))
    }
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden"
      style={{
        background: 'var(--panel)',
        borderTop: '1px solid var(--border)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        backdropFilter: 'blur(16px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
      }}
      aria-label="Primary navigation"
    >
      <div className="flex items-stretch justify-around h-14">
        {BOTTOM_NAV.map(({ href, label, Icon, live }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
              className="flex flex-col items-center justify-center gap-[3px] flex-1 min-h-[44px] relative active:scale-95"
              style={{
                color: isActive ? 'var(--accent)' : 'var(--muted)',
                textDecoration: 'none',
                transition: 'color 0.15s, transform 0.1s',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {/* Top accent bar */}
              {isActive && (
                <span
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: '20%',
                    right: '20%',
                    height: 2,
                    borderRadius: '0 0 3px 3px',
                    background: 'var(--accent)',
                    boxShadow: '0 1px 8px color-mix(in srgb, var(--accent) 60%, transparent)',
                  }}
                />
              )}

              <span className="relative flex items-center justify-center">
                <Icon
                  size={20}
                  strokeWidth={isActive ? 2.1 : 1.6}
                  aria-hidden="true"
                />
                {live && (
                  <span
                    aria-hidden="true"
                    className="rv-pulse"
                    style={{
                      position: 'absolute',
                      top: -3,
                      right: -4,
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: 'var(--signal)',
                      boxShadow: '0 0 6px var(--signal)',
                    }}
                  />
                )}
              </span>

              <span
                style={{
                  fontSize: 10,
                  fontWeight: isActive ? 600 : 400,
                  fontFamily: 'var(--font-ui)',
                  letterSpacing: '0.01em',
                }}
              >
                {label}
              </span>
            </Link>
          )
        })}

        {/* More button */}
        <button
          onClick={openMenu}
          aria-label="More navigation options"
          className="flex flex-col items-center justify-center gap-[3px] flex-1 min-h-[44px] active:scale-95"
          style={{
            color: 'var(--muted)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            transition: 'color 0.15s, transform 0.1s',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <MoreHorizontal size={20} strokeWidth={1.6} aria-hidden="true" />
          <span style={{ fontSize: 10, fontFamily: 'var(--font-ui)' }}>More</span>
        </button>
      </div>
    </nav>
  )
}
