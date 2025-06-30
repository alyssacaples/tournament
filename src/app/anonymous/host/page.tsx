'use client';

import React, { useState, useEffect } from 'react';
import { GameState, Participant } from '@/types/tournament';
import { 
  createTournament, 
  generateRandomCode, 
  setupTournament, 
  findNextActiveMatch, 
  getMaxRounds,
  formatRoundName 
} from '@/utils/tournament';
import HomeScreen from '@/components/HomeScreen';
import ParticipantSetup from '@/components/ParticipantSetup';
import AnonymousTournamentBracket from '@/components/interactive/AnonymousTournamentBracket';
import AnonymousActiveMatch from '@/components/interactive/AnonymousActiveMatch';
import { supabase, createTournamentInDB, logSupabaseOperation, createRobustSubscription, cleanupSubscription } from '@/utils/supabase';
import { Users, Wifi, WifiOff, RefreshCw } from 'lucide-react';

const AnonymousHostPage: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>({
    currentScreen: 'home'
  });
  const [tournamentCode, setTournamentCode] = useState<string>('');
  const [connectedVoters, setConnectedVoters] = useState(0);
  const [isConnected, setIsConnected] = useState(true);

  // Setup tournament code when hosting starts
  useEffect(() => {
    if (gameState.currentScreen === 'setup' && !tournamentCode) {
      const code = generateRandomCode();
      setTournamentCode(code);
    }
  }, [gameState.currentScreen, tournamentCode]);

  // Monitor connection status
  useEffect(() => {
    const checkConnection = () => {
      setIsConnected(navigator.onLine);
    };

    window.addEventListener('online', checkConnection);
    window.addEventListener('offline', checkConnection);
    checkConnection();

    return () => {
      window.removeEventListener('online', checkConnection);
      window.removeEventListener('offline', checkConnection);
    };
  }, []);

  // Subscribe to connected voters count
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

                  const activeVoters = data?.filter(voter => 
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
          const activeVoters = data.filter(voter => 
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

  const handleStartTournament = async (participants: Participant[]) => {
    try {
      const tournament = createTournament(participants);
      const setupResult = setupTournament(tournament);
      
      // Create tournament in database
      await createTournamentInDB(tournamentCode, setupResult, participants);
      
      const nextMatch = findNextActiveMatch(setupResult);
      
      setGameState({
        currentScreen: nextMatch ? 'match' : 'bracket',
        participants,
        tournament: {
          ...setupResult,
          currentMatch: nextMatch
        }
      });

      await logSupabaseOperation('Tournament started', {
        code: tournamentCode,
        participantCount: participants.length,
        totalRounds: getMaxRounds(participants.length)
      });

    } catch (error) {
      console.error('Error starting tournament:', error);
      alert('Failed to start tournament. Please try again.');
    }
  };

  const handleSetCurrentScreen = (screen: 'home' | 'setup' | 'bracket' | 'match') => {
    setGameState(prev => ({ ...prev, currentScreen: screen }));
  };

  const renderCurrentScreen = () => {
    switch (gameState.currentScreen) {
      case 'home':
        return (
          <HomeScreen 
            onStartLocal={() => handleSetCurrentScreen('setup')}
            onStartTest={() => handleSetCurrentScreen('setup')}
          />
        );
        
      case 'setup':
        return (
          <ParticipantSetup 
            onCreateTournament={(name, participantNames) => {
              const participants = participantNames.map((name, index) => ({
                id: `participant-${index}`,
                name,
                visualId: index % 20 // Using constants length
              }));
              handleStartTournament(participants);
            }}
            onBack={() => handleSetCurrentScreen('home')}
          />
        );
        
      case 'bracket':
        return (
          <AnonymousTournamentBracket
            gameState={gameState}
            onUpdateGameState={setGameState}
            onSetCurrentScreen={handleSetCurrentScreen}
            tournamentCode={tournamentCode}
          />
        );
        
      case 'match':
        return (
          <AnonymousActiveMatch
            gameState={gameState}
            onUpdateGameState={setGameState}
            onSetCurrentScreen={handleSetCurrentScreen}
            tournamentCode={tournamentCode}
            connectedVoters={connectedVoters}
          />
        );
        
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header with tournament info */}
        {(gameState.currentScreen === 'setup' || gameState.currentScreen === 'bracket' || gameState.currentScreen === 'match') && (
          <div className="mb-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="text-white">
                    <h2 className="text-xl font-bold">Tournament Host</h2>
                    <p className="text-white/80">Code: <span className="font-mono text-yellow-300 text-lg">{tournamentCode}</span></p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-6">
                  <div className="flex items-center space-x-2 text-white">
                    <Users size={20} />
                    <span className="font-semibold">{connectedVoters}</span>
                    <span className="text-white/80">voters</span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {isConnected ? (
                      <Wifi className="text-green-400" size={20} />
                    ) : (
                      <WifiOff className="text-red-400" size={20} />
                    )}
                    <span className={`text-sm ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
                      {isConnected ? 'Online' : 'Offline'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main content */}
        {renderCurrentScreen()}

        {/* Instructions for voters */}
        {(gameState.currentScreen === 'setup' || gameState.currentScreen === 'bracket' || gameState.currentScreen === 'match') && (
          <div className="mt-8">
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              <h3 className="text-white font-semibold mb-2">For Voters:</h3>
              <p className="text-white/80 text-sm">
                Go to <span className="font-mono bg-white/10 px-2 py-1 rounded">{window.location.origin}/anonymous/vote</span> and enter code: <span className="font-mono text-yellow-300 font-bold">{tournamentCode}</span>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnonymousHostPage;
