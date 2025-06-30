import React from 'react';
import { Trophy, Shuffle, Target } from 'lucide-react';
import { Match, Participant } from '@/types/tournament';
import ParticipantShape from '../ParticipantShape';

interface MatchControlsProps {
  currentMatch: Match;
  selectedWinner: string | null;
  showWinnerConfirm: boolean;
  onSelectWinner: (participantId: string) => void;
  onConfirmWinner: () => void;
  onRandomWinner: () => void;
  onEndMatch: () => void;
  onBackToBracket: () => void;
}

export default function MatchControls({
  currentMatch,
  selectedWinner,
  showWinnerConfirm,
  onSelectWinner,
  onConfirmWinner,
  onRandomWinner,
  onEndMatch,
  onBackToBracket
}: MatchControlsProps) {
  if (showWinnerConfirm) {
    const winner = selectedWinner === currentMatch.participant1?.id 
      ? currentMatch.participant1 
      : currentMatch.participant2;

    return (
      <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8">
        <div className="text-center mb-6">
          <Trophy className="mx-auto mb-4 text-yellow-400" size={64} />
          <h2 className="text-3xl font-black text-white mb-4">Confirm Winner</h2>
          
          {winner && (
            <div className="bg-yellow-400/20 rounded-2xl p-6 mb-6">
              <ParticipantShape visualId={winner.visualId} size="lg" className="mb-4" />
              <h3 className="text-2xl font-bold text-yellow-200">{winner.name}</h3>
            </div>
          )}
        </div>

        <div className="flex gap-4 justify-center">
          <button
            onClick={onConfirmWinner}
            className="bg-green-500 hover:bg-green-600 text-white px-8 py-4 rounded-xl font-bold text-lg transition-colors"
          >
            ✓ Confirm Winner
          </button>
          <button
            onClick={() => onSelectWinner('')}
            className="bg-gray-500 hover:bg-gray-600 text-white px-8 py-4 rounded-xl font-bold text-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8">
      <h2 className="text-2xl font-black text-white mb-8 text-center">Match Controls</h2>
      
      <div className="space-y-8">
        {/* Manual Winner Selection */}
        <div>
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Target size={20} />
            Select Winner Manually
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {currentMatch.participant1 && (
              <button
                onClick={() => onSelectWinner(currentMatch.participant1!.id)}
                className="bg-blue-500/30 hover:bg-blue-500/50 text-white p-6 rounded-xl transition-colors flex items-center gap-4 min-h-[80px]"
              >
                <ParticipantShape visualId={currentMatch.participant1.visualId} size="md" />
                <span className="font-bold text-lg">{currentMatch.participant1.name}</span>
              </button>
            )}
            {currentMatch.participant2 && (
              <button
                onClick={() => onSelectWinner(currentMatch.participant2!.id)}
                className="bg-red-500/30 hover:bg-red-500/50 text-white p-6 rounded-xl transition-colors flex items-center gap-4 min-h-[80px]"
              >
                <ParticipantShape visualId={currentMatch.participant2.visualId} size="md" />
                <span className="font-bold text-lg">{currentMatch.participant2.name}</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Shuffle size={20} />
            Quick Actions
          </h3>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={onRandomWinner}
              className="bg-purple-500 hover:bg-purple-600 text-white px-6 py-3 rounded-xl font-bold transition-colors flex items-center gap-2"
            >
              <Shuffle size={20} />
              Random Winner
            </button>
            <button
              onClick={onEndMatch}
              className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-xl font-bold transition-colors"
            >
              End Match
            </button>
            <button
              onClick={onBackToBracket}
              className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-xl font-bold transition-colors"
            >
              Return to Bracket
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
