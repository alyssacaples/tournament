'use client';

import React, { useState } from 'react';
import { GameState, Match } from '@/types/tournament';
import { getNextMatch, isRoundComplete, getMaxRounds, advanceWinner, getCurrentRound } from '@/utils/tournament';
import TournamentSettings from '../../bracket/TournamentSettings';
import BracketDisplay from '../../bracket/BracketDisplay';
import TournamentControls from '../../bracket/TournamentControls';

interface TournamentBracketProps {
  gameState: GameState;
  onUpdateGameState: (updater: (prev: GameState) => GameState) => void;
  onSetCurrentScreen: (screen: 'home' | 'setup' | 'bracket' | 'match') => void;
  onGoHome: () => void;
  onGoToSetup: () => void;
}

export default function TournamentBracket({
  gameState,
  onUpdateGameState,
  onSetCurrentScreen,
  onGoHome,
  onGoToSetup
}: TournamentBracketProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [roundDuration, setRoundDuration] = useState(gameState.tournament?.roundDuration || 120);

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

  const handleStartNextMatch = () => {
    if (!nextMatch) return;
    
    onUpdateGameState(prev => ({
      ...prev,
      tournament: prev.tournament ? {
        ...prev.tournament,
        currentMatch: nextMatch
      } : null
    }));
    onSetCurrentScreen('match');
  };

  const handleStartSpecificMatch = (match: Match) => {
    onUpdateGameState(prev => ({
      ...prev,
      tournament: prev.tournament ? {
        ...prev.tournament,
        currentMatch: match
      } : null
    }));
    onSetCurrentScreen('match');
  };

  const handleSkipMatch = () => {
    if (!nextMatch) return;
    
    const winner = nextMatch.participant1 || nextMatch.participant2;
    if (!winner) return;

    let updatedMatches = tournament.matches.map(m => 
      m.id === nextMatch.id 
        ? { ...m, winner, status: 'completed' as const }
        : m
    );

    updatedMatches = advanceWinner(updatedMatches, { ...nextMatch, winner });

    onUpdateGameState(prev => ({
      ...prev,
      tournament: prev.tournament ? {
        ...prev.tournament,
        matches: updatedMatches
      } : null
    }));
  };

  const handleAdvanceRound = () => {
    if (!currentRoundComplete) return;
    
    const nextRound = tournament.currentRound + 1;
    if (nextRound > maxRounds) {
      onUpdateGameState(prev => ({
        ...prev,
        tournament: prev.tournament ? {
          ...prev.tournament,
          status: 'completed'
        } : null
      }));
      return;
    }

    let updatedMatches = [...tournament.matches];
    const currentRoundMatches = updatedMatches.filter(m => 
      m.round === tournament.currentRound && m.status === 'completed' && m.winner
    );

    // Create next round matches
    for (let i = 0; i < currentRoundMatches.length; i += 2) {
      const match1 = currentRoundMatches[i];
      const match2 = currentRoundMatches[i + 1];
      
      if (match1 && match2 && match1.winner && match2.winner) {
        const newMatch: Match = {
          id: `${nextRound}-${Math.floor(i/2) + 1}`,
          round: nextRound,
          position: Math.floor(i/2) + 1,
          participant1: match1.winner,
          participant2: match2.winner,
          winner: null,
          status: 'pending'
        };
        updatedMatches.push(newMatch);
      }
    }

    onUpdateGameState(prev => ({
      ...prev,
      tournament: prev.tournament ? {
        ...prev.tournament,
        matches: updatedMatches,
        currentRound: nextRound
      } : null
    }));
  };

  const handleUpdateRoundDuration = (duration: number) => {
    setRoundDuration(duration);
    onUpdateGameState(prev => ({
      ...prev,
      tournament: prev.tournament ? {
        ...prev.tournament,
        roundDuration: duration
      } : null
    }));
  };

  const handleResetTournament = () => {
    if (window.confirm('Are you sure you want to reset the tournament? All progress will be lost.')) {
      onUpdateGameState(prev => ({
        ...prev,
        tournament: prev.tournament ? {
          ...prev.tournament,
          currentMatch: null,
          currentRound: 1,
          matches: prev.tournament.matches.map(match => ({
            ...match,
            winner: null,
            status: match.round === 1 ? 'pending' : 'pending'
          }))
        } : null
      }));
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
        onGoHome={onGoHome}
        onGoToSetup={onGoToSetup}
      />

      {/* Top Controls Bar */}
      <TournamentControls
        nextMatch={nextMatch}
        currentRoundComplete={currentRoundComplete}
        connectedVoters={0}
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
        <p className="text-white/60 text-sm">Local Tournament</p>
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
