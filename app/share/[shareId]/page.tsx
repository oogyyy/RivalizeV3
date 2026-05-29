export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { cn } from '@/lib/utils'
import type { PlayerStats } from '@/types/database'
import Link from 'next/link'
import { Shield, Trophy, Crosshair } from 'lucide-react'

const MAP_LABELS: Record<string, string> = {
  de_dust2: 'Dust2', de_mirage: 'Mirage', de_inferno: 'Inferno',
  de_nuke: 'Nuke', de_overpass: 'Overpass', de_ancient: 'Ancient',
  de_anubis: 'Anubis', de_vertigo: 'Vertigo',
}

function getRatingColor(r: number) {
  if (r >= 1.2) return 'text-emerald-400'
  if (r >= 1.0) return 'text-green-400'
  if (r >= 0.8) return 'text-yellow-400'
  return 'text-red-400'
}

type SharedDemoData = {
  map: string
  matchDate: string | null
  demoType: string
  opponentName: string
  header: {
    map?: string; team1?: string; team2?: string
    score_team1?: number; score_team2?: number; total_rounds?: number
  } | null
  players: Pick<PlayerStats, 'name' | 'team' | 'kills' | 'deaths' | 'assists' | 'adr' | 'rating' | 'headshot_percentage'>[]
  totalRounds: number
  bombPlants: number
}

export default async function SharePage({ params }: { params: Promise<{ shareId: string }> }) {
  const { shareId } = await params

  const admin = createAdminClient()
  const { data: demo } = await admin
    .from('demos')
    .select('id, map, match_date, demo_type, opponent_name, parsed_data, share_id')
    .eq('share_id', shareId)
    .single()

  if (!demo) notFound()

  const pd = demo.parsed_data as {
    header?: { map?: string; team1?: string; team2?: string; score_team1?: number; score_team2?: number; total_rounds?: number }
    players?: PlayerStats[]
    rounds?: { bomb_planted?: boolean }[]
  } | null

  const header = pd?.header ?? null
  const players = pd?.players ?? []
  const team1 = header?.team1 ?? 'Team 1'
  const team2 = header?.team2 ?? 'Team 2'
  const s1 = header?.score_team1 ?? 0
  const s2 = header?.score_team2 ?? 0
  const totalRounds = header?.total_rounds ?? 0
  const plants = (pd?.rounds ?? []).filter(r => r.bomb_planted).length

  const t1Players = players.filter(p => p.team === team1).sort((a, b) => b.rating - a.rating)
  const t2Players = players.filter(p => p.team === team2).sort((a, b) => b.rating - a.rating)
  const mapLabel = MAP_LABELS[demo.map] ?? demo.map

  const matchDate = demo.match_date
    ? new Date(demo.match_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Minimal nav */}
      <div className="border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Shield size={16} className="text-neon-green" />
            Rivalize
          </Link>
          <span className="text-xs text-muted-foreground">Shared Demo Report</span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Score card */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-mono">{mapLabel}</span>
            {matchDate && <span className="text-xs text-muted-foreground">{matchDate}</span>}
          </div>

          <div className="flex items-center justify-between mt-3">
            <div className="text-left flex-1">
              <p className="text-sm font-medium text-foreground truncate">{team1}</p>
              <p className={cn('text-4xl font-bold font-mono tabular-nums mt-1', s1 > s2 ? 'text-neon-green' : 'text-foreground')}>{s1}</p>
            </div>
            <div className="text-center px-4">
              <Trophy size={20} className="text-muted-foreground/40 mx-auto" />
              <p className="text-xs text-muted-foreground mt-1">vs</p>
            </div>
            <div className="text-right flex-1">
              <p className="text-sm font-medium text-foreground truncate">{team2}</p>
              <p className={cn('text-4xl font-bold font-mono tabular-nums mt-1', s2 > s1 ? 'text-neon-green' : 'text-foreground')}>{s2}</p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
            <span>{totalRounds} rounds</span>
            {totalRounds > 0 && <span>Bomb plants: {plants}/{totalRounds} ({Math.round((plants / totalRounds) * 100)}%)</span>}
          </div>
        </div>

        {/* Player tables */}
        {[{ label: team1, players: t1Players }, { label: team2, players: t2Players }].map(({ label, players: plist }) =>
          plist.length > 0 && (
            <div key={label} className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <Crosshair size={14} className="text-neon-green" />
                <p className="text-sm font-semibold text-foreground">{label}</p>
              </div>
              <div
                className="grid px-4 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/20"
                style={{ gridTemplateColumns: '1fr 60px 60px 60px 60px 70px' }}
              >
                <span>Player</span>
                <span className="text-right">K</span>
                <span className="text-right">D</span>
                <span className="text-right">ADR</span>
                <span className="text-right">HS%</span>
                <span className="text-right">Rating</span>
              </div>
              <div className="divide-y divide-border">
                {plist.map(p => (
                  <div
                    key={p.name}
                    className="grid items-center px-4 py-2.5 text-xs font-mono"
                    style={{ gridTemplateColumns: '1fr 60px 60px 60px 60px 70px' }}
                  >
                    <span className="font-sans font-medium text-foreground truncate">{p.name}</span>
                    <span className="text-right text-emerald-400">{p.kills}</span>
                    <span className="text-right text-red-400">{p.deaths}</span>
                    <span className="text-right text-muted-foreground">{p.adr.toFixed(0)}</span>
                    <span className="text-right text-muted-foreground">{p.headshot_percentage.toFixed(0)}%</span>
                    <span className={cn('text-right font-bold', getRatingColor(p.rating))}>{p.rating.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        )}

        <p className="text-center text-xs text-muted-foreground pt-4">
          Shared via <Link href="/" className="underline hover:text-foreground">Rivalize</Link> · CS2 demo analysis platform
        </p>
      </div>
    </div>
  )
}
