"use client";
import { useState } from 'react';
import { CheckCircle2, Circle, Flag, Calendar, MapPin, Swords, ArrowRight } from 'lucide-react';
import type { TeamReminder, MapStat } from '@/types/tactical';
import { INITIAL_REMINDERS, MAPS_POOL } from '@/lib/tactical-data';

const STATUS_STYLE: Record<NonNullable<MapStat['status']>, { label: string; cls: string }> = {
  picked_us:   { label: 'OUR PICK',      cls: 'text-brand-cyan  border-brand-cyan/40  bg-brand-cyan/10' },
  picked_them: { label: 'THEIR PICK',    cls: 'text-brand-pink  border-brand-pink/40  bg-brand-pink/10' },
  banned_us:   { label: 'BANNED (US)',   cls: 'text-gray-500   border-brand-border   bg-brand-bg' },
  banned_them: { label: 'BANNED (THEM)', cls: 'text-gray-500   border-brand-border   bg-brand-bg' },
  decider:     { label: 'DECIDER',       cls: 'text-amber-400  border-amber-500/40   bg-amber-500/10' },
  undecided:   { label: 'UNDECIDED',     cls: 'text-gray-600   border-brand-border   bg-brand-bg' },
};

interface Props {
  onNavigate?: (tab: string) => void;
}

export default function MatchPrepView({ onNavigate }: Props) {
  const [reminders, setReminders] = useState<TeamReminder[]>(INITIAL_REMINDERS);
  const [maps] = useState<MapStat[]>(MAPS_POOL);

  const toggle = (id: string) =>
    setReminders(prev => prev.map(r => r.id === id ? { ...r, completed: !r.completed } : r));

  const completedCount = reminders.filter(r => r.completed).length;
  const progress = Math.round((completedCount / reminders.length) * 100);

  return (
    <div className="h-full overflow-y-auto bg-brand-bg p-6 text-gray-100">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 pb-4 border-b border-brand-border/60">
        <div>
          <h1 className="text-2xl font-bold font-display text-white">Match Preparation</h1>
          <p className="text-xs text-gray-400 mt-0.5">Checklists, tactical plans, and veto layout for your next match</p>
        </div>
        <div className="flex items-center gap-2 bg-brand-card border border-brand-border rounded-lg px-3 py-1.5">
          <Calendar className="w-3.5 h-3.5 text-brand-purple" />
          <span className="text-xs font-mono text-gray-300">Match Day</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="space-y-4">
          {/* Match card */}
          <div className="bg-brand-card border border-brand-purple/30 rounded-xl overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-brand-purple/10 to-transparent pointer-events-none" />
            <div className="relative p-4">
              <div className="text-[10px] font-mono uppercase tracking-widest text-brand-purple mb-2">Next Match</div>
              <div className="flex items-center gap-2 mb-1">
                <Swords className="w-4 h-4 text-brand-pink" />
                <span className="text-sm font-bold text-white">vs Aurora Gaming</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                <MapPin className="w-3 h-3" />
                <span>ESL Pro League · Best of 3</span>
              </div>
              <div className="mt-3 pt-3 border-t border-brand-border/40">
                <div className="flex justify-between text-[11px]">
                  <span className="text-gray-500">Prep Progress</span>
                  <span className="font-mono text-brand-cyan">{completedCount}/{reminders.length} tasks</span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-brand-border overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-brand-purple to-brand-cyan transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Checklist */}
          <div className="bg-brand-card rounded-xl border border-brand-border/60 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-mono uppercase tracking-widest text-gray-400">Team Reminders</span>
              <span className="text-[11px] font-mono text-brand-cyan">{progress}%</span>
            </div>
            <div className="space-y-2">
              {reminders.map(r => (
                <button
                  key={r.id}
                  onClick={() => toggle(r.id)}
                  className="w-full flex items-center gap-3 text-left p-2.5 rounded-lg hover:bg-white/5 transition group"
                >
                  {r.completed
                    ? <CheckCircle2 className="w-4 h-4 text-brand-cyan shrink-0" />
                    : <Circle className="w-4 h-4 text-gray-600 group-hover:text-gray-400 shrink-0" />}
                  <span className={`text-xs leading-snug transition ${r.completed ? 'text-gray-500 line-through' : 'text-gray-200'}`}>
                    {r.text}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Middle: Map pool veto layout */}
        <div className="space-y-4">
          <div className="bg-brand-card rounded-xl border border-brand-border/60 p-4">
            <div className="text-[11px] font-mono uppercase tracking-widest text-gray-400 mb-3">Map Veto Status</div>
            <div className="space-y-2">
              {maps.map(m => {
                const s = STATUS_STYLE[m.status ?? 'undecided'];
                const isActive = m.status === 'picked_us' || m.status === 'picked_them' || m.status === 'decider';
                return (
                  <div
                    key={m.name}
                    className={`flex items-center justify-between p-2.5 rounded-lg border transition ${
                      isActive ? 'border-brand-border/60 bg-brand-bg' : 'border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <MapPin className={`w-3.5 h-3.5 ${isActive ? 'text-brand-purple' : 'text-gray-600'}`} />
                      <span className={`text-xs font-semibold ${isActive ? 'text-white' : 'text-gray-500 line-through'}`}>
                        {m.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {m.winRate !== undefined && isActive && (
                        <span className="text-[10px] font-mono text-gray-400">{m.winRate}%</span>
                      )}
                      <span className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded border ${s.cls}`}>
                        {s.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Map win rates */}
          <div className="bg-brand-card rounded-xl border border-brand-border/60 p-4">
            <div className="text-[11px] font-mono uppercase tracking-widest text-gray-400 mb-3">Map Win Rates</div>
            <div className="space-y-3">
              {maps.filter(m => m.winRate !== undefined).map(m => (
                <div key={m.name}>
                  <div className="flex justify-between text-[11px] text-gray-300 mb-1">
                    <span>{m.name}</span>
                    <span className="font-mono">{m.winRate}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-brand-border overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${(m.winRate ?? 0) >= 65 ? 'from-emerald-500 to-brand-cyan' : (m.winRate ?? 0) >= 50 ? 'from-brand-purple to-brand-cyan' : 'from-brand-pink to-brand-purple'}`}
                      style={{ width: `${m.winRate}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Focus plan */}
        <div className="space-y-4">
          <div className="bg-brand-card rounded-xl border border-brand-border/60 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Flag className="w-4 h-4 text-brand-pink" />
              <span className="text-[11px] font-mono uppercase tracking-widest text-gray-400">Tactical Focus</span>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Priority Pick',   value: 'Mirage', note: '78% win rate, high confidence' },
                { label: 'Target Ban',      value: 'Nuke',   note: 'Opponent 71% — eliminate immediately' },
                { label: 'CT Focus',        value: 'B-site', note: 'Inferno B stack after pistol' },
                { label: 'T-Side Strat',    value: 'Mid Control', note: 'Mirage window smoke + aggro' },
                { label: 'Eco Plan',        value: 'Force MP9s', note: 'A-push with smokes on loss' },
              ].map(({ label, value, note }) => (
                <div key={label} className="p-3 rounded-lg bg-brand-bg border border-brand-border/40">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-gray-500 mb-0.5">{label}</div>
                  <div className="text-sm font-semibold text-white">{value}</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">{note}</div>
                </div>
              ))}
            </div>
          </div>

          {onNavigate && (
          <button
            onClick={() => onNavigate('veto')}
            className="w-full flex items-center justify-center gap-2 bg-brand-purple/20 hover:bg-brand-purple/30 border border-brand-purple/40 text-brand-purple text-sm font-semibold py-2.5 rounded-xl transition"
          >
            <Swords className="w-4 h-4" /> Launch Veto Simulator
            <ArrowRight className="w-4 h-4 ml-1" />
          </button>
        )}

        <div className="bg-brand-card rounded-xl border border-brand-border/60 p-4">
            <div className="text-[11px] font-mono uppercase tracking-widest text-gray-400 mb-3">Side Win Rates</div>
            {[
              { side: 'CT Side', ct: 58, t: 42 },
              { side: 'T Side',  ct: 42, t: 58 },
            ].map(({ side, ct, t }) => (
              <div key={side} className="mb-3 last:mb-0">
                <div className="text-[11px] text-gray-400 mb-1.5">{side}</div>
                <div className="flex gap-1 h-2">
                  <div className="rounded-l bg-blue-500/70" style={{ width: `${ct}%` }} />
                  <div className="rounded-r bg-amber-500/70" style={{ width: `${t}%` }} />
                </div>
                <div className="flex justify-between text-[9px] font-mono text-gray-500 mt-1">
                  <span className="text-blue-400">CT {ct}%</span>
                  <span className="text-amber-400">T {t}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
