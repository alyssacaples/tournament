import React from 'react';
import { Users } from 'lucide-react';
import { Tournament } from '@/types/tournament';
import VoteConnectionStatus from './VoteConnectionStatus';

interface VoteWaitingScreenProps {
  tournamentCode: string;
  tournament: Tournament | null;
  isConnected: boolean;
}

export default function VoteWaitingScreen({ 
  tournamentCode, 
  tournament, 
  isConnected 
}: VoteWaitingScreenProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-500 to-blue-600 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 shadow-2xl w-full max-w-md text-center">
        <div className="mb-8">
          <Users className="mx-auto mb-4 text-green-500" size={64} />
          <h1 className="text-3xl font-bold text-gray-800 mb-2">You&apos;re In!</h1>
          <div className="text-2xl font-bold text-green-600 mb-4">Code: {tournamentCode}</div>
          <p className="text-gray-600">Waiting for host to start the tournament...</p>
        </div>

        <div className="space-y-4">
          <div className="bg-blue-50 rounded-xl p-4">
            <p className="text-blue-800 font-medium">Tournament: {tournament?.name}</p>
            <p className="text-blue-600">Participants: {tournament?.participants?.length || 0}</p>
          </div>
          <VoteConnectionStatus isConnected={isConnected} />
        </div>
      </div>
    </div>
  );
}
