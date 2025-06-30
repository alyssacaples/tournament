import { createClient } from '@supabase/supabase-js';
import { Tournament, Participant, Match } from '@/types/tournament';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Logging function
export async function logSupabaseOperation(operation: string, details?: any) {
  console.log(`[Supabase] ${operation}`, details);
}

// Create tournament in database
export async function createTournamentInDB(code: string, tournament: Tournament, participants: Participant[]) {
  try {
    // Insert tournament
    const { data: tournamentData, error: tournamentError } = await supabase
      .from('tournaments')
      .insert({
        code,
        tournament_data: tournament,
        participants: participants,
        status: 'active',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (tournamentError) {
      throw tournamentError;
    }

    await logSupabaseOperation('Tournament created', { code, tournamentId: tournamentData.id });
    return tournamentData;
  } catch (error) {
    console.error('Error creating tournament:', error);
    throw error;
  }
}

// Timer functions
export async function startTimer(tournamentCode: string, duration: number) {
  try {
    const { error } = await supabase
      .from('tournaments')
      .update({ 
        timer_active: true, 
        timer_remaining: duration,
        timer_started_at: new Date().toISOString()
      })
      .eq('code', tournamentCode);

    if (error) throw error;
    await logSupabaseOperation('Timer started', { code: tournamentCode, duration });
  } catch (error) {
    console.error('Error starting timer:', error);
    throw error;
  }
}

export async function pauseTimer(tournamentCode: string) {
  try {
    const { error } = await supabase
      .from('tournaments')
      .update({ timer_active: false })
      .eq('code', tournamentCode);

    if (error) throw error;
    await logSupabaseOperation('Timer paused', { code: tournamentCode });
  } catch (error) {
    console.error('Error pausing timer:', error);
    throw error;
  }
}

export async function resetTimer(tournamentCode: string, duration: number) {
  try {
    const { error } = await supabase
      .from('tournaments')
      .update({ 
        timer_active: false, 
        timer_remaining: duration,
        timer_started_at: null
      })
      .eq('code', tournamentCode);

    if (error) throw error;
    await logSupabaseOperation('Timer reset', { code: tournamentCode, duration });
  } catch (error) {
    console.error('Error resetting timer:', error);
    throw error;
  }
}

export async function updateTimerRemaining(tournamentCode: string, remaining: number) {
  try {
    const { error } = await supabase
      .from('tournaments')
      .update({ timer_remaining: remaining })
      .eq('code', tournamentCode);

    if (error) throw error;
  } catch (error) {
    console.error('Error updating timer:', error);
    throw error;
  }
}

// Subscription management
export function createRobustSubscription(channel: any, channelName: string, reconnectCallback?: () => void) {
  channel.subscribe((status: string) => {
    if (status === 'SUBSCRIBED') {
      console.log(`[Supabase] Subscribed to ${channelName}`);
    } else if (status === 'CHANNEL_ERROR') {
      console.error(`[Supabase] Channel error for ${channelName}`);
      if (reconnectCallback) {
        setTimeout(reconnectCallback, 2000);
      }
    } else if (status === 'TIMED_OUT') {
      console.warn(`[Supabase] Timeout for ${channelName}`);
      if (reconnectCallback) {
        setTimeout(reconnectCallback, 1000);
      }
    }
  });

  return channel;
}

export function cleanupSubscription(subscription: any, channelName: string) {
  try {
    if (subscription) {
      supabase.removeChannel(subscription);
      console.log(`[Supabase] Cleaned up subscription for ${channelName}`);
    }
  } catch (error) {
    console.error(`[Supabase] Error cleaning up subscription for ${channelName}:`, error);
  }
}

// Get vote tallies for a match
export async function getVoteTalliesForMatch(tournamentCode: string, matchId: string) {
  try {
    const { data, error } = await supabase
      .from('tournament_votes')
      .select('participant_id')
      .eq('tournament_code', tournamentCode)
      .eq('match_id', matchId);

    if (error) throw error;

    const tallies: { [key: string]: number } = {};
    data?.forEach((vote: any) => {
      tallies[vote.participant_id] = (tallies[vote.participant_id] || 0) + 1;
    });

    return Object.entries(tallies).map(([participantId, count]) => ({
      participantId,
      count
    }));

  } catch (error) {
    console.error('Error getting vote tallies:', error);
    return [];
  }
}

// Update tournament state
export async function updateTournamentState(tournamentCode: string, tournament: Tournament) {
  try {
    const { error } = await supabase
      .from('tournaments')
      .update({ 
        tournament_data: tournament,
        updated_at: new Date().toISOString()
      })
      .eq('code', tournamentCode);

    if (error) throw error;
    await logSupabaseOperation('Tournament state updated', { code: tournamentCode });
  } catch (error) {
    console.error('Error updating tournament state:', error);
    throw error;
  }
}

// Get tournament by code
export async function getTournamentByCode(code: string) {
  try {
    const { data, error } = await supabase
      .from('tournaments')
      .select('*')
      .eq('code', code)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error getting tournament:', error);
    throw error;
  }
}
