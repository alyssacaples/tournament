'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { GameState, Tournament, Participant } from '@/types/tournament';
import ParticipantSetup from '@/components/ParticipantSetup';
import TournamentBracket from '@/components/TournamentBracket';
import ActiveMatch from '@/components/ActiveMatch';
import { generateTestParticipants, createTournamentBracket } from '@/utils/tournament';

export default function LocalTournamentPage() {
  const router = useRouter();
  const [gameState, setGameState] = useState<GameState>({
    tournament: null,
    mode: 'local',
    timerRemaining: 0,
    isTimerActive: false
  });

  const [currentScreen, setCurrentScreen] = useState<'setup' | 'bracket' | 'match'>('setup');

  // Load saved state on mount
  useEffect(() => {
    const saved = localStorage.getItem('local-tournament-state');
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
        } else {
          localStorage.removeItem('local-tournament-state');
        }
      } catch (error) {
        console.error('Failed to load saved state:', error);
        localStorage.removeItem('local-tournament-state');
      }
    }
  }, []);

  // Save state whenever it changes
  useEffect(() => {
    if (gameState.tournament) {
      localStorage.setItem('local-tournament-state', JSON.stringify(gameState));
    }
  }, [gameState]);

  const createTournament = (name: string, participants: string[] | Participant[], seeded: boolean = false) => {
    // Check if participants is an array of strings or Participant objects
    const participantObjects: Participant[] = Array.isArray(participants) && participants.length > 0
      ? typeof participants[0] === 'string'
        ? // It's an array of strings, convert to Participant objects
          (participants as string[]).map((name, index) => ({
            id: `participant-${index}`,
            name,
            visualId: index
          }))
        : // It's already an array of Participant objects
          participants as Participant[] 
      : [];
    
    const matches = createTournamentBracket(participantObjects, seeded);
    
    const tournament: Tournament = {
      id: `tournament-${Date.now()}`,
      name,
      participants: participantObjects,
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
    localStorage.removeItem('local-tournament-state');
    router.push('/');
  };

  const goToSetup = () => {
    setCurrentScreen('setup');
  };

  const updateGameState = (updater: (prev: GameState) => GameState) => {
    setGameState(updater);
  };

  const setCurrentScreenState = (screen: 'setup' | 'bracket' | 'match' | 'home') => {
    if (screen === 'home') {
      goToHome();
    } else {
      setCurrentScreen(screen);
    }
  };

  const clearStorageAndRestart = () => {
    localStorage.removeItem('local-tournament-state');
    setGameState({
      tournament: null,
      mode: 'local',
      timerRemaining: 0,
      isTimerActive: false
    });
    setCurrentScreen('setup');
  };

  const renderScreen = () => {
    switch (currentScreen) {
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
        return (
          <ParticipantSetup 
            onCreateTournament={createTournament}
            onBack={goToHome}
          />
        );
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-orange-100 via-yellow-50 to-red-100">
      {/* Debug Panel - shown when there might be issues */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 left-4 z-50">
          <div className="bg-white border-2 border-red-300 rounded-lg p-3 shadow-lg">
            <h4 className="text-sm font-bold text-red-700 mb-2">Local Tournament Debug</h4>
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
