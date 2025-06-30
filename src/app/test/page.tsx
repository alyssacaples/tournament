'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { GameState, Tournament } from '@/types/tournament';
import TournamentBracket from '@/components/modes/local/TournamentBracket';
import ActiveMatch from '@/components/modes/local/ActiveMatch';
import { generateTestParticipants, createTournamentBracket } from '@/utils/tournament';

export default function TestModePage() {
  const router = useRouter();
  const [gameState, setGameState] = useState<GameState>({
    tournament: null,
    mode: 'test',
    timerRemaining: 0,
    isTimerActive: false
  });

  const [currentScreen, setCurrentScreen] = useState<'bracket' | 'match'>('bracket');

  // Initialize test tournament on mount
  useEffect(() => {
    // Check if there's a saved test tournament
    const saved = localStorage.getItem('test-tournament-state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.tournament && typeof parsed.tournament === 'object') {
          setGameState(parsed);
          if (parsed.tournament.currentMatch) {
            setCurrentScreen('match');
          } else {
            setCurrentScreen('bracket');
          }
          return;
        }
      } catch (error) {
        console.error('Failed to load saved test state:', error);
      }
    }

    // Create new test tournament
    const participantCount = Math.floor(Math.random() * 15) + 2; // 2-16 participants
    const participants = generateTestParticipants(participantCount);
    const matches = createTournamentBracket(participants, false); // Test mode is not seeded
    
    const tournament: Tournament = {
      id: `test-${Date.now()}`,
      name: 'Breakfast Tournament',
      participants,
      matches,
      currentRound: 1,
      currentMatch: null,
      status: 'active',
      roundDuration: 120, // 2 minutes
      seeded: false
    };

    setGameState({
      tournament,
      mode: 'test',
      timerRemaining: 0,
      isTimerActive: false
    });
  }, []);

  // Save state whenever it changes
  useEffect(() => {
    if (gameState.tournament) {
      localStorage.setItem('test-tournament-state', JSON.stringify(gameState));
    }
  }, [gameState]);

  const goToHome = () => {
    localStorage.removeItem('test-tournament-state');
    router.push('/');
  };

  const updateGameState = (updater: (prev: GameState) => GameState) => {
    setGameState(updater);
  };

  const setCurrentScreenState = (screen: 'setup' | 'bracket' | 'match' | 'home') => {
    if (screen === 'home') {
      goToHome();
    } else if (screen === 'bracket') {
      setCurrentScreen('bracket');
    } else if (screen === 'match') {
      setCurrentScreen('match');
    }
    // Test mode doesn't have a setup screen
  };

  const clearStorageAndRestart = () => {
    localStorage.removeItem('test-tournament-state');
    window.location.reload(); // Reload to generate new test tournament
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'bracket':
        return (
          <TournamentBracket 
            gameState={gameState}
            onUpdateGameState={updateGameState}
            onSetCurrentScreen={setCurrentScreenState}
            onGoHome={goToHome}
            onGoToSetup={() => {}} // Test mode doesn't have setup
          />
        );
      case 'match':
        return (
          <ActiveMatch 
            gameState={gameState}
            onUpdateGameState={updateGameState}
            onSetCurrentScreen={setCurrentScreenState}
          />
        );
      default:
        return (
          <TournamentBracket 
            gameState={gameState}
            onUpdateGameState={updateGameState}
            onSetCurrentScreen={setCurrentScreenState}
            onGoHome={goToHome}
            onGoToSetup={() => {}}
          />
        );
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-green-100 via-yellow-50 to-orange-100">
      {/* Debug Panel */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 left-4 z-50">
          <div className="bg-white border-2 border-green-300 rounded-lg p-3 shadow-lg">
            <h4 className="text-sm font-bold text-green-700 mb-2">Test Mode Debug</h4>
            <div className="text-xs text-gray-600 mb-2">
              Current Screen: {currentScreen}<br/>
              Tournament: {gameState.tournament ? 'Loaded' : 'None'}<br/>
              Participants: {gameState.tournament?.participants.length || 0}<br/>
              Current Match: {gameState.tournament?.currentMatch ? 'Active' : 'None'}
            </div>
            <button
              onClick={clearStorageAndRestart}
              className="bg-green-500 hover:bg-green-600 text-white text-xs px-2 py-1 rounded"
            >
              New Test Tournament
            </button>
          </div>
        </div>
      )}
      {renderScreen()}
    </main>
  );
}
