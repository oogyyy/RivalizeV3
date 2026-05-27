export default function MyTeamLoading() {
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-36 bg-white/5 rounded-lg" />
          <div className="h-4 w-52 bg-white/5 rounded" />
        </div>
        <div className="h-9 w-28 bg-white/5 rounded-lg" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-white/5 border border-white/5" />
        ))}
      </div>

      {/* Demo list */}
      <div className="space-y-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-12 rounded-lg bg-white/5 border border-white/5" />
        ))}
      </div>
    </div>
  )
}
