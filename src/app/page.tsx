'use client';

import React, { useState, useEffect } from 'react';
import { GameState, Tournament } from '@/types/tournament';
import HomeScreen from '@/components/HomeScreen';
import ParticipantSetup from '@/components/ParticipantSetup';
import TournamentBracket from '@/components/TournamentBracket';
import ActiveMatch from '@/components/ActiveMatch';
import { generateTestParticipants, createTournamentBracket } from '@/utils/tournament';

export default function Home() {
  const [gameState, setGameState] = useState<GameState>({
    tournament: null,
    mode: 'local',
    timerRemaining: 0,
    isTimerActive: false
  });

  const [currentScreen, setCurrentScreen] = useState<'home' | 'setup' | 'bracket' | 'match'>('home');

  // Load saved state on mount
  useEffect(() => {
    const saved = localStorage.getItem('tournament-state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Validate the parsed data structure
        if (parsed && parsed.tournament && typeof parsed.tournament === 'object') {
          setGameState(parsed);
          if (parsed.tournament.currentMatch) {
            setCurrentScreen('match');
          } else {
            setCurrentScreen('bracket');
          }
        } else {
          // Clear invalid data
          localStorage.removeItem('tournament-state');
        }
      } catch (error) {
        console.error('Failed to load saved state:', error);
        // Clear corrupted data
        localStorage.removeItem('tournament-state');
      }
    }
  }, []);

  // Save state whenever it changes
  useEffect(() => {
    if (gameState.tournament) {
      localStorage.setItem('tournament-state', JSON.stringify(gameState));
    }
  }, [gameState]);

  const startTestMode = () => {
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

    setGameState(prev => ({
      ...prev,
      tournament,
      mode: 'test'
    }));
    setCurrentScreen('bracket');
  };

  const startLocalMode = () => {
    setGameState(prev => ({ ...prev, mode: 'local' }));
    setCurrentScreen('setup');
  };

  const createTournament = (name: string, participantNames: string[], seeded: boolean = false) => {
    const participants = participantNames.map((name, index) => ({
      id: `participant-${index}`,
      name,
      visualId: index
    }));
    
    const matches = createTournamentBracket(participants, seeded);
    
    const tournament: Tournament = {
      id: `tournament-${Date.now()}`,
      name,
      participants,
      matches,
      currentRound: 1,
      currentMatch: null,
      status: 'active',
      roundDuration: 120, // 2 minutes
      seeded
    };

    setGameState(prev => ({
      ...prev,
      tournament
    }));
    setCurrentScreen('bracket');
  };

  const goToHome = () => {
    setCurrentScreen('home');
    setGameState(prev => ({ ...prev, tournament: null }));
    localStorage.removeItem('tournament-state');
  };

  const clearStorageAndRestart = () => {
    localStorage.clear();
    setGameState({
      tournament: null,
      mode: 'local',
      timerRemaining: 0,
      isTimerActive: false
    });
    setCurrentScreen('home');
    window.location.reload();
  };

  const goToSetup = () => {
    setCurrentScreen('setup');
  };

  const updateGameState = (updater: (prev: GameState) => GameState) => {
    setGameState(updater);
  };

  const setCurrentScreenState = (screen: 'home' | 'setup' | 'bracket' | 'match') => {
    setCurrentScreen(screen);
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'home':
        return (
          <HomeScreen 
            onStartLocal={startLocalMode}
            onStartTest={startTestMode}
          />
        );
      case 'setup':
        return (
          <ParticipantSetup 
            onCreateTournament={createTournament}
            onBack={goToHome}
          />
        );
      case 'bracket':
        return (
          <TournamentBracket 
            gameState={gameState}
            onUpdateGameState={updateGameState}
            onSetCurrentScreen={setCurrentScreenState}
            onGoHome={goToHome}
            onGoToSetup={goToSetup}
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
        return <HomeScreen onStartLocal={startLocalMode} onStartTest={startTestMode} />;
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-orange-100 via-yellow-50 to-red-100">
      {/* Debug Panel - shown when there might be issues */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 left-4 z-50">
          <div className="bg-white border-2 border-red-300 rounded-lg p-3 shadow-lg">
            <h4 className="text-sm font-bold text-red-700 mb-2">Debug Panel</h4>
            <div className="text-xs text-gray-600 mb-2">
              Current Screen: {currentScreen}<br/>
              Tournament: {gameState.tournament ? 'Loaded' : 'None'}<br/>
              Current Match: {gameState.tournament?.currentMatch ? 'Active' : 'None'}
            </div>
            <button
              onClick={clearStorageAndRestart}
              className="bg-red-500 hover:bg-red-600 text-white text-xs px-2 py-1 rounded"
            >
              Clear & Restart
            </button>
          </div>
        </div>
      )}
      {renderScreen()}
    </main>
  );
}
