'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn, formatDate } from '@/lib/utils'
import {
  User, Camera, Save, Link2, Trophy, Brain, Upload,
  Check, Loader2, Shield, AlertCircle, ExternalLink,
  Crosshair, Users, FileVideo
} from 'lucide-react'
import type { Profile } from '@/types/database'

const CS2_MAPS = ['de_dust2', 'de_mirage', 'de_inferno', 'de_nuke', 'de_overpass', 'de_vertigo', 'de_ancient', 'de_anubis']
const PLAYER_ROLES = ['IGL', 'AWPer', 'Entry Fragger', 'Support', 'Lurker', 'Rifler', 'Anchor']

function AvatarDropzone({
  currentUrl,
  onUpload,
  uploading,
  displayName,
}: {
  currentUrl: string | null
  onUpload: (file: File) => void
  uploading: boolean
  displayName: string
}) {
  const [preview, setPreview] = useState<string | null>(null)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setPreview(url)
    onUpload(file)
  }, [onUpload])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'] },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024,
  })

  const initials = displayName
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const src = preview || currentUrl

  return (
    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
      {/* Avatar display */}
      <div className="relative shrink-0">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={displayName}
            className="w-20 h-20 rounded-full object-cover ring-2 ring-border"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-neon-green/20 border-2 border-neon-green/30 flex items-center justify-center">
            <span className="text-2xl font-bold text-neon-green">{initials || '?'}</span>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center">
            <Loader2 size={20} className="animate-spin text-neon-green" />
          </div>
        )}
      </div>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          'flex-1 border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors',
          isDragActive ? 'border-neon-green bg-neon-green/5' : 'border-border hover:border-neon-green/40 hover:bg-accent/30'
        )}
      >
        <input {...getInputProps()} />
        <Upload size={18} className={cn('mx-auto mb-1', isDragActive ? 'text-neon-green' : 'text-muted-foreground')} />
        <p className="text-xs text-muted-foreground">
          {isDragActive ? 'Drop image here' : 'Drag & drop or click to upload'}
        </p>
        <p className="text-xs text-muted-foreground/60 mt-0.5">PNG, JPG up to 5MB</p>
      </div>
    </div>
  )
}

function ChipSelect({
  options,
  selected,
  onChange,
  color = 'neon',
}: {
  options: string[]
  selected: string[]
  onChange: (val: string[]) => void
  color?: 'neon' | 'blue'
}) {
  const toggle = (opt: string) => {
    onChange(selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt])
  }
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => {
        const active = selected.includes(opt)
        return (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={cn(
              'px-3 py-2 rounded-full text-xs font-medium border transition-all duration-150 min-h-[36px]',
              active
                ? color === 'neon'
                  ? 'bg-neon-green/20 text-neon-green border-neon-green/40'
                  : 'bg-neon-blue/20 text-neon-blue border-neon-blue/40'
                : 'bg-muted/30 text-muted-foreground border-border hover:border-neon-green/30 hover:text-foreground'
            )}
          >
            {active && <Check size={10} className="inline mr-1" />}
            {opt}
          </button>
        )
      })}
    </div>
  )
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState({ demos: 0, teams: 0 })

  // Form state
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [favoriteMaps, setFavoriteMaps] = useState<string[]>([])
  const [preferredRoles, setPreferredRoles] = useState<string[]>([])
  const [steamId, setSteamId] = useState('')
  const [discordId, setDiscordId] = useState('')
  const [faceitId, setFaceitId] = useState('')

  useEffect(() => {
    const fetchProfile = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

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
      }

      // Fetch stats
      const { data: memberships } = await supabase.from('team_members').select('team_id').eq('user_id', user.id)
      const teamIds = (memberships || []).map(m => m.team_id)
      let demoCount = 0
      if (teamIds.length) {
        const { count } = await supabase.from('demos').select('*', { count: 'exact', head: true }).in('team_id', teamIds)
        demoCount = count || 0
      }
      setStats({ demos: demoCount, teams: teamIds.length })
      setLoading(false)
    }
    fetchProfile()
  }, [])

  const handleAvatarUpload = async (file: File) => {
    setUploadingAvatar(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

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
    const { error: err } = await supabase
      .from('profiles')
      .update({
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        avatar_url: avatarUrl,
        favorite_maps: favoriteMaps,
        preferred_roles: preferredRoles,
        steam_id: steamId.trim() || null,
        discord_id: discordId.trim() || null,
        faceit_id: faceitId.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id)

    if (err) {
      setError(err.message)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="animate-spin text-neon-green" size={32} />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
        <AlertCircle size={32} className="text-red-400" />
        <p className="text-foreground">Profile not found</p>
      </div>
    )
  }

  const memberSince = formatDate(profile.created_at)
  const nameToDisplay = displayName || profile.username

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5 md:space-y-6">
      {/* Profile Header */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-card p-4 md:p-6">
        <div className="absolute inset-0 bg-gradient-to-r from-neon-green/5 via-transparent to-transparent pointer-events-none" />
        <div className="relative flex items-start gap-4 md:gap-5">
          {/* Avatar */}
          <div className="relative shrink-0">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={nameToDisplay}
                className="w-20 h-20 rounded-full object-cover ring-2 ring-neon-green/30"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-neon-green/20 border-2 border-neon-green/30 flex items-center justify-center">
                <span className="text-2xl font-bold text-neon-green">
                  {nameToDisplay.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-neon-green border-2 border-card" />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-foreground truncate">{nameToDisplay}</h1>
            <p className="text-muted-foreground text-sm">@{profile.username}</p>
            {bio && <p className="text-sm text-muted-foreground mt-2 max-w-lg">{bio}</p>}

            <div className="flex flex-wrap items-center gap-3 mt-3">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <User size={11} />
                Member since {memberSince}
              </span>
              {preferredRoles.length > 0 && preferredRoles.map(role => (
                <Badge key={role} variant="outline" className="text-xs">{role}</Badge>
              ))}
            </div>

            {favoriteMaps.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {favoriteMaps.map(map => (
                  <Badge key={map} variant="neon" className="text-xs font-mono">{map}</Badge>
                ))}
              </div>
            )}

            {/* Mobile-only quick stats */}
            <div className="md:hidden flex items-center gap-4 mt-3 pt-3 border-t border-border">
              <div>
                <p className="text-lg font-bold text-neon-green">{stats.demos}</p>
                <p className="text-xs text-muted-foreground">Demos</p>
              </div>
              <div className="w-px h-6 bg-border" />
              <div>
                <p className="text-lg font-bold text-foreground">{stats.teams}</p>
                <p className="text-xs text-muted-foreground">Teams</p>
              </div>
            </div>
          </div>

          {/* Quick stats — desktop inline, mobile shown below avatar row */}
          <div className="hidden md:flex gap-4 text-center shrink-0">
            <div>
              <p className="text-2xl font-bold text-neon-green">{stats.demos}</p>
              <p className="text-xs text-muted-foreground">Demos</p>
            </div>
            <div className="w-px h-10 bg-border self-center" />
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.teams}</p>
              <p className="text-xs text-muted-foreground">Teams</p>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Profile */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <User size={16} className="text-neon-green" />
            Edit Profile
          </CardTitle>
          <CardDescription>Update your public profile information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar upload */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Avatar</Label>
            <AvatarDropzone
              currentUrl={avatarUrl}
              onUpload={handleAvatarUpload}
              uploading={uploadingAvatar}
              displayName={nameToDisplay}
            />
          </div>

          {/* Name fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="displayName" className="text-sm mb-1.5 block">Display Name</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Your display name"
                maxLength={50}
              />
            </div>
            <div>
              <Label className="text-sm mb-1.5 block">Username</Label>
              <Input
                value={`@${profile.username}`}
                readOnly
                disabled
                className="opacity-60 cursor-not-allowed"
              />
              <p className="text-xs text-muted-foreground mt-1">Username cannot be changed</p>
            </div>
          </div>

          {/* Bio */}
          <div>
            <Label htmlFor="bio" className="text-sm mb-1.5 block">Bio</Label>
            <textarea
              id="bio"
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="Tell your team something about yourself..."
              maxLength={280}
              rows={3}
              className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
            <p className="text-xs text-muted-foreground text-right mt-1">{bio.length}/280</p>
          </div>

          {/* Favorite Maps */}
          <div>
            <Label className="text-sm mb-2 block">Favorite Maps</Label>
            <ChipSelect options={CS2_MAPS} selected={favoriteMaps} onChange={setFavoriteMaps} />
          </div>

          {/* Preferred Roles */}
          <div>
            <Label className="text-sm mb-2 block">Preferred Roles</Label>
            <ChipSelect options={PLAYER_ROLES} selected={preferredRoles} onChange={setPreferredRoles} color="blue" />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-md px-3 py-2">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          {/* Save button */}
          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={saving || uploadingAvatar}
              variant={saved ? 'outline' : 'neon'}
              className="gap-2 min-w-[120px]"
            >
              {saving ? (
                <><Loader2 size={14} className="animate-spin" />Saving...</>
              ) : saved ? (
                <><Check size={14} className="text-neon-green" />Saved!</>
              ) : (
                <><Save size={14} />Save Changes</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Linked Accounts */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 size={16} className="text-neon-green" />
            Linked Accounts
          </CardTitle>
          <CardDescription>Connect your gaming accounts for enhanced features</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Steam */}
          <div className="flex items-center gap-4 p-4 rounded-lg border border-border bg-muted/10">
            <div className="w-10 h-10 rounded-lg bg-[#1b2838] border border-border flex items-center justify-center shrink-0">
              <Shield size={18} className="text-[#c7d5e0]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Steam</p>
              <Input
                value={steamId}
                onChange={e => setSteamId(e.target.value)}
                placeholder="Your Steam ID (e.g. 76561198...)"
                className="mt-1.5 text-xs h-8"
              />
            </div>
            <Button variant="outline" size="sm" className="shrink-0 gap-1.5 text-xs">
              <ExternalLink size={11} />
              Connect
            </Button>
          </div>

          {/* Discord */}
          <div className="flex items-center gap-4 p-4 rounded-lg border border-border bg-muted/10">
            <div className="w-10 h-10 rounded-lg bg-[#5865F2]/20 border border-[#5865F2]/30 flex items-center justify-center shrink-0">
              <span className="text-[#5865F2] font-bold text-sm">DC</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Discord</p>
              <Input
                value={discordId}
                onChange={e => setDiscordId(e.target.value)}
                placeholder="Your Discord ID or username"
                className="mt-1.5 text-xs h-8"
              />
            </div>
            <Button variant="outline" size="sm" className="shrink-0 gap-1.5 text-xs">
              <ExternalLink size={11} />
              Connect
            </Button>
          </div>

          {/* FACEIT */}
          <div className="flex items-center gap-4 p-4 rounded-lg border border-border bg-muted/10">
            <div className="w-10 h-10 rounded-lg bg-orange-500/20 border border-orange-500/30 flex items-center justify-center shrink-0">
              <Crosshair size={16} className="text-orange-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">FACEIT</p>
              <Input
                value={faceitId}
                onChange={e => setFaceitId(e.target.value)}
                placeholder="Your FACEIT username"
                className="mt-1.5 text-xs h-8"
              />
            </div>
            <Button variant="outline" size="sm" className="shrink-0 gap-1.5 text-xs" onClick={handleSave}>
              <Save size={11} />
              Save
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy size={16} className="text-neon-green" />
            Activity Stats
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 rounded-lg bg-muted/20 border border-border">
              <div className="w-10 h-10 rounded-full bg-neon-green/10 flex items-center justify-center mx-auto mb-2">
                <FileVideo size={18} className="text-neon-green" />
              </div>
              <p className="text-3xl font-bold text-neon-green">{stats.demos}</p>
              <p className="text-xs text-muted-foreground mt-1">Total Demos</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/20 border border-border">
              <div className="w-10 h-10 rounded-full bg-neon-green/10 flex items-center justify-center mx-auto mb-2">
                <Users size={18} className="text-neon-green" />
              </div>
              <p className="text-3xl font-bold text-foreground">{stats.teams}</p>
              <p className="text-xs text-muted-foreground mt-1">Teams Joined</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/20 border border-border">
              <div className="w-10 h-10 rounded-full bg-neon-green/10 flex items-center justify-center mx-auto mb-2">
                <Brain size={18} className="text-neon-green" />
              </div>
              <p className="text-3xl font-bold text-foreground">—</p>
              <p className="text-xs text-muted-foreground mt-1">AI Sessions</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
