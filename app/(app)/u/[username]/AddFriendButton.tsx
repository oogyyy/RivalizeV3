'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, Clock, UserMinus, Loader2, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  friendshipId: string | null
  friendshipStatus: string | null
  iSentRequest: boolean
  theyRequestedMe: boolean
  targetUsername: string
}

export default function AddFriendButton({
  friendshipId,
  friendshipStatus,
  iSentRequest,
  theyRequestedMe,
  targetUsername,
}: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const send = async () => {
    setLoading(true)
    await fetch('/api/friends', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: targetUsername }),
    })
    router.refresh()
    setLoading(false)
  }

  const act = async (action: 'accept' | 'reject' | 'delete') => {
    if (!friendshipId) return
    setLoading(true)
    if (action === 'delete') {
      await fetch(`/api/friends/${friendshipId}`, { method: 'DELETE' })
    } else {
      await fetch(`/api/friends/${friendshipId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
    }
    router.refresh()
    setLoading(false)
  }

  if (friendshipStatus === 'accepted') {
    return (
      <Button
        variant="outline"
        size="sm"
        className="shrink-0 gap-2 text-xs text-red-400 border-red-400/30 hover:border-red-400/60"
        onClick={() => act('delete')}
        disabled={loading}
      >
        {loading ? <Loader2 size={13} className="animate-spin" /> : <UserMinus size={13} />}
        Unfriend
      </Button>
    )
  }

  if (iSentRequest) {
    return (
      <Button variant="outline" size="sm" className="shrink-0 gap-2 text-xs text-muted-foreground" onClick={() => act('delete')} disabled={loading}>
        {loading ? <Loader2 size={13} className="animate-spin" /> : <Clock size={13} />}
        Cancel Request
      </Button>
    )
  }

  if (theyRequestedMe) {
    return (
      <div className="flex items-center gap-2 shrink-0">
        <Button variant="neon" size="sm" className="gap-2 text-xs" onClick={() => act('accept')} disabled={loading}>
          {loading ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          Accept
        </Button>
        <Button variant="outline" size="sm" className="gap-2 text-xs text-red-400 border-red-400/30" onClick={() => act('reject')} disabled={loading}>
          <X size={13} />Decline
        </Button>
      </div>
    )
  }

  // No relationship yet
  return (
    <Button variant="neon" size="sm" className="shrink-0 gap-2 text-xs" onClick={send} disabled={loading}>
      {loading ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />}
      Add Friend
    </Button>
  )
}
