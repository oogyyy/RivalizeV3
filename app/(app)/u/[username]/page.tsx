export const dynamic = 'force-dynamic'

import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth/get-user'
import { cn } from '@/lib/utils'
import {
  ArrowLeft, Shield, Users, FileVideo, Target,
  Crosshair, Calendar, UserPlus, UserCheck, Folder,
} from 'lucide-react'
import type { ParsedDemoData } from '@/types/database'
import AddFriendButton from './AddFriendButton'

// ─── helpers ──────────────────────────────────────────────────────────────────

const MAP_LABELS: Record<string, string> = {
  de_dust2: 'Dust2', de_mirage: 'Mirage', de_inferno: 'Inferno',
  de_nuke: 'Nuke', de_overpass: 'Overpass', de_ancient: 'Ancient',
  de_anubis: 'Anubis', de_vertigo: 'Vertigo',
}

const ROLE_COLORS: Record<string, string> = {
  'IGL':           'bg-purple-500/15 border-purple-400/30 text-purple-400',
  'AWPer':         'bg-cyan-500/15 border-cyan-400/30 text-cyan-400',
  'Entry Fragger': 'bg-red-500/15 border-red-400/30 text-red-400',
  'Support':       'bg-blue-500/15 border-blue-400/30 text-blue-400',
  'Lurker':        'bg-amber-500/15 border-amber-400/30 text-amber-400',
  'Rifler':        'bg-emerald-500/15 border-emerald-400/30 text-emerald-400',
  'Anchor':        'bg-slate-500/15 border-slate-400/30 text-slate-400',
}

function relativeDate(d: string | null) {
  if (!d) return ''
  const diff = Date.now() - new Date(d).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default async function FriendProfilePage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params
  const me = await getCurrentUser()
  if (!me) redirect('/login')

  const admin = createAdminClient()

  // Resolve target profile
  const { data: target } = await admin
    .from('profiles')
    .select('id, username, display_name, avatar_url, bio, preferred_roles, favorite_maps, steam_id, faceit_id, created_at')
    .eq('username', username.toLowerCase())
    .single()

  if (!target) notFound()

  // Redirect to own profile if viewing yourself
  if (target.id === me.id) redirect('/profile')

  // Check friendship status
  const { data: friendship } = await admin
    .from('friendships')
    .select('id, status, requester_id, addressee_id')
    .or(
      `and(requester_id.eq.${me.id},addressee_id.eq.${target.id}),and(requester_id.eq.${target.id},addressee_id.eq.${me.id})`
    )
    .single()

  const isFriend = friendship?.status === 'accepted'
  const isPending = friendship?.status === 'pending'
  const iSentRequest = isPending && friendship?.requester_id === me.id
  const theyRequestedMe = isPending && friendship?.addressee_id === me.id

  const nameToDisplay = target.display_name || target.username
  const joinDate = new Date(target.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  // ── If friends, fetch their data ────────────────────────────────────────────
  let teams: { id: string; name: string; logo_url: string | null }[] = []
  let recentMatches: { id: string; map: string; opponent_name: string; match_date: string | null; created_at: string; score_t1: number; score_t2: number; demo_type: string }[] = []
  let opponentFolders: { id: string; opponent_display_name: string; opponent_slug: string; demo_count: number }[] = []
  let demoCount = 0

  if (isFriend) {
    // Their team memberships
    const { data: memberships } = await admin
      .from('team_members')
      .select('team_id')
      .eq('user_id', target.id)
    const teamIds = (memberships ?? []).map(m => m.team_id as string)

    if (teamIds.length > 0) {
      // Teams
      const { data: teamsData } = await admin
        .from('teams')
        .select('id, name, logo_url')
        .in('id', teamIds)
      teams = (teamsData ?? []) as typeof teams

      // Demo count
      const { count } = await admin
        .from('demos')
        .select('*', { count: 'exact', head: true })
        .in('team_id', teamIds)
      demoCount = count ?? 0

      // Recent self-analysis matches
      const { data: demosData } = await admin
        .from('demos')
        .select('id, map, opponent_name, match_date, created_at, demo_type, parsed_data')
        .in('team_id', teamIds)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(8)

      recentMatches = (demosData ?? []).map(d => {
        const pd = d.parsed_data as { header?: { score_team1?: number; score_team2?: number } } | null
        return {
          id: d.id,
          map: d.map,
          opponent_name: d.opponent_name,
          match_date: d.match_date,
          created_at: d.created_at,
          score_t1: pd?.header?.score_team1 ?? 0,
          score_t2: pd?.header?.score_team2 ?? 0,
          demo_type: d.demo_type,
        }
      })

      // Opponent prep folders
      const { data: foldersData } = await admin
        .from('team_folders')
        .select('id, opponent_display_name, opponent_slug')
        .in('user_team_id', teamIds)
        .order('opponent_display_name')

      // Count demos per folder
      const folderDemoCounts: Record<string, number> = {}
      if (foldersData?.length) {
        for (const folder of foldersData) {
          const { count: fc } = await admin
            .from('demos')
            .select('*', { count: 'exact', head: true })
            .in('team_id', teamIds)
            .eq('opponent_slug', folder.opponent_slug)
            .neq('demo_type', 'self')
          folderDemoCounts[folder.id] = fc ?? 0
        }
      }

      opponentFolders = (foldersData ?? []).map(f => ({
        id: f.id,
        opponent_display_name: f.opponent_display_name,
        opponent_slug: f.opponent_slug,
        demo_count: folderDemoCounts[f.id] ?? 0,
      }))
    }
  }

  // ────────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full pb-10">

      {/* ── HERO ───────────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-card border-b border-border">
        <div className="absolute inset-0 bg-gradient-to-br from-neon-green/5 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-0 right-0 w-80 h-40 bg-neon-green/3 blur-3xl pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8">
          {/* Back */}
          <Link href="/friends" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-5 transition-colors">
            <ArrowLeft size={13} />
            Friends
          </Link>

          <div className="flex items-start justify-between gap-4">
            {/* Avatar + info */}
            <div className="flex items-start gap-4 md:gap-5">
              <div className="relative shrink-0">
                {target.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={target.avatar_url} alt={nameToDisplay} className="w-20 h-20 md:w-24 md:h-24 rounded-full object-cover ring-2 ring-neon-green/30" />
                ) : (
                  <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-neon-green/20 border-2 border-neon-green/30 flex items-center justify-center">
                    <span className="text-2xl md:text-3xl font-bold text-neon-green">{nameToDisplay.slice(0, 2).toUpperCase()}</span>
                  </div>
                )}
                {isFriend && (
                  <div className="absolute bottom-1 right-1 w-3.5 h-3.5 rounded-full bg-neon-green border-2 border-card" title="Friend" />
                )}
              </div>

              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">{nameToDisplay}</h1>
                <p className="text-sm text-muted-foreground mt-0.5">@{target.username}</p>
                {target.bio && <p className="text-sm text-muted-foreground/80 mt-2 max-w-md leading-relaxed">{target.bio}</p>}

                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar size={11} />Joined {joinDate}
                  </span>
                  {target.steam_id && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#1b2838]/80 border border-[#c7d5e0]/20 text-[10px] text-[#c7d5e0]">
                      <Shield size={9} />Steam
                    </span>
                  )}
                  {target.faceit_id && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/25 text-[10px] text-orange-400">
                      <Crosshair size={9} />FACEIT
                    </span>
                  )}
                  {(target.preferred_roles as string[] | null ?? []).slice(0, 2).map((r: string) => (
                    <span key={r} className={cn('px-2 py-0.5 rounded-full border text-[10px] font-medium', ROLE_COLORS[r] ?? 'bg-muted/40 border-border text-muted-foreground')}>
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Friend action button (client component for interactivity) */}
            <AddFriendButton
              friendshipId={friendship?.id ?? null}
              friendshipStatus={friendship?.status ?? null}
              iSentRequest={iSentRequest}
              theyRequestedMe={theyRequestedMe}
              targetUsername={target.username}
            />
          </div>

          {/* Stats strip — only for friends */}
          {isFriend && (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mt-6 pt-5 border-t border-border/60">
              <StatCell value={demoCount} label="Demos" accent />
              <div className="w-px h-8 bg-border" />
              <StatCell value={teams.length} label="Teams" />
              <div className="w-px h-8 bg-border" />
              <StatCell value={recentMatches.length} label="Recent Matches" />
              {opponentFolders.length > 0 && (
                <>
                  <div className="w-px h-8 bg-border" />
                  <StatCell value={opponentFolders.length} label="Opponents Scouted" />
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── BODY ───────────────────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 md:px-6 pt-6">

        {/* Not friends yet */}
        {!isFriend && (
          <div className="rounded-xl border border-border bg-card p-10 text-center">
            {iSentRequest ? (
              <>
                <UserPlus size={32} className="text-neon-green/40 mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground mb-1">Request sent</p>
                <p className="text-xs text-muted-foreground">
                  Waiting for @{target.username} to accept. Once they do, you&apos;ll be able to see their team data here.
                </p>
              </>
            ) : theyRequestedMe ? (
              <>
                <UserCheck size={32} className="text-neon-green/40 mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground mb-1">
                  @{target.username} sent you a friend request
                </p>
                <p className="text-xs text-muted-foreground mb-4">
                  Accept to see their team analysis and opponent prep.
                </p>
              </>
            ) : (
              <>
                <Users size={32} className="text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground mb-1">Not friends yet</p>
                <p className="text-xs text-muted-foreground">
                  Add @{target.username} as a friend to see their team analysis and opponent prep pages.
                </p>
              </>
            )}
          </div>
        )}

        {/* Friend's data */}
        {isFriend && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* Left column */}
            <div className="space-y-4">

              {/* Roles */}
              {(target.preferred_roles as string[] | null ?? []).length > 0 && (
                <SideCard title="Roles" icon={<Target size={12} />}>
                  <div className="flex flex-wrap gap-1.5">
                    {(target.preferred_roles as string[]).map((r: string) => (
                      <span key={r} className={cn('px-2.5 py-1 rounded-full border text-xs font-medium', ROLE_COLORS[r] ?? 'bg-muted/30 border-border text-muted-foreground')}>
                        {r}
                      </span>
                    ))}
                  </div>
                </SideCard>
              )}

              {/* Fav maps */}
              {(target.favorite_maps as string[] | null ?? []).length > 0 && (
                <SideCard title="Favourite Maps" icon={<FileVideo size={12} />}>
                  <div className="flex flex-wrap gap-1.5">
                    {(target.favorite_maps as string[]).map((m: string) => (
                      <span key={m} className="px-2.5 py-1 rounded-md bg-neon-green/10 border border-neon-green/20 text-xs text-neon-green font-mono">
                        {MAP_LABELS[m] ?? m}
                      </span>
                    ))}
                  </div>
                </SideCard>
              )}

              {/* Teams */}
              {teams.length > 0 && (
                <SideCard title="Teams" icon={<Users size={12} />}>
                  <div className="space-y-2">
                    {teams.map(t => (
                      <div key={t.id} className="flex items-center gap-2.5">
                        {t.logo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={t.logo_url} alt={t.name} className="w-6 h-6 rounded object-cover shrink-0" />
                        ) : (
                          <div className="w-6 h-6 rounded bg-neon-green/10 border border-neon-green/20 flex items-center justify-center shrink-0">
                            <span className="text-[10px] font-bold text-neon-green">{t.name.charAt(0)}</span>
                          </div>
                        )}
                        <span className="text-xs font-medium text-foreground truncate">{t.name}</span>
                      </div>
                    ))}
                  </div>
                </SideCard>
              )}
            </div>

            {/* Right column */}
            <div className="lg:col-span-2 space-y-4">

              {/* Recent matches */}
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <FileVideo size={14} className="text-neon-green" />
                    Recent Matches
                  </h3>
                </div>
                {recentMatches.length > 0 ? (
                  <div className="divide-y divide-border">
                    {recentMatches.map(m => {
                      const mapLabel = MAP_LABELS[m.map] ?? m.map
                      const hasScore = (m.score_t1 + m.score_t2) > 0
                      return (
                        <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                          <div className="w-20 shrink-0">
                            <p className="text-xs font-semibold text-foreground">{mapLabel}</p>
                            <p className="text-[10px] text-muted-foreground capitalize">{m.demo_type}</p>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-muted-foreground truncate">
                              vs <span className="text-foreground font-medium">{m.opponent_name || 'Unknown'}</span>
                            </p>
                          </div>
                          {hasScore && (
                            <p className="text-sm font-bold font-mono tabular-nums shrink-0">
                              <span className="text-neon-green">{Math.max(m.score_t1, m.score_t2)}</span>
                              <span className="text-muted-foreground/60 mx-0.5">–</span>
                              <span className="text-muted-foreground">{Math.min(m.score_t1, m.score_t2)}</span>
                            </p>
                          )}
                          <div className="w-14 shrink-0 text-right">
                            <p className="text-[10px] text-muted-foreground">{relativeDate(m.match_date || m.created_at)}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                    No completed matches yet
                  </div>
                )}
              </div>

              {/* Opponent folders */}
              {opponentFolders.length > 0 && (
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="px-4 py-3 border-b border-border">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Folder size={14} className="text-neon-green" />
                      Opponent Prep ({opponentFolders.length})
                    </h3>
                  </div>
                  <div className="divide-y divide-border">
                    {opponentFolders.map(f => (
                      <div key={f.id} className="flex items-center gap-3 px-4 py-3">
                        <div className="w-8 h-8 rounded bg-muted/30 border border-border flex items-center justify-center shrink-0">
                          <Folder size={14} className="text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{f.opponent_display_name}</p>
                          <p className="text-[10px] text-muted-foreground">{f.demo_count} demo{f.demo_count !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty */}
              {teams.length === 0 && recentMatches.length === 0 && (
                <div className="rounded-xl border border-border bg-card p-8 text-center">
                  <FileVideo size={28} className="text-muted-foreground/20 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No activity yet</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── tiny helpers ─────────────────────────────────────────────────────────────

function StatCell({ value, label, accent }: { value: number; label: string; accent?: boolean }) {
  return (
    <div>
      <p className={cn('text-2xl font-bold tabular-nums', accent ? 'text-neon-green' : 'text-foreground')}>{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  )
}

function SideCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
        {icon}{title}
      </h3>
      {children}
    </div>
  )
}
