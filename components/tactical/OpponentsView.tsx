"use client";
import { useState } from 'react';
import { Search, Target, BarChart3, Globe, ChevronRight } from 'lucide-react';
import type { Opponent } from '@/types/tactical';
import { INITIAL_OPPONENTS } from '@/lib/tactical-data';

interface Props {
  onSeededScouting?: (name: string) => void;
}

function WinRateBadge({ rate }: { rate: number }) {
  const color = rate >= 65 ? 'text-brand-pink' : rate >= 55 ? 'text-amber-400' : 'text-emerald-400';
  return <span className={`font-mono font-bold text-sm ${color}`}>{rate}%</span>;
}

export default function OpponentsView({ onSeededScouting }: Props) {
  const [opponents] = useState<Opponent[]>(INITIAL_OPPONENTS);
  const [query, setQuery]       = useState('');
  const [selected, setSelected] = useState<Opponent | null>(null);

  const filtered = opponents.filter(o => o.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="h-full overflow-y-auto bg-brand-bg p-6 text-gray-100">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 pb-4 border-b border-brand-border/60">
        <div>
          <h1 className="text-2xl font-bold font-display text-white">Opponents</h1>
          <p className="text-xs text-gray-400 mt-0.5">Scout databases, win-rate profiles, and demo archives</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search opponents..."
            className="bg-brand-card border border-brand-border text-xs text-white placeholder-gray-500 rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:border-brand-purple/60 w-56"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Opponent cards */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 self-start">
          {filtered.map(o => (
            <button
              key={o.id}
              onClick={() => setSelected(o)}
              className={`text-left bg-brand-card rounded-xl border transition p-4 group ${
                selected?.id === o.id ? 'border-brand-purple' : 'border-brand-border/60 hover:border-brand-border'
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <img src={o.logo} alt={o.name} className="w-10 h-10 rounded-lg object-cover border border-brand-border/60" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{o.name}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Globe className="w-3 h-3 text-gray-500" />
                    <span className="text-[11px] text-gray-400 font-mono">{o.region}</span>
                    <span className="text-[11px] text-gray-500">· Lv {o.level}</span>
                  </div>
                </div>
                <ChevronRight className={`ml-auto w-4 h-4 text-gray-600 transition ${selected?.id === o.id ? 'text-brand-purple' : 'group-hover:text-gray-400'}`} />
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-brand-bg rounded-lg p-2 border border-brand-border/40">
                  <WinRateBadge rate={o.winRate} />
                  <div className="text-[9px] text-gray-500 mt-0.5">Win Rate</div>
                </div>
                <div className="bg-brand-bg rounded-lg p-2 border border-brand-border/40">
                  <div className="font-mono font-bold text-sm text-brand-cyan">{o.demos}</div>
                  <div className="text-[9px] text-gray-500 mt-0.5">Demos</div>
                </div>
                <div className="bg-brand-bg rounded-lg p-2 border border-brand-border/40">
                  <div className="font-mono font-bold text-sm text-brand-purple">{o.bestMapWinRate}%</div>
                  <div className="text-[9px] text-gray-500 mt-0.5">{o.bestMap}</div>
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-brand-border/40 flex items-center justify-between">
                <span className="text-[10px] text-gray-500 font-mono">Last seen: {o.lastSeen}</span>
                <span className="text-[10px] text-brand-pink font-mono">THREAT: {o.winRate > 62 ? 'HIGH' : o.winRate > 55 ? 'MED' : 'LOW'}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Detail panel */}
        <div className="space-y-4">
          {selected ? (
            <>
              <div className="bg-brand-card rounded-xl border border-brand-border/60 overflow-hidden">
                <div className="relative h-24 bg-gradient-to-br from-brand-purple/20 to-brand-card overflow-hidden">
                  <div className="absolute inset-0 opacity-10" style={{
                    backgroundImage: 'linear-gradient(rgba(112,71,235,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(112,71,235,0.3) 1px, transparent 1px)',
                    backgroundSize: '20px 20px',
                  }} />
                  <div className="absolute inset-0 bg-gradient-to-t from-brand-card to-transparent" />
                  <div className="absolute bottom-3 left-4 flex items-center gap-3">
                    <img src={selected.logo} alt={selected.name} className="w-10 h-10 rounded-lg object-cover border border-brand-border" />
                    <span className="text-sm font-bold font-display text-white">{selected.name}</span>
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  {[
                    { label: 'Region',           value: selected.region },
                    { label: 'Threat Level',     value: `Lv ${selected.level}` },
                    { label: 'Win Rate',         value: `${selected.winRate}%` },
                    { label: 'Demo Archive',     value: `${selected.demos} files` },
                    { label: 'Best Map',         value: `${selected.bestMap} (${selected.bestMapWinRate}%)` },
                    { label: 'Last Encountered', value: selected.lastSeen },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between text-xs">
                      <span className="text-gray-500">{label}</span>
                      <span className="text-gray-200 font-mono">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Map strengths */}
              <div className="bg-brand-card rounded-xl border border-brand-border/60 p-4">
                <div className="text-[11px] font-mono uppercase tracking-widest text-gray-400 mb-3">Map Danger</div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[11px] text-gray-300 mb-1">
                    <span className="font-semibold">{selected.bestMap}</span>
                    <span className="font-mono text-brand-pink">{selected.bestMapWinRate}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-brand-border overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-brand-pink to-brand-purple" style={{ width: `${selected.bestMapWinRate}%` }} />
                  </div>
                </div>
              </div>

              {/* Scout CTA */}
              <button
                onClick={() => onSeededScouting?.(selected.name)}
                className="w-full flex items-center justify-center gap-2 bg-brand-purple hover:bg-brand-purple-hover text-white font-semibold text-sm py-3 rounded-xl transition"
              >
                <Target className="w-4 h-4" />
                Scout with AI
              </button>

              <button className="w-full flex items-center justify-center gap-2 bg-brand-card border border-brand-border hover:border-brand-border/80 text-gray-300 text-sm py-2.5 rounded-xl transition">
                <BarChart3 className="w-4 h-4" />
                View Demo Archive
              </button>
            </>
          ) : (
            <div className="bg-brand-card rounded-xl border border-brand-border/60 p-8 flex flex-col items-center text-center">
              <Target className="w-8 h-8 text-gray-600 mb-3" />
              <p className="text-sm text-gray-500">Select an opponent to view detailed scout profile</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
