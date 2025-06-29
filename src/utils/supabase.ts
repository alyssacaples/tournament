import { createClient } from '@supabase/supabase-js'

// These will need to be set in environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Debug mode for development
const DEBUG_MODE = process.env.NODE_ENV === 'development'

// Enhanced logging function
export function logSupabaseOperation(operation: string, data?: any, error?: any) {
  if (DEBUG_MODE) {
    const timestamp = new Date().toISOString()
    if (error) {
      console.error(`[${timestamp}] Supabase ${operation} ERROR:`, error)
      if (data) {
        console.error(`[${timestamp}] Operation data:`, data)
      }
    } else {
      console.log(`[${timestamp}] Supabase ${operation}:`, data)
    }
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Test database connectivity
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    logSupabaseOperation('Connection Test - Start')
    
    // Test basic connection
    const { data, error } = await supabase
      .from('tournaments')
      .select('count', { count: 'exact', head: true })
      .limit(1)
    
    if (error) {
      logSupabaseOperation('Connection Test', null, error)
      return false
    }
    
    logSupabaseOperation('Connection Test - Success', { count: data })
    return true
  } catch (err) {
    logSupabaseOperation('Connection Test', null, err)
    return false
  }
}

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
  timer_active: boolean
  timer_remaining: number
  timer_started_at: string | null
  timer_duration: number
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

// Utility function to generate session IDs with fallback
export function generateSessionId(): string {
  try {
    // Try modern crypto API first
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID()
    }
  } catch (err) {
    logSupabaseOperation('UUID Generation', null, err)
  }
  
  // Fallback to timestamp + random
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2)
  return `${timestamp}-${random}`
}

// Enhanced connection management
export async function createOrUpdateConnection(tournamentId: string, sessionId: string): Promise<boolean> {
  try {
    logSupabaseOperation('Connection Create/Update - Start', { tournamentId, sessionId })
    
    // First try to update existing connection
    const { data: updateData, error: updateError } = await supabase
      .from('connections')
      .update({ last_seen: new Date().toISOString() })
      .eq('tournament_id', tournamentId)
      .eq('session_id', sessionId)
      .select()
    
    if (updateError) {
      logSupabaseOperation('Connection Update', { tournamentId, sessionId }, updateError)
    } else if (updateData && updateData.length > 0) {
      logSupabaseOperation('Connection Update - Success', updateData)
      return true
    }
    
    // If no rows were updated, insert new connection
    const { data: insertData, error: insertError } = await supabase
      .from('connections')
      .insert({
        tournament_id: tournamentId,
        session_id: sessionId,
        last_seen: new Date().toISOString()
      })
      .select()
    
    if (insertError) {
      logSupabaseOperation('Connection Insert', { tournamentId, sessionId }, insertError)
      return false
    }
    
    logSupabaseOperation('Connection Insert - Success', insertData)
    return true
    
  } catch (err) {
    logSupabaseOperation('Connection Create/Update', { tournamentId, sessionId }, err)
    return false
  }
}

// Get active connection count with cleanup
export async function getActiveConnectionCount(tournamentId: string): Promise<number> {
  try {
    logSupabaseOperation('Connection Count - Start', { tournamentId })
    
    // Clean up old connections (older than 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    
    const { error: cleanupError } = await supabase
      .from('connections')
      .delete()
      .eq('tournament_id', tournamentId)
      .lt('last_seen', fiveMinutesAgo)
    
    if (cleanupError) {
      logSupabaseOperation('Connection Cleanup', null, cleanupError)
    }
    
    // Get current active count
    const { count, error } = await supabase
      .from('connections')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId)
    
    if (error) {
      logSupabaseOperation('Connection Count', { tournamentId }, error)
      return 0
    }
    
    const activeCount = count || 0
    logSupabaseOperation('Connection Count - Success', { tournamentId, count: activeCount })
    return activeCount
    
  } catch (err) {
    logSupabaseOperation('Connection Count', { tournamentId }, err)
    return 0
  }
}

// Timer synchronization utilities
export async function startTimer(tournamentId: string, durationSeconds: number): Promise<boolean> {
  try {
    logSupabaseOperation('Start Timer', { tournamentId, durationSeconds })
    
    const { error } = await supabase
      .from('tournaments')
      .update({
        timer_active: true,
        timer_remaining: durationSeconds,
        timer_started_at: new Date().toISOString(),
        timer_duration: durationSeconds,
        updated_at: new Date().toISOString(),
        host_last_seen: new Date().toISOString()
      })
      .eq('id', tournamentId)
    
    if (error) {
      logSupabaseOperation('Start Timer', { tournamentId }, error)
      return false
    }
    
    logSupabaseOperation('Start Timer - Success', { tournamentId })
    return true
  } catch (err) {
    logSupabaseOperation('Start Timer', { tournamentId }, err)
    return false
  }
}

export async function pauseTimer(tournamentId: string): Promise<boolean> {
  try {
    logSupabaseOperation('Pause Timer', { tournamentId })
    
    const { error } = await supabase
      .from('tournaments')
      .update({
        timer_active: false,
        updated_at: new Date().toISOString(),
        host_last_seen: new Date().toISOString()
      })
      .eq('id', tournamentId)
    
    if (error) {
      logSupabaseOperation('Pause Timer', { tournamentId }, error)
      return false
    }
    
    logSupabaseOperation('Pause Timer - Success', { tournamentId })
    return true
  } catch (err) {
    logSupabaseOperation('Pause Timer', { tournamentId }, err)
    return false
  }
}

export async function updateTimerRemaining(tournamentId: string, secondsRemaining: number): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('tournaments')
      .update({
        timer_remaining: secondsRemaining,
        updated_at: new Date().toISOString(),
        host_last_seen: new Date().toISOString()
      })
      .eq('id', tournamentId)
    
    if (error) {
      logSupabaseOperation('Update Timer', { tournamentId }, error)
      return false
    }
    
    return true
  } catch (err) {
    logSupabaseOperation('Update Timer', { tournamentId }, err)
    return false
  }
}

export async function resetTimer(tournamentId: string, durationSeconds: number): Promise<boolean> {
  try {
    logSupabaseOperation('Reset Timer', { tournamentId, durationSeconds })
    
    const { error } = await supabase
      .from('tournaments')
      .update({
        timer_active: false,
        timer_remaining: durationSeconds,
        timer_started_at: null,
        timer_duration: durationSeconds,
        updated_at: new Date().toISOString(),
        host_last_seen: new Date().toISOString()
      })
      .eq('id', tournamentId)
    
    if (error) {
      logSupabaseOperation('Reset Timer', { tournamentId }, error)
      return false
    }
    
    logSupabaseOperation('Reset Timer - Success', { tournamentId })
    return true
  } catch (err) {
    logSupabaseOperation('Reset Timer', { tournamentId }, err)
    return false
  }
}

// Enhanced real-time subscription utilities
export function createRobustSubscription(
  channelName: string,
  table: string,
  filter: string,
  callback: (payload: any) => void,
  onStatusChange?: (status: string) => void
) {
  logSupabaseOperation('Creating Robust Subscription', { channelName, table, filter });

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      { 
        event: '*',
        schema: 'public', 
        table,
        filter
      },
      (payload) => {
        logSupabaseOperation('Real-time Event', { 
          channelName,
          table,
          event: payload.eventType,
          new: payload.new,
          old: payload.old
        });
        
        // Execute callback immediately
        try {
          callback(payload);
        } catch (error) {
          logSupabaseOperation('Subscription Callback Error', { channelName, table }, error);
        }
      }
    )
    .subscribe((status, err) => {
      logSupabaseOperation('Subscription Status Change', { 
        channelName,
        table,
        status, 
        error: err
      });
      
      if (onStatusChange) {
        onStatusChange(status);
      }
    });

  return channel;
}

// Utility to clean up subscription
export function cleanupSubscription(channel: any, channelName: string) {
  logSupabaseOperation('Cleaning Up Subscription', { channelName });
  if (channel) {
    supabase.removeChannel(channel);
  }
}

// Vote tally utilities
export async function getVoteTalliesForMatch(tournamentId: string, matchId: string): Promise<{ tallies: VoteTally[], totalVotes: number }> {
  try {
    logSupabaseOperation('Get Vote Tallies - Start', { tournamentId, matchId });

    const { data: votes, error } = await supabase
      .from('votes')
      .select('participant_id')
      .eq('tournament_id', tournamentId)
      .eq('match_id', matchId);

    if (error) {
      logSupabaseOperation('Get Vote Tallies', { tournamentId, matchId }, error);
      return { tallies: [], totalVotes: 0 };
    }

    // Count votes for each participant
    const tallies: Record<string, number> = {};
    votes?.forEach(vote => {
      tallies[vote.participant_id] = (tallies[vote.participant_id] || 0) + 1;
    });

    const tallyArray: VoteTally[] = Object.entries(tallies).map(([participantId, count]) => ({
      participantId,
      count
    }));

    logSupabaseOperation('Get Vote Tallies - Success', { 
      tallies,
      tallyArray,
      totalVotes: votes?.length || 0
    });

    return { tallies: tallyArray, totalVotes: votes?.length || 0 };
  } catch (err) {
    logSupabaseOperation('Get Vote Tallies', { tournamentId, matchId }, err);
    return { tallies: [], totalVotes: 0 };
  }
}

interface VoteTally {
  participantId: string;
  count: number;
}
