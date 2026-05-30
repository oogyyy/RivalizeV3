'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Users, Check, X, Loader2, ChevronLeft, ChevronRight, ExternalLink, UserPlus,
} from 'lucide-react'
import Link from 'next/link'

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

function Avatar({ profile }: { profile: FriendProfile }) {
  const name = profile.display_name || profile.username
  if (profile.avatar_url) return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={profile.avatar_url} alt={name}
      style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  )
  return (
    <div style={{
      width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
      background: 'rgba(0,255,200,0.12)', border: '1.5px solid rgba(0,255,200,0.25)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 11, fontWeight: 700, color: '#00ffc8',
    }}>
      {name.slice(0, 2).toUpperCase()}
    </div>
  )
}

export default function SocialPanel() {
  const [open, setOpen] = useState(false)
  const [friends, setFriends] = useState<FriendEntry[]>([])
  const [incoming, setIncoming] = useState<FriendEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [actioning, setActioning] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/friends')
    if (res.ok) {
      const d = await res.json() as { friends: FriendEntry[]; incoming: FriendEntry[] }
      setFriends(d.friends)
      setIncoming(d.incoming)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    // Load pending count even when closed for the badge
    fetch('/api/friends/pending-count')
      .then(r => r.ok ? r.json() : { count: 0 })
      .then((d: { count: number }) => {
        if (d.count > 0) setIncoming(Array(d.count).fill(null) as FriendEntry[])
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  const handleAction = async (id: string, action: 'accept' | 'reject') => {
    setActioning(id)
    await fetch(`/api/friends/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    await load()
    setActioning(null)
  }

  const pendingCount = incoming.filter(e => e !== null).length

  return (
    <aside
      className="hidden md:flex flex-col h-full shrink-0"
      style={{
        width: open ? 260 : 40,
        minWidth: open ? 260 : 40,
        transition: 'width 0.22s ease, min-width 0.22s ease',
        borderLeft: '1px solid rgba(255,255,255,0.07)',
        background: 'rgba(6,5,18,0.97)',
        position: 'relative',
        zIndex: 10,
        overflow: 'hidden',
      }}
    >
      {/* Tab strip — always visible */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 40,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        borderRight: open ? '1px solid rgba(255,255,255,0.07)' : 'none',
        zIndex: 2,
      }}>
        {/* Toggle button */}
        <button
          onClick={() => setOpen(v => !v)}
          title={open ? 'Close social panel' : 'Open social panel'}
          style={{
            marginTop: 14,
            width: 28, height: 28, borderRadius: 7,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.4)', cursor: 'pointer',
            transition: 'all 0.12s', flexShrink: 0,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = 'rgba(255,255,255,0.8)'
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.22)'
            e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = 'rgba(255,255,255,0.4)'
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
            e.currentTarget.style.background = 'transparent'
          }}
        >
          {open ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
        </button>

        {/* Rotated label + badge */}
        <div style={{
          marginTop: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          position: 'relative',
        }}>
          <Users size={15} style={{ color: 'rgba(255,255,255,0.28)', flexShrink: 0 }} />
          <span style={{
            writingMode: 'vertical-rl', textOrientation: 'mixed',
            transform: 'rotate(180deg)',
            fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
            color: 'rgba(255,255,255,0.22)',
            textTransform: 'uppercase',
            fontFamily: 'var(--font-inter, Inter), sans-serif',
            userSelect: 'none',
          }}>
            Social
          </span>
          {pendingCount > 0 && (
            <div style={{
              width: 16, height: 16, borderRadius: '50%',
              background: '#00ffc8', color: '#060512',
              fontSize: 9, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              {pendingCount}
            </div>
          )}
        </div>
      </div>

      {/* Panel content — shifts in when open */}
      <div style={{
        position: 'absolute', left: 40, top: 0, bottom: 0, right: 0,
        opacity: open ? 1 : 0,
        transition: 'opacity 0.18s ease',
        pointerEvents: open ? 'auto' : 'none',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 14px 10px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <span style={{
            fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)',
            textTransform: 'uppercase', letterSpacing: '0.1em',
            fontFamily: 'var(--font-inter, Inter), sans-serif',
          }}>
            Social
          </span>
          <Link
            href="/friends"
            title="Manage friends"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 24, height: 24, borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.35)', textDecoration: 'none',
              transition: 'all 0.12s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.8)'
              ;(e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(255,255,255,0.22)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.35)'
              ;(e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(255,255,255,0.1)'
            }}
          >
            <ExternalLink size={11} />
          </Link>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
              <Loader2 size={18} style={{ color: '#00ffc8', animation: 'spin 1s linear infinite' }} />
            </div>
          ) : (
            <>
              {/* Incoming requests */}
              {incoming.length > 0 && incoming[0] !== null && (
                <div style={{ marginBottom: 12 }}>
                  <p style={{
                    fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '0.1em', color: 'rgba(255,255,255,0.28)',
                    fontFamily: 'var(--font-inter, Inter), sans-serif',
                    padding: '4px 4px 6px',
                  }}>
                    Requests ({incoming.length})
                  </p>
                  {incoming.map(entry => entry && (
                    <div key={entry.id} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '6px 4px', borderRadius: 7,
                    }}>
                      <Avatar profile={entry.profile} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          fontSize: 12, fontWeight: 600, color: '#fff',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          fontFamily: 'var(--font-inter, Inter), sans-serif',
                        }}>
                          {entry.profile.display_name || entry.profile.username}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <button
                          onClick={() => handleAction(entry.id, 'accept')}
                          disabled={actioning === entry.id}
                          style={{
                            width: 22, height: 22, borderRadius: 5, border: 'none',
                            background: 'rgba(0,255,200,0.15)', color: '#00ffc8',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          {actioning === entry.id
                            ? <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} />
                            : <Check size={10} />}
                        </button>
                        <button
                          onClick={() => handleAction(entry.id, 'reject')}
                          disabled={actioning === entry.id}
                          style={{
                            width: 22, height: 22, borderRadius: 5, border: 'none',
                            background: 'rgba(255,80,80,0.12)', color: 'rgba(255,80,80,0.7)',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          <X size={10} />
                        </button>
                      </div>
                    </div>
                  ))}
                  <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '8px 0' }} />
                </div>
              )}

              {/* Friends list */}
              <p style={{
                fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.1em', color: 'rgba(255,255,255,0.28)',
                fontFamily: 'var(--font-inter, Inter), sans-serif',
                padding: '4px 4px 6px',
              }}>
                Friends ({friends.length})
              </p>

              {friends.length === 0 && !loading ? (
                <div style={{ textAlign: 'center', padding: '20px 8px' }}>
                  <UserPlus size={22} style={{ color: 'rgba(255,255,255,0.12)', margin: '0 auto 8px' }} />
                  <p style={{
                    fontSize: 11, color: 'rgba(255,255,255,0.28)',
                    fontFamily: 'var(--font-inter, Inter), sans-serif',
                  }}>
                    No friends yet
                  </p>
                  <Link
                    href="/friends"
                    style={{
                      fontSize: 11, color: '#00ffc8', textDecoration: 'none',
                      fontFamily: 'var(--font-inter, Inter), sans-serif',
                    }}
                  >
                    Add friends →
                  </Link>
                </div>
              ) : (
                friends.map(entry => (
                  <Link
                    key={entry.id}
                    href={`/u/${entry.profile.username}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '6px 4px', borderRadius: 7,
                      textDecoration: 'none', transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <Avatar profile={entry.profile} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.75)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        fontFamily: 'var(--font-inter, Inter), sans-serif',
                      }}>
                        {entry.profile.display_name || entry.profile.username}
                      </p>
                      <p style={{
                        fontSize: 10, color: 'rgba(255,255,255,0.28)',
                        fontFamily: 'var(--font-inter, Inter), sans-serif',
                      }}>
                        @{entry.profile.username}
                      </p>
                    </div>
                  </Link>
                ))
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '10px 14px',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          flexShrink: 0,
        }}>
          <Link
            href="/friends"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              width: '100%', padding: '7px 0', borderRadius: 7,
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.4)', fontSize: 11,
              textDecoration: 'none',
              fontFamily: 'var(--font-inter, Inter), sans-serif',
              transition: 'all 0.12s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.75)'
              ;(e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(255,255,255,0.2)'
              ;(e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.04)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.4)'
              ;(e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(255,255,255,0.1)'
              ;(e.currentTarget as HTMLAnchorElement).style.background = 'transparent'
            }}
          >
            <Users size={12} />
            Manage Friends
          </Link>
        </div>
      </div>
    </aside>
  )
}
