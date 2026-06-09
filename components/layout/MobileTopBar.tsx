'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import { Bell, Menu, X, Check, Loader2, FileVideo, UserPlus } from 'lucide-react'

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

export default function MobileTopBar() {
  const router = useRouter()
  const [notifCount, setNotifCount] = useState(0)
  const [mounted, setMounted] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [incoming, setIncoming] = useState<FriendEntry[]>([])
  const [demoNotifs, setDemoNotifs] = useState<DemoNotification[]>([])
  const [actioning, setActioning] = useState<string | null>(null)
  const [markingAll, setMarkingAll] = useState(false)

  useEffect(() => {
    setMounted(true)
    Promise.all([
      fetch('/api/friends/pending-count').then(r => r.ok ? r.json() : { count: 0 }),
      fetch('/api/notifications').then(r => r.ok ? r.json() : { notifications: [] }),
    ]).then(([friends, notifs]) => {
      setNotifCount((friends.count ?? 0) + (notifs.notifications?.length ?? 0))
      setDemoNotifs(notifs.notifications ?? [])
    }).catch(() => {})
  }, [])

  // Close on Escape + lock body scroll when sheet open
  useEffect(() => {
    if (!sheetOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setSheetOpen(false) }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [sheetOpen])

  const loadNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const [friendsRes, notifsRes] = await Promise.all([
        fetch('/api/friends'),
        fetch('/api/notifications'),
      ])
      const friendsData = friendsRes.ok ? await friendsRes.json() as { incoming: FriendEntry[] } : { incoming: [] }
      const notifsData  = notifsRes.ok  ? await notifsRes.json() as { notifications: DemoNotification[] } : { notifications: [] }
      const allIncoming = friendsData.incoming ?? []
      const allNotifs   = notifsData.notifications ?? []
      setIncoming(allIncoming)
      setDemoNotifs(allNotifs)
      setNotifCount(allIncoming.length + allNotifs.length)
    } catch {}
    setLoading(false)
  }, [])

  const openSheet = () => {
    setSheetOpen(true)
    loadNotifications()
  }

  const handleDemoClick = async (notif: DemoNotification) => {
    setSheetOpen(false)
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [notif.id] }),
    }).catch(() => {})
    setDemoNotifs(prev => prev.filter(n => n.id !== notif.id))
    setNotifCount(prev => Math.max(0, prev - 1))
    if (notif.link) router.push(notif.link)
  }

  const handleDismiss = async (notif: DemoNotification) => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [notif.id] }),
    }).catch(() => {})
    setDemoNotifs(prev => prev.filter(n => n.id !== notif.id))
    setNotifCount(prev => Math.max(0, prev - 1))
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

  const handleMarkAllRead = async () => {
    setMarkingAll(true)
    await fetch('/api/notifications', { method: 'PATCH' }).catch(() => {})
    setNotifCount(prev => Math.max(0, prev - demoNotifs.length))
    setDemoNotifs([])
    setMarkingAll(false)
  }

  const openMenu = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('rv-open-menu'))
    }
  }

  const totalCount = demoNotifs.length + incoming.length

  return (
    <>
      <header
        className="md:hidden sticky top-0 z-30 flex items-center justify-between h-14 shrink-0"
        style={{
          background: 'color-mix(in srgb, var(--panel) 90%, transparent)',
          borderBottom: '1px solid var(--border)',
          paddingLeft: 'max(16px, env(safe-area-inset-left))',
          paddingRight: 'max(16px, env(safe-area-inset-right))',
          backdropFilter: 'blur(20px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
        }}
      >
        {/* Hamburger */}
        <button
          onClick={openMenu}
          aria-label="Open navigation menu"
          className="flex items-center justify-center active:scale-90"
          style={{
            width: 44, height: 44, borderRadius: 10,
            background: 'transparent', border: 'none',
            color: 'var(--muted)', cursor: 'pointer', flexShrink: 0,
            transition: 'color 0.15s, transform 0.1s',
            WebkitTapHighlightColor: 'transparent', marginLeft: -8,
          }}
        >
          <Menu size={22} strokeWidth={1.8} aria-hidden="true" />
        </button>

        {/* Logo */}
        <Link
          href="/dashboard"
          className="flex items-center gap-2"
          style={{ textDecoration: 'none' }}
          aria-label="Rivalize home"
        >
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'linear-gradient(145deg, var(--accent), var(--accent-deep))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 2px 8px color-mix(in srgb, var(--accent) 40%, transparent)',
          }}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M4 3h8L9 9h7L7 18l2-6H5L4 3z" fill="#fff" />
            </svg>
          </div>
          <span style={{
            fontFamily: 'var(--font-display)', fontWeight: 700,
            fontSize: 15, color: 'var(--text)', letterSpacing: '0.14em',
          }}>
            RIVALIZE
          </span>
        </Link>

        {/* Notification bell */}
        <button
          onClick={openSheet}
          aria-label={notifCount > 0 ? `${notifCount} notifications` : 'Notifications'}
          aria-expanded={sheetOpen}
          className="flex items-center justify-center active:scale-90 relative"
          style={{
            width: 44, height: 44, borderRadius: 10,
            background: 'transparent', border: 'none',
            color: 'var(--muted)', cursor: 'pointer', flexShrink: 0,
            transition: 'color 0.15s, transform 0.1s',
            WebkitTapHighlightColor: 'transparent', marginRight: -8,
          }}
        >
          <Bell size={20} strokeWidth={1.8} aria-hidden="true" />
          {mounted && notifCount > 0 && (
            <span aria-hidden="true" style={{
              position: 'absolute', top: 8, right: 8,
              minWidth: 16, height: 16, borderRadius: 9,
              background: 'var(--signal)', color: '#fff',
              fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0 3px', lineHeight: 1,
            }}>
              {notifCount > 9 ? '9+' : notifCount}
            </span>
          )}
        </button>
      </header>

      {/* Bottom sheet overlay */}
      {sheetOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 60,
            display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          }}
        >
          {/* Backdrop */}
          <div
            onClick={() => setSheetOpen(false)}
            style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,0.55)',
              backdropFilter: 'blur(2px)',
              WebkitBackdropFilter: 'blur(2px)',
            }}
          />

          {/* Sheet */}
          <div
            role="dialog"
            aria-label="Notifications"
            style={{
              position: 'relative',
              background: 'var(--elevated)',
              borderTop: '1px solid var(--border-2)',
              borderRadius: '16px 16px 0 0',
              boxShadow: '0 -8px 40px rgba(0,0,0,0.5)',
              maxHeight: '80dvh',
              display: 'flex', flexDirection: 'column',
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            }}
          >
            {/* Drag handle */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 6px' }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border-2)' }} />
            </div>

            {/* Sheet header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '4px 16px 12px', flexShrink: 0,
              borderBottom: '1px solid var(--border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  fontSize: 15, fontWeight: 700, color: 'var(--text)',
                  fontFamily: 'var(--font-display)',
                }}>
                  Notifications
                </span>
                {totalCount > 0 && (
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '2px 8px',
                    background: 'color-mix(in srgb, var(--signal) 12%, transparent)',
                    color: 'var(--signal)', borderRadius: 20, fontFamily: 'var(--font-mono)',
                  }}>
                    {totalCount}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {demoNotifs.length > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    disabled={markingAll}
                    style={{
                      fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none',
                      cursor: 'pointer', fontFamily: 'var(--font-ui)', fontWeight: 500,
                      opacity: markingAll ? 0.5 : 1, padding: '4px 8px', borderRadius: 6,
                    }}
                  >
                    {markingAll ? 'Clearing…' : 'Mark all read'}
                  </button>
                )}
                <button
                  onClick={() => setSheetOpen(false)}
                  aria-label="Close notifications"
                  style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: 'var(--card)', border: '1px solid var(--border)',
                    color: 'var(--muted)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Sheet body */}
            <div style={{ overflowY: 'auto', flex: 1, padding: '8px 0' }}>
              {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
                  <Loader2 size={22} className="animate-spin" style={{ color: 'var(--signal)' }} />
                </div>
              ) : incoming.length === 0 && demoNotifs.length === 0 ? (
                <div style={{ padding: '40px 16px', textAlign: 'center' }}>
                  <Bell size={32} style={{ color: 'var(--faint)', margin: '0 auto 10px' }} />
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--muted)', fontFamily: 'var(--font-ui)' }}>
                    No new notifications
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--faint)', marginTop: 4, fontFamily: 'var(--font-ui)' }}>
                    You're all caught up!
                  </p>
                </div>
              ) : (
                <>
                  {/* Demo / system notifications */}
                  {demoNotifs.length > 0 && (
                    <>
                      <p style={{
                        fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                        letterSpacing: '0.1em', color: 'var(--faint)',
                        fontFamily: 'var(--font-ui)', padding: '4px 16px 8px',
                      }}>
                        Updates
                      </p>
                      {demoNotifs.map(notif => (
                        <div key={notif.id} style={{ position: 'relative' }}>
                          <button
                            onClick={() => handleDemoClick(notif)}
                            style={{
                              display: 'flex', alignItems: 'flex-start', gap: 12,
                              padding: '12px 52px 12px 16px', width: '100%',
                              background: 'transparent', border: 'none',
                              cursor: notif.link ? 'pointer' : 'default',
                              textAlign: 'left', minHeight: 60,
                              WebkitTapHighlightColor: 'transparent',
                            }}
                          >
                            <div style={{
                              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                              background: 'color-mix(in srgb, var(--signal) 10%, transparent)',
                              border: '1px solid color-mix(in srgb, var(--signal) 20%, transparent)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              <FileVideo size={16} style={{ color: 'var(--signal)' }} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{
                                fontSize: 13.5, fontWeight: 600, color: 'var(--text)',
                                fontFamily: 'var(--font-ui)', lineHeight: 1.3,
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}>
                                {notif.title}
                              </p>
                              {notif.body && (
                                <p style={{
                                  fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-ui)',
                                  marginTop: 2, lineHeight: 1.4,
                                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                }}>
                                  {notif.body}
                                </p>
                              )}
                              <p style={{ fontSize: 11, color: 'var(--faint)', fontFamily: 'var(--font-ui)', marginTop: 3 }}>
                                {formatRelativeTime(notif.created_at)}
                              </p>
                            </div>
                          </button>
                          <button
                            onClick={() => handleDismiss(notif)}
                            aria-label="Dismiss notification"
                            style={{
                              position: 'absolute', top: '50%', right: 14,
                              transform: 'translateY(-50%)',
                              width: 28, height: 28, borderRadius: 8,
                              background: 'var(--card)', border: '1px solid var(--border)',
                              color: 'var(--faint)', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              WebkitTapHighlightColor: 'transparent',
                            }}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </>
                  )}

                  {/* Friend requests */}
                  {incoming.length > 0 && (
                    <>
                      <p style={{
                        fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                        letterSpacing: '0.1em', color: 'var(--faint)',
                        fontFamily: 'var(--font-ui)', padding: '4px 16px 8px',
                        marginTop: demoNotifs.length > 0 ? 8 : 0,
                      }}>
                        Friend Requests
                      </p>
                      {incoming.map(entry => {
                        const name = entry.profile.display_name || entry.profile.username
                        return (
                          <div key={entry.id} style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            padding: '10px 16px', minHeight: 60,
                          }}>
                            {entry.profile.avatar_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={entry.profile.avatar_url}
                                alt={name}
                                style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                              />
                            ) : (
                              <div style={{
                                width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                                background: 'color-mix(in srgb, var(--signal) 10%, transparent)',
                                border: '1px solid color-mix(in srgb, var(--signal) 20%, transparent)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 12, fontWeight: 700, color: 'var(--signal)',
                              }}>
                                {name.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{
                                fontSize: 13.5, fontWeight: 600, color: 'var(--text)',
                                fontFamily: 'var(--font-ui)',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}>
                                {name}
                              </p>
                              <p style={{ fontSize: 11, color: 'var(--faint)', fontFamily: 'var(--font-mono)' }}>
                                @{entry.profile.username}
                              </p>
                            </div>
                            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                              <button
                                onClick={() => handleFriendAction(entry.id, 'accept')}
                                disabled={actioning === entry.id}
                                aria-label={`Accept friend request from ${name}`}
                                style={{
                                  width: 40, height: 40, borderRadius: 10, border: 'none',
                                  background: 'color-mix(in srgb, var(--signal) 12%, transparent)',
                                  color: 'var(--signal)',
                                  cursor: actioning === entry.id ? 'not-allowed' : 'pointer',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  opacity: actioning === entry.id ? 0.6 : 1,
                                  WebkitTapHighlightColor: 'transparent',
                                }}
                              >
                                {actioning === entry.id
                                  ? <Loader2 size={15} className="animate-spin" />
                                  : <Check size={16} />}
                              </button>
                              <button
                                onClick={() => handleFriendAction(entry.id, 'reject')}
                                disabled={actioning === entry.id}
                                aria-label={`Decline friend request from ${name}`}
                                style={{
                                  width: 40, height: 40, borderRadius: 10, border: 'none',
                                  background: 'color-mix(in srgb, var(--loss) 10%, transparent)',
                                  color: 'var(--loss)',
                                  cursor: actioning === entry.id ? 'not-allowed' : 'pointer',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  opacity: actioning === entry.id ? 0.6 : 1,
                                  WebkitTapHighlightColor: 'transparent',
                                }}
                              >
                                <X size={16} />
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
            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
              <Link
                href="/friends"
                onClick={() => setSheetOpen(false)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  width: '100%', padding: '11px 0', borderRadius: 10,
                  border: '1px solid var(--border)',
                  color: 'var(--muted)', fontSize: 13,
                  textDecoration: 'none', fontFamily: 'var(--font-ui)',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <UserPlus size={14} />
                Manage Friends
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
