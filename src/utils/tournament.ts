import { Participant, Match, Tournament } from '@/types/tournament';
import { BREAKFAST_ITEMS, SHAPE_COLOR_COMBOS } from '@/data/constants';

export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function getNextPowerOfTwo(num: number): number {
  return Math.pow(2, Math.ceil(Math.log2(num)));
}

export function createTournamentBracket(participants: Participant[]): Match[] {
  const bracketSize = getNextPowerOfTwo(participants.length);
  const matches: Match[] = [];
  
  // Shuffle participants
  const shuffledParticipants = shuffleArray(participants);
  
  // Create first round matches
  const firstRoundMatches = bracketSize / 2;
  for (let i = 0; i < firstRoundMatches; i++) {
    const participant1 = shuffledParticipants[i * 2] || null;
    const participant2 = shuffledParticipants[i * 2 + 1] || null;
    
    const match: Match = {
      id: `round-1-match-${i}`,
      participant1,
      participant2,
      winner: null,
      round: 1,
      position: i,
      status: 'pending'
    };
    
    // Handle byes and single participants
    if (!participant1 && !participant2) {
      match.status = 'bye';
    } else if (!participant2 && participant1) {
      match.winner = participant1;
      match.status = 'completed';
    } else if (!participant1 && participant2) {
      match.winner = participant2;
      match.status = 'completed';
    }
    
    matches.push(match);
  }
  
  // Create subsequent rounds
  let currentRoundSize = firstRoundMatches;
  let roundNumber = 2;
  
  while (currentRoundSize > 1) {
    const nextRoundSize = currentRoundSize / 2;
    for (let i = 0; i < nextRoundSize; i++) {
      matches.push({
        id: `round-${roundNumber}-match-${i}`,
        participant1: null,
        participant2: null,
        winner: null,
        round: roundNumber,
        position: i,
        status: 'pending'
      });
    }
    currentRoundSize = nextRoundSize;
    roundNumber++;
  }
  
  // Auto-advance winners from completed first round matches
  matches.forEach(match => {
    if (match.round === 1 && match.status === 'completed' && match.winner) {
      advanceWinner(matches, match);
    }
  });
  
  return matches;
}

export function generateTestParticipants(count: number): Participant[] {
  const shuffledBreakfast = shuffleArray(BREAKFAST_ITEMS);
  const participants: Participant[] = [];
  
  for (let i = 0; i < Math.min(count, shuffledBreakfast.length); i++) {
    participants.push({
      id: `participant-${i}`,
      name: shuffledBreakfast[i],
      visualId: i % SHAPE_COLOR_COMBOS.length
    });
  }
  
  return participants;
}

export function parseParticipantInput(input: string): string[] {
  return input
    .split(/[,\n\r]+/)
    .map(name => name.trim())
    .filter(name => name.length > 0);
}

export function getNextMatch(matches: Match[], currentRound: number): Match | null {
  // Find next pending match in current round
  const currentRoundMatches = matches.filter(m => m.round === currentRound && m.status === 'pending');
  return currentRoundMatches[0] || null;
}

export function advanceWinner(matches: Match[], completedMatch: Match): Match[] {
  if (!completedMatch.winner) return matches;
  
  const nextRound = completedMatch.round + 1;
  const nextPosition = Math.floor(completedMatch.position / 2);
  
  const nextMatch = matches.find(m => m.round === nextRound && m.position === nextPosition);
  if (!nextMatch) return matches;
  
  // Determine if winner goes to participant1 or participant2 slot
  if (completedMatch.position % 2 === 0) {
    nextMatch.participant1 = completedMatch.winner;
  } else {
    nextMatch.participant2 = completedMatch.winner;
  }
  
  return matches;
}

export function isRoundComplete(matches: Match[], round: number): boolean {
  const roundMatches = matches.filter(m => m.round === round);
  return roundMatches.every(m => m.status === 'completed' || m.status === 'bye');
}

export function getMaxRounds(participantCount: number): number {
  return Math.log2(getNextPowerOfTwo(participantCount));
}

export function formatRoundName(round: number, maxRounds: number): string {
  if (round === maxRounds) return 'Championship';
  if (round === maxRounds - 1) return 'Semi-Finals';
  if (round === maxRounds - 2) return 'Quarter-Finals';
  return `Round ${round}`;
}

export function generateRandomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function createTournament(participants: Participant[]): Tournament {
  return {
    id: `tournament-${Date.now()}`,
    name: 'Anonymous Tournament',
    participants,
    matches: [],
    currentRound: 1,
    currentMatch: null,
    status: 'setup',
    roundDuration: 30
  };
}

export function setupTournament(tournament: Tournament): Tournament {
  const matches = createTournamentBracket(tournament.participants);
  return {
    ...tournament,
    matches,
    status: 'active'
  };
}

export function findNextActiveMatch(tournament: Tournament): Match | null {
  // Find first pending match that has both participants
  const pendingMatches = tournament.matches.filter(m => 
    m.status === 'pending' && 
    m.participant1 && 
    m.participant2
  );
  
  if (pendingMatches.length === 0) {
    // Check if there are any pending matches at all (for byes)
    const anyPending = tournament.matches.filter(m => m.status === 'pending');
    return anyPending.length > 0 ? anyPending[0] : null;
  }
  
  // Sort by round, then by position
  pendingMatches.sort((a, b) => {
    if (a.round !== b.round) return a.round - b.round;
    return a.position - b.position;
  });
  
  return pendingMatches[0];
}
