'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Loader2, AlertCircle, CheckCircle2, UserPlus } from 'lucide-react'

/* ── Shared design atoms (same as pricing/page.tsx) ───────────── */
function Bolt({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M4 3h8L9 9h7L7 18l2-6H5L4 3z" fill="currentColor" />
    </svg>
  )
}

function Logo() {
  return (
    <Link href="/" className="lp-logo" style={{ textDecoration: 'none' }}>
      <span className="lp-logo-tile" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Bolt size={16} />
      </span>
      <span>
        <span className="lp-logo-word">RIVALIZE</span>
        <span className="lp-logo-sub">PRO · SCOUT</span>
      </span>
    </Link>
  )
}

/* ── Types ────────────────────────────────────────────────────── */
interface InviteData {
  teamId: string
  teamName: string
  inviterName: string
  email: string
  role: string
  expired: boolean
  alreadyAccepted: boolean
}

/* ── Page ─────────────────────────────────────────────────────── */
export default function InvitePage() {
  const params = useParams<{ token: string }>()
  const token = params.token
  const router = useRouter()
  const supabase = createClient()

  const [invite, setInvite] = useState<InviteData | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [acceptError, setAcceptError] = useState<string | null>(null)
  const [accepted, setAccepted] = useState(false)
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    async function load() {
      // Fetch invite metadata
      const res = await fetch(`/api/invite/${token}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setLoadError(body.error ?? 'Invite not found')
        setLoading(false)
        return
      }
      const data: InviteData = await res.json()
      setInvite(data)

      // Check auth state
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        setIsLoggedIn(true)
        setCurrentUserEmail(user.email ?? null)
      }

      setLoading(false)
    }

    load()
  }, [token]) // supabase is stable

  async function handleAccept() {
    if (!invite) return
    setAccepting(true)
    setAcceptError(null)

    try {
      const res = await fetch(`/api/invite/${token}`, { method: 'POST' })
      const body = await res.json()

      if (!res.ok) {
        setAcceptError(body.error ?? 'Failed to accept invite')
        return
      }

      setAccepted(true)
      // Redirect to team page after a brief moment
      setTimeout(() => {
        router.push(`/teams/${body.teamId}`)
      }, 1200)
    } catch {
      setAcceptError('An unexpected error occurred. Please try again.')
    } finally {
      setAccepting(false)
    }
  }

  /* ── Loading ──────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="lp-bg" style={{ minHeight: '100vh' }}>
        <nav className="lp-nav">
          <div className="lp-nav-in">
            <Logo />
          </div>
        </nav>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 65px)' }}>
          <Loader2 style={{ width: 28, height: 28, color: 'var(--accent)', animation: 'spin 1s linear infinite' }} />
        </div>
      </div>
    )
  }

  /* ── Error: invite not found ──────────────────────────────── */
  if (loadError || !invite) {
    return (
      <div className="lp-bg" style={{ minHeight: '100vh' }}>
        <nav className="lp-nav">
          <div className="lp-nav-in">
            <Logo />
          </div>
        </nav>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 65px)', padding: '40px 20px' }}>
          <div className="lp-panel" style={{ maxWidth: 480, width: '100%', padding: 40, textAlign: 'center' }}>
            <div className="lp-topbar" />
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.24)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <AlertCircle style={{ width: 24, height: 24, color: 'rgb(239,68,68)' }} />
            </div>
            <h1 style={{ margin: '0 0 12px', fontSize: 22, fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
              Invite Not Found
            </h1>
            <p style={{ margin: '0 0 28px', fontSize: 14, color: 'var(--muted)', lineHeight: 1.6 }}>
              {loadError ?? 'This invite link is invalid or no longer exists.'}
            </p>
            <Link href="/" className="lp-btn lp-btn-ghost lp-btn-sm">
              Go to Rivalize
            </Link>
          </div>
        </div>
      </div>
    )
  }

  /* ── Expired ──────────────────────────────────────────────── */
  if (invite.expired || invite.alreadyAccepted) {
    return (
      <div className="lp-bg" style={{ minHeight: '100vh' }}>
        <nav className="lp-nav">
          <div className="lp-nav-in">
            <Logo />
          </div>
        </nav>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 65px)', padding: '40px 20px' }}>
          <div className="lp-panel" style={{ maxWidth: 480, width: '100%', padding: 40, textAlign: 'center' }}>
            <div className="lp-topbar" />
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.24)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <AlertCircle style={{ width: 24, height: 24, color: 'rgb(239,68,68)' }} />
            </div>
            <h1 style={{ margin: '0 0 12px', fontSize: 22, fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
              {invite.alreadyAccepted ? 'Invite Already Used' : 'This Invite Has Expired'}
            </h1>
            <p style={{ margin: '0 0 8px', fontSize: 14, color: 'var(--muted)', lineHeight: 1.6 }}>
              {invite.alreadyAccepted
                ? 'This invite link has already been accepted.'
                : 'This invite link expired after 7 days.'}
            </p>
            <p style={{ margin: '0 0 28px', fontSize: 14, color: 'var(--muted)', lineHeight: 1.6 }}>
              Ask <strong style={{ color: 'var(--text)' }}>{invite.inviterName}</strong> to send a new invite.
            </p>
            <Link href="/" className="lp-btn lp-btn-ghost lp-btn-sm">
              Go to Rivalize
            </Link>
          </div>
        </div>
      </div>
    )
  }

  /* ── Accepted success state ───────────────────────────────── */
  if (accepted) {
    return (
      <div className="lp-bg" style={{ minHeight: '100vh' }}>
        <nav className="lp-nav">
          <div className="lp-nav-in">
            <Logo />
          </div>
        </nav>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 65px)', padding: '40px 20px' }}>
          <div className="lp-panel" style={{ maxWidth: 480, width: '100%', padding: 40, textAlign: 'center' }}>
            <div className="lp-topbar" />
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'color-mix(in srgb, var(--win) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--win) 24%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <CheckCircle2 style={{ width: 24, height: 24, color: 'var(--win)' }} />
            </div>
            <h1 style={{ margin: '0 0 12px', fontSize: 22, fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
              Welcome to {invite.teamName}!
            </h1>
            <p style={{ margin: '0 0 8px', fontSize: 14, color: 'var(--muted)', lineHeight: 1.6 }}>
              Redirecting you to the team page…
            </p>
            <Loader2 style={{ width: 20, height: 20, color: 'var(--accent)', animation: 'spin 1s linear infinite', marginTop: 16 }} />
          </div>
        </div>
      </div>
    )
  }

  /* ── Valid invite ─────────────────────────────────────────── */
  const emailMismatch = isLoggedIn && currentUserEmail && currentUserEmail.toLowerCase() !== invite.email.toLowerCase()

  return (
    <div className="lp-bg" style={{ minHeight: '100vh' }}>
      <nav className="lp-nav">
        <div className="lp-nav-in">
          <Logo />
        </div>
      </nav>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 65px)', padding: '40px 20px' }}>
        <div className="lp-panel" style={{ maxWidth: 480, width: '100%', padding: 40 }}>
          <div className="lp-topbar" />

          {/* Icon */}
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--accent-soft)', border: '1px solid var(--accent-line)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
            <UserPlus style={{ width: 24, height: 24, color: 'var(--accent)' }} />
          </div>

          {/* Eyebrow */}
          <p style={{ margin: '0 0 8px', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent)' }}>
            Team Invitation
          </p>

          {/* Heading */}
          <h1 style={{ margin: '0 0 12px', fontSize: 26, fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-display)', lineHeight: 1.2 }}>
            Join <span style={{ color: 'var(--accent)' }}>{invite.teamName}</span>
          </h1>

          <p style={{ margin: '0 0 28px', fontSize: 15, color: 'var(--muted)', lineHeight: 1.65 }}>
            <strong style={{ color: 'var(--text)' }}>{invite.inviterName}</strong> has invited you to join their CS2 team on Rivalize — demo analysis, AI coaching, and opponent scouting.
          </p>

          {/* Invite details pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--hairline)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 28 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--faint)', letterSpacing: '0.08em', textTransform: 'uppercase', flexShrink: 0 }}>Sent to</span>
            <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{invite.email}</span>
            <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--faint)', background: 'var(--track)', padding: '2px 7px', borderRadius: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{invite.role}</span>
          </div>

          {/* Error */}
          {acceptError && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, marginBottom: 20 }}>
              <AlertCircle style={{ width: 16, height: 16, color: 'rgb(239,68,68)', flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 13, color: 'rgb(239,68,68)', lineHeight: 1.5 }}>{acceptError}</span>
            </div>
          )}

          {/* Email mismatch warning */}
          {emailMismatch && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 10, marginBottom: 20 }}>
              <AlertCircle style={{ width: 16, height: 16, color: 'rgb(251,191,36)', flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 13, color: 'rgb(251,191,36)', lineHeight: 1.5 }}>
                You&apos;re signed in as <strong>{currentUserEmail}</strong>, but this invite was sent to <strong>{invite.email}</strong>. Please sign out and sign in with the correct account.
              </span>
            </div>
          )}

          {/* CTA */}
          {isLoggedIn ? (
            <button
              onClick={handleAccept}
              disabled={accepting || !!emailMismatch}
              className="lp-btn lp-btn-accent"
              style={{ width: '100%', justifyContent: 'center', opacity: emailMismatch ? 0.5 : 1, cursor: emailMismatch ? 'not-allowed' : 'pointer' }}
            >
              {accepting ? (
                <>
                  <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
                  Joining…
                </>
              ) : (
                <>
                  <UserPlus style={{ width: 16, height: 16 }} />
                  Join {invite.teamName}
                </>
              )}
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Link
                href={`/signup?invite=${token}`}
                className="lp-btn lp-btn-accent"
                style={{ width: '100%', justifyContent: 'center', textAlign: 'center' }}
              >
                <UserPlus style={{ width: 16, height: 16 }} />
                Create account &amp; accept
              </Link>
              <Link
                href={`/login?invite=${token}`}
                className="lp-btn lp-btn-ghost"
                style={{ width: '100%', justifyContent: 'center', textAlign: 'center' }}
              >
                Sign in to accept
              </Link>
            </div>
          )}

          <p style={{ margin: '18px 0 0', fontSize: 12, color: 'var(--faint)', textAlign: 'center' }}>
            This invite expires in 7 days.
          </p>
        </div>
      </div>
    </div>
  )
}
