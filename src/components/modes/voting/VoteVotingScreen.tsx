import React from 'react';
import { Clock, CheckCircle, Users } from 'lucide-react';
import { Match } from '@/types/tournament';
import ParticipantShape from '@/components/ParticipantShape';

interface VoteVotingScreenProps {
  tournamentCode: string;
  currentMatch: Match;
  timeRemaining: number;
  isTimerActive: boolean;
  selectedVote: string | null;
  hasVoted: boolean;
  showNewMatchAnimation: boolean;
  notification: string | null;
  error: string | null;
  onVote: (participantId: string) => void;
}

export default function VoteVotingScreen({
  tournamentCode,
  currentMatch,
  timeRemaining,
  isTimerActive,
  selectedVote,
  hasVoted,
  showNewMatchAnimation,
  notification,
  error,
  onVote
}: VoteVotingScreenProps) {
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-pink-600 flex flex-col p-4 relative overflow-hidden">
      {/* Notification */}
      {notification && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-full shadow-lg z-50 animate-bounce">
          {notification}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-full shadow-lg z-50">
          {error}
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-6 relative z-10">
        <h1 className="text-3xl font-black text-white drop-shadow-lg mb-2">VOTE NOW!</h1>
        <div className="text-white text-lg font-bold drop-shadow-md">Code: {tournamentCode}</div>
        
        {/* Timer */}
        {timeRemaining > 0 && (
          <div className="mt-4 bg-white/20 backdrop-blur-sm rounded-2xl p-4 inline-block">
            <div className="flex items-center gap-2 text-white">
              <Clock size={20} />
              <span className="text-2xl font-bold">{formatTime(timeRemaining)}</span>
            </div>
          </div>
        )}
      </div>

      {/* New Match Animation */}
      {showNewMatchAnimation && (
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="absolute text-yellow-300 text-lg animate-pulse"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${2 + Math.random() * 2}s`,
                opacity: 0.6 + Math.random() * 0.4
              }}
            >
              ✨
            </div>
          ))}
        </div>
      )}

      {/* Voting Options */}
      <div className="flex-1 flex flex-col gap-6 relative z-10">
        {currentMatch.participant1 && (
          <button
            onClick={() => onVote(currentMatch.participant1!.id)}
            disabled={!isTimerActive}
            className={`flex-1 rounded-3xl p-6 shadow-2xl transition-all transform active:scale-95 hover:shadow-3xl ${
              selectedVote === currentMatch.participant1.id
                ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 ring-8 ring-yellow-300 ring-opacity-50 scale-105 shadow-yellow-300/50'
                : 'bg-gradient-to-br from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700'
            } ${
              selectedVote === currentMatch.participant1.id 
                ? '' 
                : (!isTimerActive ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105')
            }`}
          >
            <div className="flex flex-col items-center gap-4">
              <ParticipantShape 
                visualId={currentMatch.participant1.visualId} 
                size="xl" 
                className={`transform transition-all duration-300 ${
                  selectedVote === currentMatch.participant1.id 
                    ? 'scale-125 animate-pulse drop-shadow-xl' 
                    : 'hover:scale-110'
                }`}
              />
              <h2 className={`text-2xl font-bold drop-shadow-md transition-all duration-300 ${
                selectedVote === currentMatch.participant1.id 
                  ? 'text-yellow-900 text-3xl' 
                  : 'text-white'
              }`}>
                {currentMatch.participant1.name}
              </h2>
              {selectedVote === currentMatch.participant1.id && (
                <div className="flex items-center gap-2 text-yellow-900 animate-bounce">
                  <CheckCircle size={24} className="drop-shadow-lg" />
                  <span className="font-bold text-lg drop-shadow-lg">SELECTED!</span>
                </div>
              )}
            </div>
          </button>
        )}

        <div className="text-center py-4">
          <div className="text-white text-4xl font-black drop-shadow-lg animate-pulse">VS</div>
        </div>

        {currentMatch.participant2 && (
          <button
            onClick={() => onVote(currentMatch.participant2!.id)}
            disabled={!isTimerActive}
            className={`flex-1 rounded-3xl p-6 shadow-2xl transition-all transform active:scale-95 hover:shadow-3xl ${
              selectedVote === currentMatch.participant2.id
                ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 ring-8 ring-yellow-300 ring-opacity-50 scale-105 shadow-yellow-300/50'
                : 'bg-gradient-to-br from-red-400 to-red-600 hover:from-red-500 hover:to-red-700'
            } ${
              selectedVote === currentMatch.participant2.id 
                ? '' 
                : (!isTimerActive ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105')
            }`}
          >
            <div className="flex flex-col items-center gap-4">
              <ParticipantShape 
                visualId={currentMatch.participant2.visualId} 
                size="xl" 
                className={`transform transition-all duration-300 ${
                  selectedVote === currentMatch.participant2.id 
                    ? 'scale-125 animate-pulse drop-shadow-xl' 
                    : 'hover:scale-110'
                }`}
              />
              <h2 className={`text-2xl font-bold drop-shadow-md transition-all duration-300 ${
                selectedVote === currentMatch.participant2.id 
                  ? 'text-yellow-900 text-3xl' 
                  : 'text-white'
              }`}>
                {currentMatch.participant2.name}
              </h2>
              {selectedVote === currentMatch.participant2.id && (
                <div className="flex items-center gap-2 text-yellow-900 animate-bounce">
                  <CheckCircle size={24} className="drop-shadow-lg" />
                  <span className="font-bold text-lg drop-shadow-lg">SELECTED!</span>
                </div>
              )}
            </div>
          </button>
        )}
      </div>

      {/* Status Bar */}
      <div className="mt-6 bg-white/20 backdrop-blur-sm rounded-2xl p-4 relative z-10">
        <div className="flex items-center justify-between text-white text-sm">
          <div className="flex items-center gap-2">
            <Clock size={16} />
            <span className="font-medium">{isTimerActive ? 'Voting Active' : 'Voting Paused'}</span>
          </div>
          <div className="flex items-center gap-2">
            {hasVoted ? (
              <>
                <CheckCircle size={16} className="text-yellow-300" />
                <span className="font-medium">Vote Submitted!</span>
              </>
            ) : (
              <>
                <Users size={16} />
                <span className="font-medium">Tap to Vote</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
