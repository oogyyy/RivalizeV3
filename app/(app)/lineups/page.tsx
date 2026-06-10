'use client'

import { useState, useEffect, useCallback, useRef, type ElementType, type ChangeEvent, type KeyboardEvent } from 'react'
import {
  BookMarked, Plus, Trash2, Filter, Loader2, ChevronDown, ChevronUp,
  Globe, Youtube, Video, Image, Upload, X,
} from 'lucide-react'
import Link from 'next/link'
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
  if (!videoId) return <p style={{ fontSize: 11, color: 'var(--muted)', padding: '0 16px 16px' }}>Invalid YouTube URL</p>
  return (
    <div style={{ padding: '0 16px 16px' }}>
      <div style={{ position: 'relative', width: '100%', paddingBottom: '56.25%', borderRadius: 8, overflow: 'hidden' }}>
        <iframe
          src={`https://www.youtube.com/embed/${videoId}`}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  )
}

const MEDIA_TABS: { value: MediaType; label: string; Icon: ElementType }[] = [
  { value: 'youtube', label: 'YouTube', Icon: Youtube },
  { value: 'video',   label: 'Video',   Icon: Video   },
  { value: 'images',  label: 'Images',  Icon: Image   },
]

const MAP_LABELS: Record<string, string> = {
  de_dust2: 'Dust2', de_mirage: 'Mirage', de_inferno: 'Inferno',
  de_nuke: 'Nuke', de_ancient: 'Ancient', de_anubis: 'Anubis',
  de_overpass: 'Overpass', de_vertigo: 'Vertigo',
}

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

  const [newMediaType, setNewMediaType] = useState<MediaType>('youtube')
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
                fetch(uploads[i].presignedUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
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

  const displayed = mapFilter ? lineups.filter((l: Lineup) => l.map === mapFilter) : lineups
  const isBusy = creating || uploadingMedia

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 8,
    border: '1px solid var(--border)', background: 'var(--card)',
    color: 'var(--text)', outline: 'none',
  }
  const selectStyle: React.CSSProperties = { ...inputStyle }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(129,140,248,0.12)', border: '1px solid rgba(129,140,248,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <BookMarked size={18} style={{ color: '#818cf8' }} />
          </div>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', lineHeight: 1.1, marginBottom: 3 }}>Utility Hub</h1>
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>Smoke, flash and molotov lineups per map</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link href="/lineups/community" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontSize: 12, fontWeight: 500, textDecoration: 'none', cursor: 'pointer', transition: 'color 0.14s' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
          >
            <Globe size={13} /> Community
          </Link>
          <button
            onClick={() => setShowForm(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, background: 'var(--accent)', color: 'white', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer' }}
          >
            <Plus size={14} /> New Lineup
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Filter size={13} style={{ color: 'var(--faint)', flexShrink: 0 }} />
        {/* Map filter */}
        <div style={{ display: 'flex', borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden', flexShrink: 0 }}>
          <button
            onClick={() => setMapFilter('')}
            style={{ padding: '6px 10px', fontSize: 11, fontWeight: 600, background: !mapFilter ? 'var(--accent-soft)' : 'transparent', color: !mapFilter ? 'var(--text)' : 'var(--muted)', border: 'none', cursor: 'pointer', transition: 'background 0.12s, color 0.12s' }}
          >
            All
          </button>
          {CS2_MAPS.map(m => (
            <button
              key={m.value}
              onClick={() => setMapFilter(v => v === m.value ? '' : m.value)}
              style={{ padding: '6px 10px', fontSize: 11, fontWeight: 600, background: mapFilter === m.value ? 'var(--accent-soft)' : 'transparent', color: mapFilter === m.value ? 'var(--text)' : 'var(--muted)', border: 'none', borderLeft: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.12s, color 0.12s', whiteSpace: 'nowrap' }}
            >
              {m.label}
            </button>
          ))}
        </div>
        {/* Type filter */}
        <div style={{ display: 'flex', borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden', marginLeft: 'auto' }}>
          <button
            onClick={() => setTypeFilter('')}
            style={{ padding: '6px 10px', fontSize: 11, fontWeight: 600, background: !typeFilter ? 'rgba(129,140,248,0.15)' : 'transparent', color: !typeFilter ? '#818cf8' : 'var(--muted)', border: 'none', cursor: 'pointer', transition: 'background 0.12s, color 0.12s' }}
          >
            All
          </button>
          {LINEUP_TYPES.map(t => (
            <button
              key={t.value}
              onClick={() => setTypeFilter(v => v === t.value ? '' : t.value)}
              style={{ padding: '6px 10px', fontSize: 11, fontWeight: 600, background: typeFilter === t.value ? `color-mix(in srgb, ${t.color} 18%, transparent)` : 'transparent', color: typeFilter === t.value ? t.color : 'var(--muted)', border: 'none', borderLeft: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.12s, color 0.12s' }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* New lineup form */}
      {showForm && (
        <div style={{ borderRadius: 12, border: '1px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.04)', padding: 20 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>New Lineup</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Name</label>
              <input
                value={newName}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setNewName(e.target.value)}
                placeholder="e.g. Mid smoke from T spawn"
                style={inputStyle}
                onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') handleCreate() }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Map</label>
              <select value={newMap} onChange={(e: ChangeEvent<HTMLSelectElement>) => setNewMap(e.target.value)} style={selectStyle}>
                {CS2_MAPS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Type</label>
              <select value={newType} onChange={(e: ChangeEvent<HTMLSelectElement>) => setNewType(e.target.value)} style={selectStyle}>
                {LINEUP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Team</label>
              <select value={selectedTeam} onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedTeam(e.target.value)} style={selectStyle}>
                {teams.map((t: Team) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Notes (optional)</label>
              <input
                value={newNotes}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setNewNotes(e.target.value)}
                placeholder="Aim at the corner of the wall…"
                style={inputStyle}
              />
            </div>
            {/* Media type picker */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>Media</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {MEDIA_TABS.map(({ value, label, Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => { setNewMediaType(value); setMediaFiles([]); if (fileInputRef.current) fileInputRef.current.value = '' }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12, fontWeight: 500,
                      borderRadius: 8, border: `1px solid ${newMediaType === value ? 'rgba(99,102,241,0.4)' : 'var(--border)'}`,
                      background: newMediaType === value ? 'rgba(99,102,241,0.1)' : 'transparent',
                      color: newMediaType === value ? '#818cf8' : 'var(--muted)', cursor: 'pointer',
                    }}
                  >
                    <Icon size={12} /> {label}
                  </button>
                ))}
              </div>
              {newMediaType === 'youtube' && (
                <input
                  value={newYoutubeUrl}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setNewYoutubeUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  style={{ ...inputStyle, marginTop: 8 }}
                />
              )}
              {(newMediaType === 'video' || newMediaType === 'images') && (
                <div style={{ marginTop: 8 }}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={newMediaType === 'video' ? 'video/mp4,video/webm,video/quicktime,video/x-m4v' : 'image/jpeg,image/png,image/webp,image/gif'}
                    multiple={newMediaType === 'images'}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setMediaFiles(Array.from(e.target.files ?? []))}
                    style={{ display: 'none' }}
                    id="lineup-media-upload"
                  />
                  {mediaFiles.length > 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.05)' }}>
                      <Upload size={12} style={{ color: '#818cf8', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {mediaFiles.map((f: File) => (
                          <p key={f.name} style={{ fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{f.name}</p>
                        ))}
                      </div>
                      <button type="button" onClick={() => { setMediaFiles([]); if (fileInputRef.current) fileInputRef.current.value = '' }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 0 }}>
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <label htmlFor="lineup-media-upload" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 8, border: '2px dashed var(--border)', background: 'rgba(255,255,255,0.02)', padding: '24px 16px', cursor: 'pointer' }}>
                      <Upload size={20} style={{ color: 'var(--faint)' }} />
                      <p style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', margin: 0 }}>
                        {newMediaType === 'video' ? 'Click to select a video (MP4/WebM, max 200 MB)' : 'Click to select images (JPG/PNG/WebP, max 10 MB each)'}
                      </p>
                    </label>
                  )}
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button
              onClick={handleCreate}
              disabled={isBusy || !newName.trim()}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 8, background: 'var(--accent)', color: 'white', fontSize: 13, fontWeight: 600, border: 'none', cursor: isBusy || !newName.trim() ? 'not-allowed' : 'pointer', opacity: isBusy || !newName.trim() ? 0.5 : 1 }}
            >
              {isBusy ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : null}
              Create
            </button>
            <button onClick={resetForm} style={{ padding: '7px 16px', borderRadius: 8, background: 'transparent', color: 'var(--muted)', fontSize: 13, fontWeight: 500, border: '1px solid var(--border)', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px 0', gap: 10 }}>
          <Loader2 size={22} style={{ color: 'var(--accent)', animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>Loading lineups…</span>
        </div>
      ) : displayed.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 16px', textAlign: 'center', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)' }}>
          <BookMarked size={32} style={{ color: 'var(--faint)', marginBottom: 12 }} />
          <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>No lineups yet</p>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>
            {mapFilter ? `No ${LINEUP_TYPES.find(t => t.value === typeFilter)?.label ?? ''} lineups for ${MAP_LABELS[mapFilter] ?? mapFilter} yet.` : 'Create your first lineup to get started.'}
          </p>
          <button onClick={() => setShowForm(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, background: 'var(--accent)', color: 'white', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
            <Plus size={13} /> Create lineup
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {displayed.map((lineup: Lineup) => {
            const typeInfo = LINEUP_TYPES.find(t => t.value === lineup.type) ?? LINEUP_TYPES[4]
            const mapLabelStr = MAP_LABELS[lineup.map] ?? lineup.map
            const isOpen = openId === lineup.id
            const effectiveMediaType = lineup.media_type ?? 'draw'

            return (
              <div key={lineup.id} style={{ borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)', overflow: 'hidden' }}>
                {/* Row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: typeInfo.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{lineup.name}</p>
                    <p style={{ fontSize: 11, color: 'var(--muted)', margin: '1px 0 0' }}>{mapLabelStr} · {typeInfo.label}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button
                      onClick={() => handlePublish(lineup.id, !lineup.is_public)}
                      disabled={publishing === lineup.id}
                      title={lineup.is_public ? 'Unpublish from Community' : 'Publish to Community'}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28,
                        borderRadius: 6, cursor: 'pointer', transition: 'all 0.14s',
                        border: lineup.is_public ? '1px solid rgba(99,102,241,0.4)' : '1px solid var(--border)',
                        background: lineup.is_public ? 'rgba(99,102,241,0.1)' : 'transparent',
                        color: lineup.is_public ? '#818cf8' : 'var(--muted)',
                      }}
                    >
                      {publishing === lineup.id ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Globe size={12} />}
                    </button>
                    <button
                      onClick={() => setOpenId(v => v === lineup.id ? null : lineup.id)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer' }}
                    >
                      {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                    <button
                      onClick={() => handleDelete(lineup.id)}
                      disabled={deleting === lineup.id}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: deleting === lineup.id ? 'var(--muted)' : 'var(--muted)', cursor: 'pointer' }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'var(--loss)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.4)' }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.borderColor = 'var(--border)' }}
                    >
                      {deleting === lineup.id ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={12} />}
                    </button>
                  </div>
                </div>

                {/* Expanded content */}
                {isOpen && (
                  <div style={{ borderTop: '1px solid var(--border)' }}>
                    {lineup.notes && (
                      <p style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic', padding: '10px 14px 0' }}>{lineup.notes}</p>
                    )}
                    {effectiveMediaType === 'youtube' && lineup.youtube_url && (
                      <div style={{ paddingTop: 10 }}>
                        <YoutubeEmbed url={lineup.youtube_url} />
                      </div>
                    )}
                    {effectiveMediaType === 'video' && lineup.media_urls?.[0] && (
                      <div style={{ padding: '10px 14px' }}>
                        <video src={lineup.media_urls[0]} controls style={{ width: '100%', borderRadius: 8, maxHeight: 320 }} preload="metadata" />
                      </div>
                    )}
                    {effectiveMediaType === 'images' && lineup.media_urls && lineup.media_urls.length > 0 && (
                      <div style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: lineup.media_urls.length === 1 ? '1fr' : '1fr 1fr', gap: 8 }}>
                          {lineup.media_urls.map((url, i) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img key={i} src={url} alt={`${lineup.name} ${i + 1}`} style={{ borderRadius: 8, width: '100%', objectFit: 'cover' }} />
                          ))}
                        </div>
                      </div>
                    )}
                    {effectiveMediaType === 'draw' && (
                      <div style={{ padding: 14 }}>
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
                    {((effectiveMediaType === 'video' && !lineup.media_urls?.[0]) ||
                      (effectiveMediaType === 'images' && !lineup.media_urls?.length)) && (
                      <p style={{ fontSize: 11, color: 'var(--muted)', padding: '10px 14px' }}>No media uploaded yet.</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
