'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Check, Shield } from 'lucide-react'

export interface TeamOption {
  id: string
  name: string
  role: string
}

interface Props {
  teams: TeamOption[]
  selectedTeamId: string
}

export default function TeamSwitcher({ teams, selectedTeamId }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const selected = teams.find(t => t.id === selectedTeamId) ?? teams[0]

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (teams.length <= 1) return null

  const handleSelect = (teamId: string) => {
    setOpen(false)
    router.push(`/my-team?team=${teamId}`)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          height: 32, padding: '0 10px 0 8px', borderRadius: 8,
          background: open ? 'var(--card)' : 'transparent',
          border: `1px solid ${open ? 'var(--border-2)' : 'var(--border)'}`,
          color: 'var(--text)', cursor: 'pointer',
          fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 500,
          transition: 'all 0.12s',
        }}
        onMouseEnter={e => {
          if (!open) {
            e.currentTarget.style.background = 'var(--card)'
            e.currentTarget.style.borderColor = 'var(--border-2)'
          }
        }}
        onMouseLeave={e => {
          if (!open) {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.borderColor = 'var(--border)'
          }
        }}
      >
        <Shield size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        <span style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected?.name ?? 'Select team'}
        </span>
        <ChevronDown
          size={12}
          style={{
            color: 'var(--faint)', flexShrink: 0,
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s',
          }}
        />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0,
          minWidth: 200,
          background: 'var(--elevated)',
          border: '1px solid var(--border-2)',
          borderRadius: 10,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          zIndex: 50,
          overflow: 'hidden',
          padding: '4px',
        }}>
          <p style={{
            fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.1em', color: 'var(--faint)',
            fontFamily: 'var(--font-ui)', padding: '6px 10px 4px',
          }}>
            Your Teams
          </p>
          {teams.map(team => {
            const isActive = team.id === selectedTeamId
            return (
              <button
                key={team.id}
                onClick={() => handleSelect(team.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                  padding: '7px 10px', borderRadius: 7, border: 'none',
                  background: isActive ? 'var(--accent-soft)' : 'transparent',
                  color: isActive ? 'var(--text)' : 'var(--muted)',
                  cursor: 'pointer', textAlign: 'left',
                  fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: isActive ? 600 : 400,
                  transition: 'background 0.1s, color 0.1s',
                }}
                onMouseEnter={e => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'var(--hairline)'
                    e.currentTarget.style.color = 'var(--text)'
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color = 'var(--muted)'
                  }
                }}
              >
                <Shield size={13} style={{ color: isActive ? 'var(--accent)' : 'var(--faint)', flexShrink: 0 }} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {team.name}
                </span>
                <span style={{
                  fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--faint)',
                  textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0,
                }}>
                  {team.role}
                </span>
                {isActive && <Check size={11} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
