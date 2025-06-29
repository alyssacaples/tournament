'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { GameState, Tournament, Participant } from '@/types/tournament';
import { createTournamentBracket } from '@/utils/tournament';
import { supabase, generateTournamentCode } from '@/utils/supabase';
import { SHAPE_COLOR_COMBOS } from '@/data/constants';

import AnonymousModeSetup from '@/components/interactive/AnonymousModeSetup';
import AnonymousTournamentBracket from '@/components/interactive/AnonymousTournamentBracket';
import AnonymousActiveMatch from '@/components/interactive/AnonymousActiveMatch';

type Screen = 'setup' | 'bracket' | 'match' | 'home';

export default function AnonymousHostPage() {
  const router = useRouter();
  const [currentScreen, setCurrentScreen] = useState<Screen>('setup');
  const [gameState, setGameState] = useState<GameState>({
    tournament: null,
    mode: 'anonymous',
    timerRemaining: 0,
    isTimerActive: false
  });
  const [tournamentCode, setTournamentCode] = useState<string>('');
  const [connectedVoters, setConnectedVoters] = useState<number>(0);

  // Load connection count
  useEffect(() => {
    if (!gameState.tournament?.id) return;

    const loadConnectionCount = async () => {
      const { count } = await supabase
        .from('connections')
        .select('*', { count: 'exact', head: true })
        .eq('tournament_id', gameState.tournament!.id);
      
      setConnectedVoters(count || 0);
    };

    loadConnectionCount();

    // Subscribe to connection changes
    const channel = supabase
      .channel(`connections-${gameState.tournament.id}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'connections',
          filter: `tournament_id=eq.${gameState.tournament.id}`
        },
        () => {
          loadConnectionCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameState.tournament?.id]);

  const handleCreateTournament = async (name: string, participantNames: string[], seeded: boolean) => {
    try {
      // Create participants with visual IDs
      const participants: Participant[] = participantNames.map((name, index) => ({
        id: `participant-${Date.now()}-${index}`,
        name: name.trim(),
        visualId: index % SHAPE_COLOR_COMBOS.length
      }));

      // Generate tournament code
      const code = generateTournamentCode();
      
      // Create bracket
      const matches = createTournamentBracket(participants, seeded);

      // Create tournament object
      const tournament: Tournament = {
        id: '', // Will be set by database
        name: name.trim(),
        participants,
        matches,
        currentRound: 1,
        currentMatch: null,
        status: 'active',
        roundDuration: 120,
        seeded
      };

      // Save to database
      const { data, error } = await supabase
        .from('tournaments')
        .insert({
          code,
          name: tournament.name,
          mode: 'anonymous',
          status: 'active',
          participants: tournament.participants,
          matches: tournament.matches,
          current_round: tournament.currentRound,
          current_match_id: null,
          round_duration: tournament.roundDuration,
          max_participants: participants.length,
          host_last_seen: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating tournament:', error);
        alert('Failed to create tournament. Please try again.');
        return;
      }

      // Update tournament with database ID
      tournament.id = data.id;
      setTournamentCode(code);

      // Update game state
      setGameState(prev => ({
        ...prev,
        tournament
      }));

      // Move to bracket view
      setCurrentScreen('bracket');

    } catch (error) {
      console.error('Error creating tournament:', error);
      alert('Failed to create tournament. Please try again.');
    }
  };

  const handleGoHome = () => {
    if (confirm('Are you sure you want to end this tournament and return home?')) {
      router.push('/');
    }
  };

  const handleGoToSetup = () => {
    if (confirm('Are you sure you want to restart tournament setup? This will end the current tournament.')) {
      setGameState(prev => ({
        ...prev,
        tournament: null
      }));
      setCurrentScreen('setup');
    }
  };

  const updateGameState = (updater: (prev: GameState) => GameState) => {
    setGameState(updater);
  };

  const setCurrentScreenHandler = (screen: 'setup' | 'bracket' | 'match' | 'home') => {
    if (screen === 'home') {
      handleGoHome();
      return;
    }
    setCurrentScreen(screen);
  };

  if (currentScreen === 'setup') {
    return (
      <AnonymousModeSetup
        onCreateTournament={handleCreateTournament}
        onBack={handleGoHome}
      />
    );
  }

  if (currentScreen === 'bracket') {
    return (
      <AnonymousTournamentBracket
        gameState={gameState}
        onUpdateGameState={updateGameState}
        onSetCurrentScreen={setCurrentScreenHandler}
        onGoHome={handleGoHome}
        onGoToSetup={handleGoToSetup}
        tournamentCode={tournamentCode}
        connectedVoters={connectedVoters}
      />
    );
  }

  if (currentScreen === 'match') {
    return (
      <AnonymousActiveMatch
        gameState={gameState}
        onUpdateGameState={updateGameState}
        onSetCurrentScreen={setCurrentScreenHandler}
        tournamentCode={tournamentCode}
        connectedVoters={connectedVoters}
      />
    );
  }

  return null;
}
