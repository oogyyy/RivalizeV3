'use client'

import { useState, useEffect, useCallback, useRef, type ElementType, type ChangeEvent, type KeyboardEvent } from 'react'
import {
  BookMarked, Plus, Trash2, Map, Filter, Loader2, ChevronDown, ChevronUp,
  Globe, Pencil, Youtube, Video, Image, Upload, X,
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import LineupBoard, { type DrawAction } from '@/components/lineups/LineupBoard'

const CS2_MAPS = [
  { value: 'de_dust2',    label: 'Dust2' },
  { value: 'de_mirage',   label: 'Mirage' },
  { value: 'de_inferno',  label: 'Inferno' },
  { value: 'de_nuke',     label: 'Nuke' },
  { value: 'de_ancient',  label: 'Ancient' },
  { value: 'de_anubis',   label: 'Anubis' },
  { value: 'de_overpass', label: 'Overpass' },
  { value: 'de_vertigo',  label: 'Vertigo' },
]

const LINEUP_TYPES = [
  { value: 'smoke',   label: 'Smoke',   color: '#c0c0d0' },
  { value: 'flash',   label: 'Flash',   color: '#ffff88' },
  { value: 'molotov', label: 'Molotov', color: '#ff4400' },
  { value: 'he',      label: 'HE',      color: '#ff9900' },
  { value: 'custom',  label: 'Custom',  color: '#818cf8' },
]

type MediaType = 'draw' | 'youtube' | 'video' | 'images'

interface Team { id: string; name: string }

interface Lineup {
  id: string
  team_id: string
  map: string
  name: string
  type: string
  notes: string | null
  canvas_data: DrawAction[]
  is_public: boolean
  created_at: string
  media_type: MediaType | null
  youtube_url: string | null
  media_urls: string[] | null
}

function getYoutubeEmbedId(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?v=([^&\s]+)/,
    /youtu\.be\/([^?\s]+)/,
    /youtube\.com\/shorts\/([^?\s]+)/,
    /youtube\.com\/embed\/([^?\s]+)/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return null
}

function YoutubeEmbed({ url }: { url: string }) {
  const videoId = getYoutubeEmbedId(url)
  if (!videoId) return (
    <p className="text-xs text-muted-foreground px-4 pb-4">Invalid YouTube URL</p>
  )
  return (
    <div className="px-4 pb-4">
      <div className="relative w-full rounded-lg overflow-hidden" style={{ paddingBottom: '56.25%' }}>
        <iframe
          src={`https://www.youtube.com/embed/${videoId}`}
          className="absolute inset-0 w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  )
}

const MEDIA_TABS: { value: MediaType; label: string; Icon: ElementType }[] = [
  { value: 'draw',    label: 'Draw',    Icon: Pencil  },
  { value: 'youtube', label: 'YouTube', Icon: Youtube },
  { value: 'video',   label: 'Video',   Icon: Video   },
  { value: 'images',  label: 'Images',  Icon: Image   },
]

export default function LineupsPage() {
  const [lineups, setLineups]     = useState<Lineup[]>([])
  const [teams, setTeams]         = useState<Team[]>([])
  const [loading, setLoading]     = useState(true)
  const [mapFilter, setMapFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [openId, setOpenId]       = useState<string | null>(null)
  const [creating, setCreating]   = useState(false)
  const [newMap, setNewMap]       = useState(CS2_MAPS[0].value)
  const [newName, setNewName]     = useState('')
  const [newType, setNewType]     = useState('smoke')
  const [newNotes, setNewNotes]   = useState('')
  const [selectedTeam, setSelectedTeam] = useState('')
  const [showForm, setShowForm]   = useState(false)
  const [deleting, setDeleting]   = useState<string | null>(null)
  const [publishing, setPublishing] = useState<string | null>(null)

  // Media form state
  const [newMediaType, setNewMediaType] = useState<MediaType>('draw')
  const [newYoutubeUrl, setNewYoutubeUrl] = useState('')
  const [mediaFiles, setMediaFiles] = useState<File[]>([])
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (mapFilter) params.set('map', mapFilter)
      if (typeFilter) params.set('type', typeFilter)
      const [lineupRes, teamRes] = await Promise.all([
        fetch(`/api/lineups?${params}`),
        fetch('/api/teams'),
      ])
      if (lineupRes.ok) setLineups(await lineupRes.json())
      if (teamRes.ok)   setTeams(await teamRes.json())
    } finally {
      setLoading(false)
    }
  }, [mapFilter, typeFilter])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (teams.length > 0 && !selectedTeam) setSelectedTeam(teams[0].id) }, [teams, selectedTeam])

  function resetForm() {
    setNewName(''); setNewNotes(''); setNewYoutubeUrl('')
    setMediaFiles([]); setNewMediaType('draw'); setShowForm(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleCreate() {
    if (!newName.trim() || !selectedTeam) return
    setCreating(true)
    try {
      const res = await fetch('/api/lineups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: selectedTeam, map: newMap, name: newName, type: newType, notes: newNotes,
          mediaType: newMediaType,
          youtubeUrl: newMediaType === 'youtube' ? newYoutubeUrl.trim() : undefined,
        }),
      })
      if (!res.ok) return
      const lineup: Lineup = await res.json()

      // Upload video/image files via presigned URLs, then patch lineup
      if ((newMediaType === 'video' || newMediaType === 'images') && mediaFiles.length > 0) {
        setUploadingMedia(true)
        try {
          const presignRes = await fetch('/api/lineups/upload-media', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lineupId: lineup.id,
              files: mediaFiles.map((f: File) => ({ filename: f.name, contentType: f.type, size: f.size })),
            }),
          })
          if (presignRes.ok) {
            const { uploads } = await presignRes.json() as {
              uploads: Array<{ presignedUrl: string; key: string; publicUrl: string }>
            }
            await Promise.all(
              mediaFiles.map((file: File, i: number) =>
                fetch(uploads[i].presignedUrl, {
                  method: 'PUT',
                  body: file,
                  headers: { 'Content-Type': file.type },
                })
              )
            )
            const mediaUrls = uploads.map((u: { presignedUrl: string; key: string; publicUrl: string }) => u.publicUrl)
            await fetch(`/api/lineups/${lineup.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ media_urls: mediaUrls }),
            })
            lineup.media_urls = mediaUrls
          }
        } finally {
          setUploadingMedia(false)
        }
      }

      setLineups((prev: Lineup[]) => [lineup, ...prev])
      resetForm()
      // Only open the draw board for draw-type lineups
      if (newMediaType === 'draw') setOpenId(lineup.id)

    } finally {
      setCreating(false)
    }
  }

  async function handleSave(id: string, actions: DrawAction[]) {
    await fetch(`/api/lineups/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ canvas_data: actions }),
    })
  }

  async function handlePublish(id: string, makePublic: boolean) {
    setPublishing(id)
    try {
      const res = await fetch(`/api/lineups/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_public: makePublic }),
      })
      if (res.ok) {
        setLineups((prev: Lineup[]) => prev.map((l: Lineup) => l.id === id ? { ...l, is_public: makePublic } : l))
      }
    } finally {
      setPublishing(null)
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    try {
      await fetch(`/api/lineups/${id}`, { method: 'DELETE' })
      setLineups((prev: Lineup[]) => prev.filter((l: Lineup) => l.id !== id))
      if (openId === id) setOpenId(null)
    } finally {
      setDeleting(null)
    }
  }

  const displayed = mapFilter
    ? lineups.filter((l: Lineup) => l.map === mapFilter)
    : lineups

  const isBusy = creating || uploadingMedia

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-4 md:py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                <BookMarked size={18} className="text-purple-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Utility Hub</h1>
                <p className="text-sm text-muted-foreground">Smoke, flash and molotov lineups per map</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/lineups/community"
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg border border-border hover:border-border/80"
              >
                <Globe size={13} />
                Community
              </Link>
              <Button variant="neon" size="sm" className="gap-1.5" onClick={() => setShowForm((v: boolean) => !v)}>
                <Plus size={14} />
                New Lineup
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <Filter size={13} className="text-muted-foreground" />
            <div className="flex rounded-lg border border-border overflow-hidden text-xs">
              <button
                onClick={() => setMapFilter('')}
                className={cn('px-3 py-1.5 font-medium transition-colors', !mapFilter ? 'bg-neon-green/20 text-neon-green' : 'text-muted-foreground hover:text-foreground')}
              >
                All Maps
              </button>
              {CS2_MAPS.map(m => (
                <button
                  key={m.value}
                  onClick={() => setMapFilter((v: string) => v === m.value ? '' : m.value)}
                  className={cn('px-3 py-1.5 font-medium transition-colors whitespace-nowrap', mapFilter === m.value ? 'bg-neon-green/20 text-neon-green' : 'text-muted-foreground hover:text-foreground')}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <div className="flex rounded-lg border border-border overflow-hidden text-xs ml-auto">
              <button onClick={() => setTypeFilter('')} className={cn('px-2.5 py-1.5', !typeFilter ? 'bg-purple-500/20 text-purple-400' : 'text-muted-foreground hover:text-foreground')}>
                All
              </button>
              {LINEUP_TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => setTypeFilter((v: string) => v === t.value ? '' : t.value)}
                  className={cn('px-2.5 py-1.5 capitalize', typeFilter === t.value ? 'bg-purple-500/20 text-purple-400' : 'text-muted-foreground hover:text-foreground')}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-4">
        {/* New lineup form */}
        {showForm && (
          <div className="rounded-xl border border-neon-green/20 bg-neon-green/5 p-4 space-y-4">
            <p className="text-sm font-semibold text-foreground">New Lineup</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Name</label>
                <input
                  value={newName}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setNewName(e.target.value)}
                  placeholder="e.g. Mid smoke from T spawn"
                  className="w-full px-3 py-1.5 text-sm bg-card border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-neon-green/50"
                  onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') handleCreate() }}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Map</label>
                <select
                  value={newMap}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => setNewMap(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm bg-card border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-neon-green/50"
                >
                  {CS2_MAPS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Type</label>
                <select
                  value={newType}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => setNewType(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm bg-card border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-neon-green/50"
                >
                  {LINEUP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Team</label>
                <select
                  value={selectedTeam}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedTeam(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm bg-card border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-neon-green/50"
                >
                  {teams.map((t: Team) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2 space-y-1">
                <label className="text-xs text-muted-foreground">Notes (optional)</label>
                <input
                  value={newNotes}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setNewNotes(e.target.value)}
                  placeholder="Aim at the corner of the wall…"
                  className="w-full px-3 py-1.5 text-sm bg-card border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-neon-green/50"
                />
              </div>

              {/* Media type picker */}
              <div className="sm:col-span-2 space-y-2">
                <label className="text-xs text-muted-foreground">Media</label>
                <div className="flex flex-wrap gap-2">
                  {MEDIA_TABS.map(({ value, label, Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => { setNewMediaType(value); setMediaFiles([]); if (fileInputRef.current) fileInputRef.current.value = '' }}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors',
                        newMediaType === value
                          ? 'border-neon-green/40 bg-neon-green/10 text-neon-green'
                          : 'border-border text-muted-foreground hover:text-foreground',
                      )}
                    >
                      <Icon size={12} />
                      {label}
                    </button>
                  ))}
                </div>

                {/* YouTube URL input */}
                {newMediaType === 'youtube' && (
                  <input
                    value={newYoutubeUrl}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setNewYoutubeUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=... or youtu.be/..."
                    className="w-full px-3 py-1.5 text-sm bg-card border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-neon-green/50"
                  />
                )}

                {/* File upload dropzone */}
                {(newMediaType === 'video' || newMediaType === 'images') && (
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={newMediaType === 'video'
                        ? 'video/mp4,video/webm,video/quicktime,video/x-m4v'
                        : 'image/jpeg,image/png,image/webp,image/gif'}
                      multiple={newMediaType === 'images'}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setMediaFiles(Array.from(e.target.files ?? []))}
                      className="hidden"
                      id="lineup-media-upload"
                    />
                    {mediaFiles.length > 0 ? (
                      <div className="rounded-lg border border-neon-green/20 bg-neon-green/5 px-3 py-2 flex items-center gap-2">
                        <Upload size={12} className="text-neon-green shrink-0" />
                        <div className="flex-1 min-w-0">
                          {mediaFiles.map((f: File) => (
                            <p key={f.name} className="text-xs text-foreground truncate">{f.name}</p>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => { setMediaFiles([]); if (fileInputRef.current) fileInputRef.current.value = '' }}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <label
                        htmlFor="lineup-media-upload"
                        className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-card/50 px-4 py-6 cursor-pointer hover:border-neon-green/30 transition-colors"
                      >
                        <Upload size={20} className="text-muted-foreground/40" />
                        <p className="text-xs text-muted-foreground text-center">
                          {newMediaType === 'video'
                            ? 'Click to select a video (MP4/WebM, max 200 MB)'
                            : 'Click to select images (JPG/PNG/WebP, max 10 MB each)'}
                        </p>
                      </label>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <Button size="sm" variant="neon" onClick={handleCreate} disabled={isBusy || !newName.trim()}>
                {isBusy ? <Loader2 size={12} className="animate-spin mr-1" /> : null}
                {newMediaType === 'draw' ? 'Create & Draw' : 'Create'}
              </Button>
              <Button size="sm" variant="ghost" onClick={resetForm}>Cancel</Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="text-neon-green animate-spin" />
          </div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            No lineups yet.{' '}
            <button className="text-neon-green hover:underline" onClick={() => setShowForm(true)}>
              Create your first one
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {displayed.map((lineup: Lineup) => {
              const typeInfo = LINEUP_TYPES.find(t => t.value === lineup.type) ?? LINEUP_TYPES[4]
              const mapLabel = CS2_MAPS.find(m => m.value === lineup.map)?.label ?? lineup.map
              const isOpen = openId === lineup.id
              const effectiveMediaType = lineup.media_type ?? 'draw'

              return (
                <div key={lineup.id} className="rv-panel overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: typeInfo.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{lineup.name}</p>
                      <p className="text-xs text-muted-foreground">{mapLabel} · {typeInfo.label}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handlePublish(lineup.id, !lineup.is_public)}
                        disabled={publishing === lineup.id}
                        title={lineup.is_public ? 'Unpublish from Community' : 'Publish to Community'}
                        className={cn(
                          'p-1.5 rounded border transition-colors',
                          lineup.is_public
                            ? 'border-neon-green/40 text-neon-green bg-neon-green/5 hover:bg-neon-green/10'
                            : 'border-border/50 text-muted-foreground hover:text-neon-green',
                        )}
                      >
                        {publishing === lineup.id ? <Loader2 size={13} className="animate-spin" /> : <Globe size={13} />}
                      </button>
                      <button
                        onClick={() => setOpenId((v: string | null) => v === lineup.id ? null : lineup.id)}
                        className="p-1.5 rounded border border-border/50 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                      <button
                        onClick={() => handleDelete(lineup.id)}
                        disabled={deleting === lineup.id}
                        className="p-1.5 rounded border border-border/50 text-muted-foreground hover:text-red-400 transition-colors"
                      >
                        {deleting === lineup.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="border-t border-border">
                      {lineup.notes && (
                        <p className="text-xs text-muted-foreground italic px-4 pt-3">{lineup.notes}</p>
                      )}

                      {/* YouTube embed */}
                      {effectiveMediaType === 'youtube' && lineup.youtube_url && (
                        <div className="pt-3">
                          <YoutubeEmbed url={lineup.youtube_url} />
                        </div>
                      )}

                      {/* Video player */}
                      {effectiveMediaType === 'video' && lineup.media_urls?.[0] && (
                        <div className="px-4 py-3">
                          <video
                            src={lineup.media_urls[0]}
                            controls
                            className="w-full rounded-lg max-h-80"
                            preload="metadata"
                          />
                        </div>
                      )}

                      {/* Image gallery */}
                      {effectiveMediaType === 'images' && lineup.media_urls && lineup.media_urls.length > 0 && (
                        <div className="px-4 py-3">
                          <div className={cn('grid gap-2', lineup.media_urls.length === 1 ? 'grid-cols-1' : 'grid-cols-2')}>
                            {lineup.media_urls.map((url, i) => (
                              <img
                                key={i}
                                src={url}
                                alt={`${lineup.name} ${i + 1}`}
                                className="rounded-lg w-full object-cover"
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Draw board */}
                      {effectiveMediaType === 'draw' && (
                        <div className="p-4">
                          <LineupBoard
                            mapName={lineup.map}
                            initialActions={lineup.canvas_data ?? []}
                            onSave={async (actions) => {
                              await handleSave(lineup.id, actions)
                              setLineups((prev: Lineup[]) => prev.map((l: Lineup) => l.id === lineup.id ? { ...l, canvas_data: actions } : l))
                            }}
                          />
                        </div>
                      )}

                      {/* Empty video/image state */}
                      {(effectiveMediaType === 'video' && !lineup.media_urls?.[0]) ||
                       (effectiveMediaType === 'images' && !lineup.media_urls?.length) ? (
                        <p className="text-xs text-muted-foreground px-4 py-3">No media uploaded yet.</p>
                      ) : null}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
