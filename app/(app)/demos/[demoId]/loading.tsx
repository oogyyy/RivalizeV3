export default function DemoLoading() {
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto animate-pulse">
      {/* Back + title */}
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 bg-white/5 rounded-lg" />
        <div className="h-7 w-56 bg-white/5 rounded-lg" />
      </div>

      {/* Tab bar */}
      <div className="flex gap-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-9 w-24 bg-white/5 rounded-lg" />
        ))}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-48 rounded-xl bg-white/5 border border-white/5" />
        ))}
      </div>

      {/* Main table */}
      <div className="h-64 rounded-xl bg-white/5 border border-white/5" />
    </div>
  )
}
