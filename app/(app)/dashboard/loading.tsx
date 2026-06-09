import { SkeletonStatCard, SkeletonRow } from '@/components/ui/Skeleton'

export default function DashboardLoading() {
  return (
    <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="space-y-2 pt-1">
        <div className="rv-skeleton h-8 w-44 rounded-lg" />
        <div className="rv-skeleton h-4 w-64 rounded" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3" aria-hidden="true">
        {[...Array(4)].map((_, i) => (
          <SkeletonStatCard key={i} />
        ))}
      </div>

      {/* Map pool bars */}
      <div
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: '16px',
        }}
        aria-hidden="true"
      >
        <div className="rv-skeleton h-4 w-24 rounded mb-4" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="space-y-1">
              <div className="flex justify-between">
                <div className="rv-skeleton h-3 rounded" style={{ width: `${48 + i * 8}px` }} />
                <div className="rv-skeleton h-3 w-8 rounded" />
              </div>
              <div
                className="rv-skeleton rounded-full"
                style={{ height: 6, width: '100%' }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Two-column section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent demos */}
        <div aria-hidden="true">
          <div className="rv-skeleton h-5 w-32 rounded mb-3" />
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        </div>

        {/* Community feed */}
        <div aria-hidden="true">
          <div className="rv-skeleton h-5 w-36 rounded mb-3" />
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                style={{
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  padding: '12px 14px',
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="rv-skeleton rounded-lg shrink-0" style={{ width: 36, height: 36 }} />
                  <div className="flex-1 space-y-2 min-w-0">
                    <div className="rv-skeleton h-3 rounded" style={{ width: '65%' }} />
                    <div className="rv-skeleton h-3 rounded" style={{ width: '45%' }} />
                  </div>
                  <div className="rv-skeleton h-6 w-12 rounded-md shrink-0" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
