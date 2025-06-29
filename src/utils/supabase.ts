import { createClient } from '@supabase/supabase-js'

// These will need to be set in environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database Types
export interface Tournament {
  id: string
  code: string
  name: string
  mode: 'anonymous' | 'participant'
  status: 'waiting' | 'active' | 'completed'
  participants: any[]
  matches: any[]
  current_match_id: string | null
  current_round: number
  max_participants: number
  round_duration: number
  created_at: string
  updated_at: string
  host_last_seen: string
}

export interface Vote {
  id: string
  tournament_id: string
  match_id: string
  voter_session_id: string
  participant_id: string
  created_at: string
  updated_at: string
}

export interface Connection {
  id: string
  tournament_id: string
  session_id: string
  last_seen: string
}

// Utility function to generate tournament codes
export function generateTournamentCode(): string {
  // Avoid confusing characters: 0, O, 1, I, L
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let result = ''
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// Utility function to generate session IDs
export function generateSessionId(): string {
  return crypto.randomUUID()
}
