'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Rocket, Check, ChevronRight, X, Users, Upload, Brain, Sparkles } from 'lucide-react'

export interface OnboardingState {
  teamCreated: boolean
  demoUploaded: boolean
  coachUsed: boolean
}

const DISMISS_KEY = 'rv-onboarding-dismissed'

type Step = {
  key: keyof OnboardingState
  label: string
  desc: string
  href: string
  cta: string
  Icon: React.ElementType
}

const STEPS: Step[] = [
  { key: 'teamCreated',  label: 'Create your team',     desc: 'Set up a team to organise demos and scouting.', href: '/my-team',  cta: 'Create team',  Icon: Users },
  { key: 'demoUploaded', label: 'Upload your first demo', desc: 'Drop a .dem file — we parse it automatically.',  href: '/opponents', cta: 'Upload demo',  Icon: Upload },
  { key: 'coachUsed',    label: 'Meet your AI coach',     desc: 'Ask for a scouting report or self-analysis.',   href: '/ai-coach',  cta: 'Open AI coach', Icon: Brain },
]

export default function OnboardingWizard({ state }: { state: OnboardingState }) {
  const allDone = state.teamCreated && state.demoUploaded && state.coachUsed
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(DISMISS_KEY) === '1'
  })
  const [collapsed, setCollapsed] = useState(false)

  if (allDone || dismissed) return null

  const completed = STEPS.filter(s => state[s.key]).length
  const pct = Math.round((completed / STEPS.length) * 100)
  // First step that isn't done yet — the one we nudge toward
  const nextStep = STEPS.find(s => !state[s.key])

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1')
    setDismissed(true)
  }

  return (
    <div
      className="fixed z-40 bottom-20 left-3 right-3 md:bottom-5 md:left-5 md:right-auto md:w-[340px]"
      style={{ pointerEvents: 'none' }}
    >
      <div
        className="rounded-2xl border overflow-hidden shadow-2xl"
        style={{ background: 'var(--panel)', borderColor: 'var(--border-2)', pointerEvents: 'auto' }}
      >
        {/* Header */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="w-full flex items-center gap-3 px-4 py-3 text-left"
          style={{ background: 'color-mix(in srgb, var(--signal) 6%, transparent)', borderBottom: collapsed ? 'none' : '1px solid var(--border)' }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'color-mix(in srgb, var(--signal) 14%, transparent)', border: '1px solid color-mix(in srgb, var(--signal) 28%, transparent)' }}
          >
            <Rocket size={15} style={{ color: 'var(--signal)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Get started</p>
            <p className="text-[11px]" style={{ color: 'var(--muted)' }}>{completed} of {STEPS.length} complete</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] font-mono font-bold" style={{ color: 'var(--signal)' }}>{pct}%</span>
            <ChevronRight
              size={15}
              style={{ color: 'var(--faint)', transform: collapsed ? 'rotate(90deg)' : 'rotate(-90deg)', transition: 'transform 0.15s' }}
            />
          </div>
        </button>

        {/* Progress bar */}
        <div className="h-1 w-full" style={{ background: 'var(--border)' }}>
          <div className="h-full transition-all duration-500" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, var(--signal), color-mix(in srgb, var(--signal) 60%, var(--accent)))' }} />
        </div>

        {!collapsed && (
          <>
            <div className="p-2.5 flex flex-col gap-1">
              {STEPS.map(step => {
                const done = state[step.key]
                const isNext = !done && step.key === nextStep?.key
                return (
                  <Link
                    key={step.key}
                    href={step.href}
                    className="flex items-center gap-3 p-2.5 rounded-xl transition-colors"
                    style={{ background: isNext ? 'color-mix(in srgb, var(--signal) 7%, transparent)' : 'transparent', border: isNext ? '1px solid color-mix(in srgb, var(--signal) 22%, transparent)' : '1px solid transparent' }}
                  >
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                      style={done
                        ? { background: 'color-mix(in srgb, var(--win) 16%, transparent)', border: '1px solid color-mix(in srgb, var(--win) 35%, transparent)' }
                        : { background: 'var(--elevated)', border: '1px solid var(--border)' }}
                    >
                      {done ? <Check size={13} style={{ color: 'var(--win)' }} /> : <step.Icon size={13} style={{ color: isNext ? 'var(--signal)' : 'var(--faint)' }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium" style={{ color: done ? 'var(--muted)' : 'var(--text)', textDecoration: done ? 'line-through' : 'none' }}>
                        {step.label}
                      </p>
                      {!done && <p className="text-[11px]" style={{ color: 'var(--faint)' }}>{step.desc}</p>}
                    </div>
                    {isNext && (
                      <span className="flex items-center gap-1 text-[11px] font-semibold shrink-0" style={{ color: 'var(--signal)' }}>
                        {step.cta} <ChevronRight size={12} />
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>

            <div className="px-3 py-2.5 flex items-center justify-between gap-2" style={{ borderTop: '1px solid var(--border)' }}>
              <span className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--faint)' }}>
                <Sparkles size={11} style={{ color: 'var(--signal)' }} />
                Walk in prepared
              </span>
              <button
                onClick={dismiss}
                className="flex items-center gap-1 text-[11px] transition-colors"
                style={{ color: 'var(--muted)' }}
              >
                <X size={11} /> Dismiss
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
