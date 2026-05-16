import Link from 'next/link'
import { ChevronRight, FileVideo, Trophy, Calendar } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface FolderCardProps {
  folder: {
    id: string
    opponent_display_name: string
    demoCount: number
    wins: number
    losses: number
    draws?: number
    lastPlayed?: string
    teamId: string
  }
}

export default function FolderCard({ folder }: FolderCardProps) {
  const total = folder.wins + folder.losses + (folder.draws ?? 0)
  const winRate = total > 0 ? Math.round((folder.wins / total) * 100) : 0
  const isPositive = folder.wins > folder.losses
  const isNegative = folder.losses > folder.wins

  return (
    <Link href={`/opponents/${folder.id}`}>
      <Card className="bg-card border-border hover:border-neon-green/40 transition-all duration-200 cursor-pointer group">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3">
            {/* Left: opponent + meta */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded bg-accent flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-foreground">
                    {folder.opponent_display_name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate group-hover:text-neon-green transition-colors">
                    {folder.opponent_display_name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <FileVideo size={10} className="text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {folder.demoCount} {folder.demoCount === 1 ? 'demo' : 'demos'}
                    </span>
                    {folder.lastPlayed && (
                      <>
                        <span className="text-muted-foreground/40">·</span>
                        <Calendar size={10} className="text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {formatDate(folder.lastPlayed)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* W/L record */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <span
                    className={cn(
                      'text-lg font-bold font-mono',
                      isPositive ? 'text-neon-green' : isNegative ? 'text-red-400' : 'text-foreground'
                    )}
                  >
                    {folder.wins}W
                  </span>
                  <span className="text-muted-foreground text-sm">-</span>
                  <span
                    className={cn(
                      'text-lg font-bold font-mono',
                      isNegative ? 'text-red-400' : 'text-muted-foreground'
                    )}
                  >
                    {folder.losses}L
                  </span>
                  {(folder.draws ?? 0) > 0 && (
                    <>
                      <span className="text-muted-foreground text-sm">-</span>
                      <span className="text-lg font-bold font-mono text-yellow-400">
                        {folder.draws}D
                      </span>
                    </>
                  )}
                </div>
                {total > 0 && (
                  <Badge
                    variant={isPositive ? 'neon' : isNegative ? 'destructive' : 'secondary'}
                    className="text-[10px]"
                  >
                    <Trophy size={9} className="mr-0.5" />
                    {winRate}%
                  </Badge>
                )}
              </div>
            </div>

            {/* Right: chevron */}
            <ChevronRight
              size={16}
              className="text-muted-foreground group-hover:text-neon-green transition-colors shrink-0"
            />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
