export interface AnonymousTournament {
  id: string
  code: string
  name: string
  status: 'waiting' | 'active' | 'completed'
  participants: AnonymousParticipant[]
  matches: AnonymousMatch[]
  currentMatchId: string | null
  currentRound: number
  maxParticipants: number
  roundDuration: number
  createdAt: string
  updatedAt: string
  hostLastSeen: string
}

export interface AnonymousParticipant {
  id: string
  name: string
  visualId: number
}

export interface AnonymousMatch {
  id: string
  participant1: AnonymousParticipant | null
  participant2: AnonymousParticipant | null
  winner: AnonymousParticipant | null
  round: number
  position: number
  status: 'pending' | 'active' | 'completed' | 'bye'
  votes?: VoteTally[]
}

export interface VoteTally {
  participantId: string
  count: number
}

export interface AnonymousVote {
  id: string
  tournamentId: string
  matchId: string
  voterSessionId: string
  participantId: string
  createdAt: string
  updatedAt: string
}

export interface VoterConnection {
  id: string
  tournamentId: string
  sessionId: string
  lastSeen: string
}
