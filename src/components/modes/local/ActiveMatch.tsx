'use client';

import React, { useState, useEffect } from 'react';
import { GameState, Match, Participant } from '@/types/tournament';
import { advanceWinner, isRoundComplete, getMaxRounds } from '@/utils/tournament';
import MatchTimerControls from '../../match/MatchTimerControls';
import MatchDisplay from '../../match/MatchDisplay';
import MatchControls from '../../match/MatchControls';
import MatchCelebration from '../../match/MatchCelebration';

interface ActiveMatchProps {
  gameState: GameState;
  onUpdateGameState: (updater: (prev: GameState) => GameState) => void;
  onSetCurrentScreen: (screen: 'home' | 'setup' | 'bracket' | 'match') => void;
}

export default function ActiveMatch({
  gameState,
  onUpdateGameState,
  onSetCurrentScreen
}: ActiveMatchProps) {
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [showWinnerConfirm, setShowWinnerConfirm] = useState(false);
  const [selectedWinner, setSelectedWinner] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showTournamentComplete, setShowTournamentComplete] = useState(false);
  const [tournamentChampion, setTournamentChampion] = useState<Participant | null>(null);

  const { tournament } = gameState;
  const currentMatch = tournament?.currentMatch;

  // Initialize timer for new match
  useEffect(() => {
    if (tournament && currentMatch) {
      setTimeRemaining(tournament.roundDuration);
    }
  }, [tournament, currentMatch]);

  // Timer countdown effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isTimerActive && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            setIsTimerActive(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isTimerActive, timeRemaining]);

  const handleStartTimer = () => {
    setIsTimerActive(true);
  };

  const handlePauseTimer = () => {
    setIsTimerActive(false);
  };

  const handleResetTimer = () => {
    if (tournament && currentMatch) {
      setTimeRemaining(tournament.roundDuration);
      setIsTimerActive(false);
    }
  };

  const handleAddTime = (seconds: number) => {
    setTimeRemaining(prev => prev + seconds);
  };

  const handleSelectWinner = (participantId: string) => {
    setSelectedWinner(participantId);
    setShowWinnerConfirm(true);
  };

  const handleConfirmWinner = () => {
    if (!selectedWinner || !currentMatch || !tournament) return;
    
    const winner = currentMatch.participant1?.id === selectedWinner 
      ? currentMatch.participant1 
      : currentMatch.participant2;
    
    if (winner) {
      handleEndMatch(winner);
    }
  };

  const handleRandomWinner = () => {
    if (!currentMatch) return;
    
    const participants = [currentMatch.participant1, currentMatch.participant2].filter(Boolean);
    if (participants.length === 2) {
      const randomWinner = participants[Math.floor(Math.random() * participants.length)];
      if (randomWinner) {
        handleEndMatch(randomWinner);
      }
    }
  };

  const handleEndMatch = (winner?: Participant) => {
    if (!tournament || !currentMatch) return;
    
    const finalWinner = winner || (selectedWinner 
      ? (currentMatch.participant1?.id === selectedWinner 
          ? currentMatch.participant1 
          : currentMatch.participant2)
      : null);
    
    if (!finalWinner) return;

    try {
      // First, mark the current match as completed with the winner
      let updatedMatches = tournament.matches.map(m => 
        m.id === currentMatch.id 
          ? { ...m, winner: finalWinner, status: 'completed' as const }
          : m
      );
      
      // Then advance the winner to the next round
      updatedMatches = advanceWinner(updatedMatches, { ...currentMatch, winner: finalWinner });
      
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
      <MatchTimerControls
        timeRemaining={timeRemaining}
        isTimerActive={isTimerActive}
        onStartTimer={handleStartTimer}
        onPauseTimer={handlePauseTimer}
        onResetTimer={handleResetTimer}
        onAddTime={handleAddTime}
      />
      
      <MatchDisplay
        currentMatch={currentMatch}
        liveTallies={{}} // No live tallies for regular tournament mode
        totalVotes={0}
        connectedVoters={0}
        tournamentCode=""
      />
      
      <MatchControls
        currentMatch={currentMatch}
        showWinnerConfirm={showWinnerConfirm}
        selectedWinner={selectedWinner}
        onSelectWinner={handleSelectWinner}
        onConfirmWinner={handleConfirmWinner}
        onRandomWinner={handleRandomWinner}
        onEndMatch={() => handleEndMatch()}
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
