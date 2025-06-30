'use client';

import React, { useEffect, useState } from 'react';
import { Tournament } from '@/types/tournament';
import { supabase, createTournamentInDB, subscribeTournamentVoters } from '@/utils/supabase';
import { ChevronLeft, Users, Share2, Play } from 'lucide-react';

interface AnonymousWaitingRoomProps {
  tournament: Tournament;
  tournamentCode: string;
  connectedVoters: number;
  onStartTournament: () => void;
  onGoBack: () => void;
}

export default function AnonymousWaitingRoom({
  tournament,
  tournamentCode,
  connectedVoters,
  onStartTournament,
  onGoBack
}: AnonymousWaitingRoomProps) {
  const [isCreatingTournament, setIsCreatingTournament] = useState(true);
  const [voters, setVoters] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  // Create tournament in database
  useEffect(() => {
    const setupTournament = async () => {
      try {
        setIsCreatingTournament(true);
        await createTournamentInDB(tournamentCode, tournament, tournament.participants);
        setIsCreatingTournament(false);
      } catch (err) {
        console.error('Failed to create tournament:', err);
        setError('Failed to create tournament. Please try again.');
        setIsCreatingTournament(false);
      }
    };
    
    setupTournament();
  }, [tournamentCode, tournament]);
  
  // Subscribe to voter count updates
  useEffect(() => {
    let subscription: any;
    
    const setupSubscription = async () => {
      try {
        subscription = await subscribeTournamentVoters(tournamentCode, (count) => {
          setVoters(count);
        });
      } catch (err) {
        console.error('Failed to subscribe to voters:', err);
      }
    };
    
    setupSubscription();
    
    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [tournamentCode]);
  
  // Share tournament code
  const handleShareCode = () => {
    if (navigator.share) {
      navigator.share({
        title: `Join ${tournament.name}`,
        text: `Join my tournament: ${tournament.name}. Use code: ${tournamentCode}`,
        url: `${window.location.origin}/vote?code=${tournamentCode}`
      });
    } else {
      // Fallback
      navigator.clipboard.writeText(`${window.location.origin}/vote?code=${tournamentCode}`);
      alert('Tournament link copied to clipboard!');
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="p-4 flex items-center justify-between">
        <button 
          onClick={onGoBack}
          className="flex items-center gap-2 text-white hover:text-gray-300 transition-colors"
        >
          <ChevronLeft size={20} />
          <span>Back to Home</span>
        </button>
      </div>
      
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-8 max-w-md w-full">
          <h1 className="text-3xl font-bold text-center text-white mb-2">
            {tournament.name}
          </h1>
          
          <div className="text-center mb-8">
            <p className="text-white/70">
              Tournament created successfully
            </p>
          </div>
          
          {error && (
            <div className="bg-red-500/20 border border-red-500 text-white p-4 rounded-lg mb-6">
              {error}
            </div>
          )}
          
          <div className="bg-white/5 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-center text-white mb-4">
              Tournament Code
            </h2>
            
            <div className="flex justify-center mb-4">
              <div className="bg-yellow-500 px-6 py-3 rounded-lg">
                <p className="text-4xl font-mono font-bold tracking-widest">
                  {tournamentCode}
                </p>
              </div>
            </div>
            
            <p className="text-center text-white/70 text-sm mb-4">
              Share this code with voters to join at:
              <br />
              <span className="font-semibold">{window.location.origin}/vote</span>
            </p>
            
            <button 
              onClick={handleShareCode} 
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded transition-colors"
            >
              <Share2 size={18} />
              <span>Share Tournament Link</span>
            </button>
          </div>
          
          <div className="flex items-center justify-center gap-2 mb-8">
            <Users size={24} className="text-blue-400" />
            <span className="text-xl font-bold text-white">{voters}</span>
            <span className="text-white/70">voters connected</span>
          </div>
          
          <button
            onClick={onStartTournament}
            disabled={isCreatingTournament}
            className={`w-full flex items-center justify-center gap-2 py-3 px-6 rounded-lg text-lg font-bold
              ${isCreatingTournament
                ? 'bg-gray-500 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700 transition-colors'
              }
            `}
          >
            <Play size={20} />
            <span>Start Tournament</span>
          </button>
        </div>
      </div>
    </div>
  );
}
