'use client';

import React, { useState, useCallback } from 'react';
import { GameState, Match, Participant } from '@/types/tournament';
import { advanceWinner, isRoundComplete, getMaxRounds } from '@/utils/tournament';
import { startMatchWithTimer, checkAllVotersVoted, accelerateTimer, endMatchWithWinner } from '@/utils/supabase';
import MatchTimerControls from '../../match/MatchTimerControls';
import MatchDisplay from '../../match/MatchDisplay';
import MatchControls from '../../match/MatchControls';
import MatchCelebration from '../../match/MatchCelebration';
import MatchSubscriptions from '../../match/MatchSubscriptions';
import MatchStateManager from '../../match/MatchStateManager';
import VoteTallyManager from '../../match/VoteTallyManager';

interface AnonymousActiveMatchProps {
  gameState: GameState;
  tournament: GameState['tournament'];
  tournamentCode: string;
  connectedVoters: number;
  onUpdateGameState: (updater: (prev: GameState) => GameState) => void;
  onSetCurrentScreen: (screen: 'home' | 'setup' | 'bracket' | 'match') => void;
}

export default function AnonymousActiveMatch({
  gameState,
  tournamentCode,
  connectedVoters,
  onUpdateGameState,
  onSetCurrentScreen
}: AnonymousActiveMatchProps) {
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [showWinnerConfirm, setShowWinnerConfirm] = useState(false);
  const [selectedWinner, setSelectedWinner] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showTournamentComplete, setShowTournamentComplete] = useState(false);
  const [tournamentChampion, setTournamentChampion] = useState<Participant | null>(null);
  const [hasAccelerated, setHasAccelerated] = useState(false);
  const [liveTallies, setLiveTallies] = useState<{[key: string]: number}>({});
  const [totalVotes, setTotalVotes] = useState(0);

  const { tournament } = gameState;
  const currentMatch = tournament?.currentMatch;

  // Callback handlers for child components
  const handleTimerUpdate = useCallback((remaining: number, active: boolean) => {
    setTimeRemaining(remaining);
    setIsTimerActive(active);
  }, []);

  const handleTalliesReset = useCallback(() => {
    setLiveTallies({});
    setTotalVotes(0);
  }, []);

  const handleAcceleratedReset = useCallback(() => {
    setHasAccelerated(false);
  }, []);

  const handleTalliesUpdate = useCallback((tallies: {[key: string]: number}, total: number) => {
    setLiveTallies(tallies);
    setTotalVotes(total);
  }, []);

  const handleVoteUpdate = useCallback(() => {
    // This will trigger the VoteTallyManager to update
  }, []);

  const handleTimerEnd = useCallback(async () => {
    if (!currentMatch || !tournament) return;
    
    try {
      const highestVoted = Object.entries(liveTallies).reduce((a, b) => 
        liveTallies[a[0]] > liveTallies[b[0]] ? a : b
      );
      
      if (highestVoted && liveTallies[highestVoted[0]] > 0) {
        const winner = currentMatch.participant1?.id === highestVoted[0] 
          ? currentMatch.participant1 
          : currentMatch.participant2;
        
        if (winner) {
          await handleEndMatch(winner);
        }
      }
    } catch (error) {
      console.error('Error handling timer end:', error);
    }
  }, [currentMatch, tournament, liveTallies]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStartTimer = async () => {
    if (!tournament || !currentMatch) return;
    
    try {
      await startMatchWithTimer(tournamentCode, tournament, tournament.roundDuration);
      setTimeRemaining(tournament.roundDuration);
      setIsTimerActive(true);
    } catch (error) {
      console.error('Error starting timer:', error);
    }
  };

  const handleAccelerateTimer = async () => {
    if (!isTimerActive || hasAccelerated) return;
    
    try {
      const allVoted = await checkAllVotersVoted(tournamentCode, currentMatch!.id);
      if (allVoted) {
        await accelerateTimer(tournamentCode);
        setHasAccelerated(true);
      }
    } catch (error) {
      console.error('Error accelerating timer:', error);
    }
  };

  const handleEndMatch = async (winner: Participant) => {
    if (!tournament || !currentMatch) return;
    
    try {
      await endMatchWithWinner(tournamentCode, tournament, winner);
      
      // First, mark the current match as completed with the winner
      let updatedMatches = tournament.matches.map(m => 
        m.id === currentMatch.id 
          ? { ...m, winner, status: 'completed' as const }
          : m
      );
      
      // Then advance the winner to the next round
      updatedMatches = advanceWinner(updatedMatches, { ...currentMatch, winner });
      
      const updatedTournament = {
        ...tournament,
        matches: updatedMatches
      };
      
      onUpdateGameState(prev => ({
        ...prev,
        tournament: {
          ...updatedTournament,
          currentMatch: null // Clear current match after completion
        }
      }));
      
      const maxRounds = getMaxRounds(updatedTournament.participants.length);
      
      if (isRoundComplete(updatedTournament.matches, updatedTournament.currentRound) && updatedTournament.currentRound < maxRounds) {
        setShowCelebration(true);
        setTimeout(() => {
          setShowCelebration(false);
          onSetCurrentScreen('bracket');
        }, 3000);
      } else if (updatedTournament.currentRound >= maxRounds) {
        const champion = updatedTournament.participants.find((p: Participant) => 
          updatedTournament.matches.some((m: Match) => 
            m.round === maxRounds && m.winner?.id === p.id
          )
        );
        
        setTournamentChampion(champion || null);
        setShowTournamentComplete(true);
      }
      
      setTimeRemaining(0);
      setIsTimerActive(false);
      setShowWinnerConfirm(false);
      setSelectedWinner(null);
    } catch (error) {
      console.error('Error ending match:', error);
    }
  };

  const handleManualWinner = (participantId: string) => {
    setSelectedWinner(participantId);
    setShowWinnerConfirm(true);
  };

  const handleConfirmWinner = async () => {
    if (!selectedWinner || !currentMatch) return;
    
    const winner = currentMatch.participant1?.id === selectedWinner 
      ? currentMatch.participant1 
      : currentMatch.participant2;
    
    if (winner) {
      await handleEndMatch(winner);
    }
  };

  if (!tournament || !currentMatch) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-center">
          <h2 className="text-2xl font-bold mb-4">No Active Match</h2>
          <button
            onClick={() => onSetCurrentScreen('bracket')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            View Bracket
          </button>
        </div>
      </div>
    );
  }

  if (showTournamentComplete && tournamentChampion) {
    return (
      <MatchCelebration
        winner={tournamentChampion}
        isChampion={true}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex flex-col">
      {/* State Management Components */}
      <MatchStateManager
        tournament={tournament}
        currentMatch={currentMatch}
        tournamentCode={tournamentCode}
        onTimerUpdate={handleTimerUpdate}
        onTalliesReset={handleTalliesReset}
        onAcceleratedReset={handleAcceleratedReset}
      />
      
      <MatchSubscriptions
        tournamentCode={tournamentCode}
        currentMatchId={currentMatch?.id || null}
        isTimerActive={isTimerActive}
        onTimerUpdate={handleTimerUpdate}
        onTimerEnd={handleTimerEnd}
        onVoteUpdate={handleVoteUpdate}
      />
      
      <VoteTallyManager
        currentMatch={currentMatch}
        tournamentCode={tournamentCode}
        isTimerActive={isTimerActive}
        onTalliesUpdate={handleTalliesUpdate}
      />

      {/* UI Components */}
      <MatchTimerControls
        timeRemaining={timeRemaining}
        isTimerActive={isTimerActive}
        onStartTimer={handleStartTimer}
        onPauseTimer={() => {}} // TODO: Implement if needed
        onResetTimer={() => {}} // TODO: Implement if needed  
        onAddTime={() => {}} // TODO: Implement if needed
      />
      
      <MatchDisplay
        currentMatch={currentMatch}
        liveTallies={liveTallies}
        totalVotes={totalVotes}
        connectedVoters={connectedVoters}
        tournamentCode={tournamentCode}
      />
      
      <MatchControls
        currentMatch={currentMatch}
        showWinnerConfirm={showWinnerConfirm}
        selectedWinner={selectedWinner}
        onSelectWinner={handleManualWinner}
        onConfirmWinner={handleConfirmWinner}
        onRandomWinner={() => {}} // TODO: Implement if needed
        onEndMatch={() => {}} // TODO: Implement if needed
        onBackToBracket={() => onSetCurrentScreen('bracket')}
      />
      
      {showCelebration && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 text-center">
            <h2 className="text-3xl font-bold text-gray-800 mb-4">Round Complete!</h2>
            <p className="text-gray-600">Moving to next round...</p>
          </div>
        </div>
      )}
    </div>
  );
}
