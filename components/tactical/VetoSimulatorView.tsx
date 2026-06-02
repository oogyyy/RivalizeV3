"use client";
import { useState } from 'react';
import { Sparkles, RefreshCw, X, Check } from 'lucide-react';

interface VetoMap {
  name: string;
  img: string;
  winRateUs: number;
  winRateThem: number;
  status: 'undecided' | 'banned_us' | 'banned_them' | 'picked_us' | 'picked_them' | 'decider';
}

const INITIAL_MAPS: VetoMap[] = [
  { name: 'Mirage',   winRateUs: 78, winRateThem: 40, img: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=300', status: 'undecided' },
  { name: 'Inferno',  winRateUs: 55, winRateThem: 62, img: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&q=80&w=300', status: 'undecided' },
  { name: 'Nuke',     winRateUs: 45, winRateThem: 71, img: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&q=80&w=300', status: 'undecided' },
  { name: 'Overpass', winRateUs: 64, winRateThem: 45, img: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&q=80&w=300', status: 'undecided' },
  { name: 'Ancient',  winRateUs: 60, winRateThem: 50, img: 'https://images.unsplash.com/photo-1552820728-8b83bb6b773f?auto=format&fit=crop&q=80&w=300', status: 'undecided' },
  { name: 'Vertigo',  winRateUs: 52, winRateThem: 58, img: 'https://images.unsplash.com/photo-1493723843671-1d655e66ac1c?auto=format&fit=crop&q=80&w=300', status: 'undecided' },
  { name: 'Anubis',   winRateUs: 71, winRateThem: 35, img: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&q=80&w=300', status: 'undecided' },
];

const STATUS_STYLE: Record<VetoMap['status'], string> = {
  undecided:   '',
  banned_us:   'opacity-40 grayscale',
  banned_them: 'opacity-40 grayscale',
  picked_us:   'ring-2 ring-brand-cyan',
  picked_them: 'ring-2 ring-brand-pink',
  decider:     'ring-2 ring-amber-400',
};

const STATUS_BADGE: Record<VetoMap['status'], { label: string; cls: string }> = {
  undecided:   { label: '',             cls: '' },
  banned_us:   { label: 'BANNED (US)',   cls: 'text-brand-pink border-brand-pink/40 bg-brand-pink/10' },
  banned_them: { label: 'BANNED (THEM)', cls: 'text-gray-400 border-brand-border bg-brand-card' },
  picked_us:   { label: 'OUR PICK',      cls: 'text-brand-cyan border-brand-cyan/40 bg-brand-cyan/10' },
  picked_them: { label: 'THEIR PICK',    cls: 'text-brand-pink border-brand-pink/40 bg-brand-pink/10' },
  decider:     { label: 'DECIDER',       cls: 'text-amber-400 border-amber-500/40 bg-amber-500/10' },
};

export default function VetoSimulatorView() {
  const [maps, setMaps]           = useState<VetoMap[]>(INITIAL_MAPS);
  const [actionType, setAction]   = useState<'ban' | 'pick'>('ban');
  const [stepCount, setStepCount] = useState(0);

  const worstForUs = [...maps]
    .filter(m => m.status === 'undecided')
    .sort((a, b) => a.winRateUs - b.winRateUs)[0];

  const bestForUs = [...maps]
    .filter(m => m.status === 'undecided')
    .sort((a, b) => b.winRateUs - a.winRateUs)[0];

  const handleAction = (mapName: string) => {
    setMaps(prev => prev.map(m =>
      m.name === mapName
        ? { ...m, status: actionType === 'ban' ? 'banned_us' : 'picked_us' }
        : m
    ));
    setStepCount(s => s + 1);
  };

  const reset = () => { setMaps(INITIAL_MAPS); setStepCount(0); };

  return (
    <div className="h-full overflow-y-auto bg-brand-bg p-6 text-gray-100">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 pb-4 border-b border-brand-border/60">
        <div>
          <h1 className="text-2xl font-bold font-display text-white">Veto Pick/Ban Simulator</h1>
          <p className="text-xs text-gray-400 mt-0.5">Interactive map veto with live AI win-rate recommendations</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-gray-500">Step {stepCount}</span>
          <button
            onClick={reset}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-card hover:bg-brand-border/60 border border-brand-border rounded-lg text-[11px] text-gray-300 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reset
          </button>
        </div>
      </div>

      {/* AI recommendation */}
      <div className="flex gap-3 items-start bg-brand-purple/10 border border-brand-purple/30 rounded-xl p-4 mb-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-brand-purple/5 to-transparent pointer-events-none" />
        <Sparkles className="w-5 h-5 text-brand-purple shrink-0 mt-0.5" />
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-brand-purple mb-1">AI Strategist</div>
          {worstForUs ? (
            <p className="text-xs text-gray-300">
              <span className="font-bold text-white">Recommend Ban: {worstForUs.name}</span>
              {' '}— Our win rate is only <span className="text-brand-pink font-mono">{worstForUs.winRateUs}%</span> vs their{' '}
              <span className="text-brand-pink font-mono">{worstForUs.winRateThem}%</span>. Neutralizing this map provides critical leverage.
            </p>
          ) : (
            <p className="text-xs text-gray-400">All maps resolved. Reset to run a new simulation.</p>
          )}
          {bestForUs && (
            <p className="text-xs text-gray-400 mt-1">
              Best pick candidate: <span className="text-brand-cyan font-semibold">{bestForUs.name}</span>{' '}
              (<span className="font-mono">{bestForUs.winRateUs}%</span> win rate for us).
            </p>
          )}
        </div>
      </div>

      {/* Action toggle */}
      <div className="flex items-center gap-2 mb-5">
        <span className="text-[11px] font-mono text-gray-500 uppercase tracking-widest">Your action:</span>
        {(['ban', 'pick'] as const).map(a => (
          <button
            key={a}
            onClick={() => setAction(a)}
            className={`px-4 py-1.5 text-[11px] font-mono uppercase rounded-lg border transition ${
              actionType === a
                ? a === 'ban'
                  ? 'bg-brand-pink/20 border-brand-pink text-brand-pink'
                  : 'bg-brand-cyan/20 border-brand-cyan text-brand-cyan'
                : 'bg-brand-card border-brand-border text-gray-400 hover:border-brand-border/80'
            }`}
          >
            {a}
          </button>
        ))}
      </div>

      {/* Map grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        {maps.map(m => {
          const badge  = STATUS_BADGE[m.status];
          const isLive = m.status === 'undecided';
          return (
            <div
              key={m.name}
              className={`bg-brand-card border border-brand-border rounded-xl overflow-hidden relative group transition ${STATUS_STYLE[m.status]}`}
            >
              <div className="relative">
                <img src={m.img} alt={m.name} className="w-full h-24 object-cover" />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-brand-card/90" />
                <span className="absolute bottom-2 left-2 text-xs font-bold text-white font-display">{m.name}</span>
              </div>

              <div className="p-3 text-xs">
                <div className="flex justify-between font-mono text-[10px] border-t border-brand-border/50 pt-2 mb-3">
                  <span className="text-emerald-400">US: {m.winRateUs}%</span>
                  <span className="text-brand-pink">THEM: {m.winRateThem}%</span>
                </div>

                {/* Win-rate bar */}
                <div className="h-1 rounded-full bg-brand-border overflow-hidden mb-3">
                  <div
                    className="h-full bg-gradient-to-r from-brand-cyan to-brand-purple rounded-full"
                    style={{ width: `${m.winRateUs}%` }}
                  />
                </div>

                {isLive ? (
                  <button
                    onClick={() => handleAction(m.name)}
                    className={`w-full text-[10px] uppercase font-mono font-bold py-1.5 transition rounded border text-center ${
                      actionType === 'ban'
                        ? 'bg-brand-pink/20 hover:bg-brand-pink/30 border-brand-pink/40 text-brand-pink'
                        : 'bg-brand-purple/20 hover:bg-brand-purple/30 border-brand-purple/40 text-brand-purple'
                    }`}
                  >
                    {actionType === 'ban' ? <><X className="inline w-2.5 h-2.5 mr-1" />Ban</> : <><Check className="inline w-2.5 h-2.5 mr-1" />Pick</>}
                  </button>
                ) : (
                  <span className={`block text-center font-mono text-[9px] uppercase tracking-widest py-1 rounded border ${badge.cls}`}>
                    {badge.label}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
