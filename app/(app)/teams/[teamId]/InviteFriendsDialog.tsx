'use client'

import { useState, useEffect } from 'react'
import { UserPlus, Check, Loader2, Users, Send, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Friend {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
}

interface InviteFriendsDialogProps {
  teamId: string
  existingMemberIds: string[]
}

export default function InviteFriendsDialog({ teamId, existingMemberIds }: InviteFriendsDialogProps) {
  const [open, setOpen] = useState(false)
  const [friends, setFriends] = useState<Friend[]>([])
  const [loading, setLoading] = useState(false)
  const [inviting, setInviting] = useState<string | null>(null)
  const [invited, setInvited] = useState<Set<string>>(new Set())
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())

  const loadData = async () => {
    setLoading(true)
    const [friendsRes, pendingRes] = await Promise.all([
      fetch('/api/friends'),
      fetch(`/api/teams/${teamId}/invitations`),
    ])
    if (friendsRes.ok) {
      const data = await friendsRes.json() as { friends: { profile: Friend }[] }
      setFriends(data.friends.map(f => f.profile))
    }
    if (pendingRes.ok) {
      const pending = await pendingRes.json() as { invitee_id: string }[]
      setPendingIds(new Set(pending.map(p => p.invitee_id)))
    }
    setLoading(false)
  }

  useEffect(() => {
    if (open) loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const handleInvite = async (friendId: string) => {
    setInviting(friendId)
    const res = await fetch(`/api/teams/${teamId}/invitations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invitee_id: friendId }),
    })
    if (res.ok) {
      setInvited(prev => new Set([...prev, friendId]))
    }
    setInviting(null)
  }

  return (
    <>
      <Button variant="outline" className="gap-2" onClick={() => setOpen(true)}>
        <UserPlus size={16} />
        Invite Friends
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-card border border-border rounded-xl w-full max-w-md shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div>
                <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <UserPlus size={16} className="text-neon-green" />
                  Invite Friends
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Send invitations to your friends to join this team
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 max-h-80 overflow-y-auto">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 size={20} className="animate-spin text-neon-green" />
                </div>
              ) : friends.length === 0 ? (
                <div className="text-center py-8">
                  <Users size={28} className="text-muted-foreground/20 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No friends yet</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Add friends from the Friends page first
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {friends.map(friend => {
                    const isAlreadyMember = existingMemberIds.includes(friend.id)
                    const isInvited = invited.has(friend.id) || pendingIds.has(friend.id)
                    const name = friend.display_name || friend.username

                    return (
                      <div
                        key={friend.id}
                        className={cn(
                          'flex items-center gap-3 p-2.5 rounded-lg',
                          isAlreadyMember ? 'opacity-50' : 'hover:bg-muted/10'
                        )}
                      >
                        {friend.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={friend.avatar_url}
                            alt={name}
                            className="w-8 h-8 rounded-full object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-neon-green/20 border border-neon-green/30 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-neon-green">
                              {name.slice(0, 2).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{name}</p>
                          <p className="text-xs text-muted-foreground">@{friend.username}</p>
                        </div>
                        {isAlreadyMember ? (
                          <span className="text-xs text-muted-foreground px-2 py-1 rounded bg-muted/30 shrink-0">
                            On team
                          </span>
                        ) : isInvited ? (
                          <span className="text-xs text-neon-green flex items-center gap-1 shrink-0">
                            <Check size={11} />
                            Invited
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 text-xs h-7 shrink-0"
                            onClick={() => handleInvite(friend.id)}
                            disabled={inviting === friend.id}
                          >
                            {inviting === friend.id ? (
                              <Loader2 size={11} className="animate-spin" />
                            ) : (
                              <Send size={11} />
                            )}
                            Invite
                          </Button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="px-5 pb-5">
              <Button variant="outline" className="w-full" onClick={() => setOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
