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

// Convert participant names to Participant objects
export function createParticipants(participantNames: string[]): Participant[] {
  return participantNames.map((name, index) => ({
    id: `participant-${index}`,
    name: name,
    visualId: index % SHAPE_COLOR_COMBOS.length // This ensures we cycle through available shapes
  }));
}



export const createTournamentBracket = (participants: Participant[], seeded: boolean = false): Match[] => {
  // Sort participants if seeded
if (participants.length < 2) {
    throw new Error('At least 2 participants required');
  }

  if (seeded) {
    participants.sort((a, b) => (a.seed || Infinity) - (b.seed || Infinity));
  }

  const numParticipants = participants.length;
  const rounds = Math.ceil(Math.log2(numParticipants));
  const totalMatches = Math.pow(2, rounds) - 1;
  
  const matches: Match[] = [];
  
  // Create all matches structure first
  for (let round = 0; round < rounds; round++) {
    const matchesInRound = Math.pow(2, rounds - round - 1);
    for (let position = 0; position < matchesInRound; position++) {
      matches.push({
        id: `${round}-${position}`,
        round,
        position,
        participant1: null, // Start with null participants for all matches
        participant2: null,
        winner: null,
        status: 'pending'
      });
    }
  }
  
  // Only populate first round with actual participants
  const firstRoundMatches = matches.filter(match => match.round === 0);
  for (let i = 0; i < firstRoundMatches.length; i++) {
    // Add first participant
    if (i * 2 < numParticipants) {
      firstRoundMatches[i].participant1 = participants[i * 2];
    }
    
    // Add second participant
    if (i * 2 + 1 < numParticipants) {
      firstRoundMatches[i].participant2 = participants[i * 2 + 1];
    }
    
    // Auto-advance single participant (bye match)
    if (firstRoundMatches[i].participant1 && !firstRoundMatches[i].participant2) {
      firstRoundMatches[i].winner = firstRoundMatches[i].participant1;
      firstRoundMatches[i].status = 'completed';
      
      // Find the next match this participant should advance to
      const nextRound = 1;
      const nextPosition = Math.floor(i / 2);
      const nextMatchIndex = matches.findIndex(m => 
        m.round === nextRound && m.position === nextPosition
      );
      
      if (nextMatchIndex !== -1) {
        // Place in correct slot based on position
        if (i % 2 === 0) {
          matches[nextMatchIndex].participant1 = firstRoundMatches[i].winner;
        } else {
          matches[nextMatchIndex].participant2 = firstRoundMatches[i].winner;
        }
      }
    }
  }
  
  return matches;
};

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
  // First, try to find next pending match in current round that has at least one participant
  let currentRoundMatches = matches.filter(m => 
    m.round === currentRound && 
    m.status === 'pending' && 
    (m.participant1 || m.participant2) // Must have at least one participant
  );
  
  if (currentRoundMatches.length > 0) {
    return currentRoundMatches[0];
  }
  
  // If no matches in current round, check if current round is complete
  // and look for next round with available matches
  const isCurrentRoundComplete = isRoundComplete(matches, currentRound);
  
  if (isCurrentRoundComplete) {
    // Look for next round with available matches
    const allRounds = Array.from(new Set(matches.map(m => m.round))).sort((a, b) => a - b);
    const maxRound = Math.max(...allRounds);
    
    for (let round = currentRound + 1; round <= maxRound; round++) {
      const roundMatches = matches.filter(m => 
        m.round === round && 
        m.status === 'pending' && 
        (m.participant1 || m.participant2)
      );
      
      if (roundMatches.length > 0) {
        return roundMatches[0];
      }
    }
  }
  
  return null;
}

export function getCurrentRound(matches: Match[]): number {
  // Find the current round by looking for the earliest round with pending matches
  const allRounds = Array.from(new Set(matches.map(m => m.round))).sort((a, b) => a - b);
  
  for (const round of allRounds) {
    const roundMatches = matches.filter(m => m.round === round);
    const hasPendingMatches = roundMatches.some(m => 
      m.status === 'pending' && (m.participant1 || m.participant2)
    );
    
    if (hasPendingMatches) {
      return round;
    }
  }
  
  // If no pending matches, return the highest round with completed matches
  const completedRounds = matches
    .filter(m => m.status === 'completed')
    .map(m => m.round);
    
  return completedRounds.length > 0 ? Math.max(...completedRounds) : 1;
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
  // A round is complete when all matches are either completed or are byes (no participants)
  return roundMatches.every(m => m.status === 'completed' || m.status === 'bye');
}

export function getMaxRounds(participantCount: number): number {
  return Math.ceil(Math.log2(participantCount));
}

export function formatRoundName(round: number, maxRounds: number): string {
  if (round === maxRounds) return 'Championship';
  if (round === maxRounds - 1) return 'Semi-Finals';
  if (round === maxRounds - 2) return 'Quarter-Finals';
  return `Round ${round}`;
}
