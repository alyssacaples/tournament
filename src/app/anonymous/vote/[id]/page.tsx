'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase, createOrUpdateConnection, logSupabaseOperation } from '@/utils/supabase';
import { Tournament, Match, Participant } from '@/types/tournament';
import ParticipantShape from '@/components/ParticipantShape';

export default function VotePage() {
  const params = useParams();
  const router = useRouter();
  const tournamentId = params.id as string;
  
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [currentMatch, setCurrentMatch] = useState<Match | null>(null);
  const [hasVoted, setHasVoted] = useState<boolean>(false);
  const [isVoting, setIsVoting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [sessionId, setSessionId] = useState<string>('');
  const [timerRemaining, setTimerRemaining] = useState<number>(0);
  const [isTimerActive, setIsTimerActive] = useState<boolean>(false);

  useEffect(() => {
    // Get session ID from localStorage
    const storedSessionId = localStorage.getItem('anonymous_session_id');
    if (!storedSessionId) {
      router.push('/anonymous/join');
      return;
    }
    setSessionId(storedSessionId);
    
    // Load tournament data
    loadTournamentData();
    
    // Set up heartbeat to maintain connection AND polling fallback
    const heartbeatInterval = setInterval(async () => {
      if (storedSessionId) {
        await createOrUpdateConnection(tournamentId, storedSessionId);
      }
    }, 30000); // Every 30 seconds

    // Set up polling as a fallback for real-time updates (more frequent for match changes)
    const pollingInterval = setInterval(() => {
      loadTournamentData();
    }, 3000); // Every 3 seconds for faster match change detection
    
    // Set up real-time subscription with better error handling
    const channel = supabase
      .channel(`tournament-${tournamentId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tournaments', filter: `id=eq.${tournamentId}` },
        (payload) => {
          logSupabaseOperation('Tournament Real-time Update', payload);
          // Small delay to ensure database consistency
          setTimeout(() => {
            loadTournamentData();
          }, 100);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'votes', filter: `tournament_id=eq.${tournamentId}` },
        (payload) => {
          logSupabaseOperation('Votes Real-time Update', payload);
          // Small delay to ensure database consistency
          setTimeout(() => {
            loadTournamentData();
          }, 100);
        }
      )
      .subscribe((status, err) => {
        logSupabaseOperation('Vote Page Real-time Subscription', { 
          status, 
          error: err,
          tournamentId 
        });
        
        if (status === 'SUBSCRIBED') {
          console.log('Real-time subscription active for tournament:', tournamentId);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Real-time subscription error:', err);
          // Fallback to periodic polling if real-time fails
          const fallbackInterval = setInterval(loadTournamentData, 5000);
          setTimeout(() => clearInterval(fallbackInterval), 60000); // Stop after 1 minute
        }
      });

    return () => {
      clearInterval(heartbeatInterval);
      clearInterval(pollingInterval);
      supabase.removeChannel(channel);
    };
  }, [tournamentId, router]);

  const loadTournamentData = async () => {
    try {
      logSupabaseOperation('Load Tournament Data - Start', { tournamentId });
      
      // Load tournament
      const { data: tournamentData, error: tournamentError } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', tournamentId)
        .single();

      if (tournamentError || !tournamentData) {
        logSupabaseOperation('Tournament Load', { tournamentId }, tournamentError);
        setError('Tournament not found');
        return;
      }

      logSupabaseOperation('Tournament Data Loaded', tournamentData);

      // Parse the tournament data
      const tournament: Tournament = {
        id: tournamentData.id,
        name: tournamentData.name,
        participants: tournamentData.participants || [],
        matches: tournamentData.matches || [],
        currentRound: tournamentData.current_round,
        currentMatch: null, // Will be set below
        status: tournamentData.status,
        roundDuration: tournamentData.round_duration,
        seeded: false, // Default for anonymous mode
        timerActive: tournamentData.timer_active || false,
        timerRemaining: tournamentData.timer_remaining || tournamentData.round_duration || 120,
        timerStartedAt: tournamentData.timer_started_at || null,
        timerDuration: tournamentData.timer_duration || tournamentData.round_duration || 120
      };

      // Find current active match from the matches array
      const currentActiveMatch = tournament.matches.find(match => match.status === 'active') || null;
      const previousMatchId = currentMatch?.id;
      const matchChanged = previousMatchId !== currentActiveMatch?.id;
      
      logSupabaseOperation('Active Match Search', { 
        totalMatches: tournament.matches.length,
        activeMatch: currentActiveMatch,
        previousMatchId,
        matchChanged,
        allMatches: tournament.matches.map(m => ({ id: m.id, status: m.status, round: m.round }))
      });
      
      tournament.currentMatch = currentActiveMatch;
      
      setTournament(tournament);
      setCurrentMatch(currentActiveMatch);
      setTimerRemaining(tournament.timerRemaining || 0);
      setIsTimerActive(tournament.timerActive || false);

      // Log if match changed
      if (matchChanged) {
        logSupabaseOperation('Match Changed Detected', {
          from: previousMatchId,
          to: currentActiveMatch?.id,
          newMatchParticipants: currentActiveMatch ? [
            currentActiveMatch.participant1?.name,
            currentActiveMatch.participant2?.name
          ] : null
        });
      }

      // Check if user has already voted in current match
      if (currentActiveMatch && sessionId) {
        logSupabaseOperation('Check Existing Vote - Start', { 
          tournamentId, 
          matchId: currentActiveMatch.id, 
          sessionId 
        });

        const { data: voteData, error: voteError } = await supabase
          .from('votes')
          .select('id')
          .eq('tournament_id', tournamentId)
          .eq('match_id', currentActiveMatch.id)
          .eq('voter_session_id', sessionId);

        if (voteError) {
          logSupabaseOperation('Vote Check', { matchId: currentActiveMatch.id, sessionId }, voteError);
        } else {
          const hasAlreadyVoted = (voteData?.length || 0) > 0;
          logSupabaseOperation('Vote Check - Success', { 
            matchId: currentActiveMatch.id, 
            hasVoted: hasAlreadyVoted,
            voteCount: voteData?.length || 0,
            voteData
          });
          setHasVoted(hasAlreadyVoted);
        }
      } else {
        logSupabaseOperation('Vote Check - Skipped', { 
          hasMatch: !!currentActiveMatch, 
          hasSession: !!sessionId 
        });
      }

    } catch (err) {
      logSupabaseOperation('Load Tournament Data', { tournamentId }, err);
      setError('Failed to load tournament');
    }
  };

  const handleVote = async (participantId: string) => {
    if (!currentMatch || !sessionId || hasVoted || isVoting || !isTimerActive) return;

    setIsVoting(true);
    setError('');

    try {
      logSupabaseOperation('Submit Vote - Start', { 
        tournamentId, 
        matchId: currentMatch.id, 
        participantId, 
        sessionId,
        timerActive: isTimerActive
      });

      // Check one more time if user has already voted (race condition protection)
      const { data: existingVote } = await supabase
        .from('votes')
        .select('id')
        .eq('tournament_id', tournamentId)
        .eq('match_id', currentMatch.id)
        .eq('voter_session_id', sessionId)
        .limit(1);

      if (existingVote && existingVote.length > 0) {
        logSupabaseOperation('Vote Already Exists', { existingVote });
        setHasVoted(true);
        setIsVoting(false);
        return;
      }

      const { error: voteError } = await supabase
        .from('votes')
        .insert({
          tournament_id: tournamentId,
          match_id: currentMatch.id,
          voter_session_id: sessionId,
          participant_id: participantId
        });

      if (voteError) {
        logSupabaseOperation('Submit Vote', { participantId }, voteError);
        setError(`Failed to submit vote: ${voteError.message}. Please try again.`);
        setIsVoting(false);
        return;
      }

      logSupabaseOperation('Submit Vote - Success', { participantId });
      setHasVoted(true);
      setIsVoting(false);

      // Update connection last_seen
      await createOrUpdateConnection(tournamentId, sessionId);

    } catch (err) {
      logSupabaseOperation('Submit Vote', { participantId }, err);
      setError('Failed to submit vote. Please try again.');
      setIsVoting(false);
    }
  };

  // Reset vote state when match changes
  useEffect(() => {
    if (currentMatch) {
      logSupabaseOperation('Match Changed - Resetting Vote State', { 
        newMatchId: currentMatch.id,
        sessionId 
      });
      
      // Reset vote state and recheck for this specific match
      setHasVoted(false);
      setIsVoting(false);
      setError('');
      
      // Recheck vote status for the new match
      if (sessionId) {
        checkVoteStatus(currentMatch.id, sessionId);
      }
    }
  }, [currentMatch?.id, sessionId]);

  const checkVoteStatus = async (matchId: string, voterSessionId: string) => {
    try {
      logSupabaseOperation('Check Vote Status', { matchId, voterSessionId });
      
      const { data: voteData, error: voteError } = await supabase
        .from('votes')
        .select('id')
        .eq('tournament_id', tournamentId)
        .eq('match_id', matchId)
        .eq('voter_session_id', voterSessionId);

      if (voteError) {
        logSupabaseOperation('Vote Status Check Error', { matchId, voterSessionId }, voteError);
        return;
      }

      const hasAlreadyVoted = (voteData?.length || 0) > 0;
      logSupabaseOperation('Vote Status Check Result', { 
        matchId, 
        hasVoted: hasAlreadyVoted,
        voteCount: voteData?.length || 0
      });
      
      setHasVoted(hasAlreadyVoted);
    } catch (err) {
      logSupabaseOperation('Vote Status Check Error', { matchId, voterSessionId }, err);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-400 to-pink-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="text-red-600 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Something went wrong</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => router.push('/anonymous/join')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg"
          >
            Join Another Tournament
          </button>
        </div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading tournament...</p>
        </div>
      </div>
    );
  }

  if (tournament.status === 'setup') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-400 to-orange-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="text-yellow-600 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Waiting for Tournament</h2>
          <p className="text-gray-600 mb-2">The tournament hasn't started yet.</p>
          <p className="text-sm text-gray-500">Please wait for the host to begin.</p>
        </div>
      </div>
    );
  }

  if (tournament.status === 'completed') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-400 to-blue-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="text-green-600 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Tournament Complete!</h2>
          <p className="text-gray-600 mb-6">Thanks for voting in <strong>{tournament.name}</strong></p>
          <button
            onClick={() => router.push('/anonymous/join')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg"
          >
            Join Another Tournament
          </button>
        </div>
      </div>
    );
  }

  if (!currentMatch) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="text-gray-600 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">No Active Match</h2>
          <p className="text-gray-600 mb-4">Waiting for the next match to begin...</p>
          
          {/* Debug info in development */}
          {process.env.NODE_ENV === 'development' && tournament && (
            <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded mt-4">
              <div>Tournament Status: {tournament.status}</div>
              <div>Current Round: {tournament.currentRound}</div>
              <div>Total Matches: {tournament.matches.length}</div>
              <div>Matches by Status:</div>
              <div className="ml-2">
                {['pending', 'active', 'completed'].map(status => (
                  <div key={status}>
                    {status}: {tournament.matches.filter(m => m.status === status).length}
                  </div>
                ))}
              </div>
              <div className="mt-2">Session ID: {sessionId?.substring(0, 8)}...</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-400 to-indigo-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-lg w-full">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            {tournament.name}
          </h1>
          <p className="text-gray-600">
            Round {currentMatch.round} • Match {currentMatch.position}
          </p>
          
          {/* Timer Display */}
          <div className="mt-4">
            {isTimerActive ? (
              <div className="bg-green-100 text-green-800 px-4 py-2 rounded-lg inline-block">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="font-bold">Time Remaining: {Math.floor(timerRemaining / 60)}:{(timerRemaining % 60).toString().padStart(2, '0')}</span>
                </div>
              </div>
            ) : (
              <div className="bg-yellow-100 text-yellow-800 px-4 py-2 rounded-lg inline-block">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                  <span className="font-medium">Waiting for voting to begin...</span>
                </div>
              </div>
            )}
          </div>
          
          {/* Debug info in development */}
          {process.env.NODE_ENV === 'development' && (
            <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded mt-2">
              <div>Match ID: {currentMatch.id}</div>
              <div>Match Status: {currentMatch.status}</div>
              <div>Timer Active: {isTimerActive ? 'Yes' : 'No'}</div>
              <div>Timer Remaining: {timerRemaining}s</div>
              <div>Session: {sessionId?.substring(0, 8)}...</div>
            </div>
          )}
        </div>

        {hasVoted ? (
          <div className="text-center">
            <div className="text-green-600 mb-4">
              <svg className="mx-auto h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Vote Submitted!</h2>
            <p className="text-gray-600">
              Thanks for voting. Please wait for the next match.
            </p>
          </div>
        ) : (
          <>
            <div className="text-center mb-8">
              <h2 className="text-xl font-bold text-gray-800 mb-2">Choose Your Favorite</h2>
              {isTimerActive ? (
                <p className="text-gray-600">Tap on the option you prefer</p>
              ) : (
                <p className="text-yellow-600">⏱️ Voting will begin when the timer starts</p>
              )}
            </div>

            <div className="space-y-4">
              {currentMatch.participant1 && (
                <button
                  onClick={() => handleVote(currentMatch.participant1!.id)}
                  disabled={isVoting || !isTimerActive}
                  className={`w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-6 px-6 rounded-xl text-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${!isTimerActive ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center justify-center gap-3">
                    <ParticipantShape visualId={currentMatch.participant1.visualId} size="md" />
                    <span>{isVoting ? 'Voting...' : currentMatch.participant1.name}</span>
                  </div>
                </button>
              )}

              <div className="text-center text-gray-400 font-bold text-lg">
                VS
              </div>

              {currentMatch.participant2 && (
                <button
                  onClick={() => handleVote(currentMatch.participant2!.id)}
                  disabled={isVoting || !isTimerActive}
                  className={`w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold py-6 px-6 rounded-xl text-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${!isTimerActive ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center justify-center gap-3">
                    <ParticipantShape visualId={currentMatch.participant2.visualId} size="md" />
                    <span>{isVoting ? 'Voting...' : currentMatch.participant2.name}</span>
                  </div>
                </button>
              )}
            </div>

            {error && (
              <div className="mt-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded text-center">
                {error}
              </div>
            )}
          </>
        )}

        <div className="text-center mt-8">
          <button
            onClick={() => router.push('/')}
            className="text-gray-600 hover:text-gray-800 text-sm"
          >
            ← Leave Tournament
          </button>
        </div>
      </div>
    </div>
  );
}
