'use client'

import { useState } from 'react'
import { Pencil, Loader2, X, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRouter } from 'next/navigation'

interface Props {
  teamId: string
  currentName: string
}

export default function EditTeamNameDialog({ teamId, currentName }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(currentName)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleOpen = () => {
    setName(currentName)
    setError(null)
    setOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || trimmed === currentName) { setOpen(false); return }

    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/teams/${teamId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message ?? data.error ?? 'Failed to update team name')
      setOpen(false)
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
        onClick={handleOpen}
        className="gap-1.5 text-xs h-8 px-3"
        title="Edit team name"
      >
        <Pencil size={12} />
        Edit Name
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-card border border-border rounded-xl shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded bg-[rgba(0,255,200,0.1)] flex items-center justify-center">
                  <Users size={16} className="text-[#00ffc8]" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">Edit Team Name</h2>
                  <p className="text-xs text-muted-foreground">URL slug is not changed</p>
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

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit-team-name">Team Name</Label>
                <Input
                  id="edit-team-name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Natus Vincere"
                  required
                  minLength={2}
                  maxLength={50}
                  autoFocus
                  disabled={loading}
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
                  type="submit"
                  variant="neon"
                  className="flex-1 gap-2"
                  disabled={loading || !name.trim() || name.trim() === currentName}
                >
                  {loading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Saving…
                    </>
                  ) : 'Save'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
