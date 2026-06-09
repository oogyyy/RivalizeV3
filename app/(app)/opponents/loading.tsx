export default function OpponentsLoading() {
  return (
    <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header row */}
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="rv-skeleton h-8 w-40 rounded-lg" />
          <div className="rv-skeleton h-4 w-56 rounded" />
        </div>
        <div className="rv-skeleton h-10 w-32 rounded-lg shrink-0" />
      </div>

      {/* Upload zone placeholder */}
      <div
        style={{
          background: 'var(--card)',
          border: '1px dashed var(--border-2)',
          borderRadius: 14,
          padding: '28px 20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
        }}
        aria-hidden="true"
      >
        <div className="rv-skeleton rounded-xl" style={{ width: 44, height: 44 }} />
        <div className="rv-skeleton h-4 w-48 rounded" />
        <div className="rv-skeleton h-3 w-36 rounded" />
      </div>

      {/* Opponent cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-hidden="true">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 14,
              padding: '16px',
              minHeight: 140,
            }}
          >
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="rv-skeleton rounded-lg shrink-0" style={{ width: 40, height: 40 }} />
                <div className="flex-1 space-y-2">
                  <div className="rv-skeleton h-4 rounded" style={{ width: '60%' }} />
                  <div className="rv-skeleton h-3 rounded" style={{ width: '40%' }} />
                </div>
              </div>
              <div className="rv-skeleton h-px rounded" style={{ width: '100%' }} />
              <div className="grid grid-cols-3 gap-2">
                {[...Array(3)].map((_, j) => (
                  <div key={j} className="space-y-1">
                    <div className="rv-skeleton h-5 rounded" />
                    <div className="rv-skeleton h-3 rounded" style={{ width: '70%' }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
