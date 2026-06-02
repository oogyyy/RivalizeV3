export interface Player {
  id: string;
  name: string;
  role: 'IGL' | 'AWP' | 'Rifler' | 'Support' | 'Entry';
  rating: number;
  kd: number;
  maps: number;
  form: ('W' | 'L')[];
  image?: string;
}

export interface Opponent {
  id: string;
  name: string;
  logo: string;
  region: string;
  level: number;
  demos: number;
  winRate: number;
  lastSeen: string;
  bestMap: string;
  bestMapWinRate: number;
}

export interface MapStat {
  name: string;
  ctWin: number;
  tWin: number;
  winRate?: number;
  status?: 'picked_us' | 'picked_them' | 'banned_us' | 'banned_them' | 'decider' | 'undecided';
}

export interface PlaybookItem {
  id: string;
  name: string;
  mapName: string;
  side: 'CT' | 'T';
  tags: string[];
  image: string;
  description: string;
  steps: string[];
  points: { x: number; y: number; label: string; type: 'smoke' | 'molotov' | 'flash' | 'player' }[];
}

export interface LineupItem {
  id: string;
  name: string;
  mapName: string;
  side: 'CT' | 'T';
  type: 'smoke' | 'flash' | 'molotov' | 'he';
  x: number;
  y: number;
  throwImg: string;
  landImg: string;
  instructions: string[];
  tags: string[];
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  time: string;
}

export interface TeamReminder {
  id: string;
  text: string;
  completed: boolean;
}

export interface VetoStep {
  step: number;
  action: 'ban' | 'pick' | 'decider';
  team: 'us' | 'opponent';
  mapName?: string;
  status: 'past' | 'current' | 'future';
}
