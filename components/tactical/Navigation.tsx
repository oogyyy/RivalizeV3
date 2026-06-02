"use client";
import { LogOut, LayoutDashboard, Shield, Users, ClipboardList, BookOpen, Crosshair, Sword, Bot, ChevronRight } from 'lucide-react';

export type TabId =
  | 'dashboard'
  | 'match-prep'
  | 'playbook'
  | 'lineups'
  | 'veto'
  | 'ai-scout'
  | 'my-team'
  | 'opponents';

interface NavItem {
  id: TabId;
  label: string;
  icon: React.ElementType;
  group: string;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard',  label: 'Dashboard',    icon: LayoutDashboard, group: '01 Overview' },
  { id: 'my-team',    label: 'My Team',      icon: Shield,          group: '02 Roster' },
  { id: 'opponents',  label: 'Opponents',    icon: Users,           group: '03 Scout' },
  { id: 'ai-scout',   label: 'AI Scout',     icon: Bot,             group: '03 Scout', badge: 'LIVE' },
  { id: 'match-prep', label: 'Match Prep',   icon: ClipboardList,   group: '04 Prepare' },
  { id: 'veto',       label: 'Veto Sim',     icon: Sword,           group: '04 Prepare' },
  { id: 'playbook',   label: 'Playbook',     icon: BookOpen,        group: '04 Prepare' },
  { id: 'lineups',    label: 'Lineups',      icon: Crosshair,       group: '04 Prepare' },
];

const GROUPS = ['01 Overview', '02 Roster', '03 Scout', '04 Prepare'];

interface Props {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  currentUser: string;
  onLogout: () => void;
}

export default function Navigation({ activeTab, onTabChange, currentUser, onLogout }: Props) {
  return (
    <nav
      className="flex flex-col w-[220px] shrink-0 h-screen overflow-y-auto border-r border-brand-border/60"
      style={{ background: '#090b13' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-brand-border/40">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-purple to-[#5438c4] flex items-center justify-center shadow-md shrink-0">
          <span className="text-white text-[11px] font-bold font-mono">RV</span>
        </div>
        <div>
          <div className="text-sm font-bold font-display text-white tracking-wide">RIVALIZE</div>
          <div className="text-[9px] font-mono uppercase tracking-widest text-brand-cyan">Pro Scout</div>
        </div>
      </div>

      {/* Nav groups */}
      <div className="flex-1 py-4 px-3 space-y-5">
        {GROUPS.map(group => {
          const items = NAV_ITEMS.filter(n => n.group === group);
          return (
            <div key={group}>
              <div className="text-[9px] font-mono uppercase tracking-[0.18em] text-gray-600 px-2 mb-1.5">
                {group}
              </div>
              <div className="space-y-0.5">
                {items.map(item => {
                  const Icon    = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onTabChange(item.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                        isActive
                          ? 'bg-brand-purple/20 text-white'
                          : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                      }`}
                      style={isActive ? { boxShadow: 'inset 2px 0 0 #7047eb' } : undefined}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-brand-purple' : 'text-gray-500'}`} />
                      <span className="text-[13px] font-medium flex-1">{item.label}</span>
                      {item.badge && (
                        <span className="text-[8px] font-mono font-bold tracking-widest px-1.5 py-0.5 rounded bg-brand-cyan/15 text-brand-cyan border border-brand-cyan/30">
                          {item.badge}
                        </span>
                      )}
                      {isActive && <ChevronRight className="w-3 h-3 text-brand-purple opacity-60 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* User footer */}
      <div className="border-t border-brand-border/40 px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-purple/20 border border-brand-purple/30 flex items-center justify-center shrink-0">
            <span className="text-brand-purple text-[11px] font-bold font-mono">
              {currentUser.slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-white truncate">{currentUser}</div>
            <div className="text-[10px] text-gray-500 font-mono">Pro Scout</div>
          </div>
          <button
            onClick={onLogout}
            title="Logout"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-600 hover:text-brand-pink hover:bg-brand-pink/10 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </nav>
  );
}
