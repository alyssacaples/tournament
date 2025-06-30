'use client';

import React from 'react';
import { Participant } from '@/types/tournament';
import ParticipantShape from '@/components/ParticipantShape';
import { Trophy, Home } from 'lucide-react';

interface VoteChampionScreenProps {
  champion: Participant;
}

export default function VoteChampionScreen({ champion }: VoteChampionScreenProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="bg-gradient-to-b from-yellow-600/40 to-purple-900/80 backdrop-blur-md rounded-xl p-8 max-w-md w-full text-center">
        <Trophy className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
        
        <h1 className="text-3xl font-bold text-white mb-6">
          Tournament Complete!
        </h1>
        
        <div className="bg-white/10 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-yellow-400 mb-3">
            CHAMPION
          </h2>
          
          <div className="flex flex-col items-center">
            <div className="mb-3">
              <ParticipantShape visualId={champion.visualId} size="xl" />
            </div>
            
            <h3 className="text-2xl font-bold text-white">
              {champion.name}
            </h3>
          </div>
        </div>
        
        <div className="animate-pulse">
          <div className="text-yellow-400 mb-2">Thanks for participating!</div>
        </div>
        
        <button
          onClick={() => window.location.href = '/'}
          className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded text-white"
        >
          <Home size={18} />
          <span>Return Home</span>
        </button>
      </div>
    </div>
  );
}
