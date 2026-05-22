export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import DemoUploadButton from '@/components/teams/DemoUploadButton'
import OpponentCardWithDelete from '@/components/teams/OpponentCardWithDelete'
import { Target, Brain, Upload } from 'lucide-react'
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
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 animate-fade-in-up">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Scouting</p>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Opponents</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your scouting library — teams you&apos;re preparing to face
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link href="/ai-coach">
            <Button variant="outline" className="gap-2 hover:border-neon-green/40 hover:text-neon-green hover:bg-neon-green/5 transition-all">
              <Brain size={16} />
              AI Scout
            </Button>
          </Link>
          {primaryTeamId && (
            <DemoUploadButton teamId={primaryTeamId} />
          )}
        </div>
      </div>

      {/* ── Stats bar ── */}
      <div className="grid grid-cols-3 gap-3 animate-fade-in-up animate-fade-in-up-delay-1">
        <div className="rounded-xl bg-card border border-border p-4 text-center stat-card-red card-hover">
          <p className="text-2xl font-bold text-red-400">{totalOpponents}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Opponents</p>
        </div>
        <div className="rounded-xl bg-card border border-border p-4 text-center stat-card-blue card-hover">
          <p className="text-2xl font-bold text-foreground">{totalDemos}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Demos Uploaded</p>
        </div>
        <div className="rounded-xl bg-card border border-border p-4 text-center stat-card-green card-hover">
          <p className="text-2xl font-bold text-neon-green">{analyzedDemos}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Analyzed</p>
        </div>
      </div>

      {/* ── Opponent grid ── */}
      {(folders ?? []).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in-up animate-fade-in-up-delay-2">
          <div className="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-5">
            <Target size={32} className="text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">No opponents scouted yet</h2>
          <p className="text-muted-foreground max-w-xs mb-6 text-sm leading-relaxed">
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
              <Card className="bg-card/60 border-dashed border-border hover:border-neon-green/40 hover:bg-card transition-all duration-200 group h-full card-hover">
                <CardContent className="p-5 flex flex-col items-center justify-center h-full min-h-[160px] text-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-neon-green/10 flex items-center justify-center group-hover:bg-neon-green/20 transition-colors border border-neon-green/20">
                    <Upload size={18} className="text-neon-green" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground group-hover:text-neon-green transition-colors">
                      Scout another opponent
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">Upload a demo to add them</p>
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
