import { createClient } from '@supabase/supabase-js';
import { Tournament, Participant, Match } from '@/types/tournament';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase environment variables - some features will not work');
}

export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Helper function to ensure supabase is available
function ensureSupabase() {
  if (!supabase) {
    throw new Error('Supabase client not initialized - check environment variables');
  }
  return supabase;
}

// Logging function
export async function logSupabaseOperation(operation: string, details?: any) {
  console.log(`[Supabase] ${operation}`, details);
}

// Create tournament in database
export async function createTournamentInDB(code: string, tournament: Tournament, participants: Participant[]) {
  try {
    const client = ensureSupabase();
    // Insert tournament
    const { data: tournamentData, error: tournamentError } = await client
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
    const client = ensureSupabase();
    const { error } = await client
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
    const client = ensureSupabase();
    const { error } = await client
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
    const client = ensureSupabase();
    const { error } = await client
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
    const client = ensureSupabase();
    const { error } = await client
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
    if (subscription && supabase) {
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
    const client = ensureSupabase();
    const { data, error } = await client
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
    const client = ensureSupabase();
    const { error } = await client
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
    const client = ensureSupabase();
    const { data, error } = await client
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

// Generate tournament code
export function generateTournamentCode(): string {
  // Exclude confusing characters: O, 0, I, 1, l
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Connect voter to tournament
export async function connectVoter(tournamentCode: string, voterId: string) {
  try {
    const client = ensureSupabase();
    const { error } = await client
      .from('tournament_connections')
      .upsert({
        tournament_code: tournamentCode,
        voter_id: voterId,
        connected_at: new Date().toISOString(),
        last_ping: new Date().toISOString()
      }, {
        onConflict: 'tournament_code,voter_id'
      });

    if (error) throw error;
    await logSupabaseOperation('Voter connected', { code: tournamentCode, voterId });
  } catch (error) {
    console.error('Error connecting voter:', error);
    throw error;
  }
}

// Disconnect voter from tournament
export async function disconnectVoter(tournamentCode: string, voterId: string) {
  try {
    const client = ensureSupabase();
    const { error } = await client
      .from('tournament_connections')
      .delete()
      .eq('tournament_code', tournamentCode)
      .eq('voter_id', voterId);

    if (error) throw error;
    await logSupabaseOperation('Voter disconnected', { code: tournamentCode, voterId });
  } catch (error) {
    console.error('Error disconnecting voter:', error);
    throw error;
  }
}

// Update voter ping (keep alive)
export async function updateVoterPing(tournamentCode: string, voterId: string) {
  try {
    const client = ensureSupabase();
    const { error } = await client
      .from('tournament_connections')
      .update({ last_ping: new Date().toISOString() })
      .eq('tournament_code', tournamentCode)
      .eq('voter_id', voterId);

    if (error) throw error;
  } catch (error) {
    console.error('Error updating voter ping:', error);
    throw error;
  }
}

// Clean up stale connections (older than 1 minute)
export async function cleanupStaleConnections(tournamentCode: string) {
  try {
    const client = ensureSupabase();
    const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
    
    const { error } = await client
      .from('tournament_connections')
      .delete()
      .eq('tournament_code', tournamentCode)
      .lt('last_ping', oneMinuteAgo);

    if (error) throw error;
    await logSupabaseOperation('Cleaned up stale connections', { code: tournamentCode });
  } catch (error) {
    console.error('Error cleaning up stale connections:', error);
    throw error;
  }
}

// Get all active voters for a tournament
export async function getActiveVoters(tournamentCode: string) {
  try {
    const client = ensureSupabase();
    const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString();
    
    const { data, error } = await client
      .from('tournament_connections')
      .select('voter_id, connected_at, last_ping')
      .eq('tournament_code', tournamentCode)
      .gte('last_ping', thirtySecondsAgo)
      .order('connected_at', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting active voters:', error);
    return [];
  }
}

// Get connected voters count
export async function getConnectedVotersCount(tournamentCode: string) {
  try {
    const client = ensureSupabase();
    const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString();
    
    const { count, error } = await client
      .from('tournament_connections')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_code', tournamentCode)
      .gte('last_ping', thirtySecondsAgo); // Active in last 30 seconds

    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.error('Error getting connected voters count:', error);
    return 0;
  }
}

// Submit or update vote
export async function submitVote(tournamentCode: string, matchId: string, participantId: string, voterId: string) {
  try {
    const client = ensureSupabase();
    const { error } = await client
      .from('tournament_votes')
      .upsert({
        tournament_code: tournamentCode,
        match_id: matchId,
        participant_id: participantId,
        voter_id: voterId,
        created_at: new Date().toISOString()
      }, {
        onConflict: 'tournament_code,match_id,voter_id'
      });

    if (error) throw error;
    await logSupabaseOperation('Vote submitted', { 
      code: tournamentCode, 
      matchId, 
      participantId, 
      voterId 
    });
  } catch (error) {
    console.error('Error submitting vote:', error);
    throw error;
  }
}

// Clear all votes for a match (when starting a new match)
export async function clearMatchVotes(tournamentCode: string, matchId: string) {
  try {
    const client = ensureSupabase();
    const { error } = await client
      .from('tournament_votes')
      .delete()
      .eq('tournament_code', tournamentCode)
      .eq('match_id', matchId);

    if (error) throw error;
    await logSupabaseOperation('Match votes cleared', { code: tournamentCode, matchId });
  } catch (error) {
    console.error('Error clearing match votes:', error);
    throw error;
  }
}

// Start match with timer in one operation
export async function startMatchWithTimer(tournamentCode: string, tournament: Tournament, duration: number) {
  try {
    const client = ensureSupabase();
    
    // Update tournament with current match and start timer immediately
    const { error } = await client
      .from('tournaments')
      .update({
        tournament_data: tournament,
        timer_active: true,
        timer_remaining: duration,
        timer_started_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('code', tournamentCode);

    if (error) throw error;
    
    await logSupabaseOperation('Match started with timer', { 
      code: tournamentCode, 
      matchId: tournament.currentMatch?.id,
      duration 
    });
    
    return true;
  } catch (error) {
    console.error('Error starting match with timer:', error);
    throw error;
  }
}

// Check if all connected voters have voted for current match
export async function checkAllVotersVoted(tournamentCode: string, matchId: string) {
  try {
    const client = ensureSupabase();
    
    // Get count of connected voters (active in last 30 seconds)
    const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString();
    const { count: connectedCount, error: connectedError } = await client
      .from('tournament_connections')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_code', tournamentCode)
      .gte('last_ping', thirtySecondsAgo);

    if (connectedError) throw connectedError;

    // Get count of votes for this match
    const { count: voteCount, error: voteError } = await client
      .from('tournament_votes')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_code', tournamentCode)
      .eq('match_id', matchId);

    if (voteError) throw voteError;

    const allVoted = (connectedCount || 0) > 0 && (voteCount || 0) >= (connectedCount || 0);
    
    await logSupabaseOperation('Checked voter status', { 
      code: tournamentCode, 
      matchId,
      connectedVoters: connectedCount || 0,
      votesReceived: voteCount || 0,
      allVoted
    });
    
    return {
      connectedVoters: connectedCount || 0,
      votesReceived: voteCount || 0,
      allVoted
    };
  } catch (error) {
    console.error('Error checking voter status:', error);
    return {
      connectedVoters: 0,
      votesReceived: 0,
      allVoted: false
    };
  }
}

// Accelerate timer to 10 seconds when all voters have voted
export async function accelerateTimer(tournamentCode: string) {
  try {
    const client = ensureSupabase();
    
    const { error } = await client
      .from('tournaments')
      .update({
        timer_remaining: 10,
        timer_started_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('code', tournamentCode);

    if (error) throw error;
    
    await logSupabaseOperation('Timer accelerated to 10 seconds', { code: tournamentCode });
    return true;
  } catch (error) {
    console.error('Error accelerating timer:', error);
    throw error;
  }
}

// End match and show winner
export async function endMatchWithWinner(tournamentCode: string, tournament: Tournament, winner: any) {
  try {
    const client = ensureSupabase();
    
    if (!tournament.currentMatch) {
      throw new Error('No current match to end');
    }
    
    // Mark current match as completed with winner
    const updatedMatches = tournament.matches.map(match => 
      match.id === tournament.currentMatch?.id 
        ? { ...match, winner, status: 'completed' as const }
        : match
    );
    
    // Import the advancement functions dynamically to avoid circular import
    const { advanceWinner, getCurrentRound, getMaxRounds } = await import('./tournament');
    
    // Advance winner to next round
    const finalMatches = advanceWinner(updatedMatches, { 
      ...tournament.currentMatch, 
      winner 
    });
    
    // Determine the new current round
    const newCurrentRound = getCurrentRound(finalMatches);
    
    // Check if tournament is complete
    const maxRounds = getMaxRounds(tournament.participants.length);
    const isComplete = newCurrentRound > maxRounds || 
      !finalMatches.some(m => m.status === 'pending' && (m.participant1 || m.participant2));
    
    // Update tournament: clear current match, advance winner, stop timer, update round
    const updatedTournament = {
      ...tournament,
      matches: finalMatches,
      currentMatch: null,
      currentRound: newCurrentRound,
      status: isComplete ? 'completed' as const : 'active' as const,
      lastMatchWinner: winner // Store winner for celebration
    };
    
    const { error } = await client
      .from('tournaments')
      .update({
        tournament_data: updatedTournament,
        timer_active: false,
        timer_remaining: 0,
        updated_at: new Date().toISOString()
      })
      .eq('code', tournamentCode);

    if (error) throw error;
    
    await logSupabaseOperation('Match ended with winner and advancement', { 
      code: tournamentCode, 
      winner: winner?.name,
      matchId: tournament.currentMatch.id,
      newRound: newCurrentRound,
      isComplete
    });
    
    return true;
  } catch (error) {
    console.error('Error ending match with winner:', error);
    throw error;
  }
}
