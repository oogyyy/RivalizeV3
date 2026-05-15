'use client'

import { useState, useEffect } from 'react'
import { Copy, Check, Link2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface InviteCodeSectionProps {
  inviteCode: string
  teamId: string
}

export default function InviteCodeSection({ inviteCode, teamId }: InviteCodeSectionProps) {
  const [copied, setCopied] = useState<'code' | 'link' | null>(null)
  const [joinUrl, setJoinUrl] = useState(`/teams/${teamId}/join?code=${inviteCode}`)

  useEffect(() => {
    setJoinUrl(`${window.location.origin}/teams/${teamId}/join?code=${inviteCode}`)
  }, [teamId, inviteCode])

  const copy = (text: string, type: 'code' | 'link') => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(type)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Link2 size={15} className="text-neon-green" />
          <h3 className="text-sm font-semibold text-foreground">Invite Members</h3>
        </div>

        <div className="space-y-3">
          {/* Invite code */}
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Invite code</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 rounded-md bg-background border border-border text-sm font-mono text-neon-green tracking-widest">
                {inviteCode}
              </code>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 gap-1.5"
                onClick={() => copy(inviteCode, 'code')}
              >
                {copied === 'code' ? (
                  <>
                    <Check size={13} className="text-neon-green" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy size={13} />
                    Copy
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Join link */}
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Or share this link</p>
            <div className="flex items-center gap-2">
              <p className="flex-1 px-3 py-2 rounded-md bg-background border border-border text-xs text-muted-foreground truncate font-mono">
                {joinUrl}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 gap-1.5"
                onClick={() => copy(joinUrl, 'link')}
              >
                {copied === 'link' ? (
                  <>
                    <Check size={13} className="text-neon-green" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy size={13} />
                    Copy
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
