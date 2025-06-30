'use client';

import React, { useState, useEffect } from 'react';
import { GameState, Match, Participant } from '@/types/tournament';
import { advanceWinner, isRoundComplete, getMaxRounds } from '@/utils/tournament';
import MatchTimerControls from '@/components/match/MatchTimerControls';
import MatchDisplay from '@/components/match/MatchDisplay';
import MatchControls from '@/components/match/MatchControls';
import MatchCelebration from '@/components/match/MatchCelebration';
import {
  subscribeToMatchTimer,
  subscribeToVotes,
  updateTimer,
  endMatchWithWinner,
  checkAllVotersVoted,
  accelerateTimer
} from '@/utils/supabase';

interface ActiveMatchProps {
  gameState: GameState;
  onUpdateGameState: (updater: (prev: GameState) => GameState) => void;
  onSetCurrentScreen: (screen: 'waiting' | 'bracket' | 'match') => void;
  tournamentCode: string;
  connectedVoters: number;
}

export default function AnonymousActiveMatch({
  gameState,
  onUpdateGameState,
  onSetCurrentScreen,
  tournamentCode,
  connectedVoters
}: ActiveMatchProps) {
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [showWinnerConfirm, setShowWinnerConfirm] = useState(false);
  const [selectedWinner, setSelectedWinner] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showTournamentComplete, setShowTournamentComplete] = useState(false);
  const [tournamentChampion, setTournamentChampion] = useState<Participant | null>(null);
  const [liveTallies, setLiveTallies] = useState<Record<string, number>>({});
  const [hasAccelerated, setHasAccelerated] = useState(false);

  const { tournament } = gameState;
  const currentMatch = tournament?.currentMatch;

  // Subscribe to timer updates
  useEffect(() => {
    if (!tournament || !currentMatch || !tournamentCode) return;

    let timerSubscription: any = null;
    
    const setupTimerSubscription = async () => {
      try {
        const sub = await subscribeToMatchTimer(
          tournamentCode,
          (timerData) => {
            if (timerData) {
              setTimeRemaining(timerData.remaining);
              setIsTimerActive(timerData.active);
              
              // Auto-end match when timer hits zero
              if (timerData.remaining === 0 && timerData.active === false) {
                determineWinner();
              }
            }
          }
        );
        timerSubscription = sub;
      } catch (error) {
        console.error('Error setting up timer subscription:', error);
      }
    };
    
    setupTimerSubscription();
    
    return () => {
      if (timerSubscription) {
        try {
          timerSubscription.unsubscribe?.();
        } catch (error) {
          console.error('Error unsubscribing from timer:', error);
        }
      }
    };
  }, [tournament, currentMatch, tournamentCode]);

  // Subscribe to vote tallies
  useEffect(() => {
    if (!tournament || !currentMatch || !tournamentCode) return;

    let voteSubscription: any = null;
    
    const setupVoteSubscription = async () => {
      try {
        const sub = await subscribeToVotes(
          tournamentCode,
          currentMatch.id,
          (votes) => {
            setLiveTallies(votes);
          }
        );
        voteSubscription = sub;
      } catch (error) {
        console.error('Error setting up vote subscription:', error);
      }
    };
    
    setupVoteSubscription();
    
    return () => {
      if (voteSubscription) {
        try {
          voteSubscription.unsubscribe?.();
        } catch (error) {
          console.error('Error unsubscribing from votes:', error);
        }
      }
    };
  }, [tournament, currentMatch, tournamentCode]);

  // Auto-determine winner
  const determineWinner = () => {
    if (!tournament || !currentMatch) return;
    if (!currentMatch.participant1 || !currentMatch.participant2) return;

    // Calculate winner based on votes
    const votes1 = liveTallies[currentMatch.participant1.id] || 0;
    const votes2 = liveTallies[currentMatch.participant2.id] || 0;

    // If tie or no votes, random winner
    if (votes1 === votes2) {
      const participants = [currentMatch.participant1, currentMatch.participant2];
      const winner = participants[Math.floor(Math.random() * participants.length)];
      handleEndMatch(winner);
    } else {
      // Winner is participant with most votes
      const winner = votes1 > votes2 ? currentMatch.participant1 : currentMatch.participant2;
      handleEndMatch(winner);
    }
  };

  const handleStartTimer = async () => {
    if (!tournamentCode) return;
    try {
      await updateTimer(tournamentCode, true);
      setIsTimerActive(true);
    } catch (error) {
      console.error('Error starting timer:', error);
    }
  };

  const handlePauseTimer = async () => {
    if (!tournamentCode) return;
    try {
      await updateTimer(tournamentCode, false);
      setIsTimerActive(false);
    } catch (error) {
      console.error('Error pausing timer:', error);
    }
  };

  const handleResetTimer = async () => {
    if (!tournament || !tournamentCode) return;
    try {
      await updateTimer(tournamentCode, false, tournament.roundDuration);
      setTimeRemaining(tournament.roundDuration);
      setIsTimerActive(false);
      setHasAccelerated(false);
    } catch (error) {
      console.error('Error resetting timer:', error);
    }
  };

  const handleAddTime = async (seconds: number) => {
    if (!tournamentCode) return;
    try {
      await updateTimer(tournamentCode, isTimerActive, timeRemaining + seconds);
      setTimeRemaining(prev => prev + seconds);
    } catch (error) {
      console.error('Error adding time:', error);
    }
  };

  const handleAccelerateTimer = async () => {
    if (!isTimerActive || hasAccelerated) return;
    
    try {
      const voteStatus = await checkAllVotersVoted(tournamentCode, currentMatch!.id);
      if (voteStatus.allVoted) {
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
      
      await endMatchWithWinner(tournamentCode, updatedTournament, winner);
      
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
      } else {
        onSetCurrentScreen('bracket');
      }
    } catch (error) {
      console.error('Error ending match:', error);
    }
  };

  const handleSelectWinner = (participantId: string) => {
    setSelectedWinner(participantId);
    setShowWinnerConfirm(true);
  };

  const handleConfirmWinner = () => {
    if (!selectedWinner || !currentMatch) return;
    
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

  // Calculate total votes
  const totalVotes = Object.values(liveTallies).reduce((sum, count) => sum + count, 0);
  
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
        liveTallies={liveTallies}
        totalVotes={totalVotes}
        connectedVoters={connectedVoters}
        tournamentCode={tournamentCode}
      />
      
      <MatchControls
        currentMatch={currentMatch}
        showWinnerConfirm={showWinnerConfirm}
        selectedWinner={selectedWinner}
        onSelectWinner={handleSelectWinner}
        onConfirmWinner={handleConfirmWinner}
        onRandomWinner={handleRandomWinner}
        onEndMatch={() => determineWinner()}
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
