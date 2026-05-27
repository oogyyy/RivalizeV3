export default function DashboardLoading() {
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto animate-pulse">
      {/* Header */}
      <div className="space-y-2">
        <div className="h-8 w-48 bg-white/5 rounded-lg" />
        <div className="h-4 w-64 bg-white/5 rounded" />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-white/5 border border-white/5" />
        ))}
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div className="h-5 w-32 bg-white/5 rounded" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-white/5 border border-white/5" />
          ))}
        </div>
        <div className="space-y-3">
          <div className="h-5 w-32 bg-white/5 rounded" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-white/5 border border-white/5" />
          ))}
        </div>
      </div>
    </div>
  )
}
