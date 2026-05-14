'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'folders', label: 'Team Folders' },
  { id: 'demos', label: 'All Demos' },
  { id: 'members', label: 'Members' },
]

interface TeamTabNavProps {
  teamId: string
  activeTab: string
}

export default function TeamTabNav({ teamId, activeTab }: TeamTabNavProps) {
  return (
    <nav className="flex gap-1 mt-5 border-b border-border -mb-px">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id
        return (
          <Link
            key={tab.id}
            href={`/teams/${teamId}?tab=${tab.id}`}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 transition-all duration-150',
              isActive
                ? 'border-neon-green text-neon-green'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
