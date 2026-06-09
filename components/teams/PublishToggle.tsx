'use client'

import { useState } from 'react'
import { Globe, Lock, ExternalLink } from 'lucide-react'
import Link from 'next/link'

interface Props {
  folderId: string
  initialIsPublic: boolean
}

export default function PublishToggle({ folderId, initialIsPublic }: Props) {
  const [isPublic, setIsPublic] = useState(initialIsPublic)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  async function toggle() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/opponents/${folderId}/publish`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic: !isPublic }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Failed to update')
        return
      }
      const data = await res.json()
      setIsPublic(data.isPublic)
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      borderRadius: 12, border: `1px solid ${isPublic ? 'var(--accent-line)' : 'var(--border)'}`,
      background: isPublic ? 'var(--accent-soft)' : 'var(--card)',
      padding: '14px 16px', transition: 'all 0.2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
          background: isPublic ? 'var(--accent-soft)' : 'rgba(255,255,255,0.05)',
          border: `1px solid ${isPublic ? 'var(--accent-line)' : 'var(--border)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {isPublic
            ? <Globe size={14} style={{ color: 'var(--accent)' }} />
            : <Lock size={14} style={{ color: 'var(--muted)' }} />
          }
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: isPublic ? 'var(--accent)' : 'var(--text)' }}>
            {isPublic ? 'Published to Library' : 'Private Folder'}
          </p>
          <p style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>
            {isPublic ? 'Visible in the community scout library' : 'Only your team can see this'}
          </p>
        </div>
      </div>

      <button
        onClick={toggle}
        disabled={loading}
        style={{
          width: '100%', padding: '7px 12px', borderRadius: 8,
          fontSize: 11, fontWeight: 700, cursor: loading ? 'wait' : 'pointer',
          border: `1px solid ${isPublic ? 'var(--border)' : 'var(--accent-line)'}`,
          background: isPublic ? 'rgba(255,255,255,0.04)' : 'var(--accent-soft)',
          color: isPublic ? 'var(--muted)' : 'var(--accent)',
          transition: 'all 0.15s', opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? 'Updating…' : isPublic ? 'Make Private' : 'Publish to Library'}
      </button>

      {error && (
        <p style={{ fontSize: 10, color: 'var(--loss)', marginTop: 6 }}>{error}</p>
      )}

      {isPublic && (
        <Link
          href="/scouts"
          target="_blank"
          style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, fontSize: 10, color: 'var(--accent)', textDecoration: 'none' }}
        >
          <ExternalLink size={9} />
          View in community library
        </Link>
      )}
    </div>
  )
}
