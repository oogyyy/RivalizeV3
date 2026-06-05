import Link from 'next/link'
import { Users, FileVideo, TrendingUp, Crown, Shield, User, ChevronRight } from 'lucide-react'
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

const roleIcon = { owner: Crown, admin: Shield, member: User }
const roleVariant = { owner: 'neon' as const, admin: 'warning' as const, member: 'secondary' as const }

export default function TeamCard({ team }: TeamCardProps) {
  const RoleIcon = roleIcon[team.userRole as keyof typeof roleIcon] ?? User
  const badgeVariant = roleVariant[team.userRole as keyof typeof roleVariant] ?? 'secondary'
  const initial = team.name.charAt(0).toUpperCase()

  return (
    <Link href={`/teams/${team.id}`}>
      <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-card border border-border hover:border-neon-green/40 hover:bg-card/80 transition-all duration-150 group cursor-pointer">
        {/* Logo */}
        <div className="w-9 h-9 rounded-md bg-neon-green/10 border border-neon-green/20 flex items-center justify-center shrink-0 group-hover:border-neon-green/40 transition-colors">
          {team.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={team.logo_url} alt={team.name} className="w-full h-full object-cover rounded-md" />
          ) : (
            <span className="text-sm font-bold text-neon-green">{initial}</span>
          )}
        </div>

        {/* Name + slug */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-foreground truncate group-hover:text-neon-green transition-colors">
            {team.name}
          </p>
          <p className="text-xs text-muted-foreground font-mono truncate">{team.slug}</p>
        </div>

        {/* Stats */}
        <div className="hidden sm:flex items-center gap-5 shrink-0">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Users size={12} />
            <span className="text-sm font-semibold text-foreground">{team.memberCount}</span>
            <span className="text-xs">members</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <FileVideo size={12} />
            <span className="text-sm font-semibold text-foreground">{team.demoCount}</span>
            <span className="text-xs">demos</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <TrendingUp size={12} />
            <span
              className={cn(
                'text-sm font-semibold',
                team.winRate !== undefined
                  ? team.winRate >= 50 ? 'text-neon-green' : 'text-red-400'
                  : 'text-foreground'
              )}
            >
              {team.winRate !== undefined ? `${team.winRate}%` : '—'}
            </span>
            <span className="text-xs">win%</span>
          </div>
        </div>

        {/* Role badge */}
        <Badge variant={badgeVariant} className="shrink-0 flex items-center gap-1 text-xs">
          <RoleIcon size={10} />
          {team.userRole}
        </Badge>

        <ChevronRight size={15} className="text-muted-foreground/50 shrink-0 group-hover:text-neon-green/70 transition-colors" />
      </div>
    </Link>
  )
}
