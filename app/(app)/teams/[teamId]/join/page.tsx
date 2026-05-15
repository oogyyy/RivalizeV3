'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { Users, Loader2, ArrowLeft, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'

export default function JoinTeamPage() {
  const router = useRouter()
  const params = useParams<{ teamId: string }>()
  const searchParams = useSearchParams()
  const teamId = params.teamId
  const codeFromUrl = searchParams.get('code') ?? ''

  const [inviteCode, setInviteCode] = useState(codeFromUrl)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [joined, setJoined] = useState(false)

  useEffect(() => {
    if (codeFromUrl) setInviteCode(codeFromUrl)
  }, [codeFromUrl])

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch(`/api/teams/${teamId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: inviteCode.trim().toUpperCase() }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to join team')

      setJoined(true)
      setTimeout(() => router.push(`/teams/${teamId}`), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-full flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Link
          href="/teams"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft size={14} />
          Back to teams
        </Link>

        <div className="bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b border-border text-center">
            <div className="w-14 h-14 rounded-xl bg-neon-green/10 border border-neon-green/20 flex items-center justify-center mx-auto mb-4">
              <Users size={24} className="text-neon-green" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Join a Team</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Enter your invite code to join the team
            </p>
          </div>

          {joined ? (
            <div className="p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-neon-green/10 border border-neon-green/20 flex items-center justify-center mx-auto mb-3">
                <Check size={22} className="text-neon-green" />
              </div>
              <p className="text-base font-semibold text-foreground">You&apos;ve joined the team!</p>
              <p className="text-sm text-muted-foreground mt-1">Redirecting…</p>
            </div>
          ) : (
            <form onSubmit={handleJoin} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="invite-code">Invite Code</Label>
                <Input
                  id="invite-code"
                  placeholder="XXXXXX"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  required
                  minLength={6}
                  maxLength={10}
                  className="font-mono tracking-widest text-center text-lg uppercase"
                  autoFocus={!codeFromUrl}
                />
              </div>

              {error && (
                <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-red-400">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                variant="neon"
                className="w-full gap-2"
                disabled={loading || !inviteCode.trim()}
              >
                {loading ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Joining…
                  </>
                ) : (
                  'Join Team'
                )}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
