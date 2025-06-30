'use client';

import React, { useEffect, useState } from 'react';
import { Participant } from '@/types/tournament';
import ParticipantShape from '@/components/ParticipantShape';

interface MatchCelebrationProps {
  winner: Participant;
  isChampion?: boolean;
  onContinue?: () => void;
}

export default function MatchCelebration({
  winner,
  isChampion = false,
  onContinue
}: MatchCelebrationProps) {
  const [showConfetti, setShowConfetti] = useState(false);
  
  useEffect(() => {
    // Delay confetti for a brief moment
    const timer = setTimeout(() => {
      setShowConfetti(true);
    }, 500);
    
    return () => clearTimeout(timer);
  }, []);
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex flex-col items-center justify-center z-50">
      {/* Confetti - simplified version, you might want to use a confetti library */}
      {showConfetti && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-fall"
              style={{
                left: `${Math.random() * 100}%`,
                top: `-50px`,
                width: `${Math.random() * 10 + 5}px`,
                height: `${Math.random() * 10 + 5}px`,
                backgroundColor: [
                  '#f44336', '#e91e63', '#9c27b0', '#673ab7', 
                  '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4',
                  '#009688', '#4caf50', '#8bc34a', '#cddc39',
                  '#ffeb3b', '#ffc107', '#ff9800', '#ff5722'
                ][Math.floor(Math.random() * 16)],
                animationDelay: `${Math.random() * 5}s`,
                animationDuration: `${Math.random() * 5 + 5}s`
              }}
            />
          ))}
        </div>
      )}

      <div className="bg-gradient-to-br from-indigo-900 to-purple-900 p-10 rounded-lg max-w-md w-full text-center shadow-2xl">
        <h2 className="text-3xl font-bold text-white mb-4">
          {isChampion ? 'TOURNAMENT CHAMPION!' : 'WINNER!'}
        </h2>
        
        <div className="flex justify-center mb-6">
          <div className="relative">
            <ParticipantShape 
              visualId={winner.visualId} 
              size="xxl"
            />
            
            {isChampion && (
              <div className="absolute -top-4 -right-4 text-4xl">
                👑
              </div>
            )}
          </div>
        </div>
        
        <h3 className="text-2xl font-bold text-white mb-8">
          {winner.name}
        </h3>
        
        {onContinue && (
          <button
            onClick={onContinue}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg text-lg font-bold transition-colors"
          >
            {isChampion ? 'Return to Bracket' : 'Continue'}
          </button>
        )}
      </div>
    </div>
  );
}
