'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Users, Trophy, Download } from 'lucide-react'
import type { ReactNode } from 'react'

const TABS = [
  { href: '/opponents',           label: 'Library',   icon: Users    },
  { href: '/opponents/pro-demos', label: 'Pro Demos', icon: Trophy   },
  { href: '/opponents/import',    label: 'Import',    icon: Download },
] as const

const SECTION_PATHS = new Set(['/opponents', '/opponents/pro-demos', '/opponents/import'])

export default function OpponentsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const showTabs = SECTION_PATHS.has(pathname)

  return (
    <>
      {showTabs && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 28px', borderBottom: '1px solid var(--border)',
          background: 'var(--panel)', flexShrink: 0,
          position: 'sticky', top: 0, zIndex: 10,
        }}>
          <div style={{ display: 'flex', gap: 2, padding: 2, borderRadius: 10, background: 'var(--card)', border: '1px solid var(--border)' }}>
            {TABS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href
              return (
                <Link key={href} href={href} style={{ textDecoration: 'none' }}>
                  <button
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                      background: active ? 'var(--accent)' : 'transparent',
                      color: active ? '#fff' : 'var(--muted)',
                      fontSize: 12, fontWeight: 600, transition: 'all 0.13s',
                    }}
                  >
                    <Icon size={13} />
                    {label}
                  </button>
                </Link>
              )
            })}
          </div>
        </div>
      )}
      {children}
    </>
  )
}
