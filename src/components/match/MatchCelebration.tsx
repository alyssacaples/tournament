import React from 'react';
import { Trophy } from 'lucide-react';
import ParticipantShape from '../ParticipantShape';
import { Participant } from '@/types/tournament';

interface MatchCelebrationProps {
  winner: Participant;
  isChampion?: boolean;
}

export default function MatchCelebration({ winner, isChampion = false }: MatchCelebrationProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-400 to-orange-500 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Celebration decorations */}
      <div className="absolute inset-0">
        {[...Array(30)].map((_, i) => (
          <div
            key={i}
            className="absolute text-yellow-300 text-2xl animate-bounce"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${1 + Math.random() * 2}s`
            }}
          >
            {Math.random() > 0.5 ? '🎉' : '✨'}
          </div>
        ))}
      </div>

      <div className="text-center relative z-10">
        <div className="text-8xl mb-6 animate-bounce">🏆</div>
        <h1 className="text-6xl font-black text-white mb-4 drop-shadow-2xl">
          {isChampion ? 'CHAMPION!' : 'WINNER!'}
        </h1>
        
        <div className="bg-white rounded-3xl p-8 shadow-2xl mb-6 transform hover:scale-105 transition-transform">
          <div className="flex flex-col items-center gap-6">
            <ParticipantShape 
              visualId={winner.visualId} 
              size="xl" 
              className="transform scale-150 animate-pulse"
            />
            <h2 className="text-4xl font-black text-gray-800">{winner.name}</h2>
          </div>
        </div>

        <p className="text-white text-2xl font-bold drop-shadow-lg">
          {isChampion ? 'Tournament Complete!' : 'Advancing to next round...'}
        </p>
      </div>
    </div>
  );
}
