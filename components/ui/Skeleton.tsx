import { CSSProperties } from 'react'

interface SkeletonProps {
  className?: string
  style?: CSSProperties
  width?: string | number
  height?: string | number
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
}

const RADII = { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 }

export function Skeleton({ className = '', style, width, height, rounded = 'md' }: SkeletonProps) {
  return (
    <div
      className={`rv-skeleton ${className}`}
      style={{
        width,
        height,
        borderRadius: RADII[rounded],
        flexShrink: 0,
        ...style,
      }}
      aria-hidden="true"
    />
  )
}

export function SkeletonText({ lines = 1, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="rv-skeleton"
          style={{
            height: 14,
            borderRadius: 6,
            width: i === lines - 1 && lines > 1 ? '72%' : '100%',
          }}
        />
      ))}
    </div>
  )
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div
      className={className}
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: '16px',
      }}
      aria-hidden="true"
    >
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="rv-skeleton" style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0 }} />
          <div className="flex-1 space-y-2">
            <div className="rv-skeleton" style={{ height: 12, width: '60%', borderRadius: 6 }} />
            <div className="rv-skeleton" style={{ height: 10, width: '40%', borderRadius: 5 }} />
          </div>
        </div>
        <div className="rv-skeleton" style={{ height: 28, borderRadius: 8 }} />
      </div>
    </div>
  )
}

export function SkeletonStatCard({ className = '' }: { className?: string }) {
  return (
    <div
      className={className}
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: '14px 16px',
        minHeight: 96,
      }}
      aria-hidden="true"
    >
      <div className="space-y-3">
        <div className="rv-skeleton" style={{ height: 11, width: '55%', borderRadius: 5 }} />
        <div className="rv-skeleton" style={{ height: 30, width: '70%', borderRadius: 8 }} />
        <div className="rv-skeleton" style={{ height: 10, width: '45%', borderRadius: 5 }} />
      </div>
    </div>
  )
}

export function SkeletonRow({ className = '' }: { className?: string }) {
  return (
    <div
      className={`flex items-center gap-3 ${className}`}
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '10px 14px',
        minHeight: 52,
      }}
      aria-hidden="true"
    >
      <div className="rv-skeleton" style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0 }} />
      <div className="flex-1 space-y-2">
        <div className="rv-skeleton" style={{ height: 12, width: '55%', borderRadius: 5 }} />
        <div className="rv-skeleton" style={{ height: 10, width: '35%', borderRadius: 4 }} />
      </div>
      <div className="rv-skeleton" style={{ width: 52, height: 24, borderRadius: 6, flexShrink: 0 }} />
    </div>
  )
}
