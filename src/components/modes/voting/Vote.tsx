'use client';

import React, { useState, useEffect } from 'react';
import { supabase, getTournamentByCode, connectVoter, updateVoterPing, disconnectVoter, submitVote } from '@/utils/supabase';
import { Tournament, Match, Participant } from '@/types/tournament';
import VoteJoinScreen from './VoteJoinScreen';
import VoteWaitingScreen from './VoteWaitingScreen';
import VoteMatchWaitingScreen from './VoteMatchWaitingScreen';
import VoteVotingScreen from './VoteVotingScreen';
import VoteChampionScreen from './VoteChampionScreen';
import VoteWinnerCelebration from './VoteWinnerCelebration';
import VoteConnectionStatus from './VoteConnectionStatus';

export default function Vote() {
  const [currentScreen, setCurrentScreen] = useState<'join' | 'waiting' | 'match-waiting' | 'voting' | 'champion'>('join');
  const [tournamentCode, setTournamentCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [currentMatch, setCurrentMatch] = useState<Match | null>(null);
  const [nextMatch, setNextMatch] = useState<Match | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [selectedVote, setSelectedVote] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [showNewMatchAnimation, setShowNewMatchAnimation] = useState(false);
  const [showWinnerCelebration, setShowWinnerCelebration] = useState(false);
  const [matchWinner, setMatchWinner] = useState<Participant | null>(null);
  const [voterId] = useState(`voter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);

  // Keep voter connection alive with periodic pings
  useEffect(() => {
    if (!tournamentCode || !voterId) return;

    const pingInterval = setInterval(async () => {
      try {
        await updateVoterPing(tournamentCode, voterId);
        setIsConnected(true);
      } catch (error) {
        console.error('Error updating voter ping:', error);
        setIsConnected(false);
      }
    }, 1500);

    return () => {
      clearInterval(pingInterval);
      if (tournamentCode && voterId) {
        disconnectVoter(tournamentCode, voterId).catch(console.error);
      }
    };
  }, [tournamentCode, voterId]);

  // Join tournament
  const handleJoinTournament = async (codeToUse?: string) => {
    const code = codeToUse || inputCode;
    if (code.length !== 4) {
      setError('Please enter a 4-character code');
      return;
    }

    try {
      setError(null);
      const tournamentData = await getTournamentByCode(code.toUpperCase());
      
      if (!tournamentData) {
        setError('Tournament not found. Please check the code.');
        return;
      }

      setTournament(tournamentData.tournament_data);
      setTournamentCode(code.toUpperCase());
      
      await connectVoter(code.toUpperCase(), voterId);
      setIsConnected(true);
      
      connectToTournament(code.toUpperCase());
    } catch (error) {
      console.error('Error joining tournament:', error);
      setIsConnected(false);
      setError('Code not recognized. Please try again.');
    }
  };

  // Handle initial tournament state after joining
  useEffect(() => {
    if (!tournament) return;
    
    if (tournament.status === 'completed') {
      setCurrentScreen('champion');
    } else if (tournament.status === 'active') {
      if (tournament.currentMatch) {
        setCurrentMatch(tournament.currentMatch);
        setCurrentScreen('voting');
      } else {
        const nextMatch = tournament.matches.find(m => m.status === 'pending');
        setNextMatch(nextMatch || null);
        setCurrentScreen('match-waiting');
      }
    } else {
      // Check if tournament has activity
      const hasActivity = tournament.matches?.some(m => m.status === 'completed' || m.status === 'active');
      
      if (hasActivity) {
        if (tournament.currentMatch) {
          setCurrentMatch(tournament.currentMatch);
          setCurrentScreen('voting');
        } else {
          const nextMatch = tournament.matches.find(m => m.status === 'pending');
          setNextMatch(nextMatch || null);
          setCurrentScreen('match-waiting');
        }
      } else {
        setCurrentScreen('waiting');
      }
    }
  }, [tournament]);

  // Connect to tournament real-time updates
  const connectToTournament = (code: string) => {
    if (!supabase) return () => {};
    
    const tournamentChannel = supabase
      .channel(`tournament-${code}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tournaments',
          filter: `code=eq.${code}`
        },
        (payload) => {
          const updatedTournament = payload.new.tournament_data as Tournament;
          setTournament(updatedTournament);
          
          // Check for winner celebration first
          if (updatedTournament.lastMatchWinner) {
            setMatchWinner(updatedTournament.lastMatchWinner);
            setShowWinnerCelebration(true);
            
            setTimeout(() => {
              setShowWinnerCelebration(false);
              setMatchWinner(null);
              
              if (updatedTournament.status === 'completed') {
                setCurrentScreen('champion');
              } else {
                setCurrentScreen('match-waiting');
              }
            }, 3000);
            return;
          }
          
          // Determine the correct screen based on tournament state
          if (updatedTournament.status === 'completed') {
            setCurrentScreen('champion');
          } else if (updatedTournament.status === 'active') {
            if (updatedTournament.currentMatch) {
              setCurrentMatch(updatedTournament.currentMatch);
              setCurrentScreen('voting');
              // Reset voting state for new match
              if (currentMatch?.id !== updatedTournament.currentMatch.id) {
                setHasVoted(false);
                setSelectedVote(null);
                setShowNewMatchAnimation(true);
                setTimeout(() => setShowNewMatchAnimation(false), 20000);
              }
            } else {
              const nextMatch = updatedTournament.matches.find(m => m.status === 'pending');
              setNextMatch(nextMatch || null);
              setCurrentScreen('match-waiting');
            }
          } else {
            const nextMatch = updatedTournament.matches.find(m => m.status === 'pending');
            setNextMatch(nextMatch || null);
            setCurrentScreen('waiting');
          }
        }
      )
      .subscribe();

    // Subscribe to timer updates
    const timerChannel = supabase
      .channel(`timer-${code}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tournaments',
          filter: `code=eq.${code}`
        },
        (payload) => {
          const timerActive = payload.new.timer_active;
          const timerRemaining = payload.new.timer_remaining || 0;
          
          setIsTimerActive(timerActive && timerRemaining > 0);
          setTimeRemaining(timerRemaining);
        }
      )
      .subscribe();

    return () => {
      if (supabase) {
        supabase.removeChannel(tournamentChannel);
        supabase.removeChannel(timerChannel);
      }
    };
  };

  // Handle voting
  const handleVote = async (participantId: string) => {
    if (!currentMatch || !tournament || !supabase) return;

    // If already voted for this participant, don't submit again
    if (hasVoted && selectedVote === participantId) return;

    // Set selection for immediate visual feedback
    setSelectedVote(participantId);

    try {
      await submitVote(tournamentCode, currentMatch.id, participantId, voterId);
      
      if (!hasVoted) {
        setHasVoted(true);
        setNotification('✅ Vote submitted!');
      } else {
        setNotification('✅ Vote changed!');
      }
      setTimeout(() => setNotification(null), 2000);
    } catch (error) {
      console.error('Error submitting vote:', error);
      setError('Failed to submit vote. Please try again.');
      setSelectedVote(null);
    }
  };

  // Winner Celebration Screen
  if (showWinnerCelebration && matchWinner) {
    return <VoteWinnerCelebration matchWinner={matchWinner} />;
  }

  // Render appropriate screen
  switch (currentScreen) {
    case 'join':
      return (
        <VoteJoinScreen
          inputCode={inputCode}
          setInputCode={setInputCode}
          error={error}
          onJoinTournament={handleJoinTournament}
        />
      );
    
    case 'waiting':
      return (
        <VoteWaitingScreen
          tournamentCode={tournamentCode}
          tournament={tournament}
          isConnected={isConnected}
        />
      );
    
    case 'match-waiting':
      return (
        <VoteMatchWaitingScreen
          tournamentCode={tournamentCode}
          nextMatch={nextMatch}
          isConnected={isConnected}
        />
      );
    
    case 'voting':
      if (!currentMatch) return null;
      return (
        <VoteVotingScreen
          tournamentCode={tournamentCode}
          currentMatch={currentMatch}
          timeRemaining={timeRemaining}
          isTimerActive={isTimerActive}
          selectedVote={selectedVote}
          hasVoted={hasVoted}
          showNewMatchAnimation={showNewMatchAnimation}
          notification={notification}
          error={error}
          onVote={handleVote}
        />
      );
    
    case 'champion':
      return <VoteChampionScreen tournament={tournament} />;
    
    default:
      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-500 to-gray-700 flex items-center justify-center">
          <div className="text-white text-center">
            <h1 className="text-2xl font-bold mb-4">Loading...</h1>
            <VoteConnectionStatus isConnected={isConnected} />
          </div>
        </div>
      );
  }
}
