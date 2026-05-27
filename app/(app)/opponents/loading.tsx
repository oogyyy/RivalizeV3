export default function OpponentsLoading() {
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-40 bg-white/5 rounded-lg" />
          <div className="h-4 w-56 bg-white/5 rounded" />
        </div>
        <div className="h-9 w-32 bg-white/5 rounded-lg" />
      </div>

      {/* Opponent cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-40 rounded-xl bg-white/5 border border-white/5" />
        ))}
      </div>
    </div>
  )
}
