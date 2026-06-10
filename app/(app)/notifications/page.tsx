'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, CheckCheck, Loader2, FileVideo } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface Notification {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  read: boolean
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
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function NotificationsPage() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [markingAll, setMarkingAll] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?filter=all')
      if (res.ok) {
        const data = (await res.json()) as { notifications: Notification[]; unreadCount: number }
        setNotifications(data.notifications ?? [])
        setUnreadCount(data.unreadCount ?? 0)
      }
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const markRead = useCallback(async (ids: string[]) => {
    setNotifications(prev => prev.map(n => ids.includes(n.id) ? { ...n, read: true } : n))
    setUnreadCount(prev => Math.max(0, prev - ids.length))
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    }).catch(() => {})
  }, [])

  const handleClick = useCallback(async (notif: Notification) => {
    if (!notif.read) await markRead([notif.id])
    if (notif.link) router.push(notif.link)
  }, [markRead, router])

  const handleMarkAllRead = useCallback(async () => {
    setMarkingAll(true)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
    await fetch('/api/notifications', { method: 'PATCH' }).catch(() => {})
    setMarkingAll(false)
  }, [])

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-neon-green/10 border border-neon-green/25 flex items-center justify-center shrink-0">
            <Bell size={16} className="text-neon-green" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground leading-tight">Notifications</h1>
            <p className="text-xs text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
            </p>
          </div>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllRead}
            disabled={markingAll}
            className="gap-1.5 shrink-0"
          >
            {markingAll ? <Loader2 size={12} className="animate-spin" /> : <CheckCheck size={12} />}
            Mark all read
          </Button>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={22} className="animate-spin text-neon-green" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center text-center py-16 px-4 border border-border rounded-xl bg-card">
          <Bell size={28} className="text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-foreground mb-1">No notifications yet</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            You&apos;ll be notified here when demos finish parsing and when there&apos;s team activity.
          </p>
        </div>
      ) : (
        <div className="border border-border rounded-xl bg-card overflow-hidden divide-y divide-border">
          {notifications.map(notif => (
            <button
              key={notif.id}
              onClick={() => handleClick(notif)}
              className={cn(
                'w-full flex items-start gap-3 px-4 py-3.5 text-left transition-colors',
                notif.link || !notif.read ? 'cursor-pointer hover:bg-accent/50' : 'cursor-default',
                !notif.read && 'bg-neon-green/[0.03]',
              )}
            >
              <div className={cn(
                'w-9 h-9 rounded-lg shrink-0 flex items-center justify-center border',
                notif.read
                  ? 'bg-muted/40 border-border'
                  : 'bg-neon-green/10 border-neon-green/25',
              )}>
                <FileVideo size={15} className={notif.read ? 'text-muted-foreground' : 'text-neon-green'} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={cn(
                    'text-sm leading-snug truncate',
                    notif.read ? 'text-muted-foreground font-medium' : 'text-foreground font-semibold',
                  )}>
                    {notif.title}
                  </p>
                  {!notif.read && (
                    <span className="w-1.5 h-1.5 rounded-full bg-neon-green shrink-0" aria-label="Unread" />
                  )}
                </div>
                {notif.body && (
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">{notif.body}</p>
                )}
                <p className="text-[10px] text-muted-foreground/60 mt-1 font-mono">{formatRelativeTime(notif.created_at)}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
