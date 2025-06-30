'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import VoteJoinScreen from '@/components/modes/voting/VoteJoinScreen';
import VoteMatchWaitingScreen from '@/components/modes/voting/VoteMatchWaitingScreen';
import VoteVotingScreen from '@/components/modes/voting/VoteVotingScreen';
import VoteChampionScreen from '@/components/modes/voting/VoteChampionScreen';
import VoteConnectionStatus from '@/components/modes/voting/VoteConnectionStatus';
import { 
  connectVoter, 
  subscribeToTournamentStatus,
  subscribeToMatchStatus,
  castVote
} from '@/utils/supabase';
import { Match, Participant } from '@/types/tournament';

type VoteScreen = 'join' | 'waiting' | 'voting' | 'champion';

export default function VotePage() {
  const searchParams = useSearchParams();
  const codeParam = searchParams?.get('code') || '';
  
  const [screen, setScreen] = useState<VoteScreen>('join');
  const [tournamentCode, setTournamentCode] = useState<string>(codeParam);
  const [voterId, setVoterId] = useState<string>('');
  const [currentMatch, setCurrentMatch] = useState<Match | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [tournamentCompleted, setTournamentCompleted] = useState(false);
  const [champion, setChampion] = useState<Participant | null>(null);
  
  // Generate voter ID on first render
  useEffect(() => {
    setVoterId(`voter-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);
  }, []);
  
  // Handle joining a tournament
  const handleJoinTournament = async (code: string) => {
    if (!code || !voterId) return;
    
    try {
      await connectVoter(code, voterId);
      setTournamentCode(code);
      setScreen('waiting');
      setIsConnected(true);
      
      // Subscribe to tournament status
      const subscription = subscribeToTournamentStatus(code, (tournamentData) => {
        if (tournamentData.status === 'completed') {
          setTournamentCompleted(true);
          setChampion(tournamentData.champion);
          setScreen('champion');
        } else if (tournamentData.currentMatch) {
          setCurrentMatch(tournamentData.currentMatch);
          setHasVoted(false);
          setScreen('voting');
        } else {
          setCurrentMatch(null);
          setScreen('waiting');
        }
      });
      
      return () => {
        if (subscription) {
          subscription.unsubscribe();
        }
      };
    } catch (error) {
      console.error('Error joining tournament:', error);
      setIsConnected(false);
    }
  };
  
  // Handle voting
  const handleVote = async (participantId: string) => {
    if (!tournamentCode || !currentMatch || !voterId) return;
    
    try {
      await castVote(tournamentCode, currentMatch.id, participantId, voterId);
      setHasVoted(true);
    } catch (error) {
      console.error('Error casting vote:', error);
    }
  };
  
  // Render appropriate screen
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <VoteConnectionStatus isConnected={isConnected} />
      
      {screen === 'join' && (
        <VoteJoinScreen 
          initialCode={codeParam}
          onJoinTournament={handleJoinTournament}
        />
      )}
      
      {screen === 'waiting' && (
        <VoteMatchWaitingScreen />
      )}
      
      {screen === 'voting' && currentMatch && (
        <VoteVotingScreen
          match={currentMatch}
          hasVoted={hasVoted}
          onVote={handleVote}
        />
      )}
      
      {screen === 'champion' && champion && (
        <VoteChampionScreen 
          champion={champion}
        />
      )}
    </div>
  );
}
