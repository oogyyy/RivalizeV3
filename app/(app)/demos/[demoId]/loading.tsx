export default function DemoLoading() {
  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
      {/* Back + title */}
      <div className="flex items-center gap-3" aria-hidden="true">
        <div className="rv-skeleton rounded-lg shrink-0" style={{ width: 36, height: 36 }} />
        <div className="rv-skeleton h-7 w-56 rounded-lg" />
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 overflow-x-auto pb-1" aria-hidden="true">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="rv-skeleton rounded-lg shrink-0"
            style={{ height: 36, width: 96 }}
          />
        ))}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4" aria-hidden="true">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="rv-skeleton rounded-xl"
            style={{ height: 180 }}
          />
        ))}
      </div>

      {/* Player table */}
      <div aria-hidden="true">
        <div className="rv-skeleton h-5 w-32 rounded mb-3" />
        <div className="space-y-2">
          {[...Array(10)].map((_, i) => (
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
                minHeight: 48,
              }}
            >
              <div className="rv-skeleton rounded shrink-0" style={{ width: 24, height: 14 }} />
              <div className="rv-skeleton rounded-lg shrink-0" style={{ width: 28, height: 28 }} />
              <div className="rv-skeleton h-3.5 rounded flex-1" style={{ maxWidth: 120 }} />
              <div className="flex gap-3 ml-auto">
                {[...Array(4)].map((_, j) => (
                  <div key={j} className="rv-skeleton h-4 w-9 rounded" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
