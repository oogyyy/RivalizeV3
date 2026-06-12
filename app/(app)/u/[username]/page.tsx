export const dynamic = 'force-dynamic'

import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth/get-user'
import { cn } from '@/lib/utils'
import { ArrowLeft, Shield, Calendar, Crosshair, Users, FileVideo, Target } from 'lucide-react'
import AddFriendButton from './AddFriendButton'
import { getUserPlan } from '@/lib/billing'
import { MAP_THUMBS } from '@/lib/map-config'

const ROLE_COLORS: Record<string, string> = {
  'IGL':           'bg-purple-500/15 border-purple-400/30 text-purple-400',
  'AWPer':         'bg-cyan-500/15 border-cyan-400/30 text-cyan-400',
  'Entry Fragger': 'bg-red-500/15 border-red-400/30 text-red-400',
  'Support':       'bg-blue-500/15 border-blue-400/30 text-blue-400',
  'Lurker':        'bg-amber-500/15 border-amber-400/30 text-amber-400',
  'Rifler':        'bg-emerald-500/15 border-emerald-400/30 text-emerald-400',
  'Anchor':        'bg-slate-500/15 border-slate-400/30 text-slate-400',
}

const MAP_LABELS: Record<string, string> = {
  de_dust2: 'Dust2', de_mirage: 'Mirage', de_inferno: 'Inferno',
  de_nuke: 'Nuke', de_overpass: 'Overpass', de_ancient: 'Ancient',
  de_anubis: 'Anubis', de_vertigo: 'Vertigo',
}

const PLAN_BADGE = {
  pro:  { label: 'Pro',  color: 'var(--accent)', bg: 'color-mix(in srgb, var(--accent) 14%, transparent)', border: 'color-mix(in srgb, var(--accent) 30%, transparent)' },
  team: { label: 'Team', color: 'var(--signal)',  bg: 'color-mix(in srgb, var(--signal) 14%, transparent)', border: 'color-mix(in srgb, var(--signal) 30%, transparent)' },
}

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params
  const me = await getCurrentUser()
  if (!me) redirect('/login')

  const admin = createAdminClient()

  const { data: target } = await admin
    .from('profiles')
    .select('id, username, display_name, avatar_url, bio, preferred_roles, favorite_maps, steam_id, faceit_id, created_at')
    .eq('username', username.toLowerCase())
    .single()

  if (!target) notFound()
  if (target.id === me.id) redirect('/profile')

  const [
    { data: friendship },
    targetPlan,
    { data: targetMemberships },
    { data: myMemberships },
  ] = await Promise.all([
    admin
      .from('friendships')
      .select('id, status, requester_id, addressee_id')
      .or(`and(requester_id.eq.${me.id},addressee_id.eq.${target.id}),and(requester_id.eq.${target.id},addressee_id.eq.${me.id})`)
      .maybeSingle(),
    getUserPlan(target.id),
    admin.from('team_members').select('team_id').eq('user_id', target.id),
    admin.from('team_members').select('team_id').eq('user_id', me.id),
  ])

  const isFriend = friendship?.status === 'accepted'
  const isPending = friendship?.status === 'pending'
  const iSentRequest = isPending && friendship?.requester_id === me.id
  const theyRequestedMe = isPending && friendship?.addressee_id === me.id

  // Shared teams (both are members)
  const myTeamIds = new Set((myMemberships ?? []).map(m => m.team_id))
  const targetTeamIds = (targetMemberships ?? []).map(m => m.team_id)
  const sharedTeamIds = targetTeamIds.filter(id => myTeamIds.has(id))

  const [sharedTeamsData, demoCount] = await Promise.all([
    sharedTeamIds.length > 0
      ? admin.from('teams').select('id, name, logo_url').in('id', sharedTeamIds)
      : Promise.resolve({ data: [] }),
    sharedTeamIds.length > 0
      ? admin.from('demos').select('id', { count: 'exact', head: true }).in('team_id', sharedTeamIds).eq('status', 'completed')
      : Promise.resolve({ count: 0 }),
  ])

  const sharedTeams = (sharedTeamsData?.data ?? []) as { id: string; name: string; logo_url: string | null }[]
  const totalDemos = (demoCount as { count: number | null }).count ?? 0

  const nameToDisplay = target.display_name || target.username
  const joinDate = new Date(target.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  const roles = (target.preferred_roles as string[] | null) ?? []
  const maps = (target.favorite_maps as string[] | null) ?? []

  const planBadge = targetPlan ? PLAN_BADGE[targetPlan] : null

  return (
    <div className="min-h-full pb-10">

      {/* ── HERO ──────────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden border-b border-border" style={{ background: 'var(--card)' }}>
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse 60% 100% at 0% 0%, color-mix(in srgb, var(--accent) 8%, transparent), transparent 70%)',
        }} />
        <div className="absolute top-0 left-0 right-0 h-0.5" style={{
          background: 'linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 30%, transparent) 60%, transparent)',
        }} />

        <div className="relative max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-8">
          <Link href="/friends" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-5 transition-colors">
            <ArrowLeft size={13} />
            Back
          </Link>

          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 md:gap-5">
              <div className="relative shrink-0">
                {target.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={target.avatar_url} alt={nameToDisplay}
                    style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '2px solid color-mix(in srgb, var(--accent) 50%, transparent)', boxShadow: '0 0 20px color-mix(in srgb, var(--accent) 20%, transparent)' }}
                  />
                ) : (
                  <div style={{
                    width: 80, height: 80, borderRadius: '50%',
                    background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent) 20%, transparent), color-mix(in srgb, var(--accent) 8%, transparent))',
                    border: '2px solid color-mix(in srgb, var(--accent) 45%, transparent)',
                    boxShadow: '0 0 20px color-mix(in srgb, var(--accent) 20%, transparent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 26, fontWeight: 700, color: 'var(--accent)',
                  }}>
                    {nameToDisplay.slice(0, 2).toUpperCase()}
                  </div>
                )}
                {isFriend && (
                  <div className="absolute bottom-1 right-1 w-3.5 h-3.5 rounded-full border-2 border-card" style={{ background: 'var(--win)' }} />
                )}
              </div>

              <div className="min-w-0 pt-1">
                <h1 className="text-2xl font-bold text-foreground leading-tight">{nameToDisplay}</h1>
                <p className="text-sm text-muted-foreground mt-0.5">@{target.username}</p>
                {target.bio && (
                  <p className="text-sm text-muted-foreground/80 mt-2 max-w-sm leading-relaxed">{target.bio}</p>
                )}

                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar size={11} />Joined {joinDate}
                  </span>
                  {planBadge && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold"
                      style={{ background: planBadge.bg, color: planBadge.color, border: `1px solid ${planBadge.border}`, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                      ✦ {planBadge.label}
                    </span>
                  )}
                  {target.steam_id && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium" style={{ background: 'rgba(27,40,56,0.8)', color: '#c7d5e0', border: '1px solid rgba(199,213,224,0.2)' }}>
                      <Shield size={9} />Steam
                    </span>
                  )}
                  {target.faceit_id && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium" style={{ background: 'rgba(249,115,22,0.12)', color: '#fb923c', border: '1px solid rgba(249,115,22,0.25)' }}>
                      <Crosshair size={9} />FACEIT
                    </span>
                  )}
                  {roles.slice(0, 2).map((r: string) => (
                    <span key={r} className={cn('px-2 py-0.5 rounded-md border text-[10px] font-medium', ROLE_COLORS[r] ?? 'bg-muted/30 border-border text-muted-foreground')}>
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <AddFriendButton
              friendshipId={friendship?.id ?? null}
              friendshipStatus={friendship?.status ?? null}
              iSentRequest={iSentRequest}
              theyRequestedMe={theyRequestedMe}
              targetUsername={target.username}
            />
          </div>

          {/* Stats strip */}
          {(sharedTeams.length > 0 || totalDemos > 0) && (
            <div className="flex flex-wrap items-center gap-x-8 gap-y-3 mt-6 pt-5 border-t border-border/50">
              {[
                sharedTeams.length > 0 && { value: sharedTeams.length, label: 'Shared Teams', accent: false },
                totalDemos > 0 && { value: totalDemos, label: 'Demos on Shared Teams', accent: true },
              ].filter(Boolean).map((s, i) => {
                const stat = s as { value: number; label: string; accent: boolean }
                return (
                  <div key={i} className="flex items-center gap-8">
                    {i > 0 && <div className="w-px h-7 bg-border -ml-8" />}
                    <div>
                      <p className="text-2xl font-bold tabular-nums" style={{ color: stat.accent ? 'var(--accent)' : 'var(--text)' }}>{stat.value}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{stat.label}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── CONTENT ──────────────────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-4 md:px-6 pt-6 space-y-4">

        {/* Friendship CTA */}
        {!isFriend && (
          <div className="rv-panel p-6 text-center">
            <span className="rv-tick rv-tick-tl" />
            {iSentRequest ? (
              <>
                <p className="text-sm font-medium text-foreground mb-1">Friend request sent</p>
                <p className="text-xs text-muted-foreground">Waiting for @{target.username} to accept.</p>
              </>
            ) : theyRequestedMe ? (
              <>
                <p className="text-sm font-medium text-foreground mb-1">@{target.username} wants to be friends</p>
                <p className="text-xs text-muted-foreground">Accept their request above to connect.</p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-foreground mb-1">Not connected yet</p>
                <p className="text-xs text-muted-foreground">Add @{target.username} as a friend to invite them to your team.</p>
              </>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Roles */}
          {roles.length > 0 && (
            <div className="rv-panel p-4">
              <span className="rv-tick rv-tick-tl" />
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5" style={{ letterSpacing: '0.08em' }}>
                <Target size={11} style={{ color: 'var(--accent)' }} />
                Roles
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {roles.map((r: string) => (
                  <span key={r} className={cn('px-2.5 py-1 rounded-md border text-xs font-medium', ROLE_COLORS[r] ?? 'bg-muted/30 border-border text-muted-foreground')}>
                    {r}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Favourite Maps */}
          {maps.length > 0 && (
            <div className="rv-panel p-4">
              <span className="rv-tick rv-tick-tl" />
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5" style={{ letterSpacing: '0.08em' }}>
                <FileVideo size={11} style={{ color: 'var(--accent)' }} />
                Favourite Maps
              </h3>
              <div className="flex flex-wrap gap-2">
                {maps.map((m: string) => {
                  const thumb = MAP_THUMBS[m]
                  return (
                    <div key={m} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono"
                      style={{ background: 'color-mix(in srgb, var(--accent) 10%, transparent)', color: 'var(--accent)', border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)' }}>
                      {thumb && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumb} alt={m} className="w-4 h-4 rounded object-cover opacity-70" />
                      )}
                      {MAP_LABELS[m] ?? m}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Shared Teams */}
          {sharedTeams.length > 0 && (
            <div className="rv-panel p-4 sm:col-span-2">
              <span className="rv-tick rv-tick-tl" />
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5" style={{ letterSpacing: '0.08em' }}>
                <Users size={11} style={{ color: 'var(--accent)' }} />
                Shared Teams
              </h3>
              <div className="flex flex-wrap gap-2">
                {sharedTeams.map(t => (
                  <Link key={t.id} href={`/teams/${t.id}`}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border hover:border-accent/40 hover:bg-accent/5 transition-colors">
                    {t.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.logo_url} alt={t.name} className="w-5 h-5 rounded object-cover" />
                    ) : (
                      <div className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold shrink-0"
                        style={{ background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)' }}>
                        {t.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="text-xs font-medium text-foreground">{t.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Empty state — shown when no roles, no maps, no shared teams, and is a friend */}
          {isFriend && roles.length === 0 && maps.length === 0 && sharedTeams.length === 0 && (
            <div className="rv-panel p-10 text-center sm:col-span-2">
              <span className="rv-tick rv-tick-tl" />
              <Users size={28} className="text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground mb-1">@{target.username} hasn't filled in their profile yet</p>
              <p className="text-xs text-muted-foreground">Invite them to a team to get started.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
