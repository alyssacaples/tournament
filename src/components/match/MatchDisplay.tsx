'use client';

import React from 'react';
import { Match } from '@/types/tournament';
import ParticipantShape from '@/components/ParticipantShape';

interface MatchDisplayProps {
  currentMatch: Match;
  liveTallies?: Record<string, number>;
  totalVotes?: number;
  connectedVoters?: number;
  tournamentCode?: string;
}

export default function MatchDisplay({
  currentMatch,
  liveTallies = {},
  totalVotes = 0,
  connectedVoters = 0,
  tournamentCode
}: MatchDisplayProps) {
  const participant1 = currentMatch.participant1;
  const participant2 = currentMatch.participant2;
  
  if (!participant1 || !participant2) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-white text-2xl">Match not available</div>
      </div>
    );
  }
  
  // Calculate vote percentages
  const votes1 = liveTallies[participant1.id] || 0;
  const votes2 = liveTallies[participant2.id] || 0;
  const percent1 = totalVotes > 0 ? Math.round((votes1 / totalVotes) * 100) : 0;
  const percent2 = totalVotes > 0 ? Math.round((votes2 / totalVotes) * 100) : 0;
  
  return (
    <div className="flex-1 flex flex-col p-8">
      {/* Match info */}
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-white">
          Round {currentMatch.round}, Match {currentMatch.position + 1}
        </h2>
        {tournamentCode && (
          <div className="flex justify-center items-center mt-2">
            <div className="bg-yellow-400 text-black px-2 py-0.5 rounded text-xs font-bold">
              CODE: {tournamentCode}
            </div>
            <div className="ml-4 flex items-center text-white/60 text-sm">
              <span className="bg-green-500 h-2 w-2 rounded-full inline-block mr-1"></span>
              {connectedVoters} voters
            </div>
          </div>
        )}
      </div>
      
      {/* Match display */}
      <div className="flex-1 flex flex-col sm:flex-row items-center justify-center">
        {/* Participant 1 */}
        <div className="flex-1 flex flex-col items-center p-6">
          <div className="relative">
            <ParticipantShape 
              visualId={participant1.visualId} 
              size="xl"
            />
            
            {tournamentCode && (
              <div className="absolute -bottom-2 bg-blue-600 px-2 py-0.5 rounded-full text-white text-xs">
                {votes1} votes ({percent1}%)
              </div>
            )}
          </div>
          <h3 className="mt-4 text-white text-xl font-bold">{participant1.name}</h3>
        </div>
        
        {/* VS */}
        <div className="py-4 px-10">
          <div className="bg-white/10 rounded-full px-6 py-2 text-white/90 font-bold">
            VS
          </div>
        </div>
        
        {/* Participant 2 */}
        <div className="flex-1 flex flex-col items-center p-6">
          <div className="relative">
            <ParticipantShape 
              visualId={participant2.visualId} 
              size="xl"
            />
            
            {tournamentCode && (
              <div className="absolute -bottom-2 bg-blue-600 px-2 py-0.5 rounded-full text-white text-xs">
                {votes2} votes ({percent2}%)
              </div>
            )}
          </div>
          <h3 className="mt-4 text-white text-xl font-bold">{participant2.name}</h3>
        </div>
      </div>
    </div>
  );
}
