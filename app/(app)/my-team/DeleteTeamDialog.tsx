'use client'

import { useState } from 'react'
import { Trash2, Loader2, X, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useRouter } from 'next/navigation'

interface Props {
  teamId: string
  teamName: string
}

export default function DeleteTeamDialog({ teamId, teamName }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/teams/${teamId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to delete team')
      setOpen(false)
      router.push('/my-team')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => { setConfirm(''); setError(null); setOpen(true) }}
        className="gap-1.5 text-xs h-8 px-3 text-red-400 border-red-400/30 hover:bg-red-500/10 hover:border-red-400/50 hover:text-red-400"
        title="Delete team"
      >
        <Trash2 size={12} />
        Delete Team
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-card border border-border rounded-xl shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded bg-red-500/10 flex items-center justify-center">
                  <AlertTriangle size={16} className="text-red-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">Delete Team</h2>
                  <p className="text-xs text-muted-foreground">This cannot be undone</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                disabled={loading}
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                This will permanently delete <span className="text-foreground font-medium">{teamName}</span> and all its demos, stats, and data. Members will lose access immediately.
              </p>

              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">
                  Type <span className="text-foreground font-mono">{teamName}</span> to confirm
                </label>
                <Input
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder={teamName}
                  disabled={loading}
                  autoFocus
                />
              </div>

              {error && (
                <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-red-400">
                  {error}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setOpen(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className="flex-1 gap-2"
                  disabled={loading || confirm !== teamName}
                  onClick={handleDelete}
                >
                  {loading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Deleting…
                    </>
                  ) : (
                    <>
                      <Trash2 size={14} />
                      Delete
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
