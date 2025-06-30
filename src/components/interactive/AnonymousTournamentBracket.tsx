'use client';

import React, { useState, useEffect } from 'react';
import { GameState, Match, Participant } from '@/types/tournament';
import { formatRoundName, getMaxRounds, advanceWinner, findNextActiveMatch } from '@/utils/tournament';
import { supabase, updateTournamentState, logSupabaseOperation, createRobustSubscription, cleanupSubscription } from '@/utils/supabase';
import ParticipantShape from '../ParticipantShape';
import { Play, Trophy, Users, RefreshCw } from 'lucide-react';

interface AnonymousTournamentBracketProps {
  gameState: GameState;
  onUpdateGameState: (updater: (prev: GameState) => GameState) => void;
  onSetCurrentScreen: (screen: 'home' | 'setup' | 'bracket' | 'match') => void;
  tournamentCode: string;
}

const AnonymousTournamentBracket: React.FC<AnonymousTournamentBracketProps> = ({
  gameState,
  onUpdateGameState,
  onSetCurrentScreen,
  tournamentCode
}) => {
  const [connectedVoters, setConnectedVoters] = useState(0);
  const [isUpdating, setIsUpdating] = useState(false);

  const { tournament } = gameState;

  if (!tournament) return null;

  const maxRounds = getMaxRounds(tournament.participants.length);

  // Monitor connected voters
  useEffect(() => {
    if (!tournamentCode) return;

    let voterSubscription: any;

    const setupVoterSubscription = async () => {
      try {
        voterSubscription = createRobustSubscription(
          supabase
            .channel(`voters_${tournamentCode}`)
            .on('postgres_changes', 
              { 
                event: '*', 
                schema: 'public', 
                table: 'tournament_voters',
                filter: `tournament_code=eq.${tournamentCode}`
              }, 
              async () => {
                try {
                  const { data, error } = await supabase
                    .from('tournament_voters')
                    .select('*')
                    .eq('tournament_code', tournamentCode);

                  if (error) {
                    console.error('Error fetching voters:', error);
                    return;
                  }

                  const activeVoters = data?.filter((voter: any) => 
                    new Date(voter.last_seen).getTime() > Date.now() - 30000
                  ) || [];
                  
                  setConnectedVoters(activeVoters.length);
                } catch (err) {
                  console.error('Error in voter subscription:', err);
                }
              }
            ),
          `voters_${tournamentCode}`,
          () => setupVoterSubscription()
        );

        // Initial count
        const { data, error } = await supabase
          .from('tournament_voters')
          .select('*')
          .eq('tournament_code', tournamentCode);

        if (!error && data) {
          const activeVoters = data.filter((voter: any) => 
            new Date(voter.last_seen).getTime() > Date.now() - 30000
          );
          setConnectedVoters(activeVoters.length);
        }

      } catch (error) {
        console.error('Error setting up voter subscription:', error);
      }
    };

    setupVoterSubscription();

    return () => {
      if (voterSubscription) {
        cleanupSubscription(voterSubscription, `voters_${tournamentCode}`);
      }
    };
  }, [tournamentCode]);

  const handleStartNextMatch = async () => {
    if (!tournament) return;

    setIsUpdating(true);
    try {
      const nextMatch = findNextActiveMatch(tournament);
      
      if (nextMatch) {
        const updatedTournament = {
          ...tournament,
          currentMatch: nextMatch
        };

        // Update local state
        onUpdateGameState(prev => ({
          ...prev,
          tournament: updatedTournament
        }));

        // Update database
        await updateTournamentState(tournamentCode, updatedTournament);

        // Navigate to match
        onSetCurrentScreen('match');

        await logSupabaseOperation('Match started from bracket', {
          code: tournamentCode,
          matchId: nextMatch.id
        });
      }
    } catch (error) {
      console.error('Error starting match:', error);
      alert('Failed to start match. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const getNextMatch = (): Match | null => {
    return findNextActiveMatch(tournament);
  };

  const renderMatch = (match: Match, roundIndex: number) => {
    const isNextMatch = getNextMatch()?.id === match.id;
    
    return (
      <div 
        key={match.id} 
        className={`relative bg-white/10 backdrop-blur-sm rounded-lg p-3 border transition-all duration-300 ${
          isNextMatch 
            ? 'border-yellow-400 shadow-lg ring-2 ring-yellow-400/50' 
            : 'border-white/20'
        }`}
      >
        {isNextMatch && (
          <div className="absolute -top-2 -right-2 bg-yellow-400 text-black text-xs font-bold px-2 py-1 rounded-full">
            NEXT
          </div>
        )}
        
        <div className="space-y-2">
          {/* Participant 1 */}
          <div className={`flex items-center space-x-2 p-2 rounded ${
            match.winner?.id === match.participant1?.id ? 'bg-green-500/20 border border-green-400' : 'bg-white/5'
          }`}>
            {match.participant1 ? (
              <>
                <ParticipantShape visualId={match.participant1.visualId} size="sm" />
                <span className="text-white text-sm font-medium truncate flex-1">
                  {match.participant1.name}
                </span>
                {match.winner?.id === match.participant1.id && (
                  <Trophy className="text-yellow-400" size={16} />
                )}
              </>
            ) : (
              <span className="text-white/50 text-sm italic">Bye - Advances Automatically</span>
            )}
          </div>

          {/* VS or Bye indicator */}
          {match.participant1 && match.participant2 ? (
            <div className="text-center text-white/60 text-xs font-semibold">VS</div>
          ) : (
            <div className="text-center text-white/40 text-xs">—</div>
          )}

          {/* Participant 2 */}
          <div className={`flex items-center space-x-2 p-2 rounded ${
            match.winner?.id === match.participant2?.id ? 'bg-green-500/20 border border-green-400' : 'bg-white/5'
          }`}>
            {match.participant2 ? (
              <>
                <ParticipantShape visualId={match.participant2.visualId} size="sm" />
                <span className="text-white text-sm font-medium truncate flex-1">
                  {match.participant2.name}
                </span>
                {match.winner?.id === match.participant2.id && (
                  <Trophy className="text-yellow-400" size={16} />
                )}
              </>
            ) : (
              <span className="text-white/50 text-sm italic">
                {match.participant1 ? "Bye - Advances Automatically" : "TBD"}
              </span>
            )}
          </div>
        </div>

        {/* Match status */}
        <div className="mt-2 text-center">
          {match.status === 'completed' && (
            <span className="text-green-400 text-xs font-medium">Completed</span>
          )}
          {match.status === 'pending' && match.participant1 && match.participant2 && (
            <span className="text-yellow-400 text-xs font-medium">Ready to Start</span>
          )}
          {match.status === 'pending' && (!match.participant1 || !match.participant2) && (
            <span className="text-white/50 text-xs">Waiting for Previous</span>
          )}
          {match.status === 'bye' && (
            <span className="text-blue-400 text-xs font-medium">Bye</span>
          )}
        </div>
      </div>
    );
  };

  const renderRound = (roundNumber: number) => {
    const roundMatches = tournament.matches.filter(m => m.round === roundNumber);
    
    return (
      <div key={roundNumber} className="space-y-4">
        <h3 className="text-white font-bold text-lg text-center mb-4">
          {formatRoundName(roundNumber, maxRounds)}
        </h3>
        <div className="space-y-3">
          {roundMatches.map(match => renderMatch(match, roundNumber - 1))}
        </div>
      </div>
    );
  };

  const nextMatch = getNextMatch();
  const isComplete = tournament.status === 'completed' || !nextMatch;

  return (
    <div className="space-y-6">
      {/* Tournament Status */}
      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Trophy className="text-yellow-400" size={24} />
            <div>
              <h2 className="text-white text-xl font-bold">Tournament Bracket</h2>
              <p className="text-white/80">
                {isComplete ? 'Tournament Complete!' : `Ready for ${nextMatch ? formatRoundName(nextMatch.round, maxRounds) : 'Next Round'}`}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-white">
              <Users size={20} />
              <span className="font-semibold">{connectedVoters}</span>
              <span className="text-white/80">voters connected</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Button */}
      {!isComplete && nextMatch && (
        <div className="text-center">
          <button
            onClick={handleStartNextMatch}
            disabled={isUpdating}
            className="bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 text-white px-8 py-3 rounded-lg font-semibold flex items-center space-x-2 mx-auto transition-colors"
          >
            {isUpdating ? (
              <>
                <RefreshCw className="animate-spin" size={20} />
                <span>Starting...</span>
              </>
            ) : (
              <>
                <Play size={20} />
                <span>Start {formatRoundName(nextMatch.round, maxRounds)} Match</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Tournament Complete Message */}
      {isComplete && (
        <div className="text-center py-8">
          <div className="bg-gradient-to-br from-yellow-400/20 to-orange-500/20 backdrop-blur-sm rounded-xl p-6 border border-yellow-400/30">
            <Trophy className="text-yellow-400 mx-auto mb-4" size={48} />
            <h3 className="text-yellow-400 text-2xl font-bold mb-2">Tournament Complete!</h3>
            <p className="text-white/80">
              Congratulations to all participants!
            </p>
          </div>
        </div>
      )}

      {/* Bracket Grid */}
      <div className="grid gap-8" style={{ gridTemplateColumns: `repeat(${maxRounds}, 1fr)` }}>
        {Array.from({ length: maxRounds }, (_, i) => renderRound(i + 1))}
      </div>

      {/* Back to Home */}
      <div className="text-center pt-6">
        <button
          onClick={() => onSetCurrentScreen('home')}
          className="text-white/60 hover:text-white font-medium transition-colors"
        >
          ← Back to Home
        </button>
      </div>
    </div>
  );
};

export default AnonymousTournamentBracket;
