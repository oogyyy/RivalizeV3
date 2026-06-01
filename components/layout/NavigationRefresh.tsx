'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useRouter } from 'next/navigation'

/**
 * Calls router.refresh() whenever the pathname changes so that server
 * components always render with fresh data after any navigation.
 *
 * This fixes the Next.js App Router router cache serving stale RSC payloads
 * on back/forward navigation for pages marked `force-dynamic`.
 * Skips the initial mount so it doesn't cause a double-fetch on first load.
 */
export function NavigationRefresh() {
  const pathname = usePathname()
  const router = useRouter()
  const lastPath = useRef<string | null>(null)

  useEffect(() => {
    if (lastPath.current === null) {
      lastPath.current = pathname
      return
    }
    if (lastPath.current !== pathname) {
      lastPath.current = pathname
      router.refresh()
    }
  }, [pathname, router])

  return null
}
