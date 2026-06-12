'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { LogOut, User, Settings, ChevronDown, Upload, Bell, Check, X, Loader2, UserPlus, FileVideo } from 'lucide-react'
import type { Profile } from '@/types/database'
import CommandPalette from './CommandPalette'

interface FriendProfile {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
}
interface FriendEntry {
  id: string
  profile: FriendProfile
}
interface DemoNotification {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  created_at: string
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const PLAN_BADGE: Record<string, { label: string; color: string; bg: string; border: string }> = {
  pro:  { label: 'Pro',  color: 'var(--accent)',  bg: 'color-mix(in srgb, var(--accent) 14%, transparent)',  border: 'color-mix(in srgb, var(--accent) 30%, transparent)' },
  team: { label: 'Team', color: 'var(--signal)',  bg: 'color-mix(in srgb, var(--signal) 14%, transparent)',  border: 'color-mix(in srgb, var(--signal) 30%, transparent)' },
}

export default function TopBar({ profile, plan }: { profile: Profile | null; plan?: 'pro' | 'team' | null }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [incoming, setIncoming] = useState<FriendEntry[]>([])
  const [demoNotifs, setDemoNotifs] = useState<DemoNotification[]>([])
  const [notifLoading, setNotifLoading] = useState(false)
  const [actioning, setActioning] = useState<string | null>(null)
  const [markingAll, setMarkingAll] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)

  const displayName = profile?.display_name || profile?.username || 'Player'
  const initials = displayName[0].toUpperCase()

  // Close user dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Close notification panel on outside click or Escape
  useEffect(() => {
    const clickHandler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
    }
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNotifOpen(false)
    }
    document.addEventListener('mousedown', clickHandler)
    document.addEventListener('keydown', keyHandler)
    return () => {
      document.removeEventListener('mousedown', clickHandler)
      document.removeEventListener('keydown', keyHandler)
    }
  }, [])

  // Fetch pending counts on mount and refresh every 60s so the badge stays
  // live while demos parse in the background
  useEffect(() => {
    const fetchCounts = () => {
      Promise.all([
        fetch('/api/friends/pending-count').then(r => r.ok ? r.json() : { count: 0 }),
        fetch('/api/notifications').then(r => r.ok ? r.json() : { notifications: [] }),
      ]).then(([friends, notifs]: [{ count: number }, { notifications: DemoNotification[] }]) => {
        const allNotifs = notifs.notifications ?? []
        setPendingCount((friends.count ?? 0) + allNotifs.length)
        setDemoNotifs(allNotifs)
      }).catch(() => {})
    }
    fetchCounts()
    const interval = setInterval(fetchCounts, 60_000)
    return () => clearInterval(interval)
  }, [])

  // Global ⌘K / Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setPaletteOpen(v => !v)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const loadNotifications = useCallback(async () => {
    setNotifLoading(true)
    try {
      const [friendsRes, notifsRes] = await Promise.all([
        fetch('/api/friends'),
        fetch('/api/notifications'),
      ])
      const friendsData = friendsRes.ok ? await friendsRes.json() as { incoming: FriendEntry[] } : { incoming: [] }
      const notifsData  = notifsRes.ok  ? await notifsRes.json() as { notifications: DemoNotification[] } : { notifications: [] }

      const allNotifs = notifsData.notifications ?? []
      const allIncoming = friendsData.incoming ?? []
      setIncoming(allIncoming)
      setDemoNotifs(allNotifs)
      setPendingCount(allIncoming.length + allNotifs.length)
    } catch {}
    setNotifLoading(false)
  }, [])

  const handleNotifToggle = () => {
    const next = !notifOpen
    setNotifOpen(next)
    if (next) loadNotifications()
  }

  const handleFriendAction = async (id: string, action: 'accept' | 'reject') => {
    setActioning(id)
    await fetch(`/api/friends/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    await loadNotifications()
    setActioning(null)
  }

  const handleDemoNotifClick = async (notif: DemoNotification) => {
    setNotifOpen(false)
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [notif.id] }),
    }).catch(() => {})
    setDemoNotifs(prev => prev.filter(n => n.id !== notif.id))
    setPendingCount(prev => Math.max(0, prev - 1))
    if (notif.link) router.push(notif.link)
  }

  const handleDismissNotif = async (e: React.MouseEvent, notif: DemoNotification) => {
    e.stopPropagation()
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [notif.id] }),
    }).catch(() => {})
    setDemoNotifs(prev => prev.filter(n => n.id !== notif.id))
    setPendingCount(prev => Math.max(0, prev - 1))
  }

  const handleMarkAllRead = async () => {
    setMarkingAll(true)
    await fetch('/api/notifications', { method: 'PATCH' }).catch(() => {})
    setDemoNotifs([])
    setPendingCount(prev => Math.max(0, prev - demoNotifs.length))
    setMarkingAll(false)
  }

  const handleLogout = async () => {
    setLoggingOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const menuItem = (href: string, Icon: React.ElementType, label: string) => (
    <Link
      href={href}
      onClick={() => setOpen(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 9,
        padding: '8px 14px', textDecoration: 'none',
        color: 'var(--muted)', fontSize: 13,
        fontFamily: 'var(--font-ui)',
        transition: 'color 0.12s, background 0.12s',
        borderRadius: 8,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.color = 'var(--text)'
        e.currentTarget.style.background = 'var(--hairline)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.color = 'var(--muted)'
        e.currentTarget.style.background = 'transparent'
      }}
    >
      <Icon size={14} />
      {label}
    </Link>
  )

  const totalCount = demoNotifs.length + incoming.length

  return (
    <>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

      <div
        className="hidden md:flex"
        style={{
          alignItems: 'center',
          gap: 14,
          padding: '0 20px',
          height: 56,
          flexShrink: 0,
          borderBottom: '1px solid var(--border)',
          background: 'color-mix(in srgb, var(--bg) 72%, transparent)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          position: 'sticky',
          top: 0,
          zIndex: 20,
        }}
      >
        {/* Search — opens command palette */}
        <button
          onClick={() => setPaletteOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 9, flex: 1, maxWidth: 400, height: 37,
            padding: '0 14px', borderRadius: 10, background: 'var(--card)',
            border: '1px solid var(--border)', color: 'var(--faint)',
            transition: 'border-color .14s ease',
            cursor: 'text', textAlign: 'left',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-2)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
          </svg>
          <span style={{ fontSize: 13, fontFamily: 'var(--font-ui)', color: 'var(--faint)', flex: 1 }}>
            Search opponents, demos, players…
          </span>
          <kbd style={{
            marginLeft: 'auto', fontSize: 10, fontFamily: 'var(--font-mono)',
            color: 'var(--faint)', border: '1px solid var(--border)',
            borderRadius: 5, padding: '1px 5px',
          }}>⌘K</kbd>
        </button>

        <div style={{ flex: 1 }} />

        {/* Upload icon button */}
        <button
          onClick={() => router.push('/opponents')}
          style={{
            width: 37, height: 37, borderRadius: 10, cursor: 'pointer',
            background: 'transparent', border: '1px solid transparent',
            color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all .13s ease',
          }}
          title="Upload demo"
          onMouseEnter={e => {
            e.currentTarget.style.background = 'var(--card)'
            e.currentTarget.style.borderColor = 'var(--border)'
            e.currentTarget.style.color = 'var(--text)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.borderColor = 'transparent'
            e.currentTarget.style.color = 'var(--muted)'
          }}
        >
          <Upload size={17} />
        </button>

        {/* Bell icon button + notification dropdown */}
        <div ref={notifRef} style={{ position: 'relative' }}>
          <button
            onClick={handleNotifToggle}
            aria-label={pendingCount > 0 ? `Notifications (${pendingCount} unread)` : 'Notifications'}
            aria-expanded={notifOpen}
            aria-haspopup="dialog"
            style={{
              width: 37, height: 37, borderRadius: 10, cursor: 'pointer',
              background: notifOpen ? 'var(--card)' : 'transparent',
              border: `1px solid ${notifOpen ? 'var(--border)' : 'transparent'}`,
              color: notifOpen ? 'var(--text)' : 'var(--muted)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all .13s ease', position: 'relative',
            }}
            onMouseEnter={e => {
              if (!notifOpen) {
                e.currentTarget.style.background = 'var(--card)'
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.color = 'var(--text)'
              }
            }}
            onMouseLeave={e => {
              if (!notifOpen) {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.borderColor = 'transparent'
                e.currentTarget.style.color = 'var(--muted)'
              }
            }}
          >
            <Bell size={17} />
            {pendingCount > 0 && (
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute', top: 7, right: 7,
                  width: 7, height: 7, borderRadius: '50%',
                  background: 'var(--signal)', boxShadow: '0 0 6px var(--signal)',
                }}
              />
            )}
          </button>

          {/* Notification dropdown */}
          {notifOpen && (
            <div
              role="dialog"
              aria-label="Notifications"
              style={{
                position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                width: 320,
                background: 'var(--elevated)',
                border: '1px solid var(--border-2)',
                borderRadius: 12,
                boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                zIndex: 50,
                overflow: 'hidden',
              }}
            >
              {/* Header */}
              <div style={{
                padding: '12px 14px 10px',
                borderBottom: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontSize: 12, fontWeight: 700, color: 'var(--text)',
                    fontFamily: 'var(--font-ui)', textTransform: 'uppercase', letterSpacing: '0.08em',
                  }}>
                    Notifications
                  </span>
                  {totalCount > 0 && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 7px',
                      background: 'color-mix(in srgb, var(--signal) 12%, transparent)',
                      color: 'var(--signal)',
                      borderRadius: 20, fontFamily: 'var(--font-mono)',
                    }}>
                      {totalCount}
                    </span>
                  )}
                </div>
                {demoNotifs.length > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    disabled={markingAll}
                    style={{
                      fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none',
                      cursor: 'pointer', fontFamily: 'var(--font-ui)', fontWeight: 500,
                      opacity: markingAll ? 0.5 : 1, padding: '2px 4px', borderRadius: 4,
                      transition: 'opacity 0.12s',
                    }}
                  >
                    {markingAll ? 'Clearing…' : 'Mark all read'}
                  </button>
                )}
              </div>

              {/* Body */}
              <div style={{ maxHeight: 380, overflowY: 'auto', padding: '6px 0' }}>
                {notifLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '28px 0' }}>
                    <Loader2 size={18} className="animate-spin" style={{ color: 'var(--signal)' }} />
                  </div>
                ) : incoming.length === 0 && demoNotifs.length === 0 ? (
                  <div style={{ padding: '28px 16px', textAlign: 'center' }}>
                    <Bell size={24} style={{ color: 'var(--faint)', margin: '0 auto 8px' }} />
                    <p style={{ fontSize: 12, color: 'var(--faint)', fontFamily: 'var(--font-ui)' }}>
                      No new notifications
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Demo / system notifications */}
                    {demoNotifs.length > 0 && (
                      <>
                        <p style={{
                          fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                          letterSpacing: '0.1em', color: 'var(--faint)',
                          fontFamily: 'var(--font-ui)', padding: '4px 14px 6px',
                        }}>
                          Updates
                        </p>
                        {demoNotifs.map(notif => (
                          <div
                            key={notif.id}
                            style={{ position: 'relative' }}
                          >
                            <button
                              onClick={() => handleDemoNotifClick(notif)}
                              style={{
                                display: 'flex', alignItems: 'flex-start', gap: 10,
                                padding: '9px 40px 9px 14px', width: '100%', background: 'transparent',
                                border: 'none', cursor: notif.link ? 'pointer' : 'default', textAlign: 'left',
                                transition: 'background 0.12s', minHeight: 52,
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'var(--hairline)' }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                            >
                              <div style={{
                                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                                background: 'color-mix(in srgb, var(--signal) 10%, transparent)',
                                border: '1px solid color-mix(in srgb, var(--signal) 20%, transparent)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>
                                <FileVideo size={14} style={{ color: 'var(--signal)' }} />
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{
                                  fontSize: 12.5, fontWeight: 600, color: 'var(--text)',
                                  fontFamily: 'var(--font-ui)', lineHeight: 1.3,
                                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                }}>
                                  {notif.title}
                                </p>
                                {notif.body && (
                                  <p style={{
                                    fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-ui)',
                                    marginTop: 2, lineHeight: 1.4,
                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                  }}>
                                    {notif.body}
                                  </p>
                                )}
                                <p style={{ fontSize: 10, color: 'var(--faint)', fontFamily: 'var(--font-ui)', marginTop: 3 }}>
                                  {formatRelativeTime(notif.created_at)}
                                </p>
                              </div>
                            </button>
                            {/* Dismiss button */}
                            <button
                              onClick={e => handleDismissNotif(e, notif)}
                              aria-label="Dismiss notification"
                              style={{
                                position: 'absolute', top: '50%', right: 10,
                                transform: 'translateY(-50%)',
                                width: 22, height: 22, borderRadius: 6,
                                background: 'transparent', border: 'none',
                                color: 'var(--faint)', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'color 0.12s, background 0.12s',
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.color = 'var(--text)'
                                e.currentTarget.style.background = 'var(--hairline)'
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.color = 'var(--faint)'
                                e.currentTarget.style.background = 'transparent'
                              }}
                            >
                              <X size={11} />
                            </button>
                          </div>
                        ))}
                      </>
                    )}

                    {/* Friend requests */}
                    {incoming.length > 0 && (
                      <>
                        <p style={{
                          fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                          letterSpacing: '0.1em', color: 'var(--faint)',
                          fontFamily: 'var(--font-ui)', padding: '4px 14px 6px',
                          marginTop: demoNotifs.length > 0 ? 4 : 0,
                        }}>
                          Friend Requests
                        </p>
                        {incoming.map(entry => {
                          const name = entry.profile.display_name || entry.profile.username
                          return (
                            <div key={entry.id} style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              padding: '8px 14px', minHeight: 52,
                            }}>
                              {entry.profile.avatar_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={entry.profile.avatar_url}
                                  alt={name}
                                  style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                                />
                              ) : (
                                <div style={{
                                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                                  background: 'color-mix(in srgb, var(--signal) 10%, transparent)',
                                  border: '1px solid color-mix(in srgb, var(--signal) 20%, transparent)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: 11, fontWeight: 700, color: 'var(--signal)',
                                }}>
                                  {name.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{
                                  fontSize: 12.5, fontWeight: 600, color: 'var(--text)',
                                  fontFamily: 'var(--font-ui)',
                                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                }}>
                                  {name}
                                </p>
                                <p style={{ fontSize: 10.5, color: 'var(--faint)', fontFamily: 'var(--font-mono)' }}>
                                  @{entry.profile.username}
                                </p>
                              </div>
                              <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                                <button
                                  onClick={() => handleFriendAction(entry.id, 'accept')}
                                  disabled={actioning === entry.id}
                                  aria-label={`Accept friend request from ${name}`}
                                  title="Accept"
                                  style={{
                                    width: 36, height: 36, borderRadius: 8, border: 'none',
                                    background: 'color-mix(in srgb, var(--signal) 12%, transparent)',
                                    color: 'var(--signal)',
                                    cursor: actioning === entry.id ? 'not-allowed' : 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    opacity: actioning === entry.id ? 0.6 : 1,
                                    transition: 'opacity 0.12s, background 0.12s',
                                  }}
                                >
                                  {actioning === entry.id
                                    ? <Loader2 size={13} className="animate-spin" />
                                    : <Check size={14} />}
                                </button>
                                <button
                                  onClick={() => handleFriendAction(entry.id, 'reject')}
                                  disabled={actioning === entry.id}
                                  aria-label={`Decline friend request from ${name}`}
                                  title="Decline"
                                  style={{
                                    width: 36, height: 36, borderRadius: 8, border: 'none',
                                    background: 'color-mix(in srgb, var(--loss) 10%, transparent)',
                                    color: 'var(--loss)',
                                    cursor: actioning === entry.id ? 'not-allowed' : 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    opacity: actioning === entry.id ? 0.6 : 1,
                                    transition: 'opacity 0.12s, background 0.12s',
                                  }}
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </>
                    )}
                  </>
                )}
              </div>

              {/* Footer */}
              <div style={{ padding: '8px 10px', borderTop: '1px solid var(--border)', display: 'flex', gap: 6 }}>
                {([
                  { href: '/notifications', Icon: Bell, label: 'All notifications' },
                  { href: '/friends', Icon: UserPlus, label: 'Manage Friends' },
                ] as const).map(({ href, Icon, label }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setNotifOpen(false)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      flex: 1, padding: '7px 0', borderRadius: 7,
                      border: '1px solid var(--border)',
                      color: 'var(--muted)', fontSize: 11,
                      textDecoration: 'none', fontFamily: 'var(--font-ui)',
                      transition: 'all 0.12s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.color = 'var(--text)'
                      e.currentTarget.style.borderColor = 'var(--border-2)'
                      e.currentTarget.style.background = 'var(--hairline)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.color = 'var(--muted)'
                      e.currentTarget.style.borderColor = 'var(--border)'
                      e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    <Icon size={12} />
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <span style={{ width: 1, height: 22, background: 'var(--border)' }} />

        {/* User dropdown */}
        <div ref={ref} style={{ position: 'relative' }}>
          <button
            onClick={() => setOpen(v => !v)}
            aria-expanded={open}
            aria-haspopup="menu"
            style={{
              display: 'flex', alignItems: 'center', gap: 9,
              background: open ? 'var(--hairline)' : 'transparent',
              border: '1px solid',
              borderColor: open ? 'var(--border-2)' : 'transparent',
              borderRadius: 10, padding: '5px 10px 5px 5px',
              cursor: 'pointer', transition: 'all 0.12s', outline: 'none',
            }}
            onMouseEnter={e => {
              if (!open) {
                e.currentTarget.style.background = 'var(--hairline)'
                e.currentTarget.style.borderColor = 'var(--border)'
              }
            }}
            onMouseLeave={e => {
              if (!open) {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.borderColor = 'transparent'
              }
            }}
          >
            {/* Avatar */}
            {profile?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar_url}
                alt={displayName}
                style={{
                  width: 32, height: 32, borderRadius: 9, objectFit: 'cover', flexShrink: 0,
                  border: '1px solid var(--accent-line)',
                }}
              />
            ) : (
              <div style={{
                width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                background: 'var(--accent-soft)', border: '1px solid var(--accent-line)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-display)',
                fontWeight: 700, fontSize: 13, color: 'var(--accent)',
              }}>
                {initials}
              </div>
            )}

            {/* Name */}
            <div style={{ textAlign: 'left', lineHeight: 1.25 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-ui)' }}>
                {displayName}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 1 }}>
                {profile?.username && (
                  <span style={{ fontSize: 10.5, color: 'var(--faint)', fontFamily: 'var(--font-mono)' }}>
                    @{profile.username}
                  </span>
                )}
                {plan && PLAN_BADGE[plan] && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: '0.07em',
                    fontFamily: 'var(--font-mono)', textTransform: 'uppercase',
                    color: PLAN_BADGE[plan].color,
                    background: PLAN_BADGE[plan].bg,
                    border: `1px solid ${PLAN_BADGE[plan].border}`,
                    padding: '1px 5px', borderRadius: 4,
                  }}>
                    {PLAN_BADGE[plan].label}
                  </span>
                )}
              </div>
            </div>

            <ChevronDown
              size={13}
              style={{
                color: 'var(--faint)',
                transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.15s',
                flexShrink: 0,
              }}
            />
          </button>

          {/* Dropdown menu */}
          {open && (
            <div
              role="menu"
              style={{
                position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                minWidth: 190,
                background: 'var(--elevated)',
                border: '1px solid var(--border-2)',
                borderRadius: 12,
                boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
                backdropFilter: 'blur(20px)',
                padding: '6px',
                zIndex: 50,
              }}
            >
              {/* User header */}
              <div style={{
                padding: '8px 14px 10px',
                borderBottom: '1px solid var(--border)',
                marginBottom: 4,
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-ui)' }}>
                  {displayName}
                </div>
                {profile?.username && (
                  <div style={{ fontSize: 11, color: 'var(--faint)', fontFamily: 'var(--font-mono)' }}>
                    @{profile.username}
                  </div>
                )}
              </div>

              {menuItem('/profile', User, 'Profile')}
              {menuItem('/settings', Settings, 'Settings')}

              <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

              {/* Sign out */}
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                role="menuitem"
                style={{
                  display: 'flex', alignItems: 'center', gap: 9, width: '100%',
                  padding: '8px 14px', background: 'transparent', border: 'none',
                  color: 'var(--loss)', fontSize: 13, borderRadius: 8,
                  fontFamily: 'var(--font-ui)',
                  cursor: loggingOut ? 'not-allowed' : 'pointer',
                  opacity: loggingOut ? 0.5 : 1,
                  transition: 'color 0.12s, background 0.12s',
                  outline: 'none',
                }}
                onMouseEnter={e => {
                  if (!loggingOut) {
                    e.currentTarget.style.background = 'color-mix(in srgb, var(--loss) 10%, transparent)'
                  }
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                <LogOut size={14} />
                {loggingOut ? 'Signing out…' : 'Sign out'}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
