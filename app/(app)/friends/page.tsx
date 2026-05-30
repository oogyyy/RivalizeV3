'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Users, UserPlus, Check, X, Loader2, Search,
  UserMinus, Clock, UserCheck, AlertCircle, ExternalLink, Mail,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Link from 'next/link'

// ─── types ────────────────────────────────────────────────────────────────────

interface FriendProfile {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  preferred_roles: string[] | null
}

interface FriendEntry {
  id: string
  status: string
  created_at: string
  profile: FriendProfile
}

interface FriendData {
  friends: FriendEntry[]
  incoming: FriendEntry[]
  outgoing: FriendEntry[]
}

interface TeamInvitation {
  id: string
  created_at: string
  team: { id: string; name: string; slug: string; logo_url: string | null }
  inviter: { id: string; username: string; display_name: string | null; avatar_url: string | null }
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function Avatar({ profile, size = 'md' }: { profile: FriendProfile; size?: 'sm' | 'md' }) {
  const sz = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm'
  const name = profile.display_name || profile.username
  const initials = name.slice(0, 2).toUpperCase()
  if (profile.avatar_url) return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={profile.avatar_url} alt={name} className={cn(sz, 'rounded-full object-cover shrink-0')} />
  )
  return (
    <div className={cn(sz, 'rounded-full bg-neon-green/20 border border-neon-green/30 flex items-center justify-center shrink-0')}>
      <span className="font-bold text-neon-green">{initials}</span>
    </div>
  )
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function FriendsPage() {
  const [data, setData] = useState<FriendData>({ friends: [], incoming: [], outgoing: [] })
  const [teamInvitations, setTeamInvitations] = useState<TeamInvitation[]>([])
  const [loading, setLoading] = useState(true)
  const [searchValue, setSearchValue] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [sendSuccess, setSendSuccess] = useState<string | null>(null)
  const [actioning, setActioning] = useState<string | null>(null)
  const [teamActioning, setTeamActioning] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [friendsRes, invitesRes] = await Promise.all([
      fetch('/api/friends'),
      fetch('/api/team-invitations'),
    ])
    if (friendsRes.ok) setData(await friendsRes.json() as FriendData)
    if (invitesRes.ok) setTeamInvitations(await invitesRes.json() as TeamInvitation[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    const username = searchValue.trim()
    if (!username) return
    setSending(true)
    setSendError(null)
    setSendSuccess(null)

    const res = await fetch('/api/friends', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    })
    const body = await res.json() as { error?: string; message?: string; status?: string; profile?: FriendProfile }

    if (!res.ok) {
      setSendError(body.error ?? 'Failed to send request')
    } else {
      const name = body.profile?.display_name || body.profile?.username || username
      setSendSuccess(
        body.status === 'accepted'
          ? `You and ${name} are now friends!`
          : `Friend request sent to ${name}`
      )
      setSearchValue('')
      await load()
    }
    setSending(false)
  }

  const handleAction = async (id: string, action: 'accept' | 'reject' | 'delete') => {
    setActioning(id)
    if (action === 'delete') {
      await fetch(`/api/friends/${id}`, { method: 'DELETE' })
    } else {
      await fetch(`/api/friends/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
    }
    await load()
    setActioning(null)
  }

  const handleTeamInvitation = async (id: string, action: 'accept' | 'decline') => {
    setTeamActioning(id)
    await fetch(`/api/team-invitations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    await load()
    setTeamActioning(null)
  }

  const totalPending = data.incoming.length + teamInvitations.length

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Users size={22} className="text-neon-green" />
          Friends
          {totalPending > 0 && (
            <span className="ml-1 px-2 py-0.5 rounded-full bg-neon-green text-black text-xs font-bold">
              {totalPending}
            </span>
          )}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Add teammates to share team analysis and opponent prep
        </p>
      </div>

      {/* Add friend */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <UserPlus size={14} className="text-neon-green" />
          Add Friend
        </h2>
        <form onSubmit={handleSend} className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              value={searchValue}
              onChange={e => setSearchValue(e.target.value)}
              placeholder="Enter username (e.g. john123)"
              className="pl-9"
              disabled={sending}
            />
          </div>
          <Button type="submit" variant="neon" disabled={sending || !searchValue.trim()} className="gap-2 shrink-0">
            {sending ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
            Send Request
          </Button>
        </form>
        {sendError && (
          <p className="mt-2 text-sm text-red-400 flex items-center gap-1.5">
            <AlertCircle size={13} />{sendError}
          </p>
        )}
        {sendSuccess && (
          <p className="mt-2 text-sm text-neon-green flex items-center gap-1.5">
            <Check size={13} />{sendSuccess}
          </p>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-neon-green" />
        </div>
      ) : (
        <>
          {/* Team invitations */}
          {teamInvitations.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Mail size={12} />
                Team Invitations ({teamInvitations.length})
              </h2>
              <div className="rounded-xl border border-neon-green/20 bg-neon-green/5 divide-y divide-border overflow-hidden">
                {teamInvitations.map(invite => {
                  const inviterName = invite.inviter.display_name || invite.inviter.username
                  return (
                    <div key={invite.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="w-10 h-10 rounded-xl bg-neon-green/10 border border-neon-green/20 flex items-center justify-center shrink-0">
                        {invite.team.logo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={invite.team.logo_url} alt={invite.team.name} className="w-full h-full object-cover rounded-xl" />
                        ) : (
                          <span className="text-sm font-bold text-neon-green">{invite.team.name.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{invite.team.name}</p>
                        <p className="text-xs text-muted-foreground">Invited by @{inviterName}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="neon"
                          className="gap-1.5 text-xs h-8"
                          onClick={() => handleTeamInvitation(invite.id, 'accept')}
                          disabled={teamActioning === invite.id}
                        >
                          {teamActioning === invite.id ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                          Join
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 text-xs h-8 text-red-400 border-red-400/30 hover:border-red-400/60"
                          onClick={() => handleTeamInvitation(invite.id, 'decline')}
                          disabled={teamActioning === invite.id}
                        >
                          <X size={11} />
                          Decline
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* Incoming requests */}
          {data.incoming.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Clock size={12} />
                Incoming Requests ({data.incoming.length})
              </h2>
              <div className="rounded-xl border border-neon-green/20 bg-neon-green/5 divide-y divide-border overflow-hidden">
                {data.incoming.map(entry => (
                  <div key={entry.id} className="flex items-center gap-3 px-4 py-3">
                    <Avatar profile={entry.profile} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {entry.profile.display_name || entry.profile.username}
                      </p>
                      <p className="text-xs text-muted-foreground">@{entry.profile.username}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="neon"
                        className="gap-1.5 text-xs h-8"
                        onClick={() => handleAction(entry.id, 'accept')}
                        disabled={actioning === entry.id}
                      >
                        {actioning === entry.id ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs h-8 text-red-400 border-red-400/30 hover:border-red-400/60"
                        onClick={() => handleAction(entry.id, 'reject')}
                        disabled={actioning === entry.id}
                      >
                        <X size={11} />
                        Decline
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Friends list */}
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <UserCheck size={12} />
              Friends ({data.friends.length})
            </h2>
            {data.friends.length > 0 ? (
              <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
                {data.friends.map(entry => (
                  <div key={entry.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/10 transition-colors">
                    <Avatar profile={entry.profile} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {entry.profile.display_name || entry.profile.username}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-2">
                        @{entry.profile.username}
                        {(entry.profile.preferred_roles ?? []).slice(0, 2).map(r => (
                          <span key={r} className="px-1.5 py-0.5 rounded bg-muted/40 text-[10px]">{r}</span>
                        ))}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Link href={`/u/${entry.profile.username}`}>
                        <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8">
                          <ExternalLink size={11} />
                          View
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs h-8 text-red-400 border-red-400/30 hover:border-red-400/60"
                        onClick={() => handleAction(entry.id, 'delete')}
                        disabled={actioning === entry.id}
                      >
                        {actioning === entry.id ? <Loader2 size={11} className="animate-spin" /> : <UserMinus size={11} />}
                        Unfriend
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card p-8 text-center">
                <Users size={28} className="text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground mb-1">No friends yet</p>
                <p className="text-xs text-muted-foreground">
                  Search for your teammates by username above to get started
                </p>
              </div>
            )}
          </section>

          {/* Outgoing requests */}
          {data.outgoing.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Clock size={12} />
                Pending Sent ({data.outgoing.length})
              </h2>
              <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
                {data.outgoing.map(entry => (
                  <div key={entry.id} className="flex items-center gap-3 px-4 py-3">
                    <Avatar profile={entry.profile} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {entry.profile.display_name || entry.profile.username}
                      </p>
                      <p className="text-xs text-muted-foreground">@{entry.profile.username} · Awaiting response</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs h-8 text-muted-foreground shrink-0"
                      onClick={() => handleAction(entry.id, 'delete')}
                      disabled={actioning === entry.id}
                    >
                      {actioning === entry.id ? <Loader2 size={11} className="animate-spin" /> : <X size={11} />}
                      Cancel
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
