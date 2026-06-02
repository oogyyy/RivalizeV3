"use client";
import { useState } from 'react';
import { BarChart3, Target, TrendingUp, Swords, ArrowRight, ChevronRight, Activity } from 'lucide-react';
import { INITIAL_ROSTER, MAPS_POOL, INITIAL_OPPONENTS, INITIAL_REMINDERS } from '@/lib/tactical-data';

const RECENT_DEMOS = [
  { id: 1, map: 'Mirage',   vs: 'FaZe Clan',    result: 'W', score: '16–9',  date: 'Today' },
  { id: 2, map: 'Inferno',  vs: 'G2 Esports',   result: 'L', score: '11–16', date: 'Yesterday' },
  { id: 3, map: 'Ancient',  vs: 'Team Liquid',   result: 'W', score: '16–12', date: '2 days ago' },
  { id: 4, map: 'Nuke',     vs: 'MOUZ',          result: 'L', score: '13–16', date: '3 days ago' },
  { id: 5, map: 'Overpass', vs: 'Vitality',      result: 'W', score: '16–11', date: '4 days ago' },
];

function StatCard({ label, value, delta, color }: { label: string; value: string; delta?: string; color: string }) {
  return (
    <div className={`bg-brand-card rounded-xl border border-brand-border/60 p-4 stat-card-${color} relative overflow-hidden`}>
      <div className="text-[11px] text-gray-400 mb-1">{label}</div>
      <div className={`text-2xl font-mono font-bold ${
        color === 'pink' ? 'text-brand-pink' : color === 'teal' ? 'text-brand-cyan' : color === 'purple' ? 'text-brand-purple' : 'text-amber-400'
      }`}>
        {value}
      </div>
      {delta && (
        <div className="text-[10px] text-emerald-400 font-mono mt-1">↑ {delta}</div>
      )}
    </div>
  );
}

interface Props {
  currentUser?: string;
  onNavigate?: (tab: string) => void;
}

export default function DashboardView({ currentUser = 'Coach', onNavigate }: Props) {
  const pendingReminders = INITIAL_REMINDERS.filter(r => !r.completed).length;
  const topPlayer = INITIAL_ROSTER[0];
  const nextOpp   = INITIAL_OPPONENTS[0];

  return (
    <div className="h-full overflow-y-auto bg-brand-bg p-6 text-gray-100">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 pb-4 border-b border-brand-border/60">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-widest text-gray-500 mb-0.5">Welcome back</p>
          <h1 className="text-2xl font-bold font-display text-white">{currentUser}</h1>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-mono text-brand-cyan bg-brand-cyan/10 border border-brand-cyan/30 rounded-lg px-3 py-1.5">
          <Activity className="w-3.5 h-3.5" />
          <span>Live Tracking</span>
        </div>
      </div>

      {/* Stat overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Team Win Rate"   value="64%"  delta="4% this week" color="teal" />
        <StatCard label="Avg Rating"      value="1.10" delta="0.05 vs last"  color="purple" />
        <StatCard label="Maps Analyzed"   value="84"                         color="pink" />
        <StatCard label="Prep Tasks"      value={`${pendingReminders} left`}  color="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Map win rates */}
        <div className="space-y-4">
          <div className="bg-brand-card rounded-xl border border-brand-border/60 p-4">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-brand-purple" />
              <span className="text-[11px] font-mono uppercase tracking-widest text-gray-400">Map Win Rates</span>
            </div>
            <div className="space-y-3">
              {MAPS_POOL.filter(m => m.winRate !== undefined).map(m => (
                <div key={m.name}>
                  <div className="flex justify-between text-[11px] text-gray-300 mb-1">
                    <div className="flex items-center gap-2">
                      <span>{m.name}</span>
                      {m.status && m.status !== 'undecided' && (
                        <span className={`text-[9px] font-mono px-1 rounded ${
                          m.status === 'picked_us' ? 'text-brand-cyan bg-brand-cyan/10' :
                          m.status === 'picked_them' ? 'text-brand-pink bg-brand-pink/10' :
                          'text-gray-600 bg-brand-border/40'
                        }`}>
                          {m.status.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                    <span className="font-mono">{m.winRate}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-brand-border overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r transition-all ${
                        (m.winRate ?? 0) >= 70 ? 'from-emerald-500 to-brand-cyan' :
                        (m.winRate ?? 0) >= 55 ? 'from-brand-purple to-brand-cyan' :
                        'from-brand-pink to-brand-purple'
                      }`}
                      style={{ width: `${m.winRate}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] font-mono text-gray-600 mt-0.5">
                    <span className="text-blue-400">CT {m.ctWin}%</span>
                    <span className="text-amber-500">T {m.tWin}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Next opponent */}
          <div className="bg-brand-card border border-brand-purple/30 rounded-xl p-4 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-brand-purple/10 to-transparent pointer-events-none" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <Swords className="w-4 h-4 text-brand-pink" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-gray-400">Next Match</span>
              </div>
              <div className="flex items-center gap-3">
                <img src={nextOpp.logo} alt={nextOpp.name} className="w-10 h-10 rounded-lg object-cover border border-brand-border" />
                <div>
                  <div className="text-sm font-bold text-white">{nextOpp.name}</div>
                  <div className="text-[11px] text-gray-400">Win Rate: <span className="text-brand-pink font-mono">{nextOpp.winRate}%</span></div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-brand-border/40">
                <div className="text-[11px] text-gray-400">
                  Their best map: <span className="text-white font-semibold">{nextOpp.bestMap}</span>
                  <span className="text-brand-pink font-mono ml-1">({nextOpp.bestMapWinRate}%)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Middle: Recent demos */}
        <div className="space-y-4">
          <div className="bg-brand-card rounded-xl border border-brand-border/60 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-brand-border/40">
              <Target className="w-4 h-4 text-brand-cyan" />
              <span className="text-[11px] font-mono uppercase tracking-widest text-gray-400">Recent Demos</span>
            </div>
            <div className="divide-y divide-brand-border/30">
              {RECENT_DEMOS.map(d => (
                <div key={d.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition rv-row group">
                  <span className={`w-6 h-6 shrink-0 rounded text-[10px] font-mono font-bold flex items-center justify-center ${
                    d.result === 'W' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-brand-pink/20 text-brand-pink border border-brand-pink/30'
                  }`}>
                    {d.result}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-white">{d.map}</div>
                    <div className="text-[11px] text-gray-500">vs {d.vs}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-mono text-gray-200">{d.score}</div>
                    <div className="text-[10px] text-gray-600">{d.date}</div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-600 group-hover:text-gray-400 transition" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Roster snapshot */}
        <div className="space-y-4">
          <div className="bg-brand-card rounded-xl border border-brand-border/60 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-brand-border/40">
              <TrendingUp className="w-4 h-4 text-brand-purple" />
              <span className="text-[11px] font-mono uppercase tracking-widest text-gray-400">Roster Ratings</span>
            </div>
            <div className="divide-y divide-brand-border/30">
              {INITIAL_ROSTER.map(p => (
                <div key={p.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition rv-row">
                  <img src={p.image} alt={p.name} className="w-7 h-7 rounded-lg object-cover border border-brand-border/60" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-white">{p.name}</div>
                    <div className="text-[10px] text-gray-500 font-mono">{p.role}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {p.form.slice(-3).map((f, i) => (
                      <span key={i} className={`w-4 h-4 rounded text-[8px] font-mono flex items-center justify-center ${
                        f === 'W' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-brand-pink/20 text-brand-pink'
                      }`}>{f}</span>
                    ))}
                  </div>
                  <span className={`text-sm font-mono font-bold w-10 text-right ${
                    p.rating >= 1.1 ? 'text-emerald-400' : p.rating >= 0.95 ? 'text-gray-200' : 'text-brand-pink'
                  }`}>
                    {p.rating.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick actions */}
          <div className="bg-brand-card rounded-xl border border-brand-border/60 p-4">
            <div className="text-[11px] font-mono uppercase tracking-widest text-gray-400 mb-3">Quick Actions</div>
            <div className="space-y-2">
              {([
                { label: 'Run Veto Simulation', tab: 'veto' },
                { label: 'Scout Next Opponent', tab: 'opponents' },
                { label: 'Review Playbook',      tab: 'playbook' },
              ] as const).map(({ label, tab }) => (
                <button
                  key={label}
                  onClick={() => onNavigate?.(tab)}
                  className="w-full flex items-center justify-between px-3 py-2.5 bg-brand-bg border border-brand-border/60 hover:border-brand-border rounded-lg text-xs text-gray-300 hover:text-white transition group"
                >
                  <span>{label}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-gray-600 group-hover:text-gray-300 transition" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
