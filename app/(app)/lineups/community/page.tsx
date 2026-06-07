'use client'

import { useState, useEffect, useCallback } from 'react'
import { Globe, Loader2, ArrowLeft, BookMarked, Filter } from 'lucide-react'
import Link from 'next/link'
import LineupBoard, { type DrawAction } from '@/components/lineups/LineupBoard'

const CS2_MAPS = [
  { value: '', label: 'All' },
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
  { value: '',        label: 'All',     color: '' },
  { value: 'smoke',   label: 'Smoke',   color: '#c0c0d0' },
  { value: 'flash',   label: 'Flash',   color: '#ffff88' },
  { value: 'molotov', label: 'Molotov', color: '#ff4400' },
  { value: 'he',      label: 'HE',      color: '#ff9900' },
  { value: 'custom',  label: 'Custom',  color: '#818cf8' },
]

interface CommunityLineup {
  id: string
  map: string
  name: string
  type: string
  notes: string
  canvas_data: DrawAction[]
  published_at: string | null
  created_at: string
}

const MAP_LABELS: Record<string, string> = {
  de_dust2: 'Dust2', de_mirage: 'Mirage', de_inferno: 'Inferno',
  de_nuke: 'Nuke', de_overpass: 'Overpass', de_ancient: 'Ancient',
  de_anubis: 'Anubis', de_vertigo: 'Vertigo',
}

const TYPE_COLORS: Record<string, string> = {
  smoke: '#c0c0d0', flash: '#ffff88', molotov: '#ff4400', he: '#ff9900', custom: '#818cf8',
}

export default function CommunityLineupsPage() {
  const [lineups, setLineups]   = useState<CommunityLineup[]>([])
  const [loading, setLoading]   = useState(true)
  const [mapFilter, setMap]     = useState('')
  const [typeFilter, setType]   = useState('')
  const [selected, setSelected] = useState<CommunityLineup | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (mapFilter)  params.set('map', mapFilter)
    if (typeFilter) params.set('type', typeFilter)
    const res = await fetch(`/api/lineups/community?${params}`)
    if (res.ok) {
      const data = await res.json() as CommunityLineup[]
      setLineups(data)
    }
    setLoading(false)
  }, [mapFilter, typeFilter])

  useEffect(() => { load() }, [load])

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header */}
      <div>
        {/* Breadcrumb */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
          <Link href="/lineups" style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--muted)', textDecoration: 'none' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
          >
            <BookMarked size={12} /> Utility Hub
          </Link>
          <span style={{ color: 'var(--faint)' }}>/</span>
          <span style={{ color: 'var(--text)', fontWeight: 500 }}>Community</span>
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/lineups" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', color: 'var(--muted)', textDecoration: 'none', flexShrink: 0 }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
          >
            <ArrowLeft size={15} />
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Globe size={18} style={{ color: '#818cf8' }} />
            </div>
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', lineHeight: 1.1, marginBottom: 3 }}>Community Lineups</h1>
              <p style={{ fontSize: 13, color: 'var(--muted)' }}>Public lineups shared by teams · browse, copy, learn</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Filter size={13} style={{ color: 'var(--faint)', flexShrink: 0 }} />
        <div style={{ display: 'flex', borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden' }}>
          {CS2_MAPS.map(m => (
            <button
              key={m.value}
              onClick={() => setMap(m.value)}
              style={{ padding: '6px 10px', fontSize: 11, fontWeight: 600, background: mapFilter === m.value ? 'var(--accent-soft)' : 'transparent', color: mapFilter === m.value ? 'var(--text)' : 'var(--muted)', border: 'none', borderLeft: m.value !== '' ? '1px solid var(--border)' : 'none', cursor: 'pointer', transition: 'background 0.12s, color 0.12s', whiteSpace: 'nowrap' }}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden' }}>
          {LINEUP_TYPES.map(t => (
            <button
              key={t.value}
              onClick={() => setType(t.value)}
              style={{ padding: '6px 10px', fontSize: 11, fontWeight: 600, background: typeFilter === t.value ? 'rgba(129,140,248,0.15)' : 'transparent', color: typeFilter === t.value ? '#818cf8' : 'var(--muted)', border: 'none', borderLeft: t.value !== '' ? '1px solid var(--border)' : 'none', cursor: 'pointer', transition: 'background 0.12s, color 0.12s' }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: 10 }}>
          <Loader2 size={22} style={{ color: 'var(--accent)', animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>Loading lineups…</span>
        </div>
      ) : lineups.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 16px', textAlign: 'center', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)' }}>
          <Globe size={40} style={{ color: 'var(--faint)', marginBottom: 16 }} />
          <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>No public lineups yet</p>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Be the first — publish a lineup from Utility Hub.</p>
          <Link href="/lineups" style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none', marginTop: 8 }}>
            Go to Utility Hub →
          </Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {lineups.map(lineup => {
            const typeColor = TYPE_COLORS[lineup.type] ?? '#818cf8'
            return (
              <button
                key={lineup.id}
                onClick={() => setSelected(lineup)}
                style={{ borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)', padding: 14, textAlign: 'left', cursor: 'pointer', transition: 'border-color 0.14s', width: '100%' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(129,140,248,0.35)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lineup.name}</p>
                    <p style={{ fontSize: 11, color: 'var(--muted)', margin: 0 }}>{MAP_LABELS[lineup.map] ?? lineup.map}</p>
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase', flexShrink: 0, marginLeft: 8, color: typeColor, background: `${typeColor}22` }}>
                    {lineup.type}
                  </span>
                </div>
                {lineup.notes && (
                  <p style={{ fontSize: 11, color: 'var(--muted)', margin: '0 0 10px', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{lineup.notes}</p>
                )}
                {/* Mini canvas preview */}
                <div style={{ height: 112, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', pointerEvents: 'none' }}>
                  <LineupBoard
                    mapName={lineup.map}
                    initialActions={lineup.canvas_data}
                    readOnly
                    onSave={async () => {}}
                  />
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Lineup viewer modal */}
      {selected && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setSelected(null)}
        >
          <div
            style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, width: '100%', maxWidth: 640, overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
              <div>
                <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{selected.name}</p>
                <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                  {MAP_LABELS[selected.map] ?? selected.map} ·{' '}
                  <span style={{ color: TYPE_COLORS[selected.type] ?? '#818cf8' }}>{selected.type}</span>
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 20, lineHeight: 1, padding: 4 }}
              >
                ×
              </button>
            </div>
            <div style={{ padding: 16 }}>
              {selected.notes && (
                <p style={{ fontSize: 13, color: 'var(--text)', marginBottom: 14, lineHeight: 1.5, opacity: 0.8 }}>{selected.notes}</p>
              )}
              <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
                <LineupBoard
                  mapName={selected.map}
                  initialActions={selected.canvas_data}
                  readOnly
                  onSave={async () => {}}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
