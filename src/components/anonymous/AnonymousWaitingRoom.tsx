'use client';

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Users, Wifi, WifiOff, Play, Copy, CheckCircle, QrCode } from 'lucide-react';
import { Tournament } from '@/types/tournament';
import { supabase, getConnectedVotersCount } from '@/utils/supabase';

interface AnonymousWaitingRoomProps {
  tournament: Tournament;
  tournamentCode: string;
  connectedVoters: number;
  onStartTournament: () => void;
  onBack: () => void;
}

const AnonymousWaitingRoom: React.FC<AnonymousWaitingRoomProps> = ({
  tournament,
  tournamentCode,
  connectedVoters,
  onStartTournament,
  onBack
}) => {
  const [realTimeVoters, setRealTimeVoters] = useState(connectedVoters);
  const [isConnected, setIsConnected] = useState(true);
  const [codeCopied, setCodeCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  // Real-time voter count updates
  useEffect(() => {
    if (!supabase) return;

    let voterCountInterval: NodeJS.Timeout;

    // Poll for voter count updates every 2 seconds
    const pollVoterCount = async () => {
      try {
        const count = await getConnectedVotersCount(tournamentCode);
        setRealTimeVoters(count);
      } catch (error) {
        console.error('Error fetching voter count:', error);
      }
    };

    // Initial poll
    pollVoterCount();

    // Set up polling interval
    voterCountInterval = setInterval(pollVoterCount, 2000);

    // Subscribe to real-time updates for voter connections
    const voterChannel = supabase
      .channel(`voters-${tournamentCode}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tournament_voters',
          filter: `tournament_code=eq.${tournamentCode}`
        },
        () => {
          // Refresh voter count when changes occur
          pollVoterCount();
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      if (voterCountInterval) {
        clearInterval(voterCountInterval);
      }
      if (supabase) {
        supabase.removeChannel(voterChannel);
      }
    };
  }, [tournamentCode]);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(tournamentCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy code:', error);
    }
  };

  const currentUrl = typeof window !== 'undefined' ? `${window.location.origin}/vote` : '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 to-indigo-600 flex flex-col items-center justify-center p-6">
      {/* Header */}
      <div className="w-full max-w-2xl mb-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-white/80 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft size={20} />
          <span>Back to Setup</span>
        </button>
      </div>

      {/* Main Content */}
      <div className="w-full max-w-2xl text-center">
        {/* Title */}
        <div className="mb-8">
          <div className="text-6xl mb-4">🏆</div>
          <h1 className="text-4xl font-bold text-white mb-2">{tournament.name}</h1>
          <p className="text-purple-100 text-lg">Voters are joining - ready to start when you are!</p>
        </div>

        {/* Tournament Code Display - Prominent */}
        <div className="bg-white rounded-3xl p-8 shadow-2xl mb-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Tournament Code</h2>
            <p className="text-gray-600">Voters are joining with this code</p>
          </div>

          <div className="bg-gradient-to-r from-purple-100 to-indigo-100 rounded-2xl p-6 mb-6">
            <div className="text-6xl font-black text-purple-600 tracking-widest mb-4 animate-bounce">
              {tournamentCode}
            </div>
            <button
              onClick={handleCopyCode}
              className="flex items-center gap-2 bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg transition-colors mx-auto"
            >
              {codeCopied ? (
                <>
                  <CheckCircle size={18} />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={18} />
                  <span>Copy Code</span>
                </>
              )}
            </button>
          </div>

          {/* Tournament Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="text-center">
              <div className="text-sm text-gray-600">Participants</div>
              <div className="text-2xl font-bold text-blue-600">{tournament.participants.length}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-600">Voters Joined</div>
              <div className="text-2xl font-bold text-green-600">{realTimeVoters}</div>
            </div>
          </div>

          {/* Join Instructions */}
          <div className="text-center">
            <p className="text-gray-800 text-2xl font-bold mb-3">GO THIS URL IN YOUR BROWSER</p>
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-4 mb-3 shadow-lg">
              <p className="text-white font-bold text-xl tracking-wide break-all" 
                 style={{ fontFamily: 'Courier New, Monaco, monospace', textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}>
                {currentUrl}
              </p>
            </div>
          </div>
        </div>

        {/* Status Panel */}
        <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-white">
            {/* Connection Status */}
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                {isConnected ? (
                  <Wifi className="text-green-300" size={24} />
                ) : (
                  <WifiOff className="text-red-300" size={24} />
                )}
              </div>
              <div className="text-lg font-semibold">
                {isConnected ? 'Connected' : 'Disconnected'}
              </div>
              <div className="text-white/70 text-sm">Real-time status</div>
            </div>

            {/* Voter Count */}
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Users className="text-blue-300" size={24} />
              </div>
              <div className="text-3xl font-bold">{realTimeVoters}</div>
              <div className="text-white/70 text-sm">Voters Connected</div>
            </div>

            {/* Participants */}
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Play className="text-yellow-300" size={24} />
              </div>
              <div className="text-3xl font-bold">{tournament.participants.length}</div>
              <div className="text-white/70 text-sm">Participants</div>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 mb-8">
          <h3 className="text-xl font-bold text-white mb-4">Instructions for Voters</h3>
          <div className="text-left text-white/90 space-y-2">
            <p><strong>Step 1:</strong> Open a web browser on your phone or tablet</p>
            <p><strong>Step 2:</strong> Go to <span className="font-mono bg-white/20 px-2 py-1 rounded">{currentUrl}</span></p>
            <p><strong>Step 3:</strong> Enter this tournament code: <span className="font-black text-yellow-300">{tournamentCode}</span></p>
            <p><strong>Step 4:</strong> Wait for the tournament to begin!</p>
          </div>
        </div>

        {/* Start Tournament Button */}
        <div className="space-y-4">
          {realTimeVoters > 0 ? (
            <button
              onClick={onStartTournament}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-4 px-8 rounded-2xl text-xl transition-all duration-300 transform hover:scale-105 shadow-lg"
            >
              <div className="flex items-center justify-center gap-3">
                <Play size={24} />
                <span>Start Tournament</span>
              </div>
            </button>
          ) : (
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4">
              <p className="text-white/70">Waiting for at least 1 voter to join...</p>
            </div>
          )}

          <p className="text-white/60 text-sm">
            You can start the tournament once voters have joined
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-12 text-center">
        <p className="text-white/50 text-sm">
          Tournament ID: {tournament.id} • Max Voters: {tournament.maxVoters || 50}
        </p>
      </div>
    </div>
  );
};

export default AnonymousWaitingRoom;
