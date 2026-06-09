export default function SettingsLoading() {
  return (
    <div className="p-4 md:p-6 space-y-5 max-w-3xl mx-auto">
      <div className="rv-skeleton h-8 w-32 rounded-lg" aria-hidden="true" />
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="rv-skeleton rounded-xl"
          style={{ height: 148 }}
          aria-hidden="true"
        />
      ))}
    </div>
  )
}
