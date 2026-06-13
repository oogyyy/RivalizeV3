'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ExternalLink, Link2, Trophy, X } from 'lucide-react'

interface Props {
  /** faceit-team link/unlink endpoint, e.g. /api/teams/<id>/faceit-team or /api/opponents/<id>/faceit-team */
  endpoint: string
  initialTeamId: string | null
  initialTeamName: string | null
  isOwnerOrAdmin: boolean
  /** Copy shown under the heading when no team is linked yet. */
  emptyHint?: string
}

function faceitTeamUrl(id: string) {
  return `https://www.faceit.com/en/teams/${id}/leagues`
}

export default function EseaTeamLink({ endpoint, initialTeamId, initialTeamName, isOwnerOrAdmin, emptyHint }: Props) {
  const router = useRouter()
  const [teamId, setTeamId]     = useState<string | null>(initialTeamId)
  const [teamName, setTeamName] = useState<string | null>(initialTeamName)
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  // Nothing to show: no link set and the viewer can't add one.
  if (!teamId && !isOwnerOrAdmin) return null

  async function link() {
    if (!input.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? 'Failed to link team'); return }
      setTeamId(data.faceitTeamId)
      setTeamName(data.faceitTeamName)
      setInput('')
      router.refresh()
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  async function unlink() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(endpoint, { method: 'DELETE' })
      if (!res.ok) { setError('Failed to unlink'); return }
      setTeamId(null)
      setTeamName(null)
      router.refresh()
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)', padding: '14px 16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: teamId ? 12 : 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
          background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Trophy size={14} style={{ color: 'var(--signal)' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>ESEA / FACEIT Team</p>
          <p style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>
            {teamId ? (teamName ?? 'Linked team') : (emptyHint ?? 'Link this opponent to their ESEA team page')}
          </p>
        </div>
        {teamId && isOwnerOrAdmin && (
          <button
            onClick={unlink}
            disabled={loading}
            title="Unlink team"
            style={{
              width: 24, height: 24, borderRadius: 6, flexShrink: 0, cursor: loading ? 'wait' : 'pointer',
              border: '1px solid var(--border)', background: 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)',
            }}
          >
            <X size={12} />
          </button>
        )}
      </div>

      {teamId ? (
        <a
          href={faceitTeamUrl(teamId)} target="_blank" rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '7px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, textDecoration: 'none',
            background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--accent-line)',
          }}
        >
          <ExternalLink size={11} /> View team on FACEIT
        </a>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') link() }}
              placeholder="Paste FACEIT team URL or id…"
              style={{
                flex: 1, minWidth: 0, padding: '7px 10px', borderRadius: 8, fontSize: 11,
                background: 'var(--elevated)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none',
              }}
            />
            <button
              onClick={link}
              disabled={loading || !input.trim()}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8,
                fontSize: 11, fontWeight: 700, cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                border: '1px solid var(--accent-line)', background: 'var(--accent-soft)', color: 'var(--accent)',
                opacity: loading || !input.trim() ? 0.6 : 1, whiteSpace: 'nowrap',
              }}
            >
              <Link2 size={11} /> {loading ? 'Linking…' : 'Link'}
            </button>
          </div>
          <p style={{ fontSize: 10, color: 'var(--faint)', marginTop: 6 }}>
            e.g. faceit.com/en/teams/<span style={{ fontFamily: 'var(--font-mono)' }}>&lt;id&gt;</span>/leagues
          </p>
        </>
      )}

      {error && <p style={{ fontSize: 10, color: 'var(--loss)', marginTop: 6 }}>{error}</p>}
    </div>
  )
}
