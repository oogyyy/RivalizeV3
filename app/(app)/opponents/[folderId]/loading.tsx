export default function OpponentFolderLoading() {
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto animate-pulse">
      {/* Back + title */}
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 bg-white/5 rounded-lg" />
        <div className="h-7 w-48 bg-white/5 rounded-lg" />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-white/5 border border-white/5" />
        ))}
      </div>

      {/* Demo list */}
      <div className="space-y-3">
        <div className="h-5 w-28 bg-white/5 rounded" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-white/5 border border-white/5" />
        ))}
      </div>
    </div>
  )
}
