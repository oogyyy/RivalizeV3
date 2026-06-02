"use client";
import { useState } from 'react';
import { Crosshair, ChevronLeft, ChevronRight } from 'lucide-react';
import type { LineupItem } from '@/types/tactical';
import { LINEUPS_LIST, MAPS_GRID } from '@/lib/tactical-data';

const TYPE_STYLE: Record<LineupItem['type'], { cls: string; dot: string; label: string }> = {
  smoke:   { cls: 'text-slate-300 border-slate-500/40 bg-slate-500/10', dot: 'bg-slate-400', label: 'Smoke' },
  flash:   { cls: 'text-yellow-300 border-yellow-500/40 bg-yellow-500/10', dot: 'bg-yellow-400', label: 'Flash' },
  molotov: { cls: 'text-rose-300 border-rose-500/40 bg-rose-500/10', dot: 'bg-rose-500', label: 'Molotov' },
  he:      { cls: 'text-orange-300 border-orange-500/40 bg-orange-500/10', dot: 'bg-orange-400', label: 'HE Grenade' },
};

export default function LineupsView() {
  const [mapFilter, setMapFilter]   = useState('All');
  const [typeFilter, setTypeFilter] = useState<'all' | LineupItem['type']>('all');
  const [selected, setSelected]     = useState<LineupItem>(LINEUPS_LIST[0]);
  const [imgSlide, setImgSlide]     = useState<'throw' | 'land'>('throw');

  const filtered = LINEUPS_LIST.filter(l => {
    const mapOk  = mapFilter  === 'All' || l.mapName === mapFilter;
    const typeOk = typeFilter === 'all' || l.type === typeFilter;
    return mapOk && typeOk;
  });

  const ts = TYPE_STYLE[selected.type];

  return (
    <div className="h-full overflow-y-auto bg-brand-bg p-6 text-gray-100">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 pb-4 border-b border-brand-border/60">
        <div>
          <h1 className="text-2xl font-bold font-display text-white">Grenade Lineups</h1>
          <p className="text-xs text-gray-400 mt-0.5">Crosshair-precise throw and landing reference for all utility</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={mapFilter}
            onChange={e => setMapFilter(e.target.value)}
            className="bg-brand-card border border-brand-border text-xs text-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-brand-purple/60"
          >
            <option value="All">All Maps</option>
            {MAPS_GRID.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          {(['all', 'smoke', 'flash', 'molotov'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 text-[11px] font-mono uppercase rounded-lg border transition ${
                typeFilter === t
                  ? 'bg-brand-purple/20 border-brand-purple text-white'
                  : 'bg-brand-card border-brand-border text-gray-400 hover:border-brand-border/80'
              }`}
            >
              {t === 'all' ? 'All' : t}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* List */}
        <div className="space-y-2">
          <span className="text-[11px] font-mono uppercase tracking-widest text-gray-400">
            {filtered.length} Lineups
          </span>
          <div className="space-y-2 mt-2">
            {filtered.map(l => {
              const ts2 = TYPE_STYLE[l.type];
              return (
                <button
                  key={l.id}
                  onClick={() => { setSelected(l); setImgSlide('throw'); }}
                  className={`w-full text-left p-3 rounded-xl border transition ${
                    selected.id === l.id
                      ? 'bg-brand-purple/15 border-brand-purple'
                      : 'bg-brand-card border-brand-border/60 hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className={`w-2.5 h-2.5 rounded-full ${ts2.dot}`} />
                    <span className="text-xs font-semibold text-white">{l.name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-gray-500">{l.mapName} · {l.side}</span>
                    <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${ts2.cls}`}>
                      {ts2.label}
                    </span>
                  </div>
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {l.tags.map(t => (
                      <span key={t} className="text-[9px] font-mono px-1.5 py-0.5 bg-brand-border/60 text-gray-400 rounded">{t}</span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Detail */}
        <div className="lg:col-span-2 space-y-4">
          {/* Image viewer */}
          <div className="bg-brand-card rounded-2xl border border-brand-border/60 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-brand-border/40 bg-[#0d0f1a]">
              <div>
                <span className={`text-[10px] font-mono uppercase tracking-widest block mb-0.5 ${ts.cls.split(' ')[0]}`}>
                  {ts.label}
                </span>
                <h3 className="text-sm font-bold text-white">{selected.name}</h3>
              </div>
              <div className="flex gap-1 bg-brand-bg rounded-lg p-0.5 border border-brand-border/60">
                {(['throw', 'land'] as const).map(view => (
                  <button
                    key={view}
                    onClick={() => setImgSlide(view)}
                    className={`px-3 py-1.5 text-[11px] font-mono uppercase rounded-md transition ${
                      imgSlide === view ? 'bg-brand-purple text-white' : 'text-gray-400 hover:text-gray-300'
                    }`}
                  >
                    {view === 'throw' ? 'Throw Pos.' : 'Land Pos.'}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative aspect-video bg-[#111322]">
              <img
                src={imgSlide === 'throw' ? selected.throwImg : selected.landImg}
                alt={imgSlide}
                className="w-full h-full object-cover opacity-80"
              />
              {/* Nav arrows */}
              <button
                onClick={() => setImgSlide('throw')}
                disabled={imgSlide === 'throw'}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center disabled:opacity-20 hover:bg-black/80 transition"
              >
                <ChevronLeft className="w-4 h-4 text-white" />
              </button>
              <button
                onClick={() => setImgSlide('land')}
                disabled={imgSlide === 'land'}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center disabled:opacity-20 hover:bg-black/80 transition"
              >
                <ChevronRight className="w-4 h-4 text-white" />
              </button>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {(['throw', 'land'] as const).map(v => (
                  <span key={v} className={`w-6 h-1 rounded-full transition ${imgSlide === v ? 'bg-brand-purple' : 'bg-white/30'}`} />
                ))}
              </div>
              <div className="absolute top-3 left-3 text-[10px] font-mono uppercase tracking-widest text-white/70 bg-black/40 px-2 py-0.5 rounded">
                {imgSlide === 'throw' ? '← Throw Position' : 'Landing Zone →'}
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-brand-card rounded-xl border border-brand-border/60 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Crosshair className="w-4 h-4 text-brand-cyan" />
              <span className="text-[11px] font-mono uppercase tracking-widest text-gray-400">Execution Steps</span>
            </div>
            <ol className="space-y-2.5">
              {selected.instructions.map((step, i) => (
                <li key={i} className="flex gap-3 text-xs text-gray-300 leading-relaxed">
                  <span className="w-5 h-5 shrink-0 rounded-full bg-brand-cyan/15 border border-brand-cyan/30 text-brand-cyan text-[10px] flex items-center justify-center font-mono font-bold">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            <div className="mt-4 pt-3 border-t border-brand-border/40 flex flex-wrap gap-1.5">
              {selected.tags.map(t => (
                <span key={t} className="text-[10px] font-mono px-2 py-0.5 bg-brand-border/60 text-gray-400 rounded border border-brand-border/40">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
