export default function ProfileLoading() {
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto animate-pulse">
      {/* Avatar + name */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-white/5" />
        <div className="space-y-2">
          <div className="h-6 w-36 bg-white/5 rounded" />
          <div className="h-4 w-24 bg-white/5 rounded" />
        </div>
      </div>

      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-48 rounded-xl bg-white/5 border border-white/5" />
      ))}
    </div>
  )
}
