'use client';

import React, { useState } from 'react';
import { Match } from '@/types/tournament';
import ParticipantShape from '@/components/ParticipantShape';

interface VoteVotingScreenProps {
  match: Match;
  hasVoted: boolean;
  onVote: (participantId: string) => void;
}

export default function VoteVotingScreen({ match, hasVoted, onVote }: VoteVotingScreenProps) {
  const [selectedParticipant, setSelectedParticipant] = useState<string | null>(null);
  
  const handleVote = (participantId: string) => {
    setSelectedParticipant(participantId);
    onVote(participantId);
  };
  
  if (!match.participant1 || !match.participant2) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-white text-center">
          <h2 className="text-xl font-bold mb-2">Match not ready</h2>
          <p>Waiting for participants...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md">
          <h2 className="text-center text-white text-xl font-bold mb-6">Cast your vote!</h2>
          
          <div className="grid gap-6">
            {/* Participant 1 */}
            <button
              onClick={() => handleVote(match.participant1!.id)}
              disabled={hasVoted}
              className={`
                flex items-center gap-4 p-6 rounded-xl transition-all
                ${hasVoted && selectedParticipant === match.participant1!.id
                  ? 'bg-green-500/30 border-2 border-green-500'
                  : hasVoted
                    ? 'bg-white/10 opacity-50'
                    : 'bg-white/20 hover:bg-white/30 active:scale-95'
                }
              `}
            >
              <div className="flex-shrink-0">
                <ParticipantShape visualId={match.participant1.visualId} size="lg" />
              </div>
              
              <div className="flex-1 text-left">
                <h3 className="text-white text-xl font-bold">
                  {match.participant1.name}
                </h3>
                
                {hasVoted && selectedParticipant === match.participant1.id && (
                  <div className="text-green-400 text-sm mt-1">
                    You voted for this option
                  </div>
                )}
              </div>
            </button>
            
            {/* Participant 2 */}
            <button
              onClick={() => handleVote(match.participant2!.id)}
              disabled={hasVoted}
              className={`
                flex items-center gap-4 p-6 rounded-xl transition-all
                ${hasVoted && selectedParticipant === match.participant2!.id
                  ? 'bg-green-500/30 border-2 border-green-500'
                  : hasVoted
                    ? 'bg-white/10 opacity-50'
                    : 'bg-white/20 hover:bg-white/30 active:scale-95'
                }
              `}
            >
              <div className="flex-shrink-0">
                <ParticipantShape visualId={match.participant2.visualId} size="lg" />
              </div>
              
              <div className="flex-1 text-left">
                <h3 className="text-white text-xl font-bold">
                  {match.participant2.name}
                </h3>
                
                {hasVoted && selectedParticipant === match.participant2.id && (
                  <div className="text-green-400 text-sm mt-1">
                    You voted for this option
                  </div>
                )}
              </div>
            </button>
          </div>
          
          {hasVoted && (
            <div className="mt-6 text-center text-white">
              <div className="text-lg font-bold">Vote received!</div>
              <p className="text-white/70">Waiting for results...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
