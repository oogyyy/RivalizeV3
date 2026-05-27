export default function SettingsLoading() {
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto animate-pulse">
      <div className="h-8 w-32 bg-white/5 rounded-lg" />
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-40 rounded-xl bg-white/5 border border-white/5" />
      ))}
    </div>
  )
}
