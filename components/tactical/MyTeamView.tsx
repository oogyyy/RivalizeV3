"use client";
import { useState } from 'react';
import { Shield, TrendingUp, Target, Star } from 'lucide-react';
import type { Player } from '@/types/tactical';
import { INITIAL_ROSTER } from '@/lib/tactical-data';

const ROLE_STYLE: Record<Player['role'], string> = {
  IGL:     'bg-brand-purple/20 text-brand-purple border-brand-purple/40',
  AWP:     'bg-brand-cyan/15 text-brand-cyan border-brand-cyan/30',
  Rifler:  'bg-blue-500/15 text-blue-400 border-blue-500/30',
  Support: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  Entry:   'bg-brand-pink/15 text-brand-pink border-brand-pink/30',
};

function FormPip({ result }: { result: 'W' | 'L' }) {
  return (
    <span className={`inline-flex w-5 h-5 items-center justify-center rounded text-[9px] font-mono font-bold ${
      result === 'W' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-brand-pink/20 text-brand-pink border border-brand-pink/30'
    }`}>
      {result}
    </span>
  );
}

function RatingBar({ value, max = 1.4 }: { value: number; max?: number }) {
  const pct = Math.min((value / max) * 100, 100);
  const color = value >= 1.1 ? 'from-emerald-500 to-brand-cyan' : value >= 0.95 ? 'from-brand-purple to-brand-cyan' : 'from-amber-500 to-brand-pink';
  return (
    <div className="h-1 rounded-full bg-brand-border overflow-hidden">
      <div className={`h-full rounded-full bg-gradient-to-r ${color} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function MyTeamView() {
  const [roster] = useState<Player[]>(INITIAL_ROSTER);
  const [selected, setSelected] = useState<Player>(INITIAL_ROSTER[0]);

  const avgRating = roster.reduce((a, p) => a + p.rating, 0) / roster.length;
  const totalMaps = roster[0].maps;
  const winStreaks = roster.filter(p => p.form.slice(-3).every(f => f === 'W')).length;

  return (
    <div className="h-full overflow-y-auto bg-brand-bg p-6 text-gray-100">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 pb-4 border-b border-brand-border/60">
        <div>
          <h1 className="text-2xl font-bold font-display text-white">My Team</h1>
          <p className="text-xs text-gray-400 mt-0.5">Squad roster, performance history, and role breakdown</p>
        </div>
        <div className="flex items-center gap-1.5 bg-brand-card border border-brand-border rounded-lg px-3 py-1.5">
          <Shield className="w-3.5 h-3.5 text-brand-purple" />
          <span className="text-xs font-mono text-gray-300">Season Active</span>
        </div>
      </div>

      {/* Team summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { icon: Target, label: 'Avg Rating', value: avgRating.toFixed(2), color: 'text-brand-cyan' },
          { icon: TrendingUp, label: 'Maps Played', value: String(totalMaps), color: 'text-brand-purple' },
          { icon: Star, label: 'Hot Streaks', value: `${winStreaks}/5`, color: 'text-amber-400' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-brand-card rounded-xl border border-brand-border/60 p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-brand-border/60 flex items-center justify-center">
              <Icon className={`w-4.5 h-4.5 ${color}`} />
            </div>
            <div>
              <div className={`text-lg font-mono font-bold ${color}`}>{value}</div>
              <div className="text-[11px] text-gray-500">{label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Roster list */}
        <div className="space-y-2">
          <h3 className="text-[11px] font-mono uppercase tracking-widest text-gray-400 mb-3">Roster</h3>
          {roster.map(p => (
            <button
              key={p.id}
              onClick={() => setSelected(p)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border transition ${
                selected.id === p.id
                  ? 'bg-brand-purple/15 border-brand-purple'
                  : 'bg-brand-card border-brand-border/60 hover:bg-white/5'
              }`}
            >
              <img
                src={p.image}
                alt={p.name}
                className="w-9 h-9 rounded-lg object-cover border border-brand-border/60"
              />
              <div className="flex-1 text-left min-w-0">
                <div className="text-sm font-semibold text-white">{p.name}</div>
                <span className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border ${ROLE_STYLE[p.role]}`}>
                  {p.role}
                </span>
              </div>
              <div className="text-right">
                <div className={`text-sm font-mono font-bold ${p.rating >= 1.1 ? 'text-emerald-400' : p.rating >= 0.95 ? 'text-gray-200' : 'text-brand-pink'}`}>
                  {p.rating.toFixed(2)}
                </div>
                <div className="text-[10px] text-gray-500">rating</div>
              </div>
            </button>
          ))}
        </div>

        {/* Player detail */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-brand-card rounded-2xl border border-brand-border/60 overflow-hidden">
            {/* Player hero */}
            <div className="relative h-32 bg-gradient-to-br from-brand-purple/20 to-brand-card overflow-hidden">
              <div className="absolute inset-0 opacity-10" style={{
                backgroundImage: 'linear-gradient(rgba(112,71,235,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(112,71,235,0.3) 1px, transparent 1px)',
                backgroundSize: '24px 24px',
              }} />
              <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-brand-card to-transparent" />
              <div className="absolute bottom-4 left-5 flex items-end gap-4">
                <img
                  src={selected.image}
                  alt={selected.name}
                  className="w-16 h-16 rounded-xl object-cover border-2 border-brand-purple/60 shadow-lg"
                />
                <div>
                  <div className="text-lg font-bold font-display text-white">{selected.name}</div>
                  <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${ROLE_STYLE[selected.role]}`}>
                    {selected.role}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-5">
              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-4 mb-5">
                {[
                  { label: 'Rating', value: selected.rating.toFixed(2), color: 'text-brand-cyan' },
                  { label: 'K/D',    value: selected.kd.toFixed(2),     color: 'text-brand-purple' },
                  { label: 'Maps',   value: String(selected.maps),       color: 'text-amber-400' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-brand-bg rounded-xl border border-brand-border/60 p-3 text-center">
                    <div className={`text-xl font-mono font-bold ${color}`}>{value}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">{label}</div>
                  </div>
                ))}
              </div>

              {/* Rating bar */}
              <div className="mb-5">
                <div className="flex justify-between text-[11px] text-gray-400 mb-1.5">
                  <span>Performance Rating</span>
                  <span className="font-mono">{selected.rating.toFixed(2)} / 1.40</span>
                </div>
                <RatingBar value={selected.rating} />
              </div>

              {/* Form */}
              <div>
                <div className="text-[11px] font-mono uppercase tracking-widest text-gray-400 mb-2">Recent Form</div>
                <div className="flex items-center gap-1.5">
                  {selected.form.map((r, i) => <FormPip key={i} result={r} />)}
                  <span className="ml-2 text-[11px] text-gray-500 font-mono">
                    {selected.form.filter(f => f === 'W').length}W – {selected.form.filter(f => f === 'L').length}L
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* All players form table */}
          <div className="bg-brand-card rounded-xl border border-brand-border/60 overflow-hidden">
            <div className="px-4 py-3 border-b border-brand-border/40">
              <span className="text-[11px] font-mono uppercase tracking-widest text-gray-400">Squad Form Overview</span>
            </div>
            <div className="divide-y divide-brand-border/30">
              {roster.map(p => (
                <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="text-xs font-semibold text-gray-200 w-20 truncate">{p.name}</span>
                  <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${ROLE_STYLE[p.role]} w-14 text-center`}>{p.role}</span>
                  <div className="flex gap-1 flex-1">
                    {p.form.map((r, i) => <FormPip key={i} result={r} />)}
                  </div>
                  <span className={`text-sm font-mono font-bold w-10 text-right ${p.rating >= 1.1 ? 'text-emerald-400' : p.rating >= 0.95 ? 'text-gray-200' : 'text-brand-pink'}`}>
                    {p.rating.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
