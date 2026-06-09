export default function AiCoachLoading() {
  return (
    <div className="flex h-full" aria-label="Loading AI Scout">
      {/* Sidebar panel — desktop only */}
      <aside
        className="hidden md:flex flex-col shrink-0 border-r"
        style={{
          width: 256,
          borderColor: 'var(--border)',
          padding: '16px 12px',
          gap: 8,
        }}
        aria-hidden="true"
      >
        <div className="rv-skeleton h-5 w-24 rounded mb-2" />
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="rv-skeleton rounded-lg"
            style={{ height: 44, width: '100%' }}
          />
        ))}
      </aside>

      {/* Chat area */}
      <div className="flex-1 flex flex-col p-4 md:p-5 gap-4 min-w-0">
        {/* Context header */}
        <div
          className="rv-skeleton rounded-xl shrink-0"
          style={{ height: 56 }}
          aria-hidden="true"
        />

        {/* Message thread */}
        <div className="flex-1 space-y-4 overflow-hidden" aria-hidden="true">
          {/* AI message */}
          <div className="flex items-start gap-3 pr-12 md:pr-24">
            <div className="rv-skeleton rounded-lg shrink-0" style={{ width: 32, height: 32 }} />
            <div
              className="rv-skeleton rounded-xl flex-1"
              style={{ height: 72, maxWidth: 420 }}
            />
          </div>
          {/* User message */}
          <div className="flex items-start gap-3 pl-12 md:pl-24 flex-row-reverse">
            <div className="rv-skeleton rounded-lg shrink-0" style={{ width: 32, height: 32 }} />
            <div
              className="rv-skeleton rounded-xl flex-1"
              style={{ height: 44, maxWidth: 300 }}
            />
          </div>
          {/* AI typing */}
          <div className="flex items-start gap-3 pr-12 md:pr-24">
            <div className="rv-skeleton rounded-lg shrink-0" style={{ width: 32, height: 32 }} />
            <div
              style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: '14px 16px',
                display: 'flex',
                gap: 6,
                alignItems: 'center',
              }}
            >
              {[0, 1, 2].map(i => (
                <span
                  key={i}
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: 'var(--signal)',
                    opacity: 0.4,
                    animation: `rv-shimmer ${1 + i * 0.2}s ease-in-out infinite`,
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Input */}
        <div
          className="rv-skeleton rounded-xl shrink-0"
          style={{ height: 52 }}
          aria-hidden="true"
        />
      </div>
    </div>
  )
}
