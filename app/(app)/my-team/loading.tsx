import { SkeletonStatCard, SkeletonRow } from '@/components/ui/Skeleton'

export default function MyTeamLoading() {
  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="rv-skeleton h-8 w-36 rounded-lg" />
          <div className="rv-skeleton h-4 w-52 rounded" />
        </div>
        <div className="rv-skeleton h-10 w-28 rounded-lg shrink-0" />
      </div>

      {/* Team avatar + info */}
      <div
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: '16px',
        }}
        aria-hidden="true"
      >
        <div className="flex items-center gap-4">
          <div className="rv-skeleton rounded-xl shrink-0" style={{ width: 56, height: 56 }} />
          <div className="flex-1 space-y-2">
            <div className="rv-skeleton h-5 rounded" style={{ width: '45%' }} />
            <div className="rv-skeleton h-3 rounded" style={{ width: '30%' }} />
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3" aria-hidden="true">
        {[...Array(3)].map((_, i) => (
          <SkeletonStatCard key={i} />
        ))}
      </div>

      {/* Player roster */}
      <div aria-hidden="true">
        <div className="rv-skeleton h-5 w-28 rounded mb-3" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                minHeight: 52,
              }}
            >
              <div className="rv-skeleton rounded-lg shrink-0" style={{ width: 34, height: 34 }} />
              <div className="flex-1 space-y-1.5 min-w-0">
                <div className="rv-skeleton h-3.5 rounded" style={{ width: '50%' }} />
                <div className="rv-skeleton h-3 rounded" style={{ width: '35%' }} />
              </div>
              <div className="rv-skeleton h-6 w-14 rounded-md shrink-0" />
            </div>
          ))}
        </div>
      </div>

      {/* Demo list */}
      <div aria-hidden="true">
        <div className="rv-skeleton h-5 w-28 rounded mb-3" />
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      </div>
    </div>
  )
}
