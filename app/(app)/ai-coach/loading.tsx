export default function AiCoachLoading() {
  return (
    <div className="flex h-full animate-pulse">
      {/* Sidebar panel */}
      <div className="w-64 shrink-0 border-r border-white/5 p-4 space-y-3 hidden md:block">
        <div className="h-6 w-24 bg-white/5 rounded" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-10 rounded-lg bg-white/5" />
        ))}
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col p-4 space-y-4">
        <div className="flex-1 space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className={`h-16 rounded-xl bg-white/5 ${i % 2 === 1 ? 'ml-12' : 'mr-12'}`} />
          ))}
        </div>
        <div className="h-12 rounded-xl bg-white/5 border border-white/5" />
      </div>
    </div>
  )
}
