export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import type { AggregatedStats, PlayerStats, Round, Kill, GrenadeEvent } from '@/types/database'
import PrepPrintButton from './PrepPrintButton'
import { detectTacticalPatterns } from '@/lib/cs2-zones'
import AiBriefSection from '@/components/prep/AiBriefSection'

const MAP_LABELS: Record<string, string> = {
  de_dust2: 'Dust2', de_mirage: 'Mirage', de_inferno: 'Inferno', de_nuke: 'Nuke',
  de_overpass: 'Overpass', de_ancient: 'Ancient', de_anubis: 'Anubis', de_vertigo: 'Vertigo',
}

function fmtLabel(m: string) { return MAP_LABELS[m] ?? m }
function fmtPct(n: number) { return `${Math.round(n * 100)}%` }

type ParsedDemo = {
  header?: { map?: string; team1?: string; team2?: string; score_team1?: number; score_team2?: number }
  opponentSide?: string
  players?: PlayerStats[]
  rounds?: Round[]
}

export default async function PrepPage({ params }: { params: Promise<{ folderId: string }> }) {
  const { folderId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: folder } = await admin
    .from('team_folders')
    .select('*')
    .eq('id', folderId)
    .single()
  if (!folder) notFound()

  const teamId: string = folder.user_team_id

  const { data: membership } = await admin
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .single()
  if (!membership) redirect('/opponents')

  const stats = folder.aggregated_stats as AggregatedStats | null

  const { data: demos } = await admin
    .from('demos')
    .select('parsed_data, map')
    .eq('team_id', teamId)
    .eq('opponent_slug', folder.opponent_slug)
    .eq('demo_type', 'opponent')
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(10)

  const parsedDemos = (demos ?? [])
    .map(d => d.parsed_data as ParsedDemo | null)
    .filter(Boolean) as ParsedDemo[]

  // Top players (from aggregated stats or computed)
  let topPlayers: PlayerStats[] = stats?.top_players ?? []
  if (topPlayers.length === 0) {
    const playerMap: Record<string, PlayerStats & { count: number }> = {}
    for (const pd of parsedDemos) {
      const demoOpSide = pd.opponentSide ?? 'team2'
      const opponentTeamRaw = demoOpSide === 'team1' ? pd.header?.team1 : pd.header?.team2
      for (const p of pd.players ?? []) {
        if (p.team !== opponentTeamRaw && p.team !== (demoOpSide === 'team1' ? 'T-Side' : 'CT-Side')) continue
        if (!playerMap[p.steam_id]) { playerMap[p.steam_id] = { ...p, count: 1 } }
        else {
          const ex = playerMap[p.steam_id]
          ex.kills += p.kills; ex.deaths += p.deaths; ex.assists += p.assists
          ex.adr = (ex.adr * ex.count + p.adr) / (ex.count + 1)
          ex.rating = (ex.rating * ex.count + p.rating) / (ex.count + 1)
          ex.count++
        }
      }
    }
    topPlayers = Object.values(playerMap)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 5)
      .map(({ count: _c, ...p }) => p)
  }

  // Map stats
  const mapCounts: Record<string, number> = {}
  for (const pd of parsedDemos) {
    const m = pd.header?.map
    if (m) mapCounts[m] = (mapCounts[m] ?? 0) + 1
  }
  const sortedMaps = Object.entries(mapCounts).sort((a, b) => b[1] - a[1])
  const totalDemos = parsedDemos.length

  // Cross-demo tactical patterns
  const roundsByMap: Record<string, Round[][]> = {}
  for (const pd of parsedDemos) {
    const m = pd.header?.map
    if (!m || !pd.rounds || pd.rounds.length === 0) continue
    if (!roundsByMap[m]) roundsByMap[m] = []
    roundsByMap[m].push(pd.rounds)
  }

  const patterns: Array<{ map: string; text: string[] }> = []
  for (const [map, roundSets] of Object.entries(roundsByMap)) {
    if (roundSets.length < 2) continue
    const result = detectTacticalPatterns(roundSets, map)
    if (result.hasData) patterns.push({ map, text: result.text })
  }

  // Economy profile
  const allKills: Kill[] = parsedDemos.flatMap(pd => (pd.rounds ?? []).flatMap(r => r.kills ?? []))
  const allGrenades: GrenadeEvent[] = parsedDemos.flatMap(pd => (pd.rounds ?? []).flatMap(r => r.grenades ?? []))
  const hsRate = allKills.length > 0 ? allKills.filter(k => k.headshot).length / allKills.length : 0
  const grenByType: Record<string, number> = {}
  for (const g of allGrenades) grenByType[g.type] = (grenByType[g.type] ?? 0) + 1

  const wins = stats?.wins ?? 0
  const losses = stats?.losses ?? 0
  const winRate = stats?.win_rate ?? 0
  const avgRating = stats?.avg_rating ?? 0

  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <>
      {/* Print-only styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-break { page-break-before: always; }
          body { background: white !important; color: black !important; }
          .prep-report { color: black; background: white; padding: 0; }
          .prep-section { border: 1px solid #ddd !important; background: white !important; }
          .prep-tag { background: #f0f0f0 !important; color: black !important; }
          .prep-bar-bg { background: #e0e0e0 !important; }
        }
      `}</style>

      <div className="min-h-full bg-background prep-report">
        {/* Nav (hidden in print) */}
        <div className="no-print border-b border-border bg-card/50 backdrop-blur-sm">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <Link href={`/opponents/${folderId}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft size={15} />
              Back to {folder.opponent_display_name}
            </Link>
            <PrepPrintButton />
          </div>
        </div>

        {/* Report body */}
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-8 space-y-8">

          {/* Title */}
          <div className="border-b border-border pb-6">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-mono mb-2">Match Preparation Report</p>
                <h1 className="text-3xl font-bold text-foreground">
                  vs <span className="text-neon-green">{folder.opponent_display_name}</span>
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Generated {today} · {totalDemos} {totalDemos === 1 ? 'demo' : 'demos'} analysed
                </p>
              </div>
              <div className="no-print">
                <PrepPrintButton />
              </div>
            </div>
          </div>

          {/* AI Intelligence Brief */}
          <AiBriefSection
            folderId={folderId}
            cachedBrief={(folder.ai_brief as string | null) ?? null}
            updatedAt={(folder.ai_brief_updated_at as string | null) ?? null}
          />

          {/* Overview stats */}
          <section className="prep-section rounded-xl border border-border bg-card p-5">
            <h2 className="text-base font-semibold text-foreground mb-4">Overview</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Record', value: `${wins}W – ${losses}L`, sub: stats?.draws ? `${stats.draws}D` : undefined },
                { label: 'Win Rate', value: fmtPct(winRate), sub: 'from analysed demos' },
                { label: 'Avg Rating', value: avgRating > 0 ? avgRating.toFixed(2) : '—', sub: 'HLTV-style' },
                { label: 'Demos', value: String(totalDemos), sub: 'matches on file' },
              ].map(({ label, value, sub }) => (
                <div key={label} className="text-center p-3 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">{label}</p>
                  <p className="text-xl font-bold font-mono text-foreground">{value}</p>
                  {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
                </div>
              ))}
            </div>
          </section>

          {/* Player profiles */}
          {topPlayers.length > 0 && (
            <section className="prep-section rounded-xl border border-border bg-card p-5">
              <h2 className="text-base font-semibold text-foreground mb-4">Key Players</h2>
              <div className="space-y-3">
                {topPlayers.map((p, idx) => {
                  const role = p.headshot_percentage < 20 ? 'AWP'
                    : p.flash_assists >= 4 ? 'Support'
                    : p.kills >= 20 ? 'Entry' : 'Rifler'
                  const ratingColor = p.rating >= 1.2 ? 'text-neon-green' : p.rating >= 1.0 ? 'text-green-400' : 'text-yellow-400'
                  const kd = p.deaths > 0 ? (p.kills / p.deaths).toFixed(2) : '—'
                  return (
                    <div key={p.steam_id} className="flex items-center gap-4 p-3 rounded-lg bg-muted/20">
                      <span className="font-mono text-sm text-muted-foreground w-5 text-center">#{idx + 1}</span>
                      <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold">{p.name.charAt(0).toUpperCase()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground text-sm truncate">{p.name}</span>
                          <span className="prep-tag text-[9px] font-bold px-1.5 py-0.5 rounded bg-accent text-muted-foreground shrink-0">{role}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {p.kills}K / {p.deaths}D / {p.assists}A · ADR {p.adr.toFixed(0)} · K/D {kd} · HS {Math.round(p.headshot_percentage ?? 0)}%
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`text-base font-bold font-mono ${ratingColor}`}>{p.rating.toFixed(2)}</span>
                        <p className="text-[9px] text-muted-foreground">rating</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* Map tendencies */}
          {sortedMaps.length > 0 && (
            <section className="prep-section rounded-xl border border-border bg-card p-5">
              <h2 className="text-base font-semibold text-foreground mb-4">Map Tendencies</h2>
              <div className="space-y-3">
                {sortedMaps.map(([map, count]) => {
                  const pct = Math.round((count / Math.max(totalDemos, 1)) * 100)
                  return (
                    <div key={map}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-foreground">{fmtLabel(map)}</span>
                        <span className="text-xs text-muted-foreground font-mono">{count}x played ({pct}% of matches)</span>
                      </div>
                      <div className="prep-bar-bg h-2 bg-border rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-neon-green/70" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* Tactical patterns */}
          {patterns.length > 0 && (
            <section className="prep-section rounded-xl border border-border bg-card p-5">
              <h2 className="text-base font-semibold text-foreground mb-4">Execute Patterns</h2>
              <div className="space-y-5">
                {patterns.map(({ map, text }) => (
                  <div key={map}>
                    <h3 className="text-sm font-semibold text-neon-green mb-2">{fmtLabel(map)}</h3>
                    <ul className="space-y-1">
                      {text.map((line, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                          <span className="text-neon-green/60 mt-0.5 shrink-0">›</span>
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Economy & stats */}
          <section className="prep-section rounded-xl border border-border bg-card p-5">
            <h2 className="text-base font-semibold text-foreground mb-4">Combat Profile</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                { label: 'Headshot %', value: allKills.length > 0 ? fmtPct(hsRate) : '—', note: 'of all kills' },
                { label: 'Total Kills', value: allKills.length.toLocaleString(), note: 'across demos' },
                { label: 'Smoke Usage', value: grenByType['smoke']?.toLocaleString() ?? '—', note: 'total smokes thrown' },
                { label: 'HE Grenades', value: grenByType['he']?.toLocaleString() ?? '—', note: 'damage nades' },
                { label: 'Flash Usage', value: grenByType['flash']?.toLocaleString() ?? '—', note: 'flashbangs thrown' },
                { label: 'Molotovs', value: grenByType['molotov']?.toLocaleString() ?? '—', note: 'fire grenades' },
              ].map(({ label, value, note }) => (
                <div key={label} className="p-3 rounded-lg bg-muted/20 text-center">
                  <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                  <p className="text-lg font-bold font-mono text-foreground">{value}</p>
                  <p className="text-[10px] text-muted-foreground">{note}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Recommended counters */}
          <section className="prep-section rounded-xl border border-border bg-card p-5">
            <h2 className="text-base font-semibold text-foreground mb-4">Counter-Play Notes</h2>
            <div className="space-y-3 text-sm text-foreground/80">
              {hsRate > 0.55 && (
                <div className="flex gap-2"><span className="text-orange-400 shrink-0">›</span>
                  <span>High HS% ({fmtPct(hsRate)}) suggests aggressive peeker play — consider holding wider and using utility to force commitment before engagements.</span>
                </div>
              )}
              {hsRate < 0.35 && hsRate > 0 && (
                <div className="flex gap-2"><span className="text-blue-400 shrink-0">›</span>
                  <span>Low HS% ({fmtPct(hsRate)}) indicates AWP-heavy or spray-down style — pre-aiming common AWP positions and using flashes will be key.</span>
                </div>
              )}
              {(grenByType['smoke'] ?? 0) > (totalDemos * 15) && (
                <div className="flex gap-2"><span className="text-gray-400 shrink-0">›</span>
                  <span>Heavy smoke usage ({grenByType['smoke']} smokes across {totalDemos} demos) — expect well-coordinated execute setups; prepare retake utility.</span>
                </div>
              )}
              {(grenByType['molotov'] ?? 0) > (totalDemos * 5) && (
                <div className="flex gap-2"><span className="text-red-400 shrink-0">›</span>
                  <span>High molotov count ({grenByType['molotov']}) — they use fire to control plant areas; counter with bounce smokes and fast plant rotations.</span>
                </div>
              )}
              {winRate > 0.6 && (
                <div className="flex gap-2"><span className="text-yellow-400 shrink-0">›</span>
                  <span>Strong opponent ({fmtPct(winRate)} win rate) — prioritise economic advantage and avoid unnecessary fights; let them come to you CT-side.</span>
                </div>
              )}
              {winRate < 0.4 && winRate > 0 && (
                <div className="flex gap-2"><span className="text-neon-green shrink-0">›</span>
                  <span>Beatable opponent ({fmtPct(winRate)} win rate on file) — stay disciplined and don&apos;t give away easy rounds through over-aggression.</span>
                </div>
              )}
              {sortedMaps[0] && (
                <div className="flex gap-2"><span className="text-purple-400 shrink-0">›</span>
                  <span>Most played map: <strong>{fmtLabel(sortedMaps[0][0])}</strong> — expect comfort plays and well-rehearsed setups; use unpredictable timing and fake executes.</span>
                </div>
              )}
            </div>
          </section>

          {/* Footer */}
          <div className="text-center text-xs text-muted-foreground pt-4 border-t border-border">
            Generated by Rivalize · {today}
          </div>
        </div>
      </div>
    </>
  )
}
