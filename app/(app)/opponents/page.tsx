export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth/get-user'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import DemoUploadButton from '@/components/teams/DemoUploadButton'
import OpponentCardWithDelete from '@/components/teams/OpponentCardWithDelete'
import { Target, Brain, Upload, Layers, Activity, Zap, Trophy } from 'lucide-react'
import type { AggregatedStats } from '@/types/database'
import { PageHeader } from '@/components/layout/PageHeader'

export default async function OpponentsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, username')
    .eq('id', user.id)
    .single()

  const { data: memberships } = await admin
    .from('team_members')
    .select('team_id, role, joined_at')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: true })

  let primaryTeamId: string | null = (memberships ?? [])[0]?.team_id ?? null

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

  const { data: folders } = primaryTeamId
    ? await admin
        .from('team_folders')
        .select('*')
        .eq('user_team_id', primaryTeamId)
        .order('updated_at', { ascending: false })
    : { data: [] }

  const { data: allDemos } = primaryTeamId
    ? await admin
        .from('demos')
        .select('id, opponent_slug, status, created_at, match_date')
        .eq('team_id', primaryTeamId)
        .eq('demo_type', 'opponent')
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
  const totalDemos     = (allDemos ?? []).length
  const analyzedDemos  = ((allDemos ?? []) as DemoRow[]).filter(d => d.status === 'completed').length

  return (
    <div className="p-5 md:p-7 space-y-6 max-w-7xl mx-auto">

      {/* ── Header ── */}
      <div className="animate-fade-in-up">
        <PageHeader
          label="Scouting"
          title="Opponents"
          description="Your scouting library — teams you're preparing to face"
          actions={
            <div className="flex items-center gap-2 flex-wrap">
              <Link href="/ai-coach">
                <Button variant="secondary" className="gap-2">
                  <Brain size={15} />
                  AI Scout
                </Button>
              </Link>
              <Link href="/opponents/import">
                <Button variant="secondary" className="gap-2">
                  <Zap size={15} className="text-orange-400" />
                  Import FaceIt
                </Button>
              </Link>
              <Link href="/opponents/pro-demos">
                <Button variant="secondary" className="gap-2">
                  <Trophy size={15} className="text-yellow-400" />
                  Pro Library
                </Button>
              </Link>
              {primaryTeamId && (
                <DemoUploadButton teamId={primaryTeamId} />
              )}
            </div>
          }
        />
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-3 gap-3 animate-fade-in-up animate-fade-in-up-delay-1">
        <div className={cn(
          'relative rounded-xl bg-card border border-border p-4 card-hover overflow-hidden stat-card-red'
        )}>
          <div className="flex items-start justify-between gap-2 mb-3">
            <p className="text-[11px] text-muted-foreground/60 font-semibold uppercase tracking-[0.12em]">Opponents</p>
            <div className="p-1.5 rounded-lg bg-red-500/10 shrink-0">
              <Target size={14} className="text-red-400" />
            </div>
          </div>
          <p className="text-[28px] font-bold tabular-nums text-foreground font-mono leading-none">{totalOpponents}</p>
        </div>

        <div className={cn(
          'relative rounded-xl bg-card border border-border p-4 card-hover overflow-hidden stat-card-blue'
        )}>
          <div className="flex items-start justify-between gap-2 mb-3">
            <p className="text-[11px] text-muted-foreground/60 font-semibold uppercase tracking-[0.12em]">Uploaded</p>
            <div className="p-1.5 rounded-lg bg-blue-500/10 shrink-0">
              <Layers size={14} className="text-blue-400" />
            </div>
          </div>
          <p className="text-[28px] font-bold tabular-nums text-foreground font-mono leading-none">{totalDemos}</p>
        </div>

        <div className={cn(
          'relative rounded-xl bg-card border border-border p-4 card-hover overflow-hidden stat-card-green'
        )}>
          <div className="flex items-start justify-between gap-2 mb-3">
            <p className="text-[11px] text-muted-foreground/60 font-semibold uppercase tracking-[0.12em]">Analyzed</p>
            <div className="p-1.5 rounded-lg bg-[rgba(0,255,200,0.1)] shrink-0">
              <Activity size={14} className="text-[#00ffc8]" />
            </div>
          </div>
          <p className="text-[28px] font-bold tabular-nums text-[#00ffc8] font-mono leading-none">{analyzedDemos}</p>
        </div>
      </div>

      {/* ── Opponent grid ── */}
      {(folders ?? []).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in-up animate-fade-in-up-delay-2">
          <div className="w-16 h-16 rounded-2xl bg-red-500/[0.08] border border-red-500/15 flex items-center justify-center mb-5">
            <Target size={28} className="text-red-400/70" />
          </div>
          <h2 className="text-[17px] font-bold text-foreground mb-2">No opponents scouted yet</h2>
          <p className="text-[13px] text-muted-foreground max-w-xs mb-6 leading-relaxed">
            Upload your first opponent demo to start building your scouting library.
          </p>
          {primaryTeamId && (
            <DemoUploadButton teamId={primaryTeamId} />
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 animate-fade-in-up animate-fade-in-up-delay-2">
          {(folders ?? []).map((folder) => {
            const demos = demosBySlug[folder.opponent_slug] ?? []
            const lastActivity = demos
              .map(d => d.match_date ?? d.created_at)
              .sort()
              .at(-1)

            return (
              <OpponentCardWithDelete
                key={folder.id}
                folder={{
                  id: folder.id,
                  opponent_display_name: folder.opponent_display_name,
                  opponent_slug: folder.opponent_slug,
                  aggregated_stats: folder.aggregated_stats as AggregatedStats | null,
                }}
                demoCount={demos.length}
                lastActivity={lastActivity}
              />
            )
          })}

          {/* Add opponent CTA card */}
          {primaryTeamId && (
            <div className="h-full">
              <Card className="bg-card/50 border-dashed border-border hover:border-[rgba(0,255,200,0.35)] hover:bg-card transition-all duration-200 group h-full card-hover">
                <CardContent className="p-5 flex flex-col items-center justify-center h-full min-h-[160px] text-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[rgba(0,255,200,0.08)] flex items-center justify-center group-hover:bg-[rgba(0,255,200,0.15)] transition-colors border border-[rgba(0,255,200,0.15)]">
                    <Upload size={17} className="text-[#00ffc8]" />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-foreground group-hover:text-[#00ffc8] transition-colors">
                      Scout another opponent
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Upload a demo to add them</p>
                  </div>
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
