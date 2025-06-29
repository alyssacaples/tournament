import { AnonymousParticipant, AnonymousMatch, AnonymousTournament } from '@/types/interactive'
import { shuffleArray } from '@/utils/tournament'

export function createAnonymousTournamentBracket(participants: AnonymousParticipant[]): AnonymousMatch[] {
  if (participants.length < 2) {
    throw new Error('At least 2 participants required')
  }

  // Use the same fair bracket generation logic as the local tournament
  const orderedParticipants = shuffleArray(participants)
  const totalParticipants = participants.length
  const maxRounds = Math.ceil(Math.log2(totalParticipants))
  const matches: AnonymousMatch[] = []
  
  // Calculate how many first round matches we need
  const nextPowerOf2 = Math.pow(2, maxRounds)
  const firstRoundByes = nextPowerOf2 - totalParticipants
  const firstRoundMatches = (totalParticipants - firstRoundByes) / 2
  const totalFirstRoundSlots = firstRoundMatches + firstRoundByes
  
  // Create first round - distribute participants and byes
  let participantIndex = 0
  
  // Create actual matches first
  for (let i = 0; i < firstRoundMatches; i++) {
    const participant1 = orderedParticipants[participantIndex++]
    const participant2 = orderedParticipants[participantIndex++]
    
    matches.push({
      id: `round-1-match-${i}`,
      participant1,
      participant2,
      winner: null,
      round: 1,
      position: i,
      status: 'pending',
      votes: []
    })
  }
  
  // Create bye matches (single participants who advance automatically)
  for (let i = 0; i < firstRoundByes; i++) {
    const participant = orderedParticipants[participantIndex++]
    
    matches.push({
      id: `round-1-match-${firstRoundMatches + i}`,
      participant1: participant,
      participant2: null,
      winner: participant,
      round: 1,
      position: firstRoundMatches + i,
      status: 'completed',
      votes: []
    })
  }
  
  // Create subsequent rounds (all will have exactly the right number of matches)
  let currentRoundSize = totalFirstRoundSlots
  let roundNumber = 2
  
  while (currentRoundSize > 1) {
    const nextRoundSize = currentRoundSize / 2
    for (let i = 0; i < nextRoundSize; i++) {
      matches.push({
        id: `round-${roundNumber}-match-${i}`,
        participant1: null,
        participant2: null,
        winner: null,
        round: roundNumber,
        position: i,
        status: 'pending',
        votes: []
      })
    }
    currentRoundSize = nextRoundSize
    roundNumber++
  }
  
  // Auto-advance winners from completed first round matches (bye recipients)
  const completedMatches = matches.filter(m => m.status === 'completed' && m.winner)
  
  for (const match of completedMatches) {
    advanceAnonymousWinner(matches, match)
  }
  
  return matches
}

export function advanceAnonymousWinner(matches: AnonymousMatch[], completedMatch: AnonymousMatch): AnonymousMatch[] {
  if (!completedMatch.winner) return matches
  
  const nextRound = completedMatch.round + 1
  const nextPosition = Math.floor(completedMatch.position / 2)
  
  const nextMatch = matches.find(m => m.round === nextRound && m.position === nextPosition)
  if (!nextMatch) return matches
  
  // Determine if winner goes to participant1 or participant2 slot
  if (completedMatch.position % 2 === 0) {
    nextMatch.participant1 = completedMatch.winner
  } else {
    nextMatch.participant2 = completedMatch.winner
  }
  
  return matches
}

export function getNextAnonymousMatch(matches: AnonymousMatch[], currentRound: number): AnonymousMatch | null {
  // Find next pending match in current round that has at least one participant
  const currentRoundMatches = matches.filter(m => 
    m.round === currentRound && 
    m.status === 'pending' && 
    (m.participant1 || m.participant2) // Must have at least one participant
  )
  return currentRoundMatches[0] || null
}

export function isAnonymousRoundComplete(matches: AnonymousMatch[], round: number): boolean {
  const roundMatches = matches.filter(m => m.round === round)
  // A round is complete when all matches are either completed or are byes (no participants)
  return roundMatches.every(m => m.status === 'completed' || m.status === 'bye')
}

export function getAnonymousMaxRounds(participantCount: number): number {
  return Math.ceil(Math.log2(participantCount))
}
