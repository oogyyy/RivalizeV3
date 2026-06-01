import { Trophy } from 'lucide-react'

export default function ProDemosPage() {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-sm">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4">
          <Trophy size={24} className="text-amber-400" />
        </div>
        <h1 className="text-xl font-bold text-foreground mb-2">Pro Library</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Professional demo analysis is coming soon. You'll be able to browse and study demos from top-tier teams and tournaments.
        </p>
      </div>
    </div>
  )
}
