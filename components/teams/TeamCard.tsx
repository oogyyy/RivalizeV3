import Link from 'next/link'
import { Users, FileVideo, TrendingUp, Crown, Shield, User } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface TeamCardProps {
  team: {
    id: string
    name: string
    slug: string
    logo_url: string | null
    memberCount: number
    demoCount: number
    userRole: string
    winRate?: number
  }
}

const roleIcon = {
  owner: Crown,
  admin: Shield,
  member: User,
}

const roleVariant = {
  owner: 'neon' as const,
  admin: 'warning' as const,
  member: 'secondary' as const,
}

export default function TeamCard({ team }: TeamCardProps) {
  const RoleIcon = roleIcon[team.userRole as keyof typeof roleIcon] ?? User
  const badgeVariant = roleVariant[team.userRole as keyof typeof roleVariant] ?? 'secondary'
  const initial = team.name.charAt(0).toUpperCase()

  return (
    <Link href={`/teams/${team.id}`}>
      <Card className="bg-card border-border hover:border-neon-green/40 transition-all duration-200 cursor-pointer group h-full">
        <CardContent className="p-5 flex flex-col h-full">
          {/* Header */}
          <div className="flex items-start gap-3 mb-4">
            <div className="w-12 h-12 rounded-lg bg-neon-green/10 border border-neon-green/20 flex items-center justify-center shrink-0 group-hover:border-neon-green/50 transition-colors">
              {team.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={team.logo_url}
                  alt={team.name}
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : (
                <span className="text-lg font-bold text-neon-green">{initial}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-foreground truncate group-hover:text-neon-green transition-colors text-base">
                {team.name}
              </p>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">{team.slug}</p>
            </div>
            <Badge variant={badgeVariant} className="shrink-0 flex items-center gap-1">
              <RoleIcon size={10} />
              {team.userRole}
            </Badge>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 mt-auto">
            <div className="flex flex-col items-center p-2 rounded-md bg-background/50 border border-border/50">
              <Users size={12} className="text-muted-foreground mb-1" />
              <span className="text-sm font-bold text-foreground">{team.memberCount}</span>
              <span className="text-[10px] text-muted-foreground">members</span>
            </div>
            <div className="flex flex-col items-center p-2 rounded-md bg-background/50 border border-border/50">
              <FileVideo size={12} className="text-muted-foreground mb-1" />
              <span className="text-sm font-bold text-foreground">{team.demoCount}</span>
              <span className="text-[10px] text-muted-foreground">opp. demos</span>
            </div>
            <div className="flex flex-col items-center p-2 rounded-md bg-background/50 border border-border/50">
              <TrendingUp size={12} className="text-muted-foreground mb-1" />
              <span
                className={cn(
                  'text-sm font-bold',
                  team.winRate !== undefined
                    ? team.winRate >= 50
                      ? 'text-neon-green'
                      : 'text-red-400'
                    : 'text-muted-foreground'
                )}
              >
                {team.winRate !== undefined ? `${Math.round(team.winRate)}%` : '—'}
              </span>
              <span className="text-[10px] text-muted-foreground">win rate</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
