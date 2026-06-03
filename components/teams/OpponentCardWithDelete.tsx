'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Trash2, AlertTriangle, Loader2, CheckCircle, Sparkles, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { AggregatedStats } from '@/types/database'

const PALETTE = [
  { bg: 'rgba(112,71,235,0.18)', border: 'rgba(112,71,235,0.35)', text: '#7047eb' },
  { bg: 'rgba(20,184,166,0.18)', border: 'rgba(20,184,166,0.35)', text: '#14b8a6' },
  { bg: 'rgba(244,63,94,0.18)',  border: 'rgba(244,63,94,0.35)',  text: '#f43f5e' },
  { bg: 'rgba(245,158,11,0.18)', border: 'rgba(245,158,11,0.35)', text: '#f59e0b' },
  { bg: 'rgba(59,130,246,0.18)', border: 'rgba(59,130,246,0.35)', text: '#3b82f6' },
  { bg: 'rgba(16,185,129,0.18)', border: 'rgba(16,185,129,0.35)', text: '#10b981' },
]

function hashColor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return PALETTE[Math.abs(h) % PALETTE.length]
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/)
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
}

function shortRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return '1d ago'
  if (days < 30) return `${days}d ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

interface Props {
  folder: {
    id: string
    opponent_display_name: string
    opponent_slug: string
    aggregated_stats: AggregatedStats | null
  }
  demoCount: number
  lastActivity?: string
}

export default function OpponentCardWithDelete({ folder, demoCount, lastActivity }: Props) {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const stats = folder.aggregated_stats
  const wins   = stats?.wins   ?? 0
  const losses = stats?.losses ?? 0
  const draws  = stats?.draws  ?? 0
  const total  = wins + losses + draws
  const winRate = total > 0 ? Math.round((wins / total) * 100) : null

  const mapsPlayed = (stats?.maps_played ?? {}) as Record<string, number>
  const bestMap = Object.entries(mapsPlayed).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  const color = hashColor(folder.opponent_display_name)
  const inits = getInitials(folder.opponent_display_name)

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    try {
      const res = await fetch(`/api/opponents/${folder.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Delete failed')
      }
      setDialogOpen(false)
      setSuccess(true)
      setTimeout(() => router.refresh(), 1500)
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err))
      setDeleting(false)
    }
  }

  return (
    <>
      {success && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-card border border-[rgba(0,255,200,0.3)] text-foreground text-sm px-4 py-3 rounded-xl shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200">
          <CheckCircle size={16} className="text-[#00ffc8] shrink-0" />
          Opponent folder deleted successfully.
        </div>
      )}

      <div
        className="relative group/card rounded-2xl overflow-hidden transition-all duration-200 hover:border-[rgba(112,71,235,0.45)] hover:shadow-[0_8px_28px_rgba(0,0,0,0.5)]"
        style={{ background: 'var(--panel, #0f111e)', border: '1px solid var(--border, #1e2238)' }}
      >
        {/* Trash button — reveals on card hover */}
        <button
          className="absolute top-3 right-3 z-10 p-1.5 rounded-md opacity-0 group-hover/card:opacity-100 transition-all duration-150 text-gray-500 hover:text-red-400 hover:bg-red-400/10"
          onClick={e => { e.preventDefault(); e.stopPropagation(); setDialogOpen(true) }}
          aria-label={`Delete ${folder.opponent_display_name}`}
        >
          <Trash2 size={14} />
        </button>

        <div className="p-5 flex flex-col gap-4">
          {/* Header: initials + name */}
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-[15px] font-bold border"
              style={{ background: color.bg, borderColor: color.border, color: color.text }}
            >
              {inits}
            </div>
            <div className="min-w-0 pr-6">
              <p className="text-[14px] font-semibold text-white truncate leading-tight">
                {folder.opponent_display_name}
              </p>
              <p className="text-[11px] font-mono text-gray-500 mt-0.5 truncate">
                {folder.opponent_slug}
              </p>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'DEMOS',    value: String(demoCount),             color: '#14b8a6' },
              { label: 'WIN RATE', value: winRate !== null ? `${winRate}%` : '—',
                color: winRate !== null ? (winRate >= 60 ? '#f43f5e' : winRate >= 45 ? '#f59e0b' : '#10b981') : '#4b5563' },
              { label: 'LAST SEEN', value: lastActivity ? shortRelative(lastActivity) : '—', color: '#d1d5db' },
            ].map(({ label, value, color: c }) => (
              <div
                key={label}
                className="rounded-lg p-2.5 text-center"
                style={{ background: 'var(--bg, #07080e)', border: '1px solid var(--border, #1e2238)' }}
              >
                <p className="text-[13px] font-mono font-bold leading-none" style={{ color: c }}>{value}</p>
                <p className="text-[9px] font-mono uppercase tracking-wider text-gray-500 mt-1">{label}</p>
              </div>
            ))}
          </div>

          {/* Best map win-rate bar */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[9px] font-mono uppercase tracking-widest text-gray-500">
                Best Map Win Rate
              </span>
              {bestMap && (
                <span className="text-[10px] font-mono text-gray-400">{bestMap}</span>
              )}
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#1e2238' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: winRate !== null ? `${winRate}%` : '0%',
                  background: 'linear-gradient(90deg, #14b8a6, #7047eb)',
                }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[9px] font-mono text-gray-600">{bestMap ?? 'All maps'}</span>
              <span className="text-[9px] font-mono" style={{ color: '#14b8a6' }}>
                {winRate !== null ? `${winRate}%` : '—'}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <Link href={`/opponents/${folder.id}`} className="flex-1">
              <button
                className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12px] font-semibold text-white transition-colors duration-150"
                style={{ background: '#7047eb' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#8862ff')}
                onMouseLeave={e => (e.currentTarget.style.background = '#7047eb')}
              >
                View Scouting
                <ArrowRight size={12} />
              </button>
            </Link>
            <Link href={`/ai-coach?opponent=${encodeURIComponent(folder.opponent_display_name)}`}>
              <button
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-[12px] font-semibold transition-colors duration-150 whitespace-nowrap"
                style={{
                  border: '1px solid rgba(20,184,166,0.4)',
                  color: '#14b8a6',
                  background: 'rgba(20,184,166,0.06)',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(20,184,166,0.14)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(20,184,166,0.06)')}
              >
                <Sparkles size={12} />
                AI INSIGHT
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* Confirmation dialog */}
      {dialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={e => { if (e.target === e.currentTarget && !deleting) setDialogOpen(false) }}
        >
          <div className="bg-card border border-red-500/20 rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-red-500/10 flex items-center justify-center shrink-0 mt-0.5">
                <AlertTriangle size={18} className="text-red-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Delete Opponent?</p>
                <p className="text-xs text-muted-foreground mt-1">
                  This will permanently delete the scouting folder for{' '}
                  <span className="text-foreground font-medium">{folder.opponent_display_name}</span>{' '}
                  and all associated demos. This action cannot be undone.
                </p>
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setDialogOpen(false); setError(null) }}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-red-500 hover:bg-red-600 text-white gap-1.5"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <><Loader2 size={13} className="animate-spin" /> Deleting…</>
                ) : (
                  <><Trash2 size={13} /> Delete</>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
