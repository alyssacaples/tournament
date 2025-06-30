import React from 'react';
import ParticipantShape from '@/components/ParticipantShape';
import { Participant } from '@/types/tournament';

interface VoteWinnerCelebrationProps {
  matchWinner: Participant;
}

export default function VoteWinnerCelebration({ matchWinner }: VoteWinnerCelebrationProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-400 to-orange-500 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Celebration decorations */}
      <div className="absolute inset-0">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute text-yellow-300 text-2xl animate-bounce"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${1 + Math.random()}s`
            }}
          >
            🎉
          </div>
        ))}
      </div>

      <div className="text-center relative z-10">
        <div className="text-6xl mb-6 animate-bounce">🏆</div>
        <h1 className="text-4xl font-black text-white mb-4 drop-shadow-2xl">WINNER!</h1>
        
        <div className="bg-white rounded-3xl p-6 shadow-2xl mb-6">
          <div className="flex flex-col items-center gap-4">
            <ParticipantShape 
              visualId={matchWinner.visualId} 
              size="xl" 
              className="transform scale-125 animate-pulse"
            />
            <h2 className="text-3xl font-black text-gray-800">{matchWinner.name}</h2>
          </div>
        </div>

        <p className="text-white text-lg font-bold drop-shadow-lg">
          Returning to tournament...
        </p>
      </div>
    </div>
  );
}
