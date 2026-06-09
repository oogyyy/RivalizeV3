export default function ProfileLoading() {
  return (
    <div className="p-4 md:p-6 space-y-5 max-w-3xl mx-auto">
      {/* Avatar + name */}
      <div className="flex items-center gap-4" aria-hidden="true">
        <div className="rv-skeleton shrink-0" style={{ width: 64, height: 64, borderRadius: '50%' }} />
        <div className="space-y-2">
          <div className="rv-skeleton h-6 w-36 rounded-lg" />
          <div className="rv-skeleton h-4 w-24 rounded" />
        </div>
      </div>

      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className="rv-skeleton rounded-xl"
          style={{ height: 160 }}
          aria-hidden="true"
        />
      ))}
    </div>
  )
}
