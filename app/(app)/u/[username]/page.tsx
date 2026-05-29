export const dynamic = 'force-dynamic'

import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth/get-user'
import { cn } from '@/lib/utils'
import {
  ArrowLeft, Shield, Calendar, Crosshair,
} from 'lucide-react'
import AddFriendButton from './AddFriendButton'

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
  const roles = (target.preferred_roles as string[] | null) ?? []
  const maps = (target.favorite_maps as string[] | null) ?? []

  return (
    <div className="min-h-full pb-10">
      <div className="relative overflow-hidden bg-card border-b border-border">
        <div className="absolute inset-0 bg-gradient-to-br from-neon-green/5 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-0 right-0 w-80 h-40 bg-neon-green/3 blur-3xl pointer-events-none" />

        <div className="relative max-w-3xl mx-auto px-4 md:px-6 py-6 md:py-8">
          <Link href="/friends" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-5 transition-colors">
            <ArrowLeft size={13} />
            Friends
          </Link>

          <div className="flex items-start justify-between gap-4">
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
                {target.bio && (
                  <p className="text-sm text-muted-foreground/80 mt-2 max-w-md leading-relaxed">{target.bio}</p>
                )}

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
                  {roles.slice(0, 2).map((r: string) => (
                    <span key={r} className={cn('px-2 py-0.5 rounded-full border text-[10px] font-medium', ROLE_COLORS[r] ?? 'bg-muted/40 border-border text-muted-foreground')}>
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
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 md:px-6 pt-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {roles.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Roles</h3>
              <div className="flex flex-wrap gap-1.5">
                {roles.map((r: string) => (
                  <span key={r} className={cn('px-2.5 py-1 rounded-full border text-xs font-medium', ROLE_COLORS[r] ?? 'bg-muted/30 border-border text-muted-foreground')}>
                    {r}
                  </span>
                ))}
              </div>
            </div>
          )}

          {maps.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Favourite Maps</h3>
              <div className="flex flex-wrap gap-1.5">
                {maps.map((m: string) => (
                  <span key={m} className="px-2.5 py-1 rounded-md bg-neon-green/10 border border-neon-green/20 text-xs text-neon-green font-mono">
                    {MAP_LABELS[m] ?? m}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {!isFriend && (
          <div className="mt-4 rounded-xl border border-border bg-card p-8 text-center">
            {iSentRequest ? (
              <>
                <p className="text-sm font-medium text-foreground mb-1">Friend request sent</p>
                <p className="text-xs text-muted-foreground">
                  Waiting for @{target.username} to accept.
                </p>
              </>
            ) : theyRequestedMe ? (
              <>
                <p className="text-sm font-medium text-foreground mb-1">
                  @{target.username} sent you a friend request
                </p>
                <p className="text-xs text-muted-foreground">Accept to become friends.</p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-foreground mb-1">Not friends yet</p>
                <p className="text-xs text-muted-foreground">
                  Add @{target.username} as a friend to invite them to your team.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
