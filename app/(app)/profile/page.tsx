'use client'

import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useDropzone } from 'react-dropzone'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  User, Save, Link2, Upload, Check, Loader2, Shield,
  AlertCircle, ExternalLink, Crosshair, Users, FileVideo,
  Unlink, X, Edit3, ArrowLeft, Calendar, Target,
} from 'lucide-react'
import type { Profile } from '@/types/database'
import { CS2_MAPS, PLAYER_ROLES } from '@/types/database'
import FaceitEloCard from '@/components/teams/FaceitEloCard'

// ─── constants ────────────────────────────────────────────────────────────────

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

// ─── local types ──────────────────────────────────────────────────────────────

type RecentMatch = {
  id: string
  map: string
  display_date: string | null
  demo_type: string
  opponent_name: string
  score_t1: number
  score_t2: number
}

type TeamInfo = {
  id: string
  name: string
  logo_url: string | null
}

type MapStat = {
  map: string
  count: number
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'
}

function relativeDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const diff = Date.now() - d.getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// ─── sub-components ───────────────────────────────────────────────────────────

function AvatarDisplay({
  url, name, size = 'md',
}: { url: string | null; name: string; size?: 'sm' | 'md' | 'lg' }) {
  const cls = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-16 h-16 text-xl',
    lg: 'w-24 h-24 text-3xl',
  }[size]
  if (url) return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={name} className={cn(cls, 'rounded-full object-cover ring-2 ring-neon-green/30')} />
  )
  return (
    <div className={cn(cls, 'rounded-full bg-neon-green/20 border-2 border-neon-green/30 flex items-center justify-center')}>
      <span className="font-bold text-neon-green">{getInitials(name)}</span>
    </div>
  )
}

function AvatarDropzone({ currentUrl, onUpload, uploading, displayName }: {
  currentUrl: string | null; onUpload: (file: File) => void; uploading: boolean; displayName: string
}) {
  const [preview, setPreview] = useState<string | null>(null)
  const onDrop = useCallback((files: File[]) => {
    const file = files[0]; if (!file) return
    setPreview(URL.createObjectURL(file)); onUpload(file)
  }, [onUpload])
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'] }, maxFiles: 1, maxSize: 5 * 1024 * 1024,
  })
  return (
    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
      <div className="relative shrink-0">
        <AvatarDisplay url={preview || currentUrl} name={displayName} size="md" />
        {uploading && (
          <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center">
            <Loader2 size={20} className="animate-spin text-neon-green" />
          </div>
        )}
      </div>
      <div {...getRootProps()} className={cn(
        'flex-1 border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors',
        isDragActive ? 'border-neon-green bg-neon-green/5' : 'border-border hover:border-neon-green/40 hover:bg-accent/30'
      )}>
        <input {...getInputProps()} />
        <Upload size={18} className={cn('mx-auto mb-1', isDragActive ? 'text-neon-green' : 'text-muted-foreground')} />
        <p className="text-xs text-muted-foreground">{isDragActive ? 'Drop image here' : 'Drag & drop or click to upload'}</p>
        <p className="text-xs text-muted-foreground/60 mt-0.5">PNG, JPG up to 5MB</p>
      </div>
    </div>
  )
}

function ChipSelect({ options, selected, onChange, color = 'neon' }: {
  options: readonly string[]; selected: string[]; onChange: (v: string[]) => void; color?: 'neon' | 'blue'
}) {
  const toggle = (opt: string) => onChange(selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt])
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => {
        const active = selected.includes(opt)
        return (
          <button key={opt} type="button" onClick={() => toggle(opt)} className={cn(
            'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
            active
              ? color === 'neon'
                ? 'bg-neon-green/20 text-neon-green border-neon-green/40'
                : 'bg-blue-500/20 text-blue-400 border-blue-400/40'
              : 'bg-muted/30 text-muted-foreground border-border hover:border-neon-green/30 hover:text-foreground'
          )}>
            {active && <Check size={10} className="inline mr-1" />}{opt}
          </button>
        )
      })}
    </div>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

export default function ProfilePage() {
  const searchParams = useSearchParams()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'view' | 'edit'>('view')

  // Edit state
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Social data
  const [stats, setStats] = useState({ demos: 0, teams: 0 })
  const [recentMatches, setRecentMatches] = useState<RecentMatch[]>([])
  const [teamsData, setTeamsData] = useState<TeamInfo[]>([])
  const [mapStats, setMapStats] = useState<MapStat[]>([])
  const [primaryTeamId, setPrimaryTeamId] = useState<string | null>(null)

  // Linked accounts
  const [linkBanner, setLinkBanner] = useState<string | null>(null)
  const [unlinking, setUnlinking] = useState<'steam' | 'faceit' | null>(null)
  const [faceitLinking, setFaceitLinking] = useState(false)
  const faceitPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const faceitPopupRef = useRef<Window | null>(null)

  // Form fields
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [favoriteMaps, setFavoriteMaps] = useState<string[]>([])
  const [preferredRoles, setPreferredRoles] = useState<string[]>([])
  const [steamId, setSteamId] = useState('')
  const [discordId, setDiscordId] = useState('')
  const [faceitId, setFaceitId] = useState('')

  useEffect(() => {
    return () => { if (faceitPollRef.current) clearInterval(faceitPollRef.current) }
  }, [])

  useEffect(() => {
    const fetchAll = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      // Profile
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (prof) {
        setProfile(prof as Profile)
        setDisplayName(prof.display_name || '')
        setBio(prof.bio || '')
        setAvatarUrl(prof.avatar_url || null)
        setFavoriteMaps(prof.favorite_maps || [])
        setPreferredRoles(prof.preferred_roles || [])
        setSteamId(prof.steam_id || '')
        setDiscordId(prof.discord_id || '')
        setFaceitId(prof.faceit_id || '')

        // If Steam is linked but no avatar stored yet, fetch it from Steam now
        if (prof.steam_id && !prof.avatar_url) {
          fetch('/api/profile/sync-steam-avatar', { method: 'POST' })
            .then(r => r.ok ? r.json() : null)
            .then(d => { if (d?.avatar_url) setAvatarUrl(d.avatar_url) })
            .catch(() => {})
        }
      }

      // Team memberships
      const { data: memberships } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id)
      const teamIds = (memberships || []).map(m => m.team_id)

      if (teamIds.length > 0) {
        setPrimaryTeamId(teamIds[0])

        // Teams info
        const { data: teams } = await supabase
          .from('teams')
          .select('id, name, logo_url')
          .in('id', teamIds)
        setTeamsData((teams || []) as TeamInfo[])

        // Demo count
        const { count: demoCount } = await supabase
          .from('demos')
          .select('*', { count: 'exact', head: true })
          .in('team_id', teamIds)
        setStats({ demos: demoCount ?? 0, teams: teamIds.length })

        // Recent matches (last 5 completed, most recent first)
        const { data: demosData } = await supabase
          .from('demos')
          .select('id, map, match_date, created_at, demo_type, opponent_name, parsed_data')
          .in('team_id', teamIds)
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(5)

        const matches: RecentMatch[] = (demosData || []).map(d => {
          const pd = d.parsed_data as { header?: { score_team1?: number; score_team2?: number } } | null
          return {
            id: d.id,
            map: d.map,
            display_date: d.match_date || d.created_at,
            demo_type: d.demo_type,
            opponent_name: d.opponent_name,
            score_t1: pd?.header?.score_team1 ?? 0,
            score_t2: pd?.header?.score_team2 ?? 0,
          }
        })
        setRecentMatches(matches)

        // Map play frequency
        const { data: allDemos } = await supabase
          .from('demos')
          .select('map')
          .in('team_id', teamIds)
          .eq('status', 'completed')
        const counts: Record<string, number> = {}
        for (const d of allDemos || []) counts[d.map] = (counts[d.map] || 0) + 1
        const sorted = Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([map, count]) => ({ map, count }))
        setMapStats(sorted)
      } else {
        setStats({ demos: 0, teams: 0 })
      }

      setLoading(false)
    }
    fetchAll()
  }, [])

  // OAuth result banners
  useEffect(() => {
    const linked = searchParams.get('linked')
    const linkError = searchParams.get('error')
    if (linked === 'steam') {
      setLinkBanner('Steam account linked successfully!')
      const supabase = createClient()
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) return
        supabase.from('profiles').select('steam_id').eq('id', user.id).single().then(({ data }) => {
          if (data?.steam_id) setSteamId(data.steam_id)
        })
      })
    } else if (linked === 'faceit') {
      const nickname = searchParams.get('nickname') ?? ''
      setLinkBanner(`FACEIT account linked${nickname ? ` as ${nickname}` : ''}!`)
      const supabase = createClient()
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) return
        supabase.from('profiles').select('faceit_id').eq('id', user.id).single().then(({ data }) => {
          if (data?.faceit_id) setFaceitId(data.faceit_id)
        })
      })
    } else if (linkError) {
      setLinkBanner(
        linkError === 'faceit_session'
          ? 'Link failed: session expired, please try again'
          : `Link failed: ${linkError.replace(/_/g, ' ')}`
      )
    }
  }, [searchParams])

  const handleLinkFaceit = () => {
    const popup = window.open('/api/auth/faceit', 'faceit-oauth', 'width=600,height=700,scrollbars=yes')
    if (!popup) return
    faceitPopupRef.current = popup
    setFaceitLinking(true)
    const supabase = createClient()
    faceitPollRef.current = setInterval(async () => {
      if (popup.closed) { clearInterval(faceitPollRef.current!); setFaceitLinking(false); return }
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('profiles').select('faceit_id').eq('id', user.id).single()
      if (data?.faceit_id) {
        clearInterval(faceitPollRef.current!)
        setFaceitLinking(false)
        setFaceitId(data.faceit_id)
        setLinkBanner(`FACEIT account linked as ${data.faceit_id}!`)
        try { popup.close() } catch {}
      }
    }, 2000)
  }

  const handleUnlink = async (provider: 'steam' | 'faceit') => {
    setUnlinking(provider)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setUnlinking(null); return }
    await supabase.from('profiles').update({
      [provider === 'steam' ? 'steam_id' : 'faceit_id']: null,
    }).eq('id', user.id)
    if (provider === 'steam') setSteamId('')
    else setFaceitId('')
    setUnlinking(null)
  }

  const handleAvatarUpload = async (file: File) => {
    setUploadingAvatar(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setUploadingAvatar(false); return }
    const ext = file.name.split('.').pop()
    const path = `avatars/${user.id}/avatar.${ext}`
    const { error: uploadErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (!uploadErr) {
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      setAvatarUrl(data.publicUrl + '?t=' + Date.now())
    }
    setUploadingAvatar(false)
  }

  const handleSave = async () => {
    if (!profile) return
    setSaving(true)
    setError(null)
    const supabase = createClient()
    const updates = {
      display_name: displayName.trim() || null,
      bio: bio.trim() || null,
      avatar_url: avatarUrl,
      favorite_maps: favoriteMaps,
      preferred_roles: preferredRoles,
      steam_id: steamId.trim() || null,
      discord_id: discordId.trim() || null,
      faceit_id: faceitId.trim() || null,
      updated_at: new Date().toISOString(),
    }
    const { error: err } = await supabase.from('profiles').update(updates).eq('id', profile.id)
    if (err) {
      setError(err.message)
    } else {
      setProfile(prev => prev ? { ...prev, ...updates } : prev)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }
    setSaving(false)
  }

  // ─── loading / error ────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Loader2 className="animate-spin text-neon-green" size={32} />
    </div>
  )

  if (!profile) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <AlertCircle size={32} className="text-red-400" />
      <p className="text-foreground">Profile not found</p>
    </div>
  )

  const nameToDisplay = displayName || profile.username
  const joinDate = new Date(profile.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  // ─── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full pb-10">

      {/* ── HERO BANNER ────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-card border-b border-border">
        {/* Gradient accents */}
        <div className="absolute inset-0 bg-gradient-to-br from-neon-green/6 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-0 right-0 w-96 h-48 bg-neon-green/4 blur-3xl rounded-full pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-4 md:px-6 py-8 md:py-10">
          <div className="flex items-start justify-between gap-4">

            {/* Avatar + name block */}
            <div className="flex items-start gap-4 md:gap-6">
              <div className="relative shrink-0">
                <AvatarDisplay url={avatarUrl} name={nameToDisplay} size="lg" />
                <div className="absolute bottom-1 right-1 w-3.5 h-3.5 rounded-full bg-neon-green border-2 border-card" />
              </div>

              <div className="min-w-0">
                <h1 className="text-2xl md:text-3xl font-bold text-foreground leading-tight truncate">
                  {nameToDisplay}
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">@{profile.username}</p>

                {bio && (
                  <p className="text-sm text-muted-foreground/80 mt-2 max-w-md leading-relaxed">
                    {bio}
                  </p>
                )}

                {/* Badges row */}
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar size={11} />
                    Joined {joinDate}
                  </span>
                  {steamId && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#1b2838]/80 border border-[#c7d5e0]/20 text-[10px] text-[#c7d5e0] font-medium">
                      <Shield size={9} />Steam
                    </span>
                  )}
                  {faceitId && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/25 text-[10px] text-orange-400 font-medium">
                      <Crosshair size={9} />FACEIT
                    </span>
                  )}
                  {preferredRoles.slice(0, 2).map(r => (
                    <span key={r} className={cn(
                      'px-2 py-0.5 rounded-full border text-[10px] font-medium',
                      ROLE_COLORS[r] ?? 'bg-muted/40 border-border text-muted-foreground'
                    )}>
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Edit / back button */}
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 gap-2 text-xs"
              onClick={() => setMode(mode === 'edit' ? 'view' : 'edit')}
            >
              {mode === 'edit'
                ? <><ArrowLeft size={13} />View Profile</>
                : <><Edit3 size={13} />Edit Profile</>
              }
            </Button>
          </div>

          {/* Stats strip */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mt-7 pt-6 border-t border-border/60">
            <StatCell value={stats.demos} label="Demos Analysed" accent />
            <Divider />
            <StatCell value={stats.teams} label="Teams" />
            {recentMatches.length > 0 && (
              <>
                <Divider />
                <StatCell value={recentMatches.length} label="Recent Matches" />
              </>
            )}
            {mapStats.length > 0 && (
              <>
                <Divider />
                <StatCell value={mapStats.length} label="Maps Played" />
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── BODY ────────────────────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 md:px-6 pt-6">

        {mode === 'view' ? (

          /* ── VIEW MODE ──────────────────────────────────────────────────────── */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* ── Left column ── */}
            <div className="space-y-4">

              {/* Roles */}
              {preferredRoles.length > 0 && (
                <SideCard title="Roles" icon={<Target size={12} />}>
                  <div className="flex flex-wrap gap-1.5">
                    {preferredRoles.map(r => (
                      <span key={r} className={cn(
                        'px-2.5 py-1 rounded-full border text-xs font-medium',
                        ROLE_COLORS[r] ?? 'bg-muted/30 border-border text-muted-foreground'
                      )}>
                        {r}
                      </span>
                    ))}
                  </div>
                </SideCard>
              )}

              {/* Map Pool */}
              {(favoriteMaps.length > 0 || mapStats.length > 0) && (
                <SideCard title="Map Pool" icon={<FileVideo size={12} />}>
                  {mapStats.length > 0 ? (
                    <div className="space-y-2.5">
                      {mapStats.map(({ map, count }) => {
                        const isFav = favoriteMaps.includes(map)
                        const label = MAP_LABELS[map] ?? map
                        const maxCount = mapStats[0].count
                        const pct = Math.max(8, Math.round((count / maxCount) * 100))
                        return (
                          <div key={map}>
                            <div className="flex items-center justify-between mb-1">
                              <span className={cn('text-xs font-medium flex items-center gap-1', isFav ? 'text-foreground' : 'text-muted-foreground')}>
                                {isFav && <span className="text-neon-green text-[9px]">★</span>}
                                {label}
                              </span>
                              <span className="text-[10px] text-muted-foreground tabular-nums">{count}</span>
                            </div>
                            <div className="h-1 rounded-full bg-muted/30">
                              <div
                                className={cn('h-full rounded-full transition-all', isFav ? 'bg-neon-green/60' : 'bg-muted-foreground/30')}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {favoriteMaps.map(m => (
                        <span key={m} className="px-2.5 py-1 rounded-md bg-neon-green/10 border border-neon-green/20 text-xs text-neon-green font-mono">
                          {MAP_LABELS[m] ?? m}
                        </span>
                      ))}
                    </div>
                  )}
                </SideCard>
              )}

              {/* Connections */}
              <SideCard title="Connections" icon={<Link2 size={12} />}>
                <div className="space-y-3">
                  <ConnectionRow
                    icon={<Shield size={13} className="text-[#c7d5e0]" />}
                    iconBg="bg-[#1b2838] border-[#c7d5e0]/20"
                    label="Steam"
                    value={steamId}
                  />
                  <ConnectionRow
                    icon={<Crosshair size={13} className="text-orange-400" />}
                    iconBg="bg-orange-500/20 border-orange-500/30"
                    label="FACEIT"
                    value={faceitId}
                  />
                  {discordId && (
                    <ConnectionRow
                      icon={<span className="text-[#5865F2] font-bold text-[10px]">DC</span>}
                      iconBg="bg-[#5865F2]/20 border-[#5865F2]/30"
                      label="Discord"
                      value={discordId}
                    />
                  )}
                </div>
              </SideCard>
            </div>

            {/* ── Right column ── */}
            <div className="lg:col-span-2 space-y-4">

              {/* FACEIT ELO */}
              {faceitId && primaryTeamId && (
                <FaceitEloCard faceitNickname={faceitId} teamId={primaryTeamId} />
              )}

              {/* Recent Matches */}
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <FileVideo size={14} className="text-neon-green" />
                    Recent Matches
                  </h3>
                  {recentMatches.length === 0 && (
                    <span className="text-xs text-muted-foreground">No matches yet</span>
                  )}
                </div>

                {recentMatches.length > 0 ? (
                  <div className="divide-y divide-border">
                    {recentMatches.map(m => {
                      const mapLabel = MAP_LABELS[m.map] ?? m.map
                      const hasScore = (m.score_t1 + m.score_t2) > 0
                      const hi = Math.max(m.score_t1, m.score_t2)
                      const lo = Math.min(m.score_t1, m.score_t2)
                      return (
                        <div key={m.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/10 transition-colors">
                          {/* Map name pill */}
                          <div className="w-20 shrink-0">
                            <p className="text-xs font-semibold text-foreground leading-tight">{mapLabel}</p>
                            <p className="text-[10px] text-muted-foreground capitalize mt-0.5">{m.demo_type}</p>
                          </div>

                          {/* vs opponent */}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-muted-foreground truncate">
                              vs{' '}
                              <span className="text-foreground font-medium">
                                {m.opponent_name || 'Unknown'}
                              </span>
                            </p>
                          </div>

                          {/* Score */}
                          {hasScore && (
                            <div className="shrink-0">
                              <p className="text-sm font-bold font-mono tabular-nums">
                                <span className="text-neon-green">{hi}</span>
                                <span className="text-muted-foreground/60 mx-0.5">–</span>
                                <span className="text-muted-foreground">{lo}</span>
                              </p>
                            </div>
                          )}

                          {/* Date */}
                          <div className="shrink-0 w-14 text-right">
                            <p className="text-[10px] text-muted-foreground">{relativeDate(m.display_date)}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="px-4 py-10 text-center">
                    <FileVideo size={28} className="text-muted-foreground/20 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No completed matches yet</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Upload a demo to see your match history here</p>
                  </div>
                )}
              </div>

              {/* Teams */}
              {teamsData.length > 0 && (
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="px-4 py-3 border-b border-border">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Users size={14} className="text-neon-green" />
                      Teams
                    </h3>
                  </div>
                  <div className="divide-y divide-border">
                    {teamsData.map(t => (
                      <div key={t.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/10 transition-colors">
                        {t.logo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={t.logo_url} alt={t.name} className="w-8 h-8 rounded object-cover shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded bg-neon-green/10 border border-neon-green/20 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-neon-green">{t.name.charAt(0).toUpperCase()}</span>
                          </div>
                        )}
                        <p className="text-sm font-medium text-foreground">{t.name}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No activity empty state */}
              {teamsData.length === 0 && recentMatches.length === 0 && (
                <div className="rounded-xl border border-border bg-card p-10 text-center">
                  <Users size={32} className="text-muted-foreground/20 mx-auto mb-3" />
                  <p className="text-sm font-medium text-foreground mb-1">No activity yet</p>
                  <p className="text-xs text-muted-foreground">Join a team and upload demos to see your profile come alive.</p>
                </div>
              )}
            </div>
          </div>

        ) : (

          /* ── EDIT MODE ──────────────────────────────────────────────────────── */
          <div className="max-w-2xl space-y-5">

            {/* Link banner */}
            {linkBanner && (
              <div className={cn(
                'flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-sm',
                linkBanner.startsWith('Link failed')
                  ? 'bg-red-400/10 border-red-400/30 text-red-400'
                  : 'bg-neon-green/10 border-neon-green/30 text-neon-green'
              )}>
                <span className="flex items-center gap-2">
                  {linkBanner.startsWith('Link failed') ? <AlertCircle size={14} /> : <Check size={14} />}
                  {linkBanner}
                </span>
                <button onClick={() => setLinkBanner(null)}>
                  <X size={14} className="opacity-60 hover:opacity-100" />
                </button>
              </div>
            )}

            {/* Profile info */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-5">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <User size={14} className="text-neon-green" />
                Profile Information
              </h2>

              <AvatarDropzone
                currentUrl={avatarUrl}
                onUpload={handleAvatarUpload}
                uploading={uploadingAvatar}
                displayName={nameToDisplay}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="displayName" className="text-xs mb-1.5 block">Display Name</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder="Your display name"
                    maxLength={50}
                  />
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Username</Label>
                  <Input value={`@${profile.username}`} readOnly disabled className="opacity-50 cursor-not-allowed" />
                  <p className="text-[10px] text-muted-foreground mt-1">Username cannot be changed</p>
                </div>
              </div>

              <div>
                <Label htmlFor="bio" className="text-xs mb-1.5 block">Bio</Label>
                <textarea
                  id="bio"
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  placeholder="Tell your team something about yourself..."
                  maxLength={280}
                  rows={3}
                  className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
                <p className="text-[10px] text-muted-foreground text-right mt-0.5">{bio.length}/280</p>
              </div>
            </div>

            {/* Roles & Maps */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-5">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Target size={14} className="text-neon-green" />
                Roles & Maps
              </h2>
              <div>
                <Label className="text-xs mb-2 block">Preferred Roles</Label>
                <ChipSelect options={PLAYER_ROLES} selected={preferredRoles} onChange={setPreferredRoles} color="blue" />
              </div>
              <div>
                <Label className="text-xs mb-2 block">Favorite Maps</Label>
                <ChipSelect options={CS2_MAPS} selected={favoriteMaps} onChange={setFavoriteMaps} />
              </div>
            </div>

            {/* Linked accounts */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Link2 size={14} className="text-neon-green" />
                Linked Accounts
              </h2>

              {/* Steam */}
              <div className={cn('flex items-center gap-4 p-4 rounded-lg border bg-muted/10', steamId ? 'border-[#c7d5e0]/30' : 'border-border')}>
                <div className="w-10 h-10 rounded-lg bg-[#1b2838] border border-border flex items-center justify-center shrink-0">
                  <Shield size={18} className="text-[#c7d5e0]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">Steam</p>
                    {steamId && <Badge variant="outline" className="text-[10px] text-[#c7d5e0] border-[#c7d5e0]/30 bg-[#1b2838]/50">Linked</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 font-mono">{steamId || 'Not linked'}</p>
                </div>
                {steamId ? (
                  <Button variant="outline" size="sm" className="shrink-0 gap-1.5 text-xs text-red-400 hover:text-red-300 border-red-400/30 hover:border-red-400/60" onClick={() => handleUnlink('steam')} disabled={unlinking === 'steam'}>
                    {unlinking === 'steam' ? <Loader2 size={11} className="animate-spin" /> : <Unlink size={11} />}Unlink
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" className="shrink-0 gap-1.5 text-xs" onClick={() => { window.location.href = '/api/auth/steam' }}>
                    <ExternalLink size={11} />Link Steam
                  </Button>
                )}
              </div>

              {/* FACEIT */}
              <div className={cn('flex items-center gap-4 p-4 rounded-lg border bg-muted/10', faceitId ? 'border-orange-500/30' : 'border-border')}>
                <div className="w-10 h-10 rounded-lg bg-orange-500/20 border border-orange-500/30 flex items-center justify-center shrink-0">
                  <Crosshair size={16} className="text-orange-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">FACEIT</p>
                    {faceitId && <Badge variant="outline" className="text-[10px] text-orange-400 border-orange-400/30 bg-orange-500/10">Linked</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{faceitId || 'Not linked'}</p>
                </div>
                {faceitId ? (
                  <Button variant="outline" size="sm" className="shrink-0 gap-1.5 text-xs text-red-400 hover:text-red-300 border-red-400/30 hover:border-red-400/60" onClick={() => handleUnlink('faceit')} disabled={unlinking === 'faceit'}>
                    {unlinking === 'faceit' ? <Loader2 size={11} className="animate-spin" /> : <Unlink size={11} />}Unlink
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" className="shrink-0 gap-1.5 text-xs text-orange-400 border-orange-400/30 hover:border-orange-400/60 hover:text-orange-300" onClick={handleLinkFaceit} disabled={faceitLinking}>
                    {faceitLinking ? <Loader2 size={11} className="animate-spin" /> : <ExternalLink size={11} />}
                    {faceitLinking ? 'Linking…' : 'Link FACEIT'}
                  </Button>
                )}
              </div>

              {/* Discord */}
              <div className="flex items-center gap-4 p-4 rounded-lg border border-border bg-muted/10">
                <div className="w-10 h-10 rounded-lg bg-[#5865F2]/20 border border-[#5865F2]/30 flex items-center justify-center shrink-0">
                  <span className="text-[#5865F2] font-bold text-sm">DC</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">Discord</p>
                  <Input value={discordId} onChange={e => setDiscordId(e.target.value)} placeholder="Your Discord username" className="mt-1.5 text-xs h-8" />
                </div>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-3 py-2.5">
                <AlertCircle size={14} />{error}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pb-4">
              <Button variant="ghost" size="sm" onClick={() => setMode('view')} className="gap-2 text-xs">
                <ArrowLeft size={13} />Back to Profile
              </Button>
              <Button onClick={handleSave} disabled={saving || uploadingAvatar} variant={saved ? 'outline' : 'neon'} className="gap-2 min-w-[130px]">
                {saving
                  ? <><Loader2 size={14} className="animate-spin" />Saving…</>
                  : saved
                    ? <><Check size={14} className="text-neon-green" />Saved!</>
                    : <><Save size={14} />Save Changes</>
                }
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── tiny layout helpers ──────────────────────────────────────────────────────

function StatCell({ value, label, accent }: { value: number; label: string; accent?: boolean }) {
  return (
    <div>
      <p className={cn('text-2xl font-bold tabular-nums', accent ? 'text-neon-green' : 'text-foreground')}>{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  )
}

function Divider() {
  return <div className="w-px h-8 bg-border" />
}

function SideCard({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
        {icon}{title}
      </h3>
      {children}
    </div>
  )
}

function ConnectionRow({ icon, iconBg, label, value }: {
  icon: React.ReactNode; iconBg: string; label: string; value: string
}) {
  const linked = !!value
  return (
    <div className="flex items-center gap-3">
      <div className={cn('w-7 h-7 rounded border flex items-center justify-center shrink-0', iconBg)}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground leading-tight">{label}</p>
        <p className="text-[10px] text-muted-foreground truncate mt-0.5 font-mono">
          {linked ? value : 'Not linked'}
        </p>
      </div>
      {linked && <Check size={12} className="text-neon-green shrink-0" />}
    </div>
  )
}
