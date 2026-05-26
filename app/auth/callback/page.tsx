'use client'

import { useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

// Handles both PKCE (?code=) and implicit flow (#access_token=) callbacks.
// createBrowserClient automatically detects and processes both formats,
// so we just wait for the session to be established then redirect.
export default function AuthCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? '/dashboard'
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current) return
    const supabase = createClient()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (handled.current) return
      if (session) {
        handled.current = true
        subscription.unsubscribe()
        router.replace(next)
      }
    })

    // Also check immediately in case the session was already established
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (handled.current) return
      if (session) {
        handled.current = true
        subscription.unsubscribe()
        router.replace(next)
      }
    })

    // Timeout fallback — if no session after 5 s, something went wrong
    const timeout = setTimeout(() => {
      if (!handled.current) {
        handled.current = true
        subscription.unsubscribe()
        router.replace('/login?error=auth_callback_error')
      }
    }, 5000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [next, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="animate-spin text-[#00ff87]" size={32} />
    </div>
  )
}
