'use client'

import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useDropzone } from 'react-dropzone'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  User, Save, Link2, Upload, Check, Loader2, Shield,
  AlertCircle, ExternalLink, Crosshair, Users, FileVideo,
  Unlink, X, Edit3, Calendar, Target,
} from 'lucide-react'
import type { Profile } from '@/types/database'
import { CS2_MAPS, PLAYER_ROLES } from '@/types/database'
import FaceitEloCard from '@/components/teams/FaceitEloCard'
import { MAP_THUMBS } from '@/lib/map-config'

// ─── constants ────────────────────────────────────────────────────────────────

const MAP_LABELS: Record<string, string> = {
  de_dust2: 'Dust2', de_mirage: 'Mirage', de_inferno: 'Inferno',
  de_nuke: 'Nuke', de_overpass: 'Overpass', de_ancient: 'Ancient',
  de_anubis: 'Anubis', de_vertigo: 'Vertigo',
}

const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'IGL':           { bg: 'rgba(168,85,247,0.12)', text: '#c084fc', border: 'rgba(168,85,247,0.3)' },
  'AWPer':         { bg: 'rgba(34,211,238,0.12)', text: '#22d3ee', border: 'rgba(34,211,238,0.3)' },
  'Entry Fragger': { bg: 'rgba(239,68,68,0.12)',  text: '#f87171', border: 'rgba(239,68,68,0.3)' },
  'Support':       { bg: 'rgba(59,130,246,0.12)', text: '#60a5fa', border: 'rgba(59,130,246,0.3)' },
  'Lurker':        { bg: 'rgba(245,158,11,0.12)', text: '#fbbf24', border: 'rgba(245,158,11,0.3)' },
  'Rifler':        { bg: 'rgba(16,185,129,0.12)', text: '#34d399', border: 'rgba(16,185,129,0.3)' },
  'Anchor':        { bg: 'rgba(100,116,139,0.12)',text: '#94a3b8', border: 'rgba(100,116,139,0.3)' },
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
  is_win: boolean | null
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

function AvatarDisplay({ url, name, size = 'md' }: { url: string | null; name: string; size?: 'sm' | 'md' | 'lg' }) {
  const dim = { sm: 32, md: 64, lg: 88 }[size]
  if (url) return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={name} style={{ width: dim, height: dim, borderRadius: '50%', objectFit: 'cover', border: '2px solid color-mix(in srgb, var(--accent) 50%, transparent)', boxShadow: '0 0 20px color-mix(in srgb, var(--accent) 20%, transparent)', flexShrink: 0 }} />
  )
  return (
    <div style={{
      width: dim, height: dim, borderRadius: '50%', flexShrink: 0,
      background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent) 20%, transparent), color-mix(in srgb, var(--accent) 8%, transparent))',
      border: '2px solid color-mix(in srgb, var(--accent) 45%, transparent)',
      boxShadow: '0 0 20px color-mix(in srgb, var(--accent) 20%, transparent)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size === 'lg' ? 28 : size === 'md' ? 20 : 12, fontWeight: 700, color: 'var(--accent)',
    }}>
      {getInitials(name)}
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
            <Loader2 size={20} className="animate-spin" style={{ color: 'var(--accent)' }} />
          </div>
        )}
      </div>
      <div {...getRootProps()} className={cn(
        'flex-1 border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors',
        isDragActive ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/40 hover:bg-accent/5'
      )}>
        <input {...getInputProps()} />
        <Upload size={18} className="mx-auto mb-1 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">{isDragActive ? 'Drop image here' : 'Drag & drop or click to upload'}</p>
        <p className="text-xs text-muted-foreground/50 mt-0.5">PNG, JPG up to 5MB</p>
      </div>
    </div>
  )
}

function ChipSelect({ options, selected, onChange, accent = false }: {
  options: readonly string[]; selected: string[]; onChange: (v: string[]) => void; accent?: boolean
}) {
  const toggle = (opt: string) => onChange(selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt])
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => {
        const active = selected.includes(opt)
        return (
          <button key={opt} type="button" onClick={() => toggle(opt)}
            className="px-3 py-1.5 rounded-full text-xs font-medium border transition-all"
            style={active ? {
              background: accent ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'color-mix(in srgb, var(--signal) 15%, transparent)',
              color: accent ? 'var(--accent)' : 'var(--signal)',
              borderColor: accent ? 'color-mix(in srgb, var(--accent) 40%, transparent)' : 'color-mix(in srgb, var(--signal) 40%, transparent)',
            } : { background: 'transparent', color: 'var(--muted)', borderColor: 'var(--border)' }}
          >
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

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [stats, setStats] = useState({ demos: 0, teams: 0 })
  const [recentMatches, setRecentMatches] = useState<RecentMatch[]>([])
  const [teamsData, setTeamsData] = useState<TeamInfo[]>([])
  const [mapStats, setMapStats] = useState<MapStat[]>([])
  const [primaryTeamId, setPrimaryTeamId] = useState<string | null>(null)
  const [userPlan, setUserPlan] = useState<'pro' | 'team' | null>(null)

  const [linkBanner, setLinkBanner] = useState<string | null>(null)
  const [unlinking, setUnlinking] = useState<'steam' | 'faceit' | null>(null)
  const [faceitLinking, setFaceitLinking] = useState(false)
  const faceitPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const faceitPopupRef = useRef<Window | null>(null)

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
        if (prof.steam_id && !prof.avatar_url) {
          fetch('/api/profile/sync-steam-avatar', { method: 'POST' })
            .then(r => r.ok ? r.json() : null)
            .then(d => { if (d?.avatar_url) setAvatarUrl(d.avatar_url) })
            .catch(() => {})
        }
      }

      const { data: memberships } = await supabase.from('team_members').select('team_id').eq('user_id', user.id)
      const teamIds = (memberships || []).map(m => m.team_id)

      if (teamIds.length > 0) {
        // Fetch best active plan across all teams
        const { data: subs } = await supabase
          .from('subscriptions').select('plan, status')
          .in('team_id', teamIds)
          .in('status', ['active', 'trialing'])
        if (subs?.some(s => s.plan === 'team')) setUserPlan('team')
        else if (subs?.some(s => s.plan === 'pro')) setUserPlan('pro')

        setPrimaryTeamId(teamIds[0])
        const { data: teams } = await supabase.from('teams').select('id, name, logo_url').in('id', teamIds)
        setTeamsData((teams || []) as TeamInfo[])
        const { count: demoCount } = await supabase.from('demos').select('*', { count: 'exact', head: true }).in('team_id', teamIds)
        setStats({ demos: demoCount ?? 0, teams: teamIds.length })

        const { data: demosData } = await supabase
          .from('demos')
          .select('id, map, match_date, created_at, demo_type, opponent_name, parsed_data')
          .in('team_id', teamIds)
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(5)

        const matches: RecentMatch[] = (demosData || []).map(d => {
          const pd = d.parsed_data as { header?: { score_team1?: number; score_team2?: number }; opponentSide?: string } | null
          const s1 = pd?.header?.score_team1 ?? 0
          const s2 = pd?.header?.score_team2 ?? 0
          const opSide = pd?.opponentSide ?? 'team2'
          const ourScore = opSide === 'team1' ? s2 : s1
          const theirScore = opSide === 'team1' ? s1 : s2
          const is_win = (s1 + s2) > 0 ? ourScore > theirScore : null
          return { id: d.id, map: d.map, display_date: d.match_date || d.created_at, demo_type: d.demo_type, opponent_name: d.opponent_name, score_t1: s1, score_t2: s2, is_win }
        })
        setRecentMatches(matches)

        const { data: allDemos } = await supabase.from('demos').select('map').in('team_id', teamIds).eq('status', 'completed')
        const counts: Record<string, number> = {}
        for (const d of allDemos || []) counts[d.map] = (counts[d.map] || 0) + 1
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([map, count]) => ({ map, count }))
        setMapStats(sorted)
      } else {
        setStats({ demos: 0, teams: 0 })
      }
      setLoading(false)
    }
    fetchAll()
  }, [])

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
      setLinkBanner(linkError === 'faceit_session' ? 'Link failed: session expired, please try again' : `Link failed: ${linkError.replace(/_/g, ' ')}`)
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
    await supabase.from('profiles').update({ [provider === 'steam' ? 'steam_id' : 'faceit_id']: null }).eq('id', user.id)
    if (provider === 'steam') setSteamId(''); else setFaceitId('')
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
    setSaving(true); setError(null)
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
    if (err) { setError(err.message) } else {
      setProfile(prev => prev ? { ...prev, ...updates } : prev)
      setSaved(true); setTimeout(() => setSaved(false), 2500)
    }
    setSaving(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Loader2 className="animate-spin" size={28} style={{ color: 'var(--accent)' }} />
    </div>
  )

  if (!profile) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
      <AlertCircle size={28} className="text-red-400" />
      <p className="text-sm text-foreground">Profile not found</p>
    </div>
  )

  const nameToDisplay = displayName || profile.username
  const joinDate = new Date(profile.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  return (
    <div className="min-h-full pb-10">

      {/* ── HERO ──────────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden border-b border-border" style={{ background: 'var(--card)' }}>
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse 60% 100% at 0% 0%, color-mix(in srgb, var(--accent) 10%, transparent), transparent 70%)',
        }} />
        <div className="absolute top-0 left-0 right-0 h-0.5" style={{
          background: 'linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 30%, transparent) 60%, transparent)',
        }} />

        <div className="relative max-w-5xl mx-auto px-4 md:px-6 py-8">
          <div className="flex items-start justify-between gap-4">

            {/* Avatar + info */}
            <div className="flex items-start gap-5">
              <div className="relative shrink-0">
                <AvatarDisplay url={avatarUrl} name={nameToDisplay} size="lg" />
                <div className="absolute bottom-1 right-1 w-3 h-3 rounded-full border-2 border-card" style={{ background: 'var(--win)' }} />
              </div>

              <div className="min-w-0 pt-1">
                <h1 className="text-2xl font-bold text-foreground leading-tight truncate">{nameToDisplay}</h1>
                <p className="text-sm text-muted-foreground mt-0.5">@{profile.username}</p>

                {bio && (
                  <p className="text-sm text-muted-foreground/80 mt-2 max-w-sm leading-relaxed">{bio}</p>
                )}

                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar size={11} />Joined {joinDate}
                  </span>
                  {userPlan === 'team' && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold" style={{ background: 'color-mix(in srgb, var(--signal) 14%, transparent)', color: 'var(--signal)', border: '1px solid color-mix(in srgb, var(--signal) 30%, transparent)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                      ✦ Team
                    </span>
                  )}
                  {userPlan === 'pro' && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold" style={{ background: 'color-mix(in srgb, var(--accent) 14%, transparent)', color: 'var(--accent)', border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                      ✦ Pro
                    </span>
                  )}
                  {steamId && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium" style={{ background: 'rgba(27,40,56,0.8)', color: '#c7d5e0', border: '1px solid rgba(199,213,224,0.2)' }}>
                      <Shield size={9} /> Steam
                    </span>
                  )}
                  {faceitId && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium" style={{ background: 'rgba(249,115,22,0.12)', color: '#fb923c', border: '1px solid rgba(249,115,22,0.25)' }}>
                      <Crosshair size={9} /> FACEIT
                    </span>
                  )}
                  {preferredRoles.slice(0, 2).map(r => {
                    const c = ROLE_COLORS[r]
                    return c ? (
                      <span key={r} className="px-2 py-0.5 rounded-md text-[10px] font-medium" style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
                        {r}
                      </span>
                    ) : null
                  })}
                </div>
              </div>
            </div>

          </div>

          {/* Stats strip */}
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3 mt-7 pt-5 border-t border-border/50">
            {[
              { value: stats.demos, label: 'Demos Analyzed', accent: true },
              { value: stats.teams, label: 'Teams', accent: false },
              ...(recentMatches.length > 0 ? [{ value: recentMatches.length, label: 'Recent Matches', accent: false }] : []),
              ...(mapStats.length > 0 ? [{ value: mapStats.length, label: 'Maps Played', accent: false }] : []),
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-8">
                {i > 0 && <div className="w-px h-7 bg-border -ml-8" />}
                <div>
                  <p className="text-2xl font-bold tabular-nums" style={{ color: s.accent ? 'var(--accent)' : 'var(--text)' }}>{s.value}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── TAB BAR ─────────────────────────────────────────────────────────────── */}
      <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--panel)' }}>
        <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '10px 24px' }}>
          <div style={{ display: 'flex', gap: 2, padding: 2, borderRadius: 10, background: 'var(--card)', border: '1px solid var(--border)', width: 'fit-content' }}>
            {([
              { id: 'view', label: 'Overview',     icon: User  },
              { id: 'edit', label: 'Edit Profile',  icon: Edit3 },
            ] as const).map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setMode(id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: mode === id ? 'var(--accent)' : 'transparent',
                  color: mode === id ? '#fff' : 'var(--muted)',
                  fontSize: 12, fontWeight: 600, transition: 'all 0.13s',
                }}
              >
                <Icon size={13} />{label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── BODY ────────────────────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 md:px-6 pt-6">

        {mode === 'view' ? (

          /* ── VIEW MODE ──────────────────────────────────────────────────────── */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* ── Left ── */}
            <div className="space-y-4">

              {/* Roles */}
              {preferredRoles.length > 0 && (
                <ProfileCard title="Roles" icon={<Target size={13} />}>
                  <div className="flex flex-wrap gap-2">
                    {preferredRoles.map(r => {
                      const c = ROLE_COLORS[r]
                      return (
                        <span key={r} className="px-2.5 py-1 rounded-lg text-xs font-semibold" style={c ? { background: c.bg, color: c.text, border: `1px solid ${c.border}` } : { background: 'var(--elevated)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
                          {r}
                        </span>
                      )
                    })}
                  </div>
                </ProfileCard>
              )}

              {/* Map Pool */}
              {(favoriteMaps.length > 0 || mapStats.length > 0) && (
                <ProfileCard title="Map Pool" icon={<FileVideo size={13} />}>
                  {mapStats.length > 0 ? (
                    <div className="space-y-3">
                      {mapStats.map(({ map, count }) => {
                        const isFav = favoriteMaps.includes(map)
                        const label = MAP_LABELS[map] ?? map
                        const thumb = MAP_THUMBS[map]
                        const maxCount = mapStats[0].count
                        const pct = Math.max(8, Math.round((count / maxCount) * 100))
                        return (
                          <div key={map} className="flex items-center gap-2.5">
                            {/* Mini map thumb */}
                            <div className="w-8 h-8 rounded-md overflow-hidden shrink-0 border border-border/50">
                              {thumb
                                // eslint-disable-next-line @next/next/no-img-element
                                ? <img src={thumb} alt={label} className="w-full h-full object-cover" />
                                : <div className="w-full h-full bg-muted/30" />
                              }
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium text-foreground flex items-center gap-1">
                                  {isFav && <span style={{ color: 'var(--signal)', fontSize: 9 }}>★</span>}
                                  {label}
                                </span>
                                <span className="text-[10px] text-muted-foreground tabular-nums ml-2">{count}</span>
                              </div>
                              <div className="h-1 rounded-full" style={{ background: 'var(--hairline)' }}>
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{ width: `${pct}%`, background: isFav ? 'var(--accent)' : 'color-mix(in srgb, var(--accent) 40%, transparent)' }}
                                />
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {favoriteMaps.map(m => (
                        <span key={m} className="px-2.5 py-1 rounded-lg text-xs font-mono" style={{ background: 'color-mix(in srgb, var(--accent) 10%, transparent)', color: 'var(--accent)', border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)' }}>
                          {MAP_LABELS[m] ?? m}
                        </span>
                      ))}
                    </div>
                  )}
                </ProfileCard>
              )}

              {/* Connections */}
              <ProfileCard title="Connections" icon={<Link2 size={13} />}>
                <div className="space-y-2.5">
                  <ConnectionRow
                    icon={<Shield size={12} />} iconColor="#c7d5e0" iconBg="rgba(27,40,56,0.9)"
                    label="Steam" value={steamId}
                  />
                  <ConnectionRow
                    icon={<Crosshair size={12} />} iconColor="#fb923c" iconBg="rgba(249,115,22,0.15)"
                    label="FACEIT" value={faceitId}
                  />
                  {discordId && (
                    <ConnectionRow
                      icon={<span style={{ fontSize: 9, fontWeight: 800, color: '#818cf8' }}>DC</span>} iconColor="#818cf8" iconBg="rgba(99,102,241,0.15)"
                      label="Discord" value={discordId}
                    />
                  )}
                </div>
              </ProfileCard>

              {/* Teams */}
              {teamsData.length > 0 && (
                <ProfileCard title="Teams" icon={<Users size={13} />}>
                  <div className="space-y-2">
                    {teamsData.map(t => (
                      <div key={t.id} className="flex items-center gap-2.5 py-1">
                        {t.logo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={t.logo_url} alt={t.name} className="w-7 h-7 rounded-md object-cover shrink-0" />
                        ) : (
                          <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 text-xs font-bold" style={{ background: 'color-mix(in srgb, var(--accent) 12%, transparent)', color: 'var(--accent)', border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)' }}>
                            {t.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <p className="text-sm font-medium text-foreground truncate">{t.name}</p>
                      </div>
                    ))}
                  </div>
                </ProfileCard>
              )}
            </div>

            {/* ── Right ── */}
            <div className="lg:col-span-2 space-y-4">

              {/* FACEIT ELO */}
              {faceitId && primaryTeamId && (
                <FaceitEloCard faceitNickname={faceitId} teamId={primaryTeamId} />
              )}

              {/* Recent Matches */}
              <div className="rv-panel overflow-hidden">
                <span className="rv-tick rv-tick-tl" />
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <FileVideo size={14} style={{ color: 'var(--accent)' }} />
                    Recent Matches
                  </h3>
                  <span className="text-[11px] px-2 py-0.5 rounded-md font-mono font-semibold" style={{ background: 'color-mix(in srgb, var(--accent) 10%, transparent)', color: 'var(--accent)' }}>
                    {recentMatches.length}
                  </span>
                </div>

                {recentMatches.length > 0 ? (
                  <div className="divide-y divide-border">
                    {recentMatches.map(m => {
                      const mapLabel = MAP_LABELS[m.map] ?? m.map
                      const thumb = MAP_THUMBS[m.map]
                      const hasScore = (m.score_t1 + m.score_t2) > 0
                      const hi = Math.max(m.score_t1, m.score_t2)
                      const lo = Math.min(m.score_t1, m.score_t2)
                      const resultColor = m.is_win === true ? 'var(--win)' : m.is_win === false ? 'var(--loss)' : '#facc15'
                      const resultLabel = m.is_win === true ? 'W' : m.is_win === false ? 'L' : 'D'
                      return (
                        <div key={m.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors">
                          {/* Map thumbnail */}
                          <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-border/50">
                            {thumb
                              // eslint-disable-next-line @next/next/no-img-element
                              ? <img src={thumb} alt={mapLabel} className="w-full h-full object-cover" />
                              : <div className="w-full h-full bg-muted/30 flex items-center justify-center text-[9px] font-bold text-muted-foreground">{mapLabel.slice(0, 2)}</div>
                            }
                          </div>

                          {/* Map + opponent */}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-foreground leading-tight">{mapLabel}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                              vs <span className="text-foreground/80">{m.opponent_name || 'Unknown'}</span>
                            </p>
                          </div>

                          {/* Score */}
                          {hasScore && (
                            <p className="text-sm font-bold font-mono tabular-nums shrink-0">
                              <span style={{ color: 'var(--win)' }}>{hi}</span>
                              <span className="text-muted-foreground/50 mx-0.5">–</span>
                              <span className="text-muted-foreground">{lo}</span>
                            </p>
                          )}

                          {/* Result badge */}
                          {m.is_win !== null && (
                            <span className="text-[10px] font-black w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                              style={{ background: `color-mix(in srgb, ${resultColor} 15%, transparent)`, color: resultColor }}>
                              {resultLabel}
                            </span>
                          )}

                          {/* Date */}
                          <p className="text-[10px] text-muted-foreground w-14 text-right shrink-0">{relativeDate(m.display_date)}</p>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="px-4 py-12 text-center">
                    <FileVideo size={28} className="text-muted-foreground/20 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No completed matches yet</p>
                    <p className="text-xs text-muted-foreground/50 mt-1">Upload a demo to see your match history here</p>
                  </div>
                )}
              </div>

              {/* Empty state */}
              {teamsData.length === 0 && recentMatches.length === 0 && (
                <div className="rv-panel p-10 text-center">
                  <Users size={28} className="text-muted-foreground/20 mx-auto mb-3" />
                  <p className="text-sm font-medium text-foreground mb-1">No activity yet</p>
                  <p className="text-xs text-muted-foreground">Join a team and upload demos to see your profile come alive.</p>
                </div>
              )}
            </div>
          </div>

        ) : (

          /* ── EDIT MODE ──────────────────────────────────────────────────────── */
          <div className="max-w-2xl space-y-4">

            {/* Link banner */}
            {linkBanner && (
              <div className={cn(
                'flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-sm',
                linkBanner.startsWith('Link failed') ? 'bg-red-400/10 border-red-400/30 text-red-400' : 'border-border text-foreground'
              )} style={!linkBanner.startsWith('Link failed') ? { background: 'color-mix(in srgb, var(--accent) 8%, transparent)', borderColor: 'color-mix(in srgb, var(--accent) 30%, transparent)', color: 'var(--accent)' } : {}}>
                <span className="flex items-center gap-2">
                  {linkBanner.startsWith('Link failed') ? <AlertCircle size={14} /> : <Check size={14} />}
                  {linkBanner}
                </span>
                <button onClick={() => setLinkBanner(null)}><X size={14} className="opacity-60 hover:opacity-100" /></button>
              </div>
            )}

            {/* Profile info */}
            <div className="rv-panel p-5 space-y-5">
              <span className="rv-tick rv-tick-tl" />
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <User size={14} style={{ color: 'var(--accent)' }} />
                Profile Information
              </h2>
              <AvatarDropzone currentUrl={avatarUrl} onUpload={handleAvatarUpload} uploading={uploadingAvatar} displayName={nameToDisplay} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="displayName" className="text-xs mb-1.5 block">Display Name</Label>
                  <Input id="displayName" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your display name" maxLength={50} />
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Username</Label>
                  <Input value={`@${profile.username}`} readOnly disabled className="opacity-50 cursor-not-allowed" />
                  <p className="text-[10px] text-muted-foreground mt-1">Cannot be changed</p>
                </div>
              </div>
              <div>
                <Label htmlFor="bio" className="text-xs mb-1.5 block">Bio</Label>
                <textarea
                  id="bio" value={bio} onChange={e => setBio(e.target.value)}
                  placeholder="Tell your team something about yourself..." maxLength={280} rows={3}
                  className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
                <p className="text-[10px] text-muted-foreground text-right mt-0.5">{bio.length}/280</p>
              </div>
            </div>

            {/* Roles & Maps */}
            <div className="rv-panel p-5 space-y-5">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Target size={14} style={{ color: 'var(--accent)' }} />
                Roles &amp; Maps
              </h2>
              <div>
                <Label className="text-xs mb-2 block">Preferred Roles</Label>
                <ChipSelect options={PLAYER_ROLES} selected={preferredRoles} onChange={setPreferredRoles} accent />
              </div>
              <div>
                <Label className="text-xs mb-2 block">Favorite Maps</Label>
                <ChipSelect options={CS2_MAPS} selected={favoriteMaps} onChange={setFavoriteMaps} />
              </div>
            </div>

            {/* Linked accounts */}
            <div className="rv-panel p-5 space-y-4">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Link2 size={14} style={{ color: 'var(--accent)' }} />
                Linked Accounts
              </h2>

              {/* Steam */}
              <div className="flex items-center gap-4 p-4 rounded-xl border transition-colors" style={{ background: 'rgba(27,40,56,0.4)', borderColor: steamId ? 'rgba(199,213,224,0.25)' : 'var(--border)' }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#1b2838', border: '1px solid rgba(199,213,224,0.2)' }}>
                  <Shield size={16} style={{ color: '#c7d5e0' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">Steam</p>
                    {steamId && <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: 'rgba(199,213,224,0.1)', color: '#c7d5e0', border: '1px solid rgba(199,213,224,0.2)' }}>Linked</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 font-mono truncate">{steamId || 'Not linked'}</p>
                </div>
                {steamId ? (
                  <Button variant="outline" size="sm" className="shrink-0 gap-1.5 text-xs text-red-400 hover:text-red-300 border-red-400/30" onClick={() => handleUnlink('steam')} disabled={unlinking === 'steam'}>
                    {unlinking === 'steam' ? <Loader2 size={11} className="animate-spin" /> : <Unlink size={11} />}Unlink
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" className="shrink-0 gap-1.5 text-xs" onClick={() => { window.location.href = '/api/auth/steam' }}>
                    <ExternalLink size={11} />Link Steam
                  </Button>
                )}
              </div>

              {/* FACEIT */}
              <div className="flex items-center gap-4 p-4 rounded-xl border transition-colors" style={{ background: 'rgba(249,115,22,0.05)', borderColor: faceitId ? 'rgba(249,115,22,0.3)' : 'var(--border)' }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.3)' }}>
                  <Crosshair size={16} style={{ color: '#fb923c' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">FACEIT</p>
                    {faceitId && <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: 'rgba(249,115,22,0.12)', color: '#fb923c', border: '1px solid rgba(249,115,22,0.25)' }}>Linked</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{faceitId || 'Not linked'}</p>
                </div>
                {faceitId ? (
                  <Button variant="outline" size="sm" className="shrink-0 gap-1.5 text-xs text-red-400 hover:text-red-300 border-red-400/30" onClick={() => handleUnlink('faceit')} disabled={unlinking === 'faceit'}>
                    {unlinking === 'faceit' ? <Loader2 size={11} className="animate-spin" /> : <Unlink size={11} />}Unlink
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" className="shrink-0 gap-1.5 text-xs" style={{ color: '#fb923c', borderColor: 'rgba(249,115,22,0.35)' }} onClick={handleLinkFaceit} disabled={faceitLinking}>
                    {faceitLinking ? <Loader2 size={11} className="animate-spin" /> : <ExternalLink size={11} />}
                    {faceitLinking ? 'Linking…' : 'Link FACEIT'}
                  </Button>
                )}
              </div>

              {/* Discord */}
              <div className="flex items-center gap-4 p-4 rounded-xl border border-border" style={{ background: 'rgba(99,102,241,0.05)' }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-sm font-bold" style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8' }}>
                  DC
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground mb-1.5">Discord</p>
                  <Input value={discordId} onChange={e => setDiscordId(e.target.value)} placeholder="Your Discord username" className="text-xs h-8" />
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
            <div className="flex items-center justify-end pb-6">
              <Button onClick={handleSave} disabled={saving || uploadingAvatar} className="gap-2 min-w-[130px]"
                style={saved ? {} : { background: 'var(--accent)', color: '#fff' }}>
                {saving
                  ? <><Loader2 size={14} className="animate-spin" />Saving…</>
                  : saved
                    ? <><Check size={14} />Saved!</>
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

// ─── layout helpers ───────────────────────────────────────────────────────────

function ProfileCard({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="rv-panel p-4">
      <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5" style={{ letterSpacing: '0.08em' }}>
        <span style={{ color: 'var(--accent)' }}>{icon}</span>
        {title}
      </h3>
      {children}
    </div>
  )
}

function ConnectionRow({ icon, iconColor, iconBg, label, value }: {
  icon: React.ReactNode; iconColor: string; iconBg: string; label: string; value: string
}) {
  const linked = !!value
  return (
    <div className="flex items-center gap-2.5 py-0.5">
      <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ background: iconBg, border: `1px solid color-mix(in srgb, ${iconColor} 25%, transparent)` }}>
        <span style={{ color: iconColor }}>{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground leading-tight">{label}</p>
        <p className="text-[10px] text-muted-foreground truncate font-mono">{linked ? value : 'Not linked'}</p>
      </div>
      {linked && (
        <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{ background: 'color-mix(in srgb, var(--win) 15%, transparent)' }}>
          <Check size={9} style={{ color: 'var(--win)' }} />
        </div>
      )}
    </div>
  )
}
