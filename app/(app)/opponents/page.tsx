export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import DemoUploadButton from '@/components/teams/DemoUploadButton'
import {
  Target, Brain, ChevronRight, FileVideo, Trophy, Upload, Calendar,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AggregatedStats } from '@/types/database'

export default async function OpponentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, username')
    .eq('id', user.id)
    .single()

  // joined_at is the correct column name on team_members (not created_at)
  const { data: memberships } = await admin
    .from('team_members')
    .select('team_id, role, joined_at')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: true })

  let primaryTeamId: string | null = (memberships ?? [])[0]?.team_id ?? null

  // Auto-create a team if the user has none yet
  if (!primaryTeamId) {
    const displayName = profile?.display_name || profile?.username || 'Player'
    const teamName = `${displayName}'s Team`
    const slug = teamName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      + '-' + Math.random().toString(36).slice(2, 6)

    const { data: newTeam } = await admin
      .from('teams')
      .insert({ name: teamName, slug, created_by: user.id })
      .select('id')
      .single()

    if (newTeam) {
      await admin
        .from('team_members')
        .insert({ team_id: newTeam.id, user_id: user.id, role: 'owner' })
      primaryTeamId = newTeam.id
    }
  }

  // Fetch all opponent folders for the primary team
  const { data: folders } = primaryTeamId
    ? await admin
        .from('team_folders')
        .select('*')
        .eq('user_team_id', primaryTeamId)
        .order('updated_at', { ascending: false })
    : { data: [] }

  // Fetch all demos for this team to compute per-opponent counts & dates
  const { data: allDemos } = primaryTeamId
    ? await admin
        .from('demos')
        .select('id, opponent_slug, status, created_at, match_date')
        .eq('team_id', primaryTeamId)
    : { data: [] }

  type DemoRow = {
    id: string
    opponent_slug: string | null
    status: string
    created_at: string
    match_date: string | null
  }

  const demosBySlug: Record<string, DemoRow[]> = {}
  for (const d of (allDemos ?? []) as DemoRow[]) {
    if (!d.opponent_slug) continue
    if (!demosBySlug[d.opponent_slug]) demosBySlug[d.opponent_slug] = []
    demosBySlug[d.opponent_slug].push(d)
  }

  const totalOpponents = (folders ?? []).length
  const totalDemos = (allDemos ?? []).length
  const analyzedDemos = ((allDemos ?? []) as DemoRow[]).filter(d => d.status === 'completed').length

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Opponents</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your scouting library — teams you&apos;re preparing to face
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link href="/ai-coach">
            <Button variant="outline" className="gap-2">
              <Brain size={16} />
              AI Scout
            </Button>
          </Link>
          {primaryTeamId && (
            <DemoUploadButton teamId={primaryTeamId} />
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-card border border-border p-4 text-center">
          <p className="text-2xl font-bold text-neon-green">{totalOpponents}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Opponents</p>
        </div>
        <div className="rounded-lg bg-card border border-border p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{totalDemos}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Demos Uploaded</p>
        </div>
        <div className="rounded-lg bg-card border border-border p-4 text-center">
          <p className="text-2xl font-bold text-neon-green">{analyzedDemos}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Analyzed</p>
        </div>
      </div>

      {/* Opponent grid */}
      {(folders ?? []).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-20 h-20 rounded-full bg-neon-green/10 border border-neon-green/20 flex items-center justify-center mb-4">
            <Target size={32} className="text-neon-green" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">No opponents scouted yet</h2>
          <p className="text-muted-foreground max-w-sm mb-6 text-sm">
            Upload your first opponent demo to start building your scouting library.
          </p>
          {primaryTeamId && (
            <DemoUploadButton teamId={primaryTeamId} />
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(folders ?? []).map((folder) => {
            const stats = folder.aggregated_stats as AggregatedStats | null
            const demos = demosBySlug[folder.opponent_slug] ?? []
            const lastActivity = demos
              .map(d => d.match_date ?? d.created_at)
              .sort()
              .at(-1)
            const wins = stats?.wins ?? 0
            const losses = stats?.losses ?? 0
            const draws = stats?.draws ?? 0
            const total = wins + losses + draws
            const winRate = total > 0 ? Math.round((wins / total) * 100) : null
            const isPositive = wins > losses
            const isNegative = losses > wins
            const demoCount = demos.length

            return (
              <Link key={folder.id} href={`/opponents/${folder.id}`}>
                <Card className="bg-card border-border hover:border-neon-green/40 hover:shadow-[0_0_20px_rgba(0,255,135,0.06)] transition-all duration-200 cursor-pointer group h-full">
                  <CardContent className="p-5 flex flex-col h-full gap-4">
                    {/* Top: avatar + name + chevron */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-neon-green/20 to-accent flex items-center justify-center shrink-0 border border-neon-green/20">
                          <span className="text-base font-bold text-neon-green">
                            {folder.opponent_display_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate group-hover:text-neon-green transition-colors leading-tight">
                            {folder.opponent_display_name}
                          </p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <FileVideo size={10} />
                              {demoCount} {demoCount === 1 ? 'demo' : 'demos'}
                            </span>
                            {lastActivity && (
                              <>
                                <span className="text-muted-foreground/30">·</span>
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Calendar size={10} />
                                  {formatDate(lastActivity)}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <ChevronRight
                        size={15}
                        className="text-muted-foreground/50 group-hover:text-neon-green transition-colors shrink-0 mt-1"
                      />
                    </div>

                    {/* Bottom: record + win rate */}
                    <div className="flex items-center justify-between border-t border-border pt-3 mt-auto">
                      {total > 0 ? (
                        <>
                          <div className="flex items-center gap-1.5">
                            <span className={cn(
                              'text-base font-bold font-mono',
                              isPositive ? 'text-neon-green' : isNegative ? 'text-red-400' : 'text-muted-foreground'
                            )}>
                              {wins}W
                            </span>
                            <span className="text-muted-foreground text-xs">–</span>
                            <span className={cn(
                              'text-base font-bold font-mono',
                              isNegative ? 'text-red-400' : 'text-muted-foreground'
                            )}>
                              {losses}L
                            </span>
                            {draws > 0 && (
                              <>
                                <span className="text-muted-foreground text-xs">–</span>
                                <span className="text-base font-bold font-mono text-yellow-400">{draws}D</span>
                              </>
                            )}
                          </div>
                          {winRate !== null && (
                            <Badge
                              variant={isPositive ? 'neon' : isNegative ? 'destructive' : 'secondary'}
                              className="text-[10px] gap-1"
                            >
                              <Trophy size={9} />
                              {winRate}%
                            </Badge>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">No completed matches</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}

          {/* Add opponent CTA card */}
          {primaryTeamId && (
            <div className="h-full">
              <Card className="bg-card border-dashed border-border hover:border-neon-green/40 transition-all duration-200 group h-full">
                <CardContent className="p-5 flex flex-col items-center justify-center h-full min-h-[140px] text-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-neon-green/10 flex items-center justify-center group-hover:bg-neon-green/20 transition-colors border border-neon-green/20">
                    <Upload size={16} className="text-neon-green" />
                  </div>
                  <p className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                    Scout another opponent
                  </p>
                  <DemoUploadButton teamId={primaryTeamId} />
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
