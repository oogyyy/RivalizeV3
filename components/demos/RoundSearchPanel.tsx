'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Search, Filter, ChevronDown, ChevronUp, Bomb, Skull, Shield, Sword } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface RoundResult {
  demo_id: string
  demo_map: string
  demo_opponent: string
  demo_date: string | null
  round: {
    number: number
    winner: string
    win_reason: string
    duration: number
    bomb_planted?: boolean
    bomb_defused?: boolean
    kills: Array<{ killer_name: string; victim_name: string; weapon: string; headshot: boolean }>
    opponent_side?: string
  }
  kill_count: number
  top_weapon: string | null
}

interface RoundSearchPanelProps {
  folderId: string
  opponentName: string
}

const WEAPONS = [
  { label: 'Any', value: '' },
  { label: 'AWP', value: 'awp' },
  { label: 'AK-47', value: 'ak47' },
  { label: 'M4', value: 'm4' },
  { label: 'Pistol', value: 'pistol' },
  { label: 'Knife', value: 'knife' },
]

const CS2_MAPS = [
  'de_dust2', 'de_mirage', 'de_inferno', 'de_nuke',
  'de_overpass', 'de_vertigo', 'de_ancient', 'de_anubis',
]

function winReasonLabel(reason: string): string {
  const map: Record<string, string> = {
    bomb_detonated: 'Bomb detonated',
    target_bombed: 'Bomb detonated',
    bomb_defused: 'Bomb defused',
    target_saved: 'Time ran out',
    terrorists_win: 'T eliminated CTs',
    counter_terrorists_win: 'CT eliminated Ts',
    hostage_rescued: 'Hostage rescued',
  }
  return map[reason] ?? reason.replace(/_/g, ' ')
}

export default function RoundSearchPanel({ folderId, opponentName }: RoundSearchPanelProps) {
  const [expanded, setExpanded] = useState(false)
  const [side, setSide] = useState('')
  const [outcome, setOutcome] = useState('')
  const [weapon, setWeapon] = useState('')
  const [bombPlanted, setBombPlanted] = useState('')
  const [mapFilter, setMapFilter] = useState('')
  const [minKills, setMinKills] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<RoundResult[] | null>(null)
  const [total, setTotal] = useState(0)

  async function handleSearch() {
    setLoading(true)
    try {
      const p = new URLSearchParams()
      if (side) p.set('side', side)
      if (outcome) p.set('outcome', outcome)
      if (weapon) p.set('weapon', weapon)
      if (bombPlanted) p.set('bomb_planted', bombPlanted)
      if (mapFilter) p.set('map', mapFilter)
      if (minKills) p.set('min_kills', minKills)
      const res = await fetch(`/api/opponents/${folderId}/rounds?${p}`)
      const data = await res.json()
      setResults(data.rounds ?? [])
      setTotal(data.total ?? 0)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Header toggle */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Search size={14} className="text-neon-green" />
          <span className="text-sm font-semibold text-foreground">Round Search</span>
          <span className="text-[10px] text-muted-foreground">across all demos</span>
        </div>
        {expanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="border-t border-border">
          {/* Filter controls */}
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {/* Side */}
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                  Opponent Side
                </label>
                <select
                  value={side}
                  onChange={e => setSide(e.target.value)}
                  className="w-full text-xs bg-background border border-border rounded-md px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-neon-green/50"
                >
                  <option value="">Any side</option>
                  <option value="T">T-side</option>
                  <option value="CT">CT-side</option>
                </select>
              </div>

              {/* Outcome */}
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                  Round Outcome
                </label>
                <select
                  value={outcome}
                  onChange={e => setOutcome(e.target.value)}
                  className="w-full text-xs bg-background border border-border rounded-md px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-neon-green/50"
                >
                  <option value="">Any outcome</option>
                  <option value="win">Opponent wins</option>
                  <option value="loss">Opponent loses</option>
                </select>
              </div>

              {/* Weapon */}
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                  Weapon Used
                </label>
                <select
                  value={weapon}
                  onChange={e => setWeapon(e.target.value)}
                  className="w-full text-xs bg-background border border-border rounded-md px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-neon-green/50"
                >
                  {WEAPONS.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
                </select>
              </div>

              {/* Bomb planted */}
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                  Bomb
                </label>
                <select
                  value={bombPlanted}
                  onChange={e => setBombPlanted(e.target.value)}
                  className="w-full text-xs bg-background border border-border rounded-md px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-neon-green/50"
                >
                  <option value="">Any</option>
                  <option value="true">Plant occurred</option>
                  <option value="false">No plant</option>
                </select>
              </div>

              {/* Map */}
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                  Map
                </label>
                <select
                  value={mapFilter}
                  onChange={e => setMapFilter(e.target.value)}
                  className="w-full text-xs bg-background border border-border rounded-md px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-neon-green/50"
                >
                  <option value="">Any map</option>
                  {CS2_MAPS.map(m => <option key={m} value={m}>{m.replace('de_', '')}</option>)}
                </select>
              </div>

              {/* Min kills */}
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                  Min Kills
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={minKills}
                  onChange={e => setMinKills(e.target.value)}
                  placeholder="Any"
                  className="w-full text-xs bg-background border border-border rounded-md px-2.5 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-neon-green/50"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="neon"
                size="sm"
                onClick={handleSearch}
                disabled={loading}
                className="gap-2"
              >
                <Filter size={12} />
                {loading ? 'Searching…' : 'Search Rounds'}
              </Button>
              {results !== null && (
                <span className="text-xs text-muted-foreground">
                  {total} round{total !== 1 ? 's' : ''} matched
                  {total > 100 && ' (showing top 100)'}
                </span>
              )}
            </div>
          </div>

          {/* Results */}
          {results !== null && (
            <div className="border-t border-border">
              {results.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                  No rounds match these filters.
                </div>
              ) : (
                <div className="divide-y divide-border/50 max-h-80 overflow-y-auto">
                  {results.map((r, idx) => (
                    <div key={`${r.demo_id}-${r.round.number}-${idx}`} className="px-4 py-3 hover:bg-accent/20 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-mono font-bold text-foreground">
                              R{r.round.number}
                            </span>
                            <span className={cn(
                              'text-[9px] font-bold px-1.5 py-0.5 rounded',
                              r.round.opponent_side === 'T' ? 'bg-orange-400/10 text-orange-400' : 'bg-blue-400/10 text-blue-400'
                            )}>
                              {r.round.opponent_side ?? '?'}
                            </span>
                            {r.round.bomb_planted && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-400/10 text-red-400 flex items-center gap-0.5">
                                <Bomb size={8} />
                                Plant
                              </span>
                            )}
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {r.demo_map.replace('de_', '')}
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {winReasonLabel(r.round.win_reason)} · {r.kill_count} kill{r.kill_count !== 1 ? 's' : ''}
                            {r.top_weapon && ` · top: ${r.top_weapon}`}
                          </p>
                          {r.demo_date && (
                            <p className="text-[9px] text-muted-foreground/60 mt-0.5">
                              {new Date(r.demo_date).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className={cn(
                            'text-[10px] font-semibold px-2 py-0.5 rounded',
                            r.round.winner.includes(r.demo_opponent)
                              ? 'bg-neon-green/10 text-neon-green'
                              : 'bg-red-400/10 text-red-400'
                          )}>
                            {r.round.winner.includes(r.demo_opponent) ? 'W' : 'L'}
                          </span>
                        </div>
                      </div>

                      {/* Top kills preview */}
                      {r.round.kills?.slice(0, 3).map((k, ki) => (
                        <div key={ki} className="flex items-center gap-1.5 mt-1 text-[10px] text-muted-foreground/70">
                          <Skull size={8} />
                          <span>{k.killer_name}</span>
                          <span className="text-muted-foreground/40">→</span>
                          <span>{k.victim_name}</span>
                          <span className="font-mono text-muted-foreground/50">({k.weapon})</span>
                          {k.headshot && <span className="text-orange-400/70">HS</span>}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
