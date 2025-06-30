import React from 'react';
import { Clock } from 'lucide-react';
import { Match } from '@/types/tournament';
import ParticipantShape from '@/components/ParticipantShape';
import VoteConnectionStatus from './VoteConnectionStatus';

interface VoteMatchWaitingScreenProps {
  tournamentCode: string;
  nextMatch: Match | null;
  isConnected: boolean;
}

export default function VoteMatchWaitingScreen({ 
  tournamentCode, 
  nextMatch, 
  isConnected 
}: VoteMatchWaitingScreenProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-500 to-red-600 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 shadow-2xl w-full max-w-md text-center">
        <div className="mb-8">
          <Clock className="mx-auto mb-4 text-orange-500" size={64} />
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Tournament In Progress</h1>
          <div className="text-xl font-bold text-orange-600 mb-4">Code: {tournamentCode}</div>
          <p className="text-gray-600">Waiting for match to start...</p>
        </div>

        {nextMatch && (
          <div className="bg-orange-50 rounded-xl p-4 mb-4">
            <p className="text-orange-800 font-medium mb-2">Next Match:</p>
            <div className="flex items-center justify-center gap-4">
              {nextMatch.participant1 && (
                <div className="flex flex-col items-center">
                  <ParticipantShape visualId={nextMatch.participant1.visualId} size="sm" />
                  <span className="text-sm font-medium mt-1">{nextMatch.participant1.name}</span>
                </div>
              )}
              <span className="text-orange-600 font-bold">VS</span>
              {nextMatch.participant2 && (
                <div className="flex flex-col items-center">
                  <ParticipantShape visualId={nextMatch.participant2.visualId} size="sm" />
                  <span className="text-sm font-medium mt-1">{nextMatch.participant2.name}</span>
                </div>
              )}
            </div>
          </div>
        )}

        <VoteConnectionStatus isConnected={isConnected} />
      </div>
    </div>
  );
}
