"use client";
import { useState } from 'react';
import { Plus, MapPin } from 'lucide-react';
import type { PlaybookItem } from '@/types/tactical';
import { PLAYBOOK_ITEMS, MAPS_GRID } from '@/lib/tactical-data';

const POINT_COLORS: Record<PlaybookItem['points'][number]['type'], string> = {
  smoke:   'bg-slate-400 border-slate-200',
  molotov: 'bg-rose-500 border-rose-300',
  flash:   'bg-yellow-400 border-yellow-200',
  player:  'bg-brand-purple border-purple-400',
};

export default function PlaybookView() {
  const [plays, setPlays] = useState<PlaybookItem[]>(PLAYBOOK_ITEMS);
  const [mapFilter, setMapFilter]   = useState('All');
  const [sideFilter, setSideFilter] = useState<'All' | 'CT' | 'T'>('All');
  const [selected, setSelected]     = useState<PlaybookItem>(PLAYBOOK_ITEMS[0]);

  const filtered = plays.filter(p => {
    const mapOk  = mapFilter  === 'All' || p.mapName === mapFilter;
    const sideOk = sideFilter === 'All' || p.side    === sideFilter;
    return mapOk && sideOk;
  });

  return (
    <div className="h-full overflow-y-auto bg-brand-bg p-6 text-gray-100">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 pb-4 border-b border-brand-border/60">
        <div>
          <h1 className="text-2xl font-bold font-display text-white">Interactive Playbook</h1>
          <p className="text-xs text-gray-400 mt-0.5">Tactical coordinates mapped across active duty maps</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Map filter */}
          <select
            value={mapFilter}
            onChange={e => setMapFilter(e.target.value)}
            className="bg-brand-card border border-brand-border text-xs text-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-brand-purple/60"
          >
            <option value="All">All Maps</option>
            {MAPS_GRID.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          {/* Side filter */}
          {(['All', 'CT', 'T'] as const).map(s => (
            <button
              key={s}
              onClick={() => setSideFilter(s)}
              className={`px-3 py-1.5 text-[11px] font-mono uppercase rounded-lg border transition ${
                sideFilter === s
                  ? 'bg-brand-purple/20 border-brand-purple text-white'
                  : 'bg-brand-card border-brand-border text-gray-400 hover:border-brand-border/80'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sidebar list */}
        <div className="bg-brand-card rounded-xl border border-brand-border/60 p-4 space-y-2 self-start">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-mono uppercase tracking-widest text-gray-400">Tactics</span>
            <button className="flex items-center gap-1 text-[11px] text-brand-purple hover:text-brand-purple-hover transition">
              <Plus className="w-3.5 h-3.5" /> New
            </button>
          </div>

          {filtered.length === 0 && (
            <p className="text-xs text-gray-500 text-center py-4">No plays match filters.</p>
          )}

          {filtered.map(p => (
            <button
              key={p.id}
              onClick={() => setSelected(p)}
              className={`w-full text-left p-3 rounded-lg border transition ${
                selected.id === p.id
                  ? 'bg-brand-purple/15 border-brand-purple'
                  : 'border-brand-border/40 hover:bg-white/5'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-white">{p.name}</span>
                <span className="text-[9px] font-mono uppercase tracking-wider text-brand-pink">{p.mapName}</span>
              </div>
              <p className="text-[11px] text-gray-500 truncate">{p.description}</p>
              <div className="flex gap-1 mt-2 flex-wrap">
                {p.tags.map(t => (
                  <span key={t} className="text-[9px] font-mono px-1.5 py-0.5 bg-brand-border/60 text-gray-400 rounded">
                    {t}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>

        {/* Main board */}
        <div className="lg:col-span-2 space-y-4">
          {/* Header bar */}
          <div className="bg-brand-card rounded-2xl border border-brand-border/60 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-brand-border/40 bg-[#0d0f1a]">
              <div>
                <span className="text-[10px] uppercase font-mono tracking-widest text-brand-purple block mb-0.5">
                  Tactical Coordinates
                </span>
                <h3 className="text-sm font-bold text-white">{selected.name}</h3>
              </div>
              <span className={`px-3 py-1 text-[10px] font-mono tracking-widest uppercase rounded-full border ${
                selected.side === 'T'
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                  : 'bg-blue-500/15 border-blue-500/40 text-blue-400'
              }`}>
                {selected.side} Side
              </span>
            </div>

            {/* Map canvas */}
            <div className="relative aspect-video w-full bg-[#111322]">
              <img
                src={selected.image}
                alt={selected.mapName}
                className="absolute inset-0 w-full h-full object-cover opacity-30"
              />
              {/* Grid overlay */}
              <div className="absolute inset-0 opacity-10" style={{
                backgroundImage: 'linear-gradient(rgba(112,71,235,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(112,71,235,0.4) 1px, transparent 1px)',
                backgroundSize: '10% 10%',
              }} />

              {selected.points.map((pt, i) => (
                <div
                  key={i}
                  style={{ left: `${pt.x}%`, top: `${pt.y}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 group z-20 cursor-pointer"
                >
                  <div className={`w-4 h-4 rounded-full border-2 shadow-lg flex items-center justify-center ${POINT_COLORS[pt.type]}`}>
                    <span className="text-[8px] font-bold text-white">{i + 1}</span>
                  </div>
                  <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-gray-950/95 border border-brand-border px-2 py-1 rounded text-[10px] text-white font-mono whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none z-30 shadow-xl">
                    <span className="text-brand-cyan">{pt.type.toUpperCase()}</span> · {pt.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Steps + legend */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-brand-card rounded-xl border border-brand-border/60 p-4">
              <h4 className="text-[11px] font-mono uppercase tracking-widest text-gray-400 mb-3">Execution Steps</h4>
              <ol className="space-y-2">
                {selected.steps.map((s, i) => (
                  <li key={i} className="flex gap-2.5 text-xs text-gray-300 leading-relaxed">
                    <span className="w-5 h-5 shrink-0 rounded-full bg-brand-purple/20 border border-brand-purple/40 text-brand-purple text-[10px] flex items-center justify-center font-mono font-bold">
                      {i + 1}
                    </span>
                    {s}
                  </li>
                ))}
              </ol>
            </div>

            <div className="bg-brand-card rounded-xl border border-brand-border/60 p-4">
              <h4 className="text-[11px] font-mono uppercase tracking-widest text-gray-400 mb-3">Legend</h4>
              <div className="space-y-2">
                {(['smoke', 'flash', 'molotov', 'player'] as const).map(t => (
                  <div key={t} className="flex items-center gap-2 text-xs text-gray-400">
                    <div className={`w-3 h-3 rounded-full border ${POINT_COLORS[t]}`} />
                    <span className="capitalize font-mono">{t}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t border-brand-border/40">
                <p className="text-[11px] text-gray-500 leading-relaxed">{selected.description}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
