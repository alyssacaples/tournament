'use client';

import React, { useState, useEffect } from 'react';
import { GameState, Match } from '@/types/tournament';
import { Settings, Home, Users, Play, SkipForward, Trophy, RotateCcw } from 'lucide-react';
import { getNextMatch, isRoundComplete, formatRoundName, getMaxRounds, advanceWinner } from '@/utils/tournament';
import { supabase, startTimer, logSupabaseOperation } from '@/utils/supabase';
import ParticipantShape from '../ParticipantShape';

interface AnonymousTournamentBracketProps {
  gameState: GameState;
  onUpdateGameState: (updater: (prev: GameState) => GameState) => void;
  onSetCurrentScreen: (screen: 'home' | 'setup' | 'bracket' | 'match') => void;
  onGoHome: () => void;
  onGoToSetup: () => void;
  tournamentCode: string;
  connectedVoters: number;
}

const AnonymousTournamentBracket: React.FC<AnonymousTournamentBracketProps> = ({
  gameState,
  onUpdateGameState,
  onSetCurrentScreen,
  onGoHome,
  onGoToSetup,
  tournamentCode,
  connectedVoters
}) => {
  const [showSettings, setShowSettings] = useState(false);
  const [roundDuration, setRoundDuration] = useState(gameState.tournament?.roundDuration || 120);
  const [isUpdatingDatabase, setIsUpdatingDatabase] = useState(false);

  // Update Supabase when tournament state changes
  useEffect(() => {
    const tournament = gameState.tournament;
    if (!tournament) return;
    
    const updateDatabase = async () => {
      if (!tournament.id || isUpdatingDatabase) return;
      
      setIsUpdatingDatabase(true);
      try {
        const { error } = await supabase
          .from('tournaments')
          .update({
            participants: tournament.participants,
            matches: tournament.matches,
            current_round: tournament.currentRound,
            current_match_id: tournament.currentMatch?.id || null,
            status: tournament.status,
            round_duration: tournament.roundDuration,
            updated_at: new Date().toISOString(),
            host_last_seen: new Date().toISOString()
          })
          .eq('id', tournament.id);

        if (error) {
          console.error('Error updating tournament:', error);
        }
      } catch (err) {
        console.error('Error updating database:', err);
      } finally {
        setIsUpdatingDatabase(false);
      }
    };

    updateDatabase();
  }, [gameState.tournament, isUpdatingDatabase]);

  if (!gameState.tournament) return null;

  const { tournament } = gameState;
  const maxRounds = getMaxRounds(tournament.participants.length);
  
  // Group matches by round
  const matchesByRound = tournament.matches.reduce((acc, match) => {
    if (!acc[match.round]) acc[match.round] = [];
    acc[match.round].push(match);
    return acc;
  }, {} as Record<number, Match[]>);

  const nextMatch = getNextMatch(tournament.matches, tournament.currentRound);
  const currentRoundComplete = isRoundComplete(tournament.matches, tournament.currentRound);

  const handleStartNextMatch = async () => {
    if (!nextMatch || !tournament?.id) return;
    
    // Update the match status to 'active' and set it as current match
    const updatedMatches = tournament.matches.map(match => 
      match.id === nextMatch.id 
        ? { ...match, status: 'active' as const }
        : match
    );

    // Update local state first
    onUpdateGameState(prev => ({
      ...prev,
      tournament: prev.tournament ? {
        ...prev.tournament,
        currentMatch: nextMatch,
        matches: updatedMatches,
        timerActive: true,
        timerRemaining: prev.tournament.roundDuration,
        timerStartedAt: new Date().toISOString(),
        timerDuration: prev.tournament.roundDuration
      } : null
    }));

    // Update database immediately with match AND timer state
    try {
      const { error } = await supabase
        .from('tournaments')
        .update({
          matches: updatedMatches,
          current_match_id: nextMatch.id,
          timer_active: true,
          timer_remaining: tournament.roundDuration,
          timer_started_at: new Date().toISOString(),
          timer_duration: tournament.roundDuration,
          updated_at: new Date().toISOString(),
          host_last_seen: new Date().toISOString()
        })
        .eq('id', tournament.id);

      if (error) {
        console.error('Error updating tournament with new match:', error);
      } else {
        console.log('Successfully started new match with timer:', nextMatch.id);
      }
    } catch (err) {
      console.error('Error updating database immediately:', err);
    }
    
    onSetCurrentScreen('match');
  };

  const handleAdvanceRound = () => {
    if (!currentRoundComplete) return;
    
    onUpdateGameState(prev => ({
      ...prev,
      tournament: prev.tournament ? {
        ...prev.tournament,
        currentRound: prev.tournament.currentRound + 1
      } : null
    }));
  };

  const handleResetTournament = () => {
    if (confirm('Are you sure you want to reset the tournament? This will clear all match results.')) {
      onSetCurrentScreen('setup');
    }
  };

  const handleUpdateSettings = () => {
    onUpdateGameState(prev => ({
      ...prev,
      tournament: prev.tournament ? {
        ...prev.tournament,
        roundDuration
      } : null
    }));
    setShowSettings(false);
  };

  const getMatchesForRound = (round: number) => {
    return matchesByRound[round] || [];
  };

  const renderMatch = (match: Match) => {
    const isCompleted = match.status === 'completed';
    const isActive = tournament.currentMatch?.id === match.id;
    const isBye = !match.participant2;
    
    return (
      <div 
        key={match.id}
        className={`
          relative bg-white rounded-lg border-2 p-4 min-h-[120px] transition-all duration-300
          ${isActive ? 'border-blue-500 bg-blue-50 shadow-lg' : 'border-gray-200'}
          ${isCompleted ? 'bg-green-50' : ''}
        `}
      >
        {isActive && (
          <div className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full font-bold">
            ACTIVE
          </div>
        )}
        
        <div className="text-xs text-gray-500 mb-2">
          {formatRoundName(match.round, maxRounds)} - Match {match.position + 1}
        </div>
        
        <div className="space-y-2">
          <div className={`flex items-center justify-between p-2 rounded ${
            match.winner?.id === match.participant1?.id ? 'bg-green-100 border border-green-300' : 'bg-gray-50'
          }`}>
            {match.participant1 ? (
              <div className="flex items-center gap-2">
                <ParticipantShape 
                  visualId={match.participant1.visualId} 
                  size="sm"
                />
                <span className="text-sm font-medium">{match.participant1.name}</span>
              </div>
            ) : (
              <span className="text-sm text-gray-400 italic">TBD</span>
            )}
            {isCompleted && match.winner?.id === match.participant1?.id && (
              <Trophy size={16} className="text-yellow-500" />
            )}
          </div>
          
          {!isBye && (
            <div className={`flex items-center justify-between p-2 rounded ${
              match.winner?.id === match.participant2?.id ? 'bg-green-100 border border-green-300' : 'bg-gray-50'
            }`}>
              {match.participant2 ? (
                <div className="flex items-center gap-2">
                  <ParticipantShape 
                    visualId={match.participant2.visualId} 
                    size="sm"
                  />
                  <span className="text-sm font-medium">{match.participant2.name}</span>
                </div>
              ) : (
                <span className="text-sm text-gray-400 italic">TBD</span>
              )}
              {isCompleted && match.winner?.id === match.participant2?.id && (
                <Trophy size={16} className="text-yellow-500" />
              )}
            </div>
          )}
          
          {isBye && (
            <div className="text-center text-xs text-gray-500 italic py-2">
              Bye - Advances Automatically
            </div>
          )}
        </div>
        
        <div className="mt-2 text-xs text-gray-400">
          Status: <span className="capitalize">{match.status}</span>
        </div>
      </div>
    );
  };

  const renderRound = (roundNumber: number) => {
    const matches = getMatchesForRound(roundNumber);
    if (matches.length === 0) return null;
    
    return (
      <div key={roundNumber} className="flex-shrink-0">
        <h3 className="text-lg font-bold text-gray-700 mb-4 text-center">
          {formatRoundName(roundNumber, maxRounds)}
        </h3>
        <div className="space-y-4">
          {matches.map(renderMatch)}
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-800">{tournament.name}</h1>
            <div className="flex items-center gap-2 text-sm bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full">
              <Users size={16} />
              Code: <span className="font-bold">{tournamentCode}</span>
            </div>
            <div className="flex items-center gap-2 text-sm bg-green-100 text-green-700 px-3 py-1 rounded-full">
              <Users size={16} />
              {connectedVoters} voters connected
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              title="Settings"
            >
              <Settings size={20} />
            </button>
            <button
              onClick={onGoHome}
              className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              title="Home"
            >
              <Home size={20} />
            </button>
          </div>
        </div>
        
        {/* Settings Panel */}
        {showSettings && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
            <h3 className="font-bold text-gray-700 mb-3">Tournament Settings</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Round Duration (seconds)
                </label>
                <input
                  type="number"
                  value={roundDuration}
                  onChange={(e) => setRoundDuration(parseInt(e.target.value) || 120)}
                  className="w-full border border-gray-300 rounded px-3 py-1 text-sm"
                  min="30"
                  max="600"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleUpdateSettings}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium"
              >
                Update Settings
              </button>
              <button
                onClick={() => setShowSettings(false)}
                className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tournament Status */}
      <div className="bg-white border-b px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6 text-sm text-gray-600">
            <span>Round: <strong>{tournament.currentRound}</strong></span>
            <span>Participants: <strong>{tournament.participants.length}</strong></span>
            <span>Status: <strong className="capitalize">{tournament.status}</strong></span>
          </div>
          
          <div className="flex items-center gap-2">
            {nextMatch && (
              <button
                onClick={handleStartNextMatch}
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
              >
                <Play size={16} />
                Start Next Match
              </button>
            )}
            
            {currentRoundComplete && !nextMatch && tournament.currentRound < maxRounds && (
              <button
                onClick={handleAdvanceRound}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
              >
                <SkipForward size={16} />
                Advance to Round {tournament.currentRound + 1}
              </button>
            )}
            
            {tournament.status === 'completed' && (
              <div className="flex items-center gap-2 text-green-600 font-bold">
                <Trophy size={20} />
                Tournament Complete!
              </div>
            )}
            
            <button
              onClick={handleResetTournament}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
            >
              <RotateCcw size={16} />
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Bracket Display */}
      <div className="flex-1 overflow-auto p-6">
        <div className="flex gap-8 justify-center min-w-max">
          {Array.from({ length: maxRounds }, (_, i) => i + 1).map(renderRound)}
        </div>
      </div>
    </div>
  );
};

export default AnonymousTournamentBracket;
