"use client";
import { useState } from 'react';
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
      <main className="flex-1 overflow-hidden relative">
        {renderView()}
      </main>
    </div>
  );
}
