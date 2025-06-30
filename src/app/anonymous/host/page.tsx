'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AnonymousSetup from '../../../components/anonymous/AnonymousSetup';
import AnonymousWaitingRoom from '../../../components/anonymous/AnonymousWaitingRoom';
import AnonymousTournamentBracket from '../../../components/anonymous/AnonymousTournamentBracket';
import AnonymousActiveMatch from '../../../components/anonymous/AnonymousActiveMatch';
import { Tournament, Participant, Match, GameState } from '../../../types/tournament';
import { createTournamentBracket } from '../../../utils/tournament';
import { generateTournamentCode, createTournamentInDB, updateTournamentState, getConnectedVotersCount } from '../../../utils/supabase';

type ScreenState = 'setup' | 'waiting' | 'bracket' | 'match';

export default function AnonymousHostPage() {
  const router = useRouter();
  const [currentScreen, setCurrentScreen] = useState<ScreenState>('setup');
  const [gameState, setGameState] = useState<GameState>({
    tournament: null,
    mode: 'anonymous',
    timerRemaining: 0,
    isTimerActive: false
  });
  const [tournamentCode, setTournamentCode] = useState<string>('');
  const [connectedVoters, setConnectedVoters] = useState<number>(0);

  // Load saved state on mount
  useEffect(() => {
    const saved = localStorage.getItem('anonymous-tournament-state');
    if (saved) {      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.gameState && typeof parsed.gameState === 'object') {
          setGameState(parsed.gameState);
          setTournamentCode(parsed.tournamentCode || '');
          if (parsed.gameState.tournament?.currentMatch) {
            setCurrentScreen('match');
          } else if (parsed.gameState.tournament?.status === 'active') {
            setCurrentScreen('bracket');
          } else if (parsed.gameState.tournament) {
            setCurrentScreen('waiting');
          }
        } else {
          localStorage.removeItem('anonymous-tournament-state');
        }
      } catch (error) {
        console.error('Failed to load saved state:', error);
        localStorage.removeItem('anonymous-tournament-state');
      }
    }
  }, []);

  // Save state whenever it changes
  useEffect(() => {
    if (gameState.tournament) {
      localStorage.setItem('anonymous-tournament-state', JSON.stringify({
        gameState,
        tournamentCode,
        currentScreen
      }));
    }
  }, [gameState, tournamentCode, currentScreen]);

  // Poll for connected voters count
  useEffect(() => {
    if (!tournamentCode) return;

    const pollVoters = async () => {
      try {
        const count = await getConnectedVotersCount(tournamentCode);
        setConnectedVoters(count);
      } catch (error) {
        console.error('Error getting voter count:', error);
      }
    };

    // Poll immediately and then every 2 seconds
    pollVoters();
    const interval = setInterval(pollVoters, 2000);

    return () => clearInterval(interval);
  }, [tournamentCode]);

  const handleCreateTournament = async (name: string, participants: Participant[], seeded: boolean) => {
    try {
      console.log('Creating anonymous tournament:', { name, participants, seeded });

      // Generate tournament code
      const code = generateTournamentCode();
      setTournamentCode(code);

      // Create tournament bracket
      const matches = createTournamentBracket(participants, seeded);

      // Create tournament object
      const newTournament: Tournament = {
        id: `tournament-${Date.now()}`,
        name: name.trim(),
        participants,
        matches,
        currentRound: 1,
        currentMatch: null,
        status: 'setup',
        roundDuration: 30, // Default 30 seconds for anonymous mode
        seeded,
        maxVoters: 50 // Default max voters
      };

      // Save tournament to database
      await createTournamentInDB(code, newTournament, participants);

      setGameState(prev => ({
        ...prev,
        tournament: newTournament
      }));
      setCurrentScreen('waiting');
    } catch (error) {
      console.error('Error creating tournament:', error);
      alert('Failed to create tournament. Please try again.');
    }
  };

  const handleStartTournament = async () => {
    if (gameState.tournament && tournamentCode) {
      try {
        console.log('Starting tournament and updating database...');
        
        const updatedTournament = {
          ...gameState.tournament,
          status: 'active' as const
        };
        
        // Update database so voters can see tournament has started
        await updateTournamentState(tournamentCode, updatedTournament);
        
        // Update local state
        setGameState(prev => ({
          ...prev,
          tournament: updatedTournament
        }));
        
        setCurrentScreen('bracket');
      } catch (error) {
        console.error('Error starting tournament:', error);
        
        // Fallback: just update local state
        const updatedTournament = {
          ...gameState.tournament,
          status: 'active' as const
        };
        setGameState(prev => ({
          ...prev,
          tournament: updatedTournament
        }));
        setCurrentScreen('bracket');
      }
    }
  };

  const handleStartMatch = (match: Match) => {
    if (gameState.tournament) {
      const updatedTournament = {
        ...gameState.tournament,
        currentMatch: match
      };
      setGameState(prev => ({
        ...prev,
        tournament: updatedTournament
      }));
      setCurrentScreen('match');
    }
  };

  const handleMatchComplete = (completedMatch: Match) => {
    if (gameState.tournament) {
      // Update the tournament with the completed match
      const updatedMatches = gameState.tournament.matches.map((m: Match) =>
        m.id === completedMatch.id ? completedMatch : m
      );

      const updatedTournament = {
        ...gameState.tournament,
        matches: updatedMatches,
        currentMatch: null
      };

      setGameState(prev => ({
        ...prev,
        tournament: updatedTournament
      }));
      setCurrentScreen('bracket');
    }
  };

  const handleBackToBracket = () => {
    if (gameState.tournament) {
      const updatedTournament = {
        ...gameState.tournament,
        currentMatch: null
      };
      setGameState(prev => ({
        ...prev,
        tournament: updatedTournament
      }));
      setCurrentScreen('bracket');
    }
  };

  const handleBack = () => {
    // Clear saved state when going back to home
    localStorage.removeItem('anonymous-tournament-state');
    router.push('/');
  };

  const handleResetTournament = () => {
    localStorage.removeItem('anonymous-tournament-state');
    setGameState({
      tournament: null,
      mode: 'anonymous',
      timerRemaining: 0,
      isTimerActive: false
    });
    setTournamentCode('');
    setConnectedVoters(0);
    setCurrentScreen('setup');
  };

  const updateGameState = (updater: (prev: GameState) => GameState) => {
    setGameState(updater);
  };

  const setCurrentScreenState = (screen: 'home' | 'setup' | 'bracket' | 'match') => {
    if (screen === 'home') {
      handleBack();
    } else if (screen === 'setup') {
      setCurrentScreen('setup');
    } else if (screen === 'bracket') {
      setCurrentScreen('bracket');
    } else if (screen === 'match') {
      setCurrentScreen('match');
    }
  };  const renderScreen = () => {
    switch (currentScreen) {
      case 'setup':
        return (
          <AnonymousSetup 
            onCreateTournament={handleCreateTournament}
            onBack={handleBack}
          />
        );
      case 'waiting':
        return gameState.tournament ? (
          <AnonymousWaitingRoom 
            tournament={gameState.tournament}
            tournamentCode={tournamentCode}
            connectedVoters={connectedVoters}
            onStartTournament={handleStartTournament}
            onBack={handleResetTournament}
          />
        ) : null;
      case 'bracket':
        return gameState.tournament ? (
          <AnonymousTournamentBracket 
            gameState={gameState}
            tournament={gameState.tournament}
            tournamentCode={tournamentCode}
            connectedVoters={connectedVoters}
            onUpdateGameState={updateGameState}
            onSetCurrentScreen={setCurrentScreenState}
            onGoHome={handleBack}
            onGoToSetup={() => setCurrentScreen('setup')}
          />
        ) : null;
      case 'match':
        return gameState.tournament ? (
          <AnonymousActiveMatch 
            gameState={gameState}
            tournament={gameState.tournament}
            tournamentCode={tournamentCode}
            connectedVoters={connectedVoters}
            onUpdateGameState={updateGameState}
            onSetCurrentScreen={setCurrentScreenState}
          />
        ) : null;
      default:
        return (
          <AnonymousSetup 
            onCreateTournament={handleCreateTournament}
            onBack={handleBack}
          />
        );
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-100 via-blue-50 to-indigo-100">
      {/* Debug Panel - shown when there might be issues */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 left-4 z-50">
          <div className="bg-white border-2 border-purple-300 rounded-lg p-3 shadow-lg">
            <h4 className="text-sm font-bold text-purple-700 mb-2">Anonymous Tournament Debug</h4>
            <div className="text-xs text-gray-600 mb-2">
              Current Screen: {currentScreen}<br/>
              Tournament: {gameState.tournament ? 'Loaded' : 'None'}<br/>
              Tournament Code: {tournamentCode || 'None'}<br/>
              Connected Voters: {connectedVoters}<br/>
              Current Match: {gameState.tournament?.currentMatch ? 'Active' : 'None'}
            </div>
            <button
              onClick={handleResetTournament}
              className="bg-purple-500 hover:bg-purple-600 text-white text-xs px-2 py-1 rounded"
            >
              Reset Tournament
            </button>
          </div>
        </div>
      )}
      {renderScreen()}
    </main>
  );
}
