export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth/get-user'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Brain, FileText, Crosshair, Target,
  MapPin, ExternalLink, TrendingUp, BarChart3, Trophy,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import DemoUploadButton from '@/components/teams/DemoUploadButton'
import DeleteFolderButton from '@/components/teams/DeleteFolderButton'
import OpponentDemoList from '@/components/teams/OpponentDemoList'
import TeamNotes from '@/components/teams/TeamNotes'
import PublishToggle from '@/components/teams/PublishToggle'
import EseaTeamLink from '@/components/teams/EseaTeamLink'
import EseaMatchList from '@/components/teams/EseaMatchList'
import VetoTendencies from '@/components/teams/VetoTendencies'
import { getTeamStats, type FaceitTeamStats } from '@/lib/faceit'
import RoundSearchPanel from '@/components/demos/RoundSearchPanel'
import RoutinesPanel from '@/components/demos/RoutinesPanel'
import type { AggregatedStats, PlayerStats } from '@/types/database'
import { getPlayerRoleInfo } from '@/lib/roles'
import { MAP_THUMBS } from '@/lib/map-config'
import { PARSED_SUMMARY_SELECT, summaryToParsedData, type ParsedSummaryRow } from '@/lib/demo-parser/parsed-summary'

/* ── helpers ─────────────────────────────────────────────────────── */

function getInitials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

function mapDisplayName(map: string): string {
  return map.replace(/^(de_|cs_|ar_)/, '').split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

// Colour cycling for team avatar — deterministic from first char
const TEAM_COLORS = [
  'var(--accent)',
  'var(--signal)',
  'var(--win)',
  '#facc15',
  'var(--loss)',
]
function teamColor(name: string): string {
  return TEAM_COLORS[name.charCodeAt(0) % TEAM_COLORS.length]
}

/* ── page ─────────────────────────────────────────────────────────── */

export default async function OpponentPage({
  params,
}: {
  params: Promise<{ folderId: string }>
}) {
  const { folderId } = await params
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: folder } = await admin
    .from('team_folders')
    .select('*')
    .eq('id', folderId)
    .single()
  if (!folder || !folder.user_team_id) notFound()

  const teamId: string = folder.user_team_id

  const { data: membership } = await admin
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .single()
  if (!membership) redirect('/opponents')

  const stats = folder.aggregated_stats as AggregatedStats | null

  type DemoListRow  = { id: string; status: string; map: string; match_date: string | null; created_at: string; opponent_slug: string; faceit_match_id: string | null }
  type DemoStatRow  = { id: string; map: string; parsed_data: unknown }

  // Two parallel queries: display list (no heavy parsed_data) + stat computation (completed only)
  const [listResult, statResult] = await Promise.all([
    admin
      .from('demos')
      .select('id, status, map, match_date, created_at, opponent_slug, faceit_match_id')
      .eq('team_id', teamId)
      .eq('opponent_slug', folder.opponent_slug)
      .eq('demo_type', 'opponent')
      .order('created_at', { ascending: false })
      .limit(200),
    admin
      .from('demos')
      // Slim projection — only header/players/opponentSide leave the DB, not the
      // heavy rounds[] array. See lib/demo-parser/parsed-summary.ts.
      .select(`id, map, ${PARSED_SUMMARY_SELECT}`)
      .eq('team_id', teamId)
      .eq('opponent_slug', folder.opponent_slug)
      .eq('demo_type', 'opponent')
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(100),
  ])
  const demos     = listResult.data as DemoListRow[] | null
  const statDemos = ((statResult.data ?? []) as Array<{ id: string; map: string } & ParsedSummaryRow>)
    .map(r => ({ id: r.id, map: r.map, parsed_data: summaryToParsedData(r) })) as DemoStatRow[]

  // Build a header lookup so OpponentDemoList can show real team names
  const parsedByDemoId = new Map(
    (statDemos ?? []).map(d => [
      d.id,
      d.parsed_data as { header?: import('@/types/database').DemoHeader; opponentSide?: 'team1' | 'team2' } | null,
    ])
  )

  const totalDemos = (demos ?? []).length
  const wins    = stats?.wins    ?? 0
  const losses  = stats?.losses  ?? 0
  const draws   = stats?.draws   ?? 0
  const winRate = stats?.win_rate ?? 0
  const isOwnerOrAdmin = membership.role === 'owner' || membership.role === 'admin'

  /* ── per-map opponent win rates (computed from completed demos only) ── */
  const mapStats: Record<string, { w: number; l: number; d: number }> = {}
  for (const demo of statDemos ?? []) {
    if (!demo.map || !demo.parsed_data) continue
    const h  = (demo.parsed_data as { header?: { score_team1?: number; score_team2?: number }; opponentSide?: string }).header
    const os = (demo.parsed_data as { opponentSide?: string }).opponentSide ?? 'team2'
    if (!h) continue
    const oppScore = os === 'team1' ? (h.score_team1 ?? 0) : (h.score_team2 ?? 0)
    const ourScore = os === 'team1' ? (h.score_team2 ?? 0) : (h.score_team1 ?? 0)
    const key = demo.map
    if (!mapStats[key]) mapStats[key] = { w: 0, l: 0, d: 0 }
    if (oppScore > ourScore)       mapStats[key].w++
    else if (oppScore === ourScore) mapStats[key].d++
    else                           mapStats[key].l++
  }

  const mapEntries = Object.entries(mapStats)
    .map(([map, s]) => {
      const t = s.w + s.l + s.d
      return { map, total: t, winRate: t > 0 ? Math.round((s.w / t) * 100) : 0 }
    })
    .sort((a, b) => b.total - a.total)

  const bestMap = mapEntries.sort((a, b) => b.winRate - a.winRate)[0]

  /* ── top players ── */
  let topPlayers: PlayerStats[] = stats?.top_players ?? []
  if (topPlayers.length === 0 && (statDemos ?? []).length > 0) {
    const playerMap: Record<string, PlayerStats & { count: number }> = {}
    for (const demo of statDemos ?? []) {
      if (!demo.parsed_data) continue
      const pd = demo.parsed_data as {
        header?: { team1?: string; team2?: string }
        opponentSide?: string
        players?: PlayerStats[]
      }
      const demoOpSide     = pd.opponentSide ?? 'team2'
      const opponentTeamRaw = demoOpSide === 'team1' ? pd.header?.team1 : pd.header?.team2
      const opponentTeamAlt = demoOpSide === 'team1' ? 'T-Side' : 'CT-Side'
      for (const p of pd.players ?? []) {
        if (p.team !== opponentTeamRaw && p.team !== opponentTeamAlt) continue
        if (!playerMap[p.steam_id]) {
          playerMap[p.steam_id] = { ...p, count: 1 }
        } else {
          const ex = playerMap[p.steam_id]
          ex.kills   += p.kills
          ex.deaths  += p.deaths
          ex.assists += p.assists
          ex.adr    = (ex.adr    * ex.count + p.adr)    / (ex.count + 1)
          ex.rating = (ex.rating * ex.count + p.rating) / (ex.count + 1)
          ex.entry_kills       = (ex.entry_kills       ?? 0) + (p.entry_kills       ?? 0)
          ex.entry_deaths      = (ex.entry_deaths      ?? 0) + (p.entry_deaths      ?? 0)
          ex.trade_kills       = (ex.trade_kills       ?? 0) + (p.trade_kills       ?? 0)
          ex.traded_deaths     = (ex.traded_deaths     ?? 0) + (p.traded_deaths     ?? 0)
          ex.clutch_attempts   = (ex.clutch_attempts   ?? 0) + (p.clutch_attempts   ?? 0)
          ex.clutch_wins       = (ex.clutch_wins       ?? 0) + (p.clutch_wins       ?? 0)
          ex.flashes_thrown    = (ex.flashes_thrown    ?? 0) + (p.flashes_thrown    ?? 0)
          ex.flashes_effective = (ex.flashes_effective ?? 0) + (p.flashes_effective ?? 0)
          ex.count++
        }
      }
    }
    topPlayers = Object.values(playerMap)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 5)
      .map(({ count: _count, ...p }) => p)
  }

  /* ── pro-ref link ── */
  const mapCounts: Record<string, number> = {}
  for (const d of demos ?? []) {
    if (d.map) mapCounts[d.map] = (mapCounts[d.map] ?? 0) + 1
  }
  const primaryMap = Object.entries(mapCounts).sort((a, b) => b[1] - a[1])[0]?.[0]
  const proRefUrl  = primaryMap
    ? `https://huggingface.co/datasets/blanchon/opencs2_dataset/viewer/default/train?q=${encodeURIComponent(primaryMap)}`
    : 'https://huggingface.co/datasets/blanchon/opencs2_dataset/viewer'

  /* ── ESEA / FACEIT team link + live map stats ── */
  const faceitTeamId   = (folder as { faceit_team_id?: string | null }).faceit_team_id ?? null
  const faceitTeamName = (folder as { faceit_team_name?: string | null }).faceit_team_name ?? null
  let faceitStats: FaceitTeamStats | null = null
  if (faceitTeamId) {
    try {
      faceitStats = await getTeamStats(faceitTeamId)
    } catch {
      faceitStats = null  // FACEIT unreachable / no stats — fall back to demo-derived data
    }
  }

  const color    = teamColor(folder.opponent_display_name)
  const initials = getInitials(folder.opponent_display_name)
  const wrPct    = Math.round(winRate * 100)

  return (
    <div className="min-h-full">
      {/* ── top action bar ── */}
      <div className="border-b border-border/60 bg-card/40 backdrop-blur-sm px-4 md:px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
        <Link
          href="/opponents"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={14} />
          Opponents
        </Link>
        <div className="flex items-center gap-2 flex-wrap">
          {isOwnerOrAdmin && <DemoUploadButton teamId={teamId} />}
          {isOwnerOrAdmin && (
            <DeleteFolderButton folderId={folderId} opponentName={folder.opponent_display_name} />
          )}
          {primaryMap && (
            <a href={proRefUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="secondary" size="sm" className="gap-1.5 text-xs h-8">
                <ExternalLink size={12} />
                Pro Plays
              </Button>
            </a>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-6 py-5 space-y-5">

        {/* ── Team Header Card ── */}
        <div className="rv-panel relative p-5 overflow-hidden">
          <span className="rv-tick rv-tick-tl" />
          <span className="rv-tick rv-tick-br" style={{ borderColor: `color-mix(in srgb, ${color} 40%, transparent)` }} />
          {/* Accent top bar */}
          <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: `linear-gradient(90deg, ${color}, color-mix(in srgb, ${color} 0%, transparent) 70%)` }} />
          {/* Radial glow */}
          <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(600px 300px at 0% 0%, color-mix(in srgb, ${color} 8%, transparent), transparent 60%)` }} />

          <div className="relative flex flex-wrap items-center gap-5">
            {/* Avatar */}
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-black text-white shrink-0"
              style={{
                background: `linear-gradient(145deg, color-mix(in srgb, ${color} 28%, transparent), color-mix(in srgb, ${color} 12%, transparent))`,
                border: `2px solid color-mix(in srgb, ${color} 45%, transparent)`,
                boxShadow: `0 0 28px color-mix(in srgb, ${color} 20%, transparent), inset 0 1px 0 rgba(255,255,255,0.08)`,
              }}
            >
              {initials}
            </div>

            {/* Name + badges */}
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-black text-foreground leading-tight">{folder.opponent_display_name}</h1>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
                  {totalDemos} demo{totalDemos !== 1 ? 's' : ''} scouted
                </span>
                {wins > losses && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'color-mix(in srgb, var(--loss) 15%, transparent)', color: 'var(--loss)' }}>
                    THREAT
                  </span>
                )}
              </div>
            </div>

            {/* Quick action buttons */}
            <div className="flex items-center gap-2 shrink-0">
              <Link href={`/prep/${folderId}`}>
                <Button variant="secondary" size="sm" className="gap-1.5 h-9">
                  <FileText size={14} />
                  Match Prep
                </Button>
              </Link>
              <Link href={`/ai-coach?team=${teamId}&folder=${folderId}`}>
                <Button size="sm" className="gap-1.5 h-9" style={{ background: 'var(--accent)', color: '#fff', boxShadow: 'none' }}>
                  <Brain size={14} />
                  Anti-Strat
                </Button>
              </Link>
            </div>
          </div>

          {/* Stats grid */}
          <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-border/50">
            {[
              { label: 'DEMOS', value: totalDemos, icon: BarChart3, color: 'var(--signal)' },
              {
                label: 'WIN RATE',
                value: totalDemos > 0 ? `${wrPct}%` : '—',
                icon: TrendingUp,
                color: wrPct >= 55 ? 'var(--loss)' : wrPct >= 45 ? '#facc15' : 'var(--win)',
              },
              {
                label: 'BEST MAP',
                value: bestMap ? mapDisplayName(bestMap.map) : '—',
                icon: MapPin,
                color: 'var(--signal)',
              },
              {
                label: 'MAP WIN RATE',
                value: bestMap ? `${bestMap.winRate}%` : '—',
                icon: Trophy,
                color: bestMap && bestMap.winRate >= 55 ? 'var(--loss)' : '#facc15',
              },
            ].map(({ label, value, icon: Icon, color: c }) => (
              <div key={label} className="space-y-1">
                <p className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground flex items-center gap-1.5">
                  <Icon size={10} />
                  {label}
                </p>
                <p className="text-xl font-black font-mono leading-none" style={{ color: c }}>{value}</p>
                {label === 'WIN RATE' && wins + losses + draws > 0 && (
                  <p className="text-[10px] text-muted-foreground">{wins}W – {losses}L{draws > 0 ? ` – ${draws}D` : ''}</p>
                )}
                {label === 'BEST MAP' && bestMap && (
                  <p className="text-[10px] text-muted-foreground">{bestMap.total} match{bestMap.total !== 1 ? 'es' : ''}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Main layout ── */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">

          {/* Left: Demo list + panels */}
          <div className="lg:col-span-2 space-y-5">
            {faceitTeamId && (
              <EseaMatchList
                matchesUrl={`/api/opponents/${folderId}/faceit-matches`}
                uploadTeamId={teamId}
                demoType="opponent"
                opponentName={folder.opponent_display_name}
                isOwnerOrAdmin={isOwnerOrAdmin}
                uploadedMatchIds={(demos ?? []).map(d => d.faceit_match_id).filter((x): x is string => !!x)}
              />
            )}
            <div className="rv-panel overflow-hidden">
              <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-border/50">
                <Crosshair size={14} style={{ color: 'var(--signal)' }} />
                <h2 className="text-sm font-semibold text-foreground">Demo Recordings</h2>
                <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: 'color-mix(in srgb, var(--signal) 12%, transparent)', color: 'var(--signal)' }}>
                  {totalDemos}
                </span>
              </div>
              <div className="p-2">
                <OpponentDemoList
                  demos={(demos ?? []).map(d => ({ ...d, parsed_data: parsedByDemoId.get(d.id) ?? null }))}
                  folderId={folderId}
                  teamId={teamId}
                  isOwnerOrAdmin={isOwnerOrAdmin}
                  opponentDisplayName={folder.opponent_display_name}
                />
              </div>
            </div>

            {(demos ?? []).some(d => d.status === 'completed') && (
              <RoundSearchPanel folderId={folderId} opponentName={folder.opponent_display_name} />
            )}
            {(demos ?? []).some(d => d.status === 'completed') && (
              <RoutinesPanel folderId={folderId} opponentName={folder.opponent_display_name} />
            )}
          </div>

          {/* Right sidebar */}
          <div className="space-y-4">

            {/* Map Performance */}
            {mapEntries.length > 0 && (
              <div className="rv-panel p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <MapPin size={13} style={{ color: 'var(--signal)' }} />
                  <h2 className="text-sm font-semibold text-foreground">Map Performance</h2>
                  <span className="text-[10px] text-muted-foreground ml-1">opponent win rate</span>
                </div>
                <div className="space-y-2.5">
                  {mapEntries.slice(0, 7).map(({ map, winRate: wr, total }) => {
                    const c = wr >= 60 ? 'var(--loss)' : wr >= 40 ? '#facc15' : 'var(--win)'
                    return (
                      <div key={map}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            {MAP_THUMBS[map] && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={MAP_THUMBS[map]} alt={map} className="w-6 h-4 rounded object-cover opacity-70" />
                            )}
                            <span className="text-xs font-medium text-foreground">{mapDisplayName(map)}</span>
                            <span className="text-[10px] text-muted-foreground">{total}x</span>
                          </div>
                          <span className="text-xs font-bold font-mono" style={{ color: c }}>{wr}%</span>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${wr}%`, background: `linear-gradient(90deg, ${c}, color-mix(in srgb, ${c} 70%, transparent))` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Key Players */}
            <div className="rv-panel overflow-hidden">
              <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-border/50">
                <Target size={13} style={{ color: 'var(--signal)' }} />
                <h2 className="text-sm font-semibold text-foreground">Key Players</h2>
              </div>
              {topPlayers.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">
                  Player stats available after demos are analysed
                </p>
              ) : (
                <div className="divide-y divide-border/50">
                  {topPlayers.slice(0, 5).map((player, idx) => {
                    const ri = getPlayerRoleInfo(player)
                    return (
                      <div key={player.steam_id} className="flex items-center gap-3 px-4 py-3">
                        <span className={`text-xs font-bold w-4 text-center font-mono ${idx === 0 ? 'text-yellow-400' : 'text-muted-foreground'}`}>
                          #{idx + 1}
                        </span>
                        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                          style={{ background: `color-mix(in srgb, ${color} 18%, transparent)`, color }}>
                          {player.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <Link
                              href={`/opponents/${folderId}/player/${encodeURIComponent(player.name)}`}
                              className="text-xs font-medium text-foreground hover:text-[color:var(--signal)] transition-colors truncate"
                            >
                              {player.name}
                            </Link>
                            <span className={`text-[9px] font-bold px-1 py-0.5 rounded shrink-0 ${ri.color} ${ri.bg}`}>{ri.label}</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground">{player.kills}K {player.deaths}D · {player.adr.toFixed(0)} ADR</p>
                          {((player.entry_kills ?? 0) > 0 || (player.clutch_wins ?? 0) > 0 || (player.trade_kills ?? 0) > 0) && (
                            <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                              {(player.entry_kills ?? 0) > 0 && (
                                <span className="text-[9px] px-1 py-0.5 rounded font-semibold" style={{ background: 'color-mix(in srgb, #f97316 12%, transparent)', color: '#f97316' }}>
                                  {player.entry_kills}E
                                </span>
                              )}
                              {(player.clutch_wins ?? 0) > 0 && (
                                <span className="text-[9px] px-1 py-0.5 rounded font-semibold" style={{ background: 'color-mix(in srgb, #a855f7 12%, transparent)', color: '#a855f7' }}>
                                  {player.clutch_wins}/{player.clutch_attempts}C
                                </span>
                              )}
                              {(player.trade_kills ?? 0) > 0 && (
                                <span className="text-[9px] px-1 py-0.5 rounded font-semibold" style={{ background: 'color-mix(in srgb, #3b82f6 12%, transparent)', color: '#3b82f6' }}>
                                  {player.trade_kills}T
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`text-xs font-bold font-mono ${player.rating >= 1.2 ? 'text-red-400' : player.rating >= 1.0 ? 'text-yellow-400' : 'text-foreground'}`}>
                            {player.rating.toFixed(2)}
                          </span>
                          <p className="text-[9px] text-muted-foreground">rating</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* ESEA / FACEIT team link */}
            <EseaTeamLink
              endpoint={`/api/opponents/${folderId}/faceit-team`}
              initialTeamId={faceitTeamId}
              initialTeamName={faceitTeamName}
              isOwnerOrAdmin={isOwnerOrAdmin}
            />

            {/* FACEIT / ESEA map win rates (live from FACEIT) */}
            {faceitStats && faceitStats.maps.length > 0 && (
              <div className="rv-panel p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Trophy size={13} style={{ color: 'var(--signal)' }} />
                  <h2 className="text-sm font-semibold text-foreground">ESEA Map Form</h2>
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    {faceitStats.matches} matches · {Math.round(faceitStats.winRate)}% WR
                  </span>
                </div>
                <div className="space-y-2.5">
                  {faceitStats.maps.slice(0, 7).map(m => {
                    const wr = Math.round(m.winRate)
                    const c  = wr >= 60 ? 'var(--loss)' : wr >= 40 ? '#facc15' : 'var(--win)'
                    return (
                      <div key={m.label}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-foreground">{mapDisplayName(m.label)}</span>
                            <span className="text-[10px] text-muted-foreground">{m.matches}x</span>
                          </div>
                          <span className="text-xs font-bold font-mono" style={{ color: c }}>{wr}%</span>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${wr}%`, background: `linear-gradient(90deg, ${c}, color-mix(in srgb, ${c} 70%, transparent))` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Ban tendencies (veto donuts, live from FACEIT) */}
            {faceitTeamId && <VetoTendencies folderId={folderId} />}

            {/* Publish to Library */}
            {isOwnerOrAdmin && (
              <PublishToggle folderId={folderId} initialIsPublic={folder.is_public ?? false} />
            )}

            {/* Team Notes */}
            <TeamNotes teamId={teamId} folderId={folderId} currentUserId={user.id} />

            {/* AI Anti-Strat CTA */}
            <div className="rv-panel rv-insight p-4 relative">
              <span className="rv-tick rv-tick-tl" />
              <span className="rv-tick rv-tick-br" style={{ borderColor: 'color-mix(in srgb, var(--signal) 48%, transparent)' }} />
              <div className="flex items-start gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'color-mix(in srgb, var(--signal) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--signal) 25%, transparent)' }}>
                  <Brain size={16} style={{ color: 'var(--signal)' }} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Generate Anti-Strat</p>
                  <p className="text-xs text-muted-foreground mt-0.5">AI counter-strategies vs {folder.opponent_display_name}</p>
                </div>
              </div>
              <Link href={`/ai-coach?team=${teamId}&folder=${folderId}`} className="block">
                <button
                  className="w-full py-2 rounded-lg text-xs font-bold transition-all"
                  style={{ background: 'color-mix(in srgb, var(--signal) 15%, transparent)', color: 'var(--signal)', border: '1px solid color-mix(in srgb, var(--signal) 28%, transparent)' }}
                >
                  Scout with AI →
                </button>
              </Link>
            </div>

            {/* Pro reference */}
            {primaryMap && (
              <a
                href={proRefUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rv-panel p-3.5 group hover:border-blue-400/30 transition-colors block"
              >
                <div className="w-7 h-7 rounded bg-blue-500/10 flex items-center justify-center shrink-0">
                  <ExternalLink size={12} className="text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground">OpenCS2 Pro Dataset</p>
                  <p className="text-[10px] text-muted-foreground truncate">Pro matches on {mapDisplayName(primaryMap)}</p>
                </div>
                <ExternalLink size={11} className="text-muted-foreground group-hover:text-blue-400 shrink-0 transition-colors" />
              </a>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
