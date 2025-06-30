import React from 'react';
import { Trophy, Users, SkipForward, Settings, Home, RotateCcw } from 'lucide-react';
import { Match } from '@/types/tournament';

interface TournamentControlsProps {
  nextMatch: Match | null;
  currentRoundComplete: boolean;
  connectedVoters: number;
  maxRounds: number;
  currentRound: number;
  canAdvanceRound: boolean;
  tournamentCode?: string;
  onStartNextMatch: () => void;
  onSkipMatch: () => void;
  onAdvanceRound: () => void;
  onGoHome?: () => void;
  onOpenSettings?: () => void;
  onResetTournament?: () => void;
}

export default function TournamentControls({
  nextMatch,
  currentRoundComplete,
  connectedVoters,
  maxRounds,
  currentRound,
  canAdvanceRound,
  tournamentCode,
  onStartNextMatch,
  onSkipMatch,
  onAdvanceRound,
  onGoHome,
  onOpenSettings,
  onResetTournament
}: TournamentControlsProps) {
  return (
    <div className="bg-white/10 backdrop-blur-sm border-b border-white/20 p-4">
      <div className="flex items-center justify-between">
        {/* Left side - Tournament info */}
        <div className="flex items-center gap-6">
          {tournamentCode && (
            <div className="flex items-center gap-2 bg-purple-600/20 px-4 py-2 rounded-lg border border-purple-500/30">
              <span className="text-white font-bold">CODE:</span>
              <span className="text-purple-300 font-mono text-lg font-bold">{tournamentCode}</span>
            </div>
          )}
          
          {connectedVoters > 0 && (
            <div className="flex items-center gap-2 bg-green-600/20 px-4 py-2 rounded-lg border border-green-500/30">
              <Users className="w-5 h-5 text-green-400" />
              <span className="text-white font-semibold">{connectedVoters} connected</span>
            </div>
          )}
          
          <div className="text-white/80">
            <span className="font-semibold">Round {currentRound} of {maxRounds}</span>
          </div>
        </div>

        {/* Right side - Navigation & Actions */}
        <div className="flex items-center gap-3">
          {/* Settings Button */}
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="flex items-center gap-2 px-3 py-2 bg-gray-600/20 text-white rounded-lg hover:bg-gray-600/40 transition-colors"
              title="Tournament Settings"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Settings</span>
            </button>
          )}

          {/* Reset Tournament Button */}
          {onResetTournament && (
            <button
              onClick={onResetTournament}
              className="flex items-center gap-2 px-3 py-2 bg-orange-600/20 text-white rounded-lg hover:bg-orange-600/40 transition-colors"
              title="Reset Tournament"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          )}

          {/* Action Buttons */}
          {nextMatch && (!nextMatch.participant1 || !nextMatch.participant2) && (
            <button
              onClick={onSkipMatch}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-semibold"
            >
              <SkipForward className="w-4 h-4" />
              Skip Match
            </button>
          )}
          
          {currentRoundComplete && currentRound < maxRounds && canAdvanceRound && (
            <button
              onClick={onAdvanceRound}
              className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-bold"
            >
              <Trophy className="w-5 h-5" />
              Advance to Round {currentRound + 1}
            </button>
          )}

          {/* Home Button */}
          {onGoHome && (
            <button
              onClick={onGoHome}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600/20 text-white rounded-lg hover:bg-blue-600/40 transition-colors"
              title="Go Home"
            >
              <Home className="w-4 h-4" />
              <span className="hidden sm:inline">Home</span>
            </button>
          )}
          
          {currentRoundComplete && currentRound >= maxRounds && (
            <div className="text-center text-white">
              <div className="text-xl font-bold text-yellow-400">🏆 Tournament Complete!</div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom row - Next match info */}
      {nextMatch && !currentRoundComplete && (
        <div className="mt-3 pt-3 border-t border-white/10">
          <div className="flex items-center justify-center gap-2 text-white/80">
            <span className="text-sm">Next match ready:</span>
            <span className="font-semibold bg-white/10 px-3 py-1 rounded-lg">
              {nextMatch.participant1?.name || 'TBD'} vs {nextMatch.participant2?.name || 'TBD'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}