'use client';

import React from 'react';
import { Match } from '@/types/tournament';

interface MatchControlsProps {
  currentMatch: Match;
  showWinnerConfirm: boolean;
  selectedWinner: string | null;
  onSelectWinner: (participantId: string) => void;
  onConfirmWinner: () => void;
  onRandomWinner: () => void;
  onEndMatch: () => void;
  onBackToBracket: () => void;
}

export default function MatchControls({
  currentMatch,
  showWinnerConfirm,
  selectedWinner,
  onSelectWinner,
  onConfirmWinner,
  onRandomWinner,
  onEndMatch,
  onBackToBracket
}: MatchControlsProps) {
  const participant1 = currentMatch.participant1;
  const participant2 = currentMatch.participant2;
  
  if (!participant1 || !participant2) {
    return null;
  }
  
  return (
    <div className="bg-gray-800 border-t border-white/10 px-6 py-4">
      {!showWinnerConfirm ? (
        <div className="flex flex-col sm:flex-row items-center justify-between space-y-3 sm:space-y-0">
          <div className="flex space-x-2 w-full sm:w-auto">
            <button
              onClick={() => onSelectWinner(participant1.id)}
              className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
            >
              {participant1.name} Wins
            </button>
            <button
              onClick={() => onSelectWinner(participant2.id)}
              className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
            >
              {participant2.name} Wins
            </button>
          </div>
          
          <div className="flex space-x-2 w-full sm:w-auto justify-center sm:justify-end">
            <button
              onClick={onRandomWinner}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded"
            >
              Random Winner
            </button>
            <button
              onClick={onEndMatch}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
            >
              End Match
            </button>
            <button
              onClick={onBackToBracket}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded"
            >
              Back to Bracket
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center space-y-4">
          <p className="text-white text-lg">
            Confirm winner: 
            <span className="font-bold ml-2">
              {participant1.id === selectedWinner ? participant1.name : participant2.name}
            </span>
          </p>
          
          <div className="flex space-x-4">
            <button
              onClick={onConfirmWinner}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded"
            >
              Confirm
            </button>
            <button
              onClick={() => onSelectWinner('')}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
