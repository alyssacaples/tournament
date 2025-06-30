'use client';

import React, { useState, useEffect } from 'react';
import { GameState, Match } from '@/types/tournament';
import { getNextMatch, isRoundComplete, getMaxRounds, advanceWinner, getCurrentRound } from '@/utils/tournament';
import TournamentSettings from '@/components/bracket/TournamentSettings';
import BracketDisplay from '@/components/bracket/BracketDisplay';
import TournamentControls from '@/components/bracket/TournamentControls';
import {
  updateTournamentInDB,
  startMatchWithTimer,
  subscribeToTournamentUpdates
} from '@/utils/supabase';

interface AnonymousTournamentBracketProps {
  gameState: GameState;
  onUpdateGameState: (updater: (prev: GameState) => GameState) => void;
  onSetCurrentScreen: (screen: 'waiting' | 'bracket' | 'match') => void;
  onGoHome: () => void;
  tournamentCode: string;
  connectedVoters: number;
}

export default function AnonymousTournamentBracket({
  gameState,
  onUpdateGameState,
  onSetCurrentScreen,
  onGoHome,
  tournamentCode,
  connectedVoters
}: AnonymousTournamentBracketProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [roundDuration, setRoundDuration] = useState(gameState.tournament?.roundDuration || 120);
  
  useEffect(() => {
    // Subscribe to tournament updates from Supabase
    const subscription = subscribeToTournamentUpdates(tournamentCode, (updatedTournament) => {
      if (updatedTournament) {
        onUpdateGameState(prev => ({
          ...prev,
          tournament: updatedTournament
        }));
      }
    });
    
    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [tournamentCode, onUpdateGameState]);

  if (!gameState.tournament) return null;

  const { tournament } = gameState;
  const maxRounds = getMaxRounds(tournament.participants.length);
  
  // Auto-detect current round based on match states
  const actualCurrentRound = getCurrentRound(tournament.matches);
  
  // Update tournament current round if it's different
  if (actualCurrentRound !== tournament.currentRound) {
    onUpdateGameState(prev => ({
      ...prev,
      tournament: prev.tournament ? {
        ...prev.tournament,
        currentRound: actualCurrentRound
      } : null
    }));
  }
  
  // Group matches by round and sort by position within each round
  const matchesByRound = tournament.matches.reduce((acc, match) => {
    if (!acc[match.round]) acc[match.round] = [];
    acc[match.round].push(match);
    return acc;
  }, {} as Record<number, Match[]>);
  
  // Sort matches within each round by position
  Object.keys(matchesByRound).forEach(round => {
    matchesByRound[parseInt(round)].sort((a, b) => a.position - b.position);
  });

  const nextMatch = getNextMatch(tournament.matches, actualCurrentRound);
  const currentRoundComplete = isRoundComplete(tournament.matches, actualCurrentRound);

  const handleStartNextMatch = async () => {
    if (!nextMatch) return;
    
    try {
      const updatedTournament = {
        ...tournament,
        currentMatch: nextMatch
      };
      
      await startMatchWithTimer(tournamentCode, updatedTournament, tournament.roundDuration);
      
      onUpdateGameState(prev => ({
        ...prev,
        tournament: updatedTournament
      }));
      
      setTimeout(() => {
        onSetCurrentScreen('match');
      }, 100);
      
    } catch (error) {
      console.error('Error starting match:', error);
      
      // Fallback: just set the match and go to match screen
      onUpdateGameState(prev => ({
        ...prev,
        tournament: prev.tournament ? {
          ...prev.tournament,
          currentMatch: nextMatch
        } : null
      }));
      onSetCurrentScreen('match');
    }
  };

  const handleStartSpecificMatch = async (match: Match) => {
    if (match.status !== 'pending' || !match.participant1 || !match.participant2) {
      return;
    }
    
    try {
      const updatedTournament = {
        ...tournament,
        currentMatch: match
      };
      
      await startMatchWithTimer(tournamentCode, updatedTournament, tournament.roundDuration);
      
      onUpdateGameState(prev => ({
        ...prev,
        tournament: updatedTournament
      }));
      
      setTimeout(() => {
        onSetCurrentScreen('match');
      }, 100);
      
    } catch (error) {
      console.error('Error starting specific match:', error);
      
      // Fallback: just set the match and go to match screen
      onUpdateGameState(prev => ({
        ...prev,
        tournament: prev.tournament ? {
          ...prev.tournament,
          currentMatch: match
        } : null
      }));
      onSetCurrentScreen('match');
    }
  };

  const handleSkipMatch = async () => {
    if (!nextMatch) return;
    
    const winner = nextMatch.participant1 || nextMatch.participant2;
    if (!winner) return;

    let updatedMatches = tournament.matches.map(m => 
      m.id === nextMatch.id 
        ? { ...m, winner, status: 'completed' as const }
        : m
    );

    updatedMatches = advanceWinner(updatedMatches, { ...nextMatch, winner });

    const updatedTournament = {
      ...tournament,
      matches: updatedMatches
    };
    
    try {
      await updateTournamentInDB(tournamentCode, updatedTournament);
      
      onUpdateGameState(prev => ({
        ...prev,
        tournament: updatedTournament
      }));
    } catch (error) {
      console.error('Error skipping match:', error);
    }
  };

  const handleAdvanceRound = async () => {
    if (!currentRoundComplete) return;
    
    const nextRound = tournament.currentRound + 1;
    if (nextRound > maxRounds) {
      const updatedTournament = {
        ...tournament,
        status: 'completed'
      };
      
      try {
        await updateTournamentInDB(tournamentCode, updatedTournament);
        
        onUpdateGameState(prev => ({
          ...prev,
          tournament: updatedTournament
        }));
      } catch (error) {
        console.error('Error completing tournament:', error);
      }
      return;
    }

    const updatedTournament = {
      ...tournament,
      currentRound: nextRound
    };
    
    try {
      await updateTournamentInDB(tournamentCode, updatedTournament);
      
      onUpdateGameState(prev => ({
        ...prev,
        tournament: updatedTournament
      }));
    } catch (error) {
      console.error('Error advancing round:', error);
    }
  };

  const handleUpdateRoundDuration = async (duration: number) => {
    setRoundDuration(duration);
    
    const updatedTournament = {
      ...tournament,
      roundDuration: duration
    };
    
    try {
      await updateTournamentInDB(tournamentCode, updatedTournament);
      
      onUpdateGameState(prev => ({
        ...prev,
        tournament: updatedTournament
      }));
    } catch (error) {
      console.error('Error updating round duration:', error);
    }
  };

  const handleResetTournament = async () => {
    if (window.confirm('Are you sure you want to reset the tournament? All progress will be lost.')) {
      const resetTournament = {
        ...tournament,
        currentMatch: null,
        currentRound: 1,
        matches: tournament.matches.map(match => ({
          ...match,
          winner: null,
          status: match.round === 1 ? 'pending' : 'pending'
        }))
      };
      
      try {
        await updateTournamentInDB(tournamentCode, resetTournament);
        
        onUpdateGameState(prev => ({
          ...prev,
          tournament: resetTournament
        }));
      } catch (error) {
        console.error('Error resetting tournament:', error);
      }
    }
  };

  const handleGoHome = () => {
    if (window.confirm('Are you sure you want to go home? Tournament progress will be saved.')) {
      onGoHome();
    }
  };

  // Check if we can advance to next round
  const canAdvanceRound = currentRoundComplete && tournament.currentRound < maxRounds;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex flex-col">
      {/* Settings Modal */}
      <TournamentSettings
        showSettings={showSettings}
        roundDuration={roundDuration}
        onShowSettings={setShowSettings}
        onUpdateRoundDuration={handleUpdateRoundDuration}
        onGoHome={handleGoHome}
      />

      {/* Top Controls Bar */}
      <TournamentControls
        nextMatch={nextMatch}
        currentRoundComplete={currentRoundComplete}
        connectedVoters={connectedVoters}
        maxRounds={maxRounds}
        currentRound={actualCurrentRound}
        canAdvanceRound={canAdvanceRound}
        onStartNextMatch={handleStartNextMatch}
        onSkipMatch={handleSkipMatch}
        onAdvanceRound={handleAdvanceRound}
        onGoHome={handleGoHome}
        onOpenSettings={() => setShowSettings(true)}
        onResetTournament={handleResetTournament}
      />

      {/* Tournament Header */}
      <div className="px-6 py-4 border-b border-white/10">
        <h1 className="text-2xl font-bold text-white">{tournament.name}</h1>
        <div className="flex items-center">
          <p className="text-white/60 text-sm">Anonymous Tournament</p>
          <div className="ml-4 bg-yellow-400 text-black px-2 py-0.5 rounded text-xs font-bold">
            CODE: {tournamentCode}
          </div>
          <div className="ml-4 flex items-center text-white/60 text-sm">
            <span className="bg-green-500 h-2 w-2 rounded-full inline-block mr-1"></span>
            {connectedVoters} voters
          </div>
        </div>
      </div>

      {/* Main Bracket Display */}
      <div className="flex-1 min-h-0">
        <BracketDisplay
          tournament={tournament}
          matchesByRound={matchesByRound}
          maxRounds={maxRounds}
          onStartMatch={handleStartSpecificMatch}
        />
      </div>
    </div>
  );
}
