'use client';

import React, { useState } from 'react';
import { GameState, Match } from '@/types/tournament';
import { Settings, Home, Users, Play, SkipForward, Trophy, RotateCcw } from 'lucide-react';
import { getNextMatch, isRoundComplete, formatRoundName, getMaxRounds, advanceWinner } from '@/utils/tournament';
import ParticipantShape from './ParticipantShape';

interface TournamentBracketProps {
  gameState: GameState;
  onUpdateGameState: (updater: (prev: GameState) => GameState) => void;
  onSetCurrentScreen: (screen: 'home' | 'setup' | 'bracket' | 'match') => void;
  onGoHome: () => void;
  onGoToSetup: () => void;
}

const TournamentBracket: React.FC<TournamentBracketProps> = ({
  gameState,
  onUpdateGameState,
  onSetCurrentScreen,
  onGoHome,
  onGoToSetup
}) => {
  const [showSettings, setShowSettings] = useState(false);
  const [roundDuration, setRoundDuration] = useState(gameState.tournament?.roundDuration || 120);

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

  const handleStartNextMatch = () => {
    if (!nextMatch) return;
    
    // Always go to match screen - let host decide even for single participants
    onUpdateGameState(prev => ({
      ...prev,
      tournament: prev.tournament ? {
        ...prev.tournament,
        currentMatch: nextMatch
      } : null
    }));
    onSetCurrentScreen('match');
  };

  const handleSkipMatch = () => {
    if (!nextMatch) return;
    
    const winner = nextMatch.participant1 || nextMatch.participant2;
    if (!winner) return;

    // Mark match as completed with winner
    let updatedMatches = tournament.matches.map(m => 
      m.id === nextMatch.id 
        ? { ...m, winner, status: 'completed' as const }
        : m
    );

    // Advance winner to next round
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
      // Tournament complete
      onUpdateGameState(prev => ({
        ...prev,
        tournament: prev.tournament ? {
          ...prev.tournament,
          status: 'completed'
        } : null
      }));
      return;
    }

    // Advance all winners from current round to next round
    let updatedMatches = [...tournament.matches];
    const currentRoundMatches = updatedMatches.filter(m => 
      m.round === tournament.currentRound && m.status === 'completed' && m.winner
    );
    
    for (const match of currentRoundMatches) {
      updatedMatches = advanceWinner(updatedMatches, match);
    }

    onUpdateGameState(prev => ({
      ...prev,
      tournament: prev.tournament ? {
        ...prev.tournament,
        currentRound: nextRound,
        matches: updatedMatches
      } : null
    }));
  };

  const resetTournament = () => {
    if (confirm('Are you sure you want to reset the tournament? This will clear all match results.')) {
      const resetMatches = tournament.matches.map(match => ({
        ...match,
        winner: null,
        status: match.status === 'bye' ? 'bye' as const : 'pending' as const
      }));

      onUpdateGameState(prev => ({
        ...prev,
        tournament: prev.tournament ? {
          ...prev.tournament,
          matches: resetMatches,
          currentRound: 1,
          currentMatch: null,
          status: 'active'
        } : null
      }));
    }
  };

  const updateRoundDuration = () => {
    onUpdateGameState(prev => ({
      ...prev,
      tournament: prev.tournament ? {
        ...prev.tournament,
        roundDuration
      } : null
    }));
    setShowSettings(false);
  };

  const renderMatch = (match: Match, roundIndex: number) => {
    const isNext = match.id === nextMatch?.id && !currentRoundComplete;
    const isActive = match.id === tournament.currentMatch?.id;
    
    let matchClass = 'border-2 rounded-lg p-3 min-h-[80px] flex flex-col justify-center';
    
    if (match.status === 'completed') {
      matchClass += ' bg-gray-100 border-gray-300';
    } else if (isActive) {
      matchClass += ' bg-red-100 border-red-500 scale-110';
    } else if (isNext) {
      matchClass += ' bg-yellow-100 border-yellow-500 animate-pulse-glow';
    } else {
      matchClass += ' bg-white border-gray-200';
    }

    return (
      <div key={match.id} className={matchClass}>
        <div className="space-y-2">
          {match.participant1 && (
            <div className={`flex items-center gap-2 p-2 rounded ${
              match.winner?.id === match.participant1.id ? 'bg-blue-200 border border-blue-400' : ''
            }`}>
              <ParticipantShape visualId={match.participant1.visualId} size="sm" />
              <span className="text-sm font-medium text-black">{match.participant1.name}</span>
            </div>
          )}
          {match.participant2 && (
            <div className={`flex items-center gap-2 p-2 rounded ${
              match.winner?.id === match.participant2.id ? 'bg-blue-200 border border-blue-400' : ''
            }`}>
              <ParticipantShape visualId={match.participant2.visualId} size="sm" />
              <span className="text-sm font-medium text-black">{match.participant2.name}</span>
            </div>
          )}
          {match.status === 'bye' && (
            <div className="text-center text-black text-sm font-medium">BYE</div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-black">{tournament.name}</h1>
          <p className="text-black">
            {formatRoundName(tournament.currentRound, maxRounds)} - Round {tournament.currentRound} of {maxRounds}
          </p>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 text-black hover:text-gray-800"
          >
            <Settings size={24} />
          </button>
          <button
            onClick={onGoHome}
            className="p-2 text-black hover:text-gray-800"
          >
            <Home size={24} />
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-white rounded-lg shadow-lg p-4 mb-6">
          <h3 className="font-bold mb-3 text-black">Tournament Settings</h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1 text-black">Round Duration (seconds)</label>
              <input
                type="number"
                min="30"
                max="600"
                value={roundDuration}
                onChange={(e) => setRoundDuration(parseInt(e.target.value) || 120)}
                className="w-full border rounded px-2 py-1"
              />
              <button
                onClick={updateRoundDuration}
                className="mt-1 text-xs bg-blue-500 text-white px-2 py-1 rounded"
              >
                Update
              </button>
            </div>
            <div className="flex flex-col">
              <label className="block text-sm font-medium mb-1 text-black">Seeding</label>
              <div className="text-xs text-black mb-2">
                Current: {tournament.seeded ? 'Enabled' : 'Disabled'}
              </div>
              <div className="text-xs text-orange-600">
                Changing requires reset
              </div>
            </div>
            <button
              onClick={resetTournament}
              className="flex items-center gap-2 bg-yellow-500 text-white px-3 py-2 rounded hover:bg-yellow-600"
            >
              <RotateCcw size={16} />
              Reset Tournament
            </button>
            <button
              onClick={onGoToSetup}
              className="flex items-center gap-2 bg-gray-500 text-white px-3 py-2 rounded hover:bg-gray-600"
            >
              <Users size={16} />
              Change Lineup
            </button>
            <button
              onClick={onGoHome}
              className="flex items-center gap-2 bg-red-500 text-white px-3 py-2 rounded hover:bg-red-600"
            >
              <Home size={16} />
              New Tournament
            </button>
          </div>
        </div>
      )}

      {/* Tournament Bracket */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <div className="overflow-x-auto">
          <div className="flex gap-8 min-w-max">
            {Array.from({ length: maxRounds }, (_, roundIndex) => {
              const roundNumber = roundIndex + 1;
              const roundMatches = matchesByRound[roundNumber] || [];
              
              return (
                <div key={roundNumber} className="flex flex-col gap-4 min-w-48">
                  <h3 className="text-lg font-bold text-center text-black">
                    {formatRoundName(roundNumber, maxRounds)}
                  </h3>
                  <div className="flex flex-col gap-4">
                    {roundMatches.map((match, matchIndex) => renderMatch(match, roundIndex))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Next Match Info */}
      {nextMatch && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <h3 className="font-bold text-black mb-2">Next Match</h3>
          <div className="flex items-center gap-4">
            {nextMatch.participant1 ? (
              <div className="flex items-center gap-2">
                <ParticipantShape visualId={nextMatch.participant1.visualId} size="md" />
                <span className="font-medium text-black">{nextMatch.participant1.name}</span>
              </div>
            ) : (
              <div className="text-black italic">No participant</div>
            )}
            <span className="text-yellow-600">VS</span>
            {nextMatch.participant2 ? (
              <div className="flex items-center gap-2">
                <ParticipantShape visualId={nextMatch.participant2.visualId} size="md" />
                <span className="font-medium text-black">{nextMatch.participant2.name}</span>
              </div>
            ) : (
              <div className="text-black italic">No participant</div>
            )}
          </div>
          {(!nextMatch.participant1 || !nextMatch.participant2) && (
            <div className="mt-2 text-sm text-black">
              Host will select the winner to advance
            </div>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-3 justify-center">
        {nextMatch && (
          <button
            onClick={handleStartNextMatch}
            className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg"
          >
            <Play size={20} />
            Start Next Match
          </button>
        )}
        
        {nextMatch && (
          <button
            onClick={handleSkipMatch}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-6 rounded-lg"
          >
            <SkipForward size={20} />
            Skip Match
          </button>
        )}

        {currentRoundComplete && tournament.currentRound < maxRounds && (
          <button
            onClick={handleAdvanceRound}
            className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg"
          >
            <Trophy size={20} />
            Advance to Next Round
          </button>
        )}

        {tournament.status === 'completed' && (
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600 mb-2">Tournament Complete!</div>
            {tournament.matches
              .filter(m => m.round === maxRounds && m.winner)
              .map(m => m.winner)
              .map(winner => winner && (
                <div key={winner.id} className="flex items-center gap-3 justify-center">
                  <ParticipantShape visualId={winner.visualId} size="lg" />
                  <span className="text-xl font-bold text-black">{winner.name} is the Champion!</span>
                </div>
              ))
            }
          </div>
        )}
      </div>
    </div>
  );
};

export default TournamentBracket;
