import { SkeletonStatCard } from '@/components/ui/Skeleton'

export default function OpponentFolderLoading() {
  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto">
      {/* Back + title */}
      <div className="flex items-center gap-3" aria-hidden="true">
        <div className="rv-skeleton rounded-lg shrink-0" style={{ width: 36, height: 36 }} />
        <div className="rv-skeleton h-7 w-48 rounded-lg" />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3" aria-hidden="true">
        {[...Array(4)].map((_, i) => (
          <SkeletonStatCard key={i} />
        ))}
      </div>

      {/* Demo list */}
      <div aria-hidden="true">
        <div className="rv-skeleton h-5 w-28 rounded mb-3" />
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: '14px 16px',
                minHeight: 72,
              }}
            >
              <div className="flex items-center gap-3">
                <div className="rv-skeleton rounded-lg shrink-0" style={{ width: 40, height: 40 }} />
                <div className="flex-1 space-y-2">
                  <div className="rv-skeleton h-3.5 rounded" style={{ width: '55%' }} />
                  <div className="rv-skeleton h-3 rounded" style={{ width: '38%' }} />
                </div>
                <div className="rv-skeleton h-7 w-20 rounded-md shrink-0" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
