'use client'

import { useState, useEffect } from 'react'
import { Plus, Loader2, X, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { slugify } from '@/lib/utils'

interface CreateTeamDialogProps {
  asCard?: boolean
}

export default function CreateTeamDialog({ asCard }: CreateTeamDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)

  // Auto-generate slug from name unless manually edited
  useEffect(() => {
    if (!slugManuallyEdited) {
      setSlug(slugify(name))
    }
  }, [name, slugManuallyEdited])

  const handleSlugChange = (val: string) => {
    setSlugManuallyEdited(true)
    setSlug(val.toLowerCase().replace(/[^a-z0-9-]/g, ''))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), slug: slug.trim() }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message ?? data.error ?? 'Failed to create team')

      setOpen(false)
      setName('')
      setSlug('')
      setSlugManuallyEdited(false)
      window.location.href = `/teams/${data.id}`
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const trigger = asCard ? (
    <button
      onClick={() => setOpen(true)}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-dashed border-border hover:border-neon-green/40 hover:bg-card/60 transition-all duration-150 group cursor-pointer"
    >
      <div className="w-9 h-9 rounded-md bg-neon-green/5 border border-dashed border-neon-green/20 flex items-center justify-center shrink-0 group-hover:border-neon-green/50 transition-colors">
        <Plus size={16} className="text-neon-green/50 group-hover:text-neon-green transition-colors" />
      </div>
      <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
        Create new team
      </span>
    </button>
  ) : (
    <Button variant="neon" onClick={() => setOpen(true)} className="gap-2">
      <Plus size={16} />
      Create Team
    </Button>
  )

  return (
    <>
      {trigger}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded bg-neon-green/10 flex items-center justify-center">
                  <Users size={16} className="text-neon-green" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">Create Team</h2>
                  <p className="text-xs text-muted-foreground">Set up your team to start scouting opponents</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {/* Team Name */}
              <div className="space-y-1.5">
                <Label htmlFor="team-name">Team Name</Label>
                <Input
                  id="team-name"
                  placeholder="e.g. Natus Vincere"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  minLength={2}
                  maxLength={50}
                  autoFocus
                />
              </div>

              {/* Team Slug */}
              <div className="space-y-1.5">
                <Label htmlFor="team-slug">
                  Slug{' '}
                  <span className="text-muted-foreground font-normal text-xs">(URL identifier)</span>
                </Label>
                <div className="flex items-center">
                  <span className="inline-flex items-center h-10 rounded-l-md border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground">
                    /teams/
                  </span>
                  <Input
                    id="team-slug"
                    className="rounded-l-none"
                    placeholder="natus-vincere"
                    value={slug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    required
                    minLength={2}
                    maxLength={30}
                    pattern="^[a-z0-9-]+$"
                    title="Only lowercase letters, numbers, and hyphens"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Only lowercase letters, numbers, and hyphens
                </p>
              </div>

              {error && (
                <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-red-400">
                  {error}
                </div>
              )}

              <div className="flex gap-2 pt-2">
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
                  disabled={loading || !name.trim() || !slug.trim()}
                >
                  {loading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Creating…
                    </>
                  ) : (
                    <>
                      <Plus size={14} />
                      Create Team
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
