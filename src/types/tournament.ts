export interface Participant {
  id: string;
  name: string;
  visualId: number; // Index for shape/color combination
}

export interface Match {
  id: string;
  participant1: Participant | null;
  participant2: Participant | null;
  winner: Participant | null;
  round: number;
  position: number;
  status: 'pending' | 'active' | 'completed' | 'bye';
}

export interface Tournament {
  id: string;
  name: string;
  participants: Participant[];
  matches: Match[];
  currentRound: number;
  currentMatch: Match | null;
  status: 'setup' | 'active' | 'completed';
  roundDuration: number; // in seconds
  seeded: boolean; // Whether tournament uses seeding (participant order = seed rank)
}

export interface GameState {
  tournament: Tournament | null;
  mode: 'local' | 'test' | 'anonymous' | 'participant';
  timerRemaining: number;
  isTimerActive: boolean;
}

export interface ShapeColorCombo {
  id: number;
  shape: 'circle' | 'square' | 'triangle' | 'diamond' | 'hexagon' | 'star';
  fillColor: string;
  outlineColor: string;
}
