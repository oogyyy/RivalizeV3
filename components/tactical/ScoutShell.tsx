"use client";
import { useState } from 'react';
import { FlaskConical } from 'lucide-react';
import Navigation, { type TabId } from './Navigation';
import DashboardView   from './DashboardView';
import MyTeamView      from './MyTeamView';
import OpponentsView   from './OpponentsView';
import MatchPrepView   from './MatchPrepView';
import PlaybookView    from './PlaybookView';
import LineupsView     from './LineupsView';
import VetoSimulatorView from './VetoSimulatorView';
import AIScoutView     from './AIScoutView';

interface Props {
  currentUser?: string;
}

export default function ScoutShell({ currentUser = 'Mikael' }: Props) {
  const [activeTab, setActiveTab]       = useState<TabId>('dashboard');
  const [scoutContext, setScoutContext]  = useState<string | undefined>(undefined);

  const handleSeededScouting = (opponentName: string) => {
    setScoutContext(opponentName);
    setActiveTab('ai-scout');
  };

  const handleTabChange = (tab: string) => {
    if (tab !== 'ai-scout') setScoutContext(undefined);
    setActiveTab(tab as TabId);
  };

  const renderView = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView currentUser={currentUser} onNavigate={handleTabChange} />;
      case 'match-prep':
        return <MatchPrepView onNavigate={handleTabChange} />;
      case 'playbook':
        return <PlaybookView />;
      case 'lineups':
        return <LineupsView />;
      case 'veto':
        return <VetoSimulatorView />;
      case 'ai-scout':
        return <AIScoutView initialSearchContext={scoutContext} />;
      case 'my-team':
        return <MyTeamView />;
      case 'opponents':
        return <OpponentsView onSeededScouting={handleSeededScouting} onNavigate={handleTabChange} />;
      default:
        return <DashboardView currentUser={currentUser} onNavigate={handleTabChange} />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-brand-bg text-gray-100">
      <Navigation
        activeTab={activeTab}
        onTabChange={handleTabChange}
        currentUser={currentUser}
        onLogout={() => handleTabChange('dashboard')}
      />
      <main className="flex-1 overflow-hidden relative flex flex-col">
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-amber-400 text-[11px] shrink-0">
          <FlaskConical size={12} className="shrink-0" />
          <span>
            <strong>Preview — sample data only.</strong>
            {' '}Stats, opponents, and match history shown here are not from your account.
            {' '}The Scout Hub will be connected to your real demos in a future update.
          </span>
        </div>
        <div className="flex-1 overflow-hidden">
          {renderView()}
        </div>
      </main>
    </div>
  );
}
