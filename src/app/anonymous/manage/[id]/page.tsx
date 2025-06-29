'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import { AnonymousTournament, AnonymousMatch } from '@/types/interactive';
import { createAnonymousTournamentBracket } from '@/utils/anonymousTournament';
import { Play, Users, Clock, Trophy, Home } from 'lucide-react';

export default function AnonymousManagePage() {
  const params = useParams();
  const router = useRouter();
  const tournamentId = params.id as string;
  
  const [tournament, setTournament] = useState<AnonymousTournament | null>(null);
  const [currentMatch, setCurrentMatch] = useState<AnonymousMatch | null>(null);
  const [connectedCount, setConnectedCount] = useState(0);
  const [voteCount, setVoteCount] = useState(0);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!tournamentId) return;

    loadTournamentData();
    
    // Set up real-time subscriptions
    const channel = supabase
      .channel(`tournament-management-${tournamentId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tournaments', filter: `id=eq.${tournamentId}` },
        () => {
          loadTournamentData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'votes', filter: `tournament_id=eq.${tournamentId}` },
        () => {
          loadVoteCount();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'connections', filter: `tournament_id=eq.${tournamentId}` },
        () => {
          loadConnectionCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tournamentId]);

  const loadTournamentData = async () => {
    try {
      const { data, error: dbError } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', tournamentId)
        .single();

      if (dbError || !data) {
        setError('Tournament not found');
        return;
      }

      const tournament: AnonymousTournament = {
        ...data,
        participants: data.participants || [],
        matches: data.matches || []
      };

      setTournament(tournament);

      // Find current active match
      const activeMatch = tournament.matches.find(match => match.status === 'active') || null;
      setCurrentMatch(activeMatch);

      // Initialize bracket if tournament is active but has no matches
      if (tournament.status === 'active' && tournament.matches.length === 0 && tournament.participants.length > 0) {
        await initializeTournament(tournament);
      }

    } catch (err) {
      console.error('Error loading tournament:', err);
      setError('Failed to load tournament');
    }
  };

  const loadConnectionCount = async () => {
    const { count } = await supabase
      .from('connections')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId);
    
    setConnectedCount(count || 0);
  };

  const loadVoteCount = async () => {
    if (!currentMatch) return;
    
    const { count } = await supabase
      .from('votes')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId)
      .eq('match_id', currentMatch.id);
    
    setVoteCount(count || 0);
  };

  const initializeTournament = async (tournament: AnonymousTournament) => {
    if (isInitializing) return;
    
    setIsInitializing(true);
    try {
      // Create bracket from participants
      const bracket = createAnonymousTournamentBracket(tournament.participants);
      
      // Set first match as active
      if (bracket.length > 0) {
        bracket[0].status = 'active';
      }

      // Update tournament with bracket
      const { error: updateError } = await supabase
        .from('tournaments')
        .update({
          matches: bracket,
          current_match_id: bracket[0]?.id || null,
          host_last_seen: new Date().toISOString()
        })
        .eq('id', tournamentId);

      if (updateError) {
        throw updateError;
      }

    } catch (err) {
      console.error('Error initializing tournament:', err);
      setError('Failed to initialize tournament');
    } finally {
      setIsInitializing(false);
    }
  };

  const advanceToNextMatch = async () => {
    if (!tournament || !currentMatch || isAdvancing) return;

    setIsAdvancing(true);
    try {
      // Get vote counts for current match
      const { data: votes } = await supabase
        .from('votes')
        .select('participant_id')
        .eq('tournament_id', tournamentId)
        .eq('match_id', currentMatch.id);

      // Count votes for each participant
      const voteCounts: Record<string, number> = {};
      votes?.forEach(vote => {
        voteCounts[vote.participant_id] = (voteCounts[vote.participant_id] || 0) + 1;
      });

      // Determine winner
      let winner = null;
      if (currentMatch.participant1 && currentMatch.participant2) {
        const votes1 = voteCounts[currentMatch.participant1.id] || 0;
        const votes2 = voteCounts[currentMatch.participant2.id] || 0;
        
        if (votes1 > votes2) {
          winner = currentMatch.participant1;
        } else if (votes2 > votes1) {
          winner = currentMatch.participant2;
        } else {
          // Tie - pick randomly
          winner = Math.random() < 0.5 ? currentMatch.participant1 : currentMatch.participant2;
        }
      } else if (currentMatch.participant1) {
        // Bye match
        winner = currentMatch.participant1;
      }

      // Update current match as completed
      const updatedMatches = tournament.matches.map(match => {
        if (match.id === currentMatch.id) {
          return { ...match, status: 'completed' as const, winner };
        }
        return match;
      });

      // Find next match to activate
      let nextActiveMatch = null;
      const pendingMatches = updatedMatches.filter(match => match.status === 'pending');
      
      if (pendingMatches.length > 0) {
        // Check if any pending match has all participants ready
        for (const match of pendingMatches) {
          if (match.participant1 && match.participant2) {
            nextActiveMatch = match;
            break;
          } else if (match.participant1 && !match.participant2) {
            // Check if this match is waiting for winners from previous matches
            // For now, just activate the first pending match that has at least one participant
            nextActiveMatch = match;
            break;
          }
        }
        
        if (nextActiveMatch) {
          updatedMatches.forEach(match => {
            if (match.id === nextActiveMatch!.id) {
              match.status = 'active';
            }
          });
        }
      }

      // Update tournament
      const { error: updateError } = await supabase
        .from('tournaments')
        .update({
          matches: updatedMatches,
          current_match_id: nextActiveMatch?.id || null,
          status: nextActiveMatch ? 'active' : 'completed',
          host_last_seen: new Date().toISOString()
        })
        .eq('id', tournamentId);

      if (updateError) {
        throw updateError;
      }

    } catch (err) {
      console.error('Error advancing match:', err);
      setError('Failed to advance to next match');
    } finally {
      setIsAdvancing(false);
    }
  };

  useEffect(() => {
    if (currentMatch) {
      loadVoteCount();
      loadConnectionCount();
    }
  }, [currentMatch]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p className="text-gray-600 mb-8">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading tournament...</p>
        </div>
      </div>
    );
  }

  if (tournament.status === 'completed') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Trophy className="mx-auto h-16 w-16 text-yellow-500 mb-4" />
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Tournament Complete!</h1>
          <p className="text-gray-600 mb-8">{tournament.name} has finished</p>
          <button
            onClick={() => router.push('/')}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg"
          >
            Create New Tournament
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">{tournament.name}</h1>
            <p className="text-gray-600">Tournament Code: <span className="font-bold">{tournament.code}</span></p>
          </div>
          <button
            onClick={() => router.push('/')}
            className="p-2 text-gray-600 hover:text-gray-800"
          >
            <Home size={24} />
          </button>
        </div>

        {isInitializing && (
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-6 text-center">
            <div className="flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-700"></div>
              Initializing tournament bracket...
            </div>
          </div>
        )}

        {/* Current Match */}
        {currentMatch ? (
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
              Round {currentMatch.round} • Match {currentMatch.position + 1}
            </h2>
            
            <div className="flex items-center justify-center gap-8 mb-8">
              <div className="text-center">
                <div className="bg-blue-100 text-blue-800 text-xl font-bold py-4 px-6 rounded-lg mb-2">
                  {currentMatch.participant1?.name || 'TBD'}
                </div>
              </div>
              
              <div className="text-2xl font-bold text-gray-400">VS</div>
              
              <div className="text-center">
                <div className="bg-red-100 text-red-800 text-xl font-bold py-4 px-6 rounded-lg mb-2">
                  {currentMatch.participant2?.name || 'TBD'}
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="text-center">
                <div className="text-3xl font-bold text-indigo-600">{connectedCount}</div>
                <div className="text-gray-600">Voters Connected</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">{voteCount}</div>
                <div className="text-gray-600">Votes Cast</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600">{tournament.participants.length}</div>
                <div className="text-gray-600">Total Participants</div>
              </div>
            </div>

            <div className="text-center">
              <button
                onClick={advanceToNextMatch}
                disabled={isAdvancing}
                className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-4 px-8 rounded-xl text-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isAdvancing ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Processing...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Play size={20} />
                    Advance to Next Match
                  </div>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-8 text-center">
            <Clock className="mx-auto h-16 w-16 text-gray-400 mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">No Active Match</h2>
            <p className="text-gray-600">
              {tournament.matches.length === 0 ? 'Tournament will start automatically...' : 'All matches completed!'}
            </p>
          </div>
        )}

        {/* Tournament Stats */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Tournament Progress</h3>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-gray-600">Status:</span>
              <span className="font-bold capitalize text-indigo-600">{tournament.status}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Current Round:</span>
              <span className="font-bold">{tournament.currentRound}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Matches:</span>
              <span className="font-bold">{tournament.matches.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Completed Matches:</span>
              <span className="font-bold">
                {tournament.matches.filter(m => m.status === 'completed').length}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
