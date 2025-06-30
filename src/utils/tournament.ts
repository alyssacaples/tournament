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

export function createTournamentBracket(participants: Participant[], seeded: boolean = false): Match[] {
  if (participants.length < 2) {
    throw new Error('At least 2 participants required');
  }

  // Sort participants by seed if seeded (participant order = seed rank)
  const orderedParticipants = seeded 
    ? [...participants] // Already in seed order
    : shuffleArray(participants); // Random order
  
  const totalParticipants = participants.length;
  const maxRounds = Math.ceil(Math.log2(totalParticipants));
  const matches: Match[] = [];
  
  // Calculate how many first round matches we need
  // If we have 10 participants, we need 6 first round matches (4 real matches + 2 byes)
  // This will leave us with 8 participants for round 2 (4 winners + 2 bye recipients + 2 who got byes)
  const nextPowerOf2 = Math.pow(2, maxRounds);
  const firstRoundByes = nextPowerOf2 - totalParticipants;
  const firstRoundMatches = (totalParticipants - firstRoundByes) / 2;
  const totalFirstRoundSlots = firstRoundMatches + firstRoundByes;
  
  // Create first round - distribute participants and byes
  let participantIndex = 0;
  
  // Create actual matches first
  for (let i = 0; i < firstRoundMatches; i++) {
    const participant1 = orderedParticipants[participantIndex++];
    const participant2 = orderedParticipants[participantIndex++];
    
    matches.push({
      id: `round-1-match-${i}`,
      participant1,
      participant2,
      winner: null,
      round: 1,
      position: i,
      status: 'pending'
    });
  }
  
  // Create bye matches (single participants who advance automatically)
  for (let i = 0; i < firstRoundByes; i++) {
    const participant = orderedParticipants[participantIndex++];
    
    matches.push({
      id: `round-1-match-${firstRoundMatches + i}`,
      participant1: participant,
      participant2: null,
      winner: participant,
      round: 1,
      position: firstRoundMatches + i,
      status: 'completed'
    });
  }
  
  // Create subsequent rounds (all will have exactly the right number of matches)
  let currentRoundSize = totalFirstRoundSlots;
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
  
  // Auto-advance winners from completed first round matches (bye recipients)
  const completedMatches = matches.filter(m => m.status === 'completed' && m.winner);
  
  for (const match of completedMatches) {
    advanceWinner(matches, match);
  }
  
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
